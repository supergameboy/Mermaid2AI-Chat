/**
 * Canvas — Mermaid 反向编辑器核心画布组件
 *
 * 职责：管理 React Flow 画布状态，处理用户交互，通过回调通知外部
 *
 * 数据流设计（单向，无循环）：
 * - 服务端同步：syncNodes/syncEdges/syncDirection → useEffect → React Flow state
 * - 本地操作：React Flow state → ref → onCanvasEdit 回调 → 外部发送到服务端
 *
 * 不包含 WebSocket 逻辑，由外部通过 props 注入状态和回调
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type Node,
  type Edge,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import {
  serializeMermaid,
  type MermaidShapeType,
  type MermaidNode,
  type MermaidEdge,
  type FlowchartDirection,
} from '@mermaid-editor/serializer';
import type { CanvasProps, CanvasSnapshot } from './types.js';
import { nodeTypes } from './nodes/mermaid-nodes.js';
import { edgeTypes } from './edges/mermaid-edge.js';
import { Toolbar } from './components/toolbar.js';
import { NodeLibrary } from './components/node-library.js';
import { ConsumedBadge } from './components/consumed-badge.js';
import { ConnectionStatus } from './components/connection-status.js';
import { PropertyPanel } from './components/property-panel.js';
import { InlineEditor } from './components/inline-editor.js';
import { CodeEditor } from './components/code-editor.js';
import './styles.css';

let nodeIdCounter = 0;
function generateNodeId(): string {
  return `node_${Date.now()}_${nodeIdCounter++}`;
}

// React Flow 内部测量变化类型（非用户操作，不应触发 canvas_edit）
const INTERNAL_CHANGE_TYPES = new Set(['measured', 'dimensions']);

function CanvasInner(props: CanvasProps) {
  const {
    syncNodes,
    syncEdges,
    syncDirection,
    syncViewport,
    consumed,
    canvasSource,
    lastConsumedAt,
    connectionStatus,
    onCanvasEdit,
    onDirectionChange,
    onResetConsumed,
    onViewportChange,
  } = props;

  const reactFlow = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState<MermaidNode>(syncNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<MermaidEdge>(syncEdges);

  // 选中节点/边的 ID（用于属性面板，从 nodes/edges 派生选中对象，确保单一数据源）
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // 内联编辑状态
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null);

  // ref 保存最新 React Flow state，供 onCanvasEdit 读取
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const directionRef = useRef(syncDirection);
  nodesRef.current = nodes;
  edgesRef.current = edges;
  directionRef.current = syncDirection;

  // 标记视口同步来源，避免本地 onMove → viewport_edit → viewport_update → setViewport 循环
  const isApplyingRemoteViewport = useRef(false);

  // 服务端同步 → React Flow state
  useEffect(() => {
    setNodes(syncNodes);
  }, [syncNodes, setNodes]);

  useEffect(() => {
    setEdges(syncEdges);
  }, [syncEdges, setEdges]);

  // 服务端视口同步 → React Flow viewport（null 表示无同步需求，如初始连接前）
  useEffect(() => {
    if (syncViewport === null) return;
    isApplyingRemoteViewport.current = true;
    reactFlow.setViewport({ x: syncViewport.x, y: syncViewport.y, zoom: syncViewport.zoom });
    // 异步清除标记，确保 onMove 触发时能识别为远程同步
    requestAnimationFrame(() => {
      isApplyingRemoteViewport.current = false;
    });
  }, [syncViewport, reactFlow]);

  // 构建当前画布快照
  const getCanvasSnapshot = useCallback((): CanvasSnapshot => {
    return {
      nodes: nodesRef.current,
      edges: edgesRef.current,
      direction: directionRef.current,
    };
  }, []);

  // 节点变化处理（过滤内部测量变化）
  const handleNodesChange = useCallback(
    (changes: NodeChange<MermaidNode>[]) => {
      onNodesChange(changes);
      const hasUserChange = changes.some((c) => !INTERNAL_CHANGE_TYPES.has(c.type));
      if (hasUserChange) {
        setTimeout(() => {
          onCanvasEdit(getCanvasSnapshot());
        }, 0);
      }
    },
    [onNodesChange, onCanvasEdit, getCanvasSnapshot]
  );

  // 边变化处理
  const handleEdgesChange = useCallback(
    (changes: EdgeChange<MermaidEdge>[]) => {
      onEdgesChange(changes);
      const hasUserChange = changes.some((c) => !INTERNAL_CHANGE_TYPES.has(c.type));
      if (hasUserChange) {
        setTimeout(() => {
          onCanvasEdit(getCanvasSnapshot());
        }, 0);
      }
    },
    [onEdgesChange, onCanvasEdit, getCanvasSnapshot]
  );

  // 连接处理
  const onConnect = useCallback(
    (connection: Connection) => {
      const newEdge: MermaidEdge = {
        ...connection,
        id: `edge_${Date.now()}`,
        type: 'smoothstep',
        data: { edgeStyle: 'arrow' },
      };
      setEdges((eds) => addEdge(newEdge, eds));
      setTimeout(() => {
        onCanvasEdit(getCanvasSnapshot());
      }, 0);
    },
    [setEdges, onCanvasEdit, getCanvasSnapshot]
  );

  // 从节点库创建节点
  const addNodeFromLibrary = useCallback(
    (shape: MermaidShapeType) => {
      const newNode: MermaidNode = {
        id: generateNodeId(),
        type: shape,
        position: { x: Math.random() * 300 + 100, y: Math.random() * 200 + 100 },
        data: {
          label: '新节点',
          shape,
        },
      };
      setNodes((nds) => [...nds, newNode]);
      setTimeout(() => {
        onCanvasEdit(getCanvasSnapshot());
      }, 0);
    },
    [setNodes, onCanvasEdit, getCanvasSnapshot]
  );

  // 双击节点 → 进入编辑模式
  const onNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node) => {
    setEditingNodeId(node.id);
    setEditingEdgeId(null);
  }, []);

  // 双击边 → 进入编辑模式
  const onEdgeDoubleClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setEditingEdgeId(edge.id);
    setEditingNodeId(null);
  }, []);

  // 确认节点文本编辑
  const confirmNodeEdit = useCallback((nodeId: string, newLabel: string) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, label: newLabel } } : n))
    );
    setEditingNodeId(null);
    setTimeout(() => {
      onCanvasEdit(getCanvasSnapshot());
    }, 0);
  }, [setNodes, onCanvasEdit, getCanvasSnapshot]);

  // 确认边标签编辑
  const confirmEdgeEdit = useCallback((edgeId: string, newLabel: string) => {
    setEdges((eds) =>
      eds.map((e) => (e.id === edgeId ? { ...e, data: { ...e.data, label: newLabel || undefined } } : e))
    );
    setEditingEdgeId(null);
    setTimeout(() => {
      onCanvasEdit(getCanvasSnapshot());
    }, 0);
  }, [setEdges, onCanvasEdit, getCanvasSnapshot]);

  // 选中变化 → 更新选中 ID（属性面板从 nodes/edges 派生选中对象）
  const onSelectionChange = useCallback(({ nodes: selNodes, edges: selEdges }: { nodes: Node[]; edges: Edge[] }) => {
    setSelectedNodeId(selNodes.length === 1 ? selNodes[0].id : null);
    setSelectedEdgeId(selEdges.length === 1 ? selEdges[0].id : null);
  }, []);

  // 视口变化（用户平移/缩放）→ 通知外部发送 viewport_edit
  // 跳过远程同步触发的 onMove，避免循环
  const onMove = useCallback(
    (_event: unknown, viewport: { x: number; y: number; zoom: number }) => {
      if (isApplyingRemoteViewport.current) return;
      onViewportChange({ x: viewport.x, y: viewport.y, zoom: viewport.zoom });
    },
    [onViewportChange]
  );

  // 属性面板更新节点（合并为一次 setNodes 调用，同时更新 type 和 data）
  const handleUpdateNode = useCallback((id: string, data: Partial<MermaidNode['data']>) => {
    setNodes((nds) => nds.map((n) => {
      if (n.id !== id) return n;
      const newData = { ...n.data, ...data };
      // 形状变化时同步更新 type 字段
      const newType = data.shape ?? n.type;
      return { ...n, type: newType, data: newData };
    }));
    setTimeout(() => {
      onCanvasEdit(getCanvasSnapshot());
    }, 0);
  }, [setNodes, onCanvasEdit, getCanvasSnapshot]);

  // 属性面板更新边
  const handleUpdateEdge = useCallback((id: string, data: Partial<MermaidEdge['data']>) => {
    setEdges((eds) => eds.map((e) => (e.id === id ? { ...e, data: { ...e.data, ...data } } : e)));
    setTimeout(() => {
      onCanvasEdit(getCanvasSnapshot());
    }, 0);
  }, [setEdges, onCanvasEdit, getCanvasSnapshot]);

  // Delete 键删除选中元素
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // 不在输入框中时才触发删除
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') {
          return;
        }
        const selectedNodes = nodesRef.current.filter((n) => n.selected);
        const selectedEdges = edgesRef.current.filter((e) => e.selected);
        if (selectedNodes.length > 0 || selectedEdges.length > 0) {
          e.preventDefault();
          reactFlow.deleteElements({
            nodes: selectedNodes.map((n) => ({ id: n.id })),
            edges: selectedEdges.map((e) => ({ id: e.id })),
          });
          setTimeout(() => {
            onCanvasEdit(getCanvasSnapshot());
          }, 0);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [reactFlow, onCanvasEdit, getCanvasSnapshot]);

  // 为编辑中的节点/边准备数据
  const editingNode = editingNodeId ? nodes.find((n) => n.id === editingNodeId) : null;
  const editingEdge = editingEdgeId ? edges.find((e) => e.id === editingEdgeId) : null;

  // 从 nodes/edges 派生选中对象（单一数据源，属性面板始终反映最新状态）
  const selectedNode = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) ?? null : null;
  const selectedEdge = selectedEdgeId ? edges.find((e) => e.id === selectedEdgeId) ?? null : null;

  // 实时序列化画布为 Mermaid 代码（供左侧代码编辑器显示，设计依据：模块3 L145-191）
  const mermaidCode = useMemo(() => {
    const result = serializeMermaid({ nodes, edges, direction: syncDirection });
    return result.mermaid;
  }, [nodes, edges, syncDirection]);

  return (
    <div className="app-container">
      {/* 顶部工具栏 */}
      <Toolbar
        direction={syncDirection}
        onDirectionChange={(dir) => {
          directionRef.current = dir;
          onDirectionChange(dir);
          onCanvasEdit({ ...getCanvasSnapshot(), direction: dir });
        }}
      />

      <div className="main-content">
        {/* 左侧面板：代码编辑器（上）+ 节点库（下）— 设计依据：模块3 L145-191 */}
        <div className="left-panel">
          <CodeEditor code={mermaidCode} />
          <NodeLibrary onAddNode={addNodeFromLibrary} />
        </div>

        {/* 画布 */}
        <div className="canvas-container">
          {/* 自定义 SVG marker 定义 — 边样式端点形状 */}
          <svg width="0" height="0" style={{ position: 'absolute' }}>
            <defs>
              {/* 实心箭头 — arrow/dotted-arrow/thick/bidirectional */}
              <marker
                id="mermaid-arrow-marker"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#333" />
              </marker>
              {/* 空心圆 — circle (mermaid ---o) */}
              <marker
                id="mermaid-circle-marker"
                viewBox="0 0 10 10"
                refX="5"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <circle cx="5" cy="5" r="4" stroke="#333" strokeWidth="1.5" fill="none" />
              </marker>
              {/* X 形端点 — cross (mermaid ---x) */}
              <marker
                id="mermaid-cross-marker"
                viewBox="0 0 10 10"
                refX="5"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M 0 0 L 10 10 M 10 0 L 0 10" stroke="#333" strokeWidth="2" fill="none" />
              </marker>
            </defs>
          </svg>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={onConnect}
            onNodeDoubleClick={onNodeDoubleClick}
            onEdgeDoubleClick={onEdgeDoubleClick}
            onSelectionChange={onSelectionChange}
            onMove={onMove}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            deleteKeyCode={null}
            fitView
            defaultEdgeOptions={{
              type: 'smoothstep',
            }}
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>

          {/* 节点内联编辑器 */}
          {editingNode && (
            <div
              className="inline-editor-overlay"
              style={{
                position: 'absolute',
                top: 50,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 1000,
                background: '#fff',
                padding: '8px',
                borderRadius: '4px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              }}
            >
              <InlineEditor
                value={editingNode.data.label}
                onConfirm={(value) => confirmNodeEdit(editingNode.id, value)}
                onCancel={() => setEditingNodeId(null)}
              />
            </div>
          )}

          {/* 边内联编辑器 */}
          {editingEdge && (
            <div
              className="inline-editor-overlay"
              style={{
                position: 'absolute',
                top: 50,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 1000,
                background: '#fff',
                padding: '8px',
                borderRadius: '4px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              }}
            >
              <InlineEditor
                value={editingEdge.data.label ?? ''}
                onConfirm={(value) => confirmEdgeEdit(editingEdge.id, value)}
                onCancel={() => setEditingEdgeId(null)}
              />
            </div>
          )}

          {/* 消费状态徽章 */}
          <ConsumedBadge
            consumed={consumed}
            canvasSource={canvasSource}
            lastConsumedAt={lastConsumedAt}
            onReset={onResetConsumed}
          />

          {/* 连接状态 */}
          <ConnectionStatus status={connectionStatus} />
        </div>

        {/* 右侧属性面板 */}
        <PropertyPanel
          selectedNode={selectedNode}
          selectedEdge={selectedEdge}
          onUpdateNode={handleUpdateNode}
          onUpdateEdge={handleUpdateEdge}
        />
      </div>
    </div>
  );
}

/**
 * Canvas 组件 — 包裹 ReactFlowProvider
 * 外部使用：<Canvas {...canvasProps} />
 */
export function Canvas(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
