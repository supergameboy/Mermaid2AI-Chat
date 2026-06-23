/**
 * GraphCanvas — 图结构类型画布（React Flow）
 *
 * 单一职责：管理 React Flow 画布状态，处理用户交互，通过回调通知外部
 * 支持 7 种图结构类型：flowchart/sequenceDiagram/classDiagram/erDiagram/mindmap/stateDiagram/architecture
 *
 * 数据流设计（单向，无循环）：
 * - 服务端同步：syncNodes/syncEdges/syncDirection → useEffect → React Flow state
 * - 本地操作：React Flow state → ref → onCanvasEdit 回调 → 外部发送到服务端
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useUpdateNodeInternals,
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
  parseMermaid,
  serializeMermaid,
  isGraphCanvasState,
  detectCycle,
  type CanvasState,
  type MermaidShapeType,
  type MermaidNode,
  type MermaidEdge,
  type FlowchartDirection,
  type GraphDiagramType,
  type GraphCanvasState,
  type GraphMetadata,
  type ArchitectureGroupInfo,
  type ArchitectureLayoutHint,
  type ArchitectureEdgeInfo,
} from '@mermaid2aichat/serializer';
import type { CanvasProps, CanvasSnapshot } from './types.js';
import { getNodeTypes, DirectionContext, ConnectionModeContext, type ConnectionMode } from './nodes/index.js';
import { getEdgeTypes } from './edges/index.js';
import { FlowchartEdgeMarkers } from './edges/flowchart/index.js';
import { getLayoutFn } from './layouts/index.js';
import { Toolbar } from './components/toolbar.js';
import { NodeLibrary } from './components/node-library.js';
import { ConsumedBadge } from './components/consumed-badge.js';
import { ConnectionStatus } from './components/connection-status.js';
import { PropertyPanel, type SelectedId } from './components/property-panel.js';
import { ContextMenu } from './components/flowchart/context-menu.js';
import { InlineEditor } from './components/inline-editor.js';
import { CodeEditor } from './components/code-editor.js';
import { MindmapTreePanel, collectDescendantIds } from './components/mindmap/index.js';
import { ArchitectureTreePanel } from './components/architecture/architecture-tree-panel.js';
import { ArchitectureLayoutPanel } from './components/architecture/architecture-layout-panel.js';
// M0: 触发 architecture icon 自动注册到 IconRegistry
import './components/architecture-icon-registration.js';
import './styles.css';

let nodeIdCounter = 0;
function generateNodeId(): string {
  return `node_${Date.now()}_${nodeIdCounter++}`;
}

// React Flow 内部测量变化类型（非用户操作，不应触发 canvas_edit）
const INTERNAL_CHANGE_TYPES = new Set(['measured', 'dimensions']);

/**
 * 将 CanvasState 中的 subgraph 节点映射为 React Flow 'subgraph' 类型
 * 解析器输出的 subgraph 节点 type 为 'rect'，data.isSubgraph 为 true
 * React Flow 需要单独的 'subgraph' 节点类型才能使用 SubgraphNodeComponent 渲染
 */
function mapNodeTypeForFlowchart(node: MermaidNode): MermaidNode {
  const isSubgraph = readField<boolean>(node.data, 'isSubgraph');
  if (isSubgraph) {
    return { ...node, type: 'subgraph' };
  }
  // 普通节点：type 设为 'default'，由 FlowchartNodeComponent 根据 data.shape 分发
  return { ...node, type: 'default' };
}

/** 安全读取 MermaidNodeData 的扩展字段 */
function readField<T>(data: MermaidNode['data'], key: string): T | undefined {
  const value = (data as Record<string, unknown>)[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  return value as T;
}

/** GraphCanvas Props — 继承 CanvasProps，增加 diagramType */
export interface GraphCanvasProps extends CanvasProps {
  /** 图表类型（决定节点/边组件和布局算法） */
  diagramType: GraphDiagramType;
}

function GraphCanvasInner(props: GraphCanvasProps) {
  const {
    syncNodes,
    syncEdges,
    syncDirection,
    syncViewport,
    syncMetadata,
    consumed,
    canvasSource,
    lastConsumedAt,
    connectionStatus,
    onCanvasEdit,
    onCanvasUpdate,
    onDirectionChange,
    onResetConsumed,
    onViewportChange,
    onDiagramTypeChange,
    diagramType,
  } = props;

  const reactFlow = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();

  const [nodes, setNodes, onNodesChange] = useNodesState<MermaidNode>(syncNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<MermaidEdge>(syncEdges);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  /** v4：architecture 选中状态联合类型（替代 selectedGroupId） */
  const [archSelectedId, setArchSelectedId] = useState<SelectedId>(null);
  /** v4：architecture 删除 group 确认对话框状态 */
  const [deleteGroupConfirm, setDeleteGroupConfirm] = useState<{ groupId: string; groupName: string } | null>(null);
  /** M1：flowchart 右键菜单状态 */
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeIds: string[] } | null>(null);

  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const directionRef = useRef(syncDirection);
  /** architecture: metadata 状态（groups 等） */
  const [metadata, setMetadata] = useState<GraphMetadata | undefined>(syncMetadata);
  const metadataRef = useRef(metadata);
  nodesRef.current = nodes;
  edgesRef.current = edges;
  directionRef.current = syncDirection;
  metadataRef.current = metadata;

  const [localDirection, setLocalDirection] = useState<FlowchartDirection>(syncDirection);

  useEffect(() => {
    setLocalDirection(syncDirection);
  }, [syncDirection]);

  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('direction');

  // 根据 diagramType 选择节点/边类型和布局函数
  const nodeTypes = useMemo(() => getNodeTypes(diagramType), [diagramType]);
  const edgeTypes = useMemo(() => getEdgeTypes(diagramType), [diagramType]);
  const layoutFn = useMemo(() => getLayoutFn(diagramType), [diagramType]);

  const handleConnectionModeChange = useCallback(
    (mode: ConnectionMode) => {
      setConnectionMode(mode);
      const edgeType = mode === 'nearest' ? 'floating' : 'smoothstep';
      setEdges((eds) => eds.map((e) => ({ ...e, type: edgeType })));
      setTimeout(() => {
        nodesRef.current.forEach((node) => updateNodeInternals(node.id));
      }, 0);
    },
    [setEdges, updateNodeInternals]
  );

  const isApplyingRemoteViewport = useRef(false);

  useEffect(() => {
    // flowchart 类型需要映射 subgraph 节点类型
    if (diagramType === 'flowchart') {
      setNodes(syncNodes.map(mapNodeTypeForFlowchart));
    } else {
      setNodes(syncNodes);
    }
  }, [syncNodes, setNodes, diagramType]);

  useEffect(() => {
    setEdges(syncEdges);
  }, [syncEdges, setEdges]);

  // architecture: 同步 metadata（groups 等）
  useEffect(() => {
    setMetadata(syncMetadata);
  }, [syncMetadata]);

  // mindmap: 从 nodes 的 parentId 派生 edges（用于 React Flow 渲染，不存储在 CanvasState.edges）
  useEffect(() => {
    if (diagramType !== 'mindmap') return;
    const derivedEdges: MermaidEdge[] = nodes
      .filter((n): n is MermaidNode & { parentId: string } => Boolean(n.parentId))
      .map((n) => ({
        id: `mindmap-edge-${n.id}`,
        source: n.parentId,
        target: n.id,
        type: 'smoothstep',
        data: { edgeStyle: 'line' as const },
      }));
    setEdges(derivedEdges);
  }, [nodes, diagramType, setEdges]);

  useEffect(() => {
    if (syncViewport === null) return;
    isApplyingRemoteViewport.current = true;
    reactFlow.setViewport({ x: syncViewport.x, y: syncViewport.y, zoom: syncViewport.zoom });
    requestAnimationFrame(() => {
      isApplyingRemoteViewport.current = false;
    });
  }, [syncViewport, reactFlow]);

  const getCanvasSnapshot = useCallback((): CanvasSnapshot => {
    // mindmap 的 edges 从 parentId 派生，不存储在 CanvasState.edges 中
    if (diagramType === 'mindmap') {
      return {
        nodes: nodesRef.current,
        edges: [],
        direction: directionRef.current,
      };
    }
    // architecture 需要传递 metadata（groups 等）
    if (diagramType === 'architecture') {
      return {
        nodes: nodesRef.current,
        edges: edgesRef.current,
        direction: directionRef.current,
        ...(metadataRef.current ? { metadata: metadataRef.current } : {}),
      };
    }
    return {
      nodes: nodesRef.current,
      edges: edgesRef.current,
      direction: directionRef.current,
    };
  }, [diagramType]);

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

  const onConnect = useCallback(
    (connection: Connection) => {
      // v4 修复#7：architecture 模式下创建 archEdge 数据，确保新边可序列化
      if (diagramType === 'architecture') {
        const handleIdToDir = (handleId: string | null | undefined): 'L' | 'R' | 'T' | 'B' => {
          switch (handleId) {
            case 'left': return 'L';
            case 'right': return 'R';
            case 'top': return 'T';
            case 'bottom': return 'B';
            default: return 'L';
          }
        };
        const archEdge: ArchitectureEdgeInfo = {
          lhsId: connection.source,
          lhsDir: handleIdToDir(connection.sourceHandle),
          lhsInto: false,
          rhsId: connection.target,
          rhsDir: handleIdToDir(connection.targetHandle),
          rhsInto: true, // 默认有箭头
        };
        const newEdge: MermaidEdge = {
          ...connection,
          id: `edge_${Date.now()}`,
          type: connectionMode === 'nearest' ? 'floating' : 'smoothstep',
          data: { edgeStyle: 'arrow', archEdge },
        };
        setEdges((eds) => addEdge(newEdge, eds));
        setTimeout(() => {
          onCanvasEdit(getCanvasSnapshot());
        }, 0);
        return;
      }
      const newEdge: MermaidEdge = {
        ...connection,
        id: `edge_${Date.now()}`,
        type: connectionMode === 'nearest' ? 'floating' : 'smoothstep',
        data: { edgeStyle: 'arrow' },
      };
      setEdges((eds) => addEdge(newEdge, eds));
      setTimeout(() => {
        onCanvasEdit(getCanvasSnapshot());
      }, 0);
    },
    [setEdges, onCanvasEdit, getCanvasSnapshot, connectionMode, diagramType]
  );

  // ============================================================
  // architecture 节点添加回调（v4 新增）
  // 注意：必须在 addNodeFromLibrary/onDrop 之前定义，因为它们被引用
  // ============================================================

  /** v4：architecture 添加 group（可选父 group ID 实现嵌套） */
  const handleAddGroup = useCallback((parentId?: string) => {
    const groupId = `group_${Date.now()}`;
    const newNode: MermaidNode = {
      id: groupId,
      type: 'arch-group',
      position: { x: Math.random() * 200 + 100, y: Math.random() * 200 + 100 },
      data: {
        label: '新分组',
        shape: 'arch-group',
      },
      ...(parentId ? { parentId, extent: 'parent' as const } : {}),
    };
    // v4 根因修复：group 属性全部通过 nodes[] 表达
    //   - title → node.data.label（已在 newNode.data 中设置）
    //   - in（父 group）→ node.parentId（已在 newNode 中设置）
    //   - metadata.groups 仅保留 id 和可选 icon（作为 group 索引）
    setMetadata((prev) => {
      const newGroup: ArchitectureGroupInfo = { id: groupId };
      const newGroups = [...(prev?.groups ?? []), newGroup];
      return { ...prev, groups: newGroups };
    });
    setNodes((nds) => {
      const newNodes = [...nds, newNode];
      setTimeout(() => {
        onCanvasEdit(getCanvasSnapshot());
      }, 0);
      return newNodes;
    });
    setArchSelectedId({ type: 'group', id: groupId });
  }, [setNodes, setMetadata, onCanvasEdit, getCanvasSnapshot]);

  /** v4：architecture 添加 service（可选所属 group ID） */
  const handleAddService = useCallback((groupId?: string) => {
    const newNode: MermaidNode = {
      id: generateNodeId(),
      type: 'arch-service',
      position: { x: Math.random() * 200 + 100, y: Math.random() * 200 + 100 },
      data: {
        label: '新服务',
        shape: 'arch-service',
        archIcon: 'server',
      },
      ...(groupId ? { parentId: groupId, extent: 'parent' as const } : {}),
    };
    setNodes((nds) => {
      const newNodes = [...nds, newNode];
      setTimeout(() => {
        onCanvasEdit(getCanvasSnapshot());
      }, 0);
      return newNodes;
    });
    setArchSelectedId({ type: 'node', id: newNode.id });
  }, [setNodes, onCanvasEdit, getCanvasSnapshot]);

  /** v4：architecture 添加 junction（可选所属 group ID） */
  const handleAddJunction = useCallback((groupId?: string) => {
    const newNode: MermaidNode = {
      id: generateNodeId(),
      type: 'arch-junction',
      position: { x: Math.random() * 200 + 100, y: Math.random() * 200 + 100 },
      data: {
        label: '连接点',
        shape: 'arch-junction',
        archIsJunction: true,
      },
      ...(groupId ? { parentId: groupId, extent: 'parent' as const } : {}),
    };
    setNodes((nds) => {
      const newNodes = [...nds, newNode];
      setTimeout(() => {
        onCanvasEdit(getCanvasSnapshot());
      }, 0);
      return newNodes;
    });
    setArchSelectedId({ type: 'node', id: newNode.id });
  }, [setNodes, onCanvasEdit, getCanvasSnapshot]);

  const addNodeFromLibrary = useCallback(
    (shape: MermaidShapeType) => {
      // mindmap: 画布为空时创建 root 节点，画布非空时通过树形面板添加子节点
      if (diagramType === 'mindmap') {
        if (nodesRef.current.length > 0) {
          setCodeError('mindmap 已有根节点，请通过树形面板添加子节点');
          return;
        }
        const newNode: MermaidNode = {
          id: generateNodeId(),
          type: 'mindmap-default',
          position: { x: 100, y: 200 },
          data: {
            label: '根节点',
            shape: 'mindmap-default',
            mindmapType: 'default',
            isRoot: true,
          },
        };
        setNodes((nds) => {
          const newNodes = [...nds, newNode];
          setTimeout(() => {
            // mindmap 的 edges 从 parentId 派生，不存储在 CanvasState.edges 中
            onCanvasEdit({
              nodes: newNodes,
              edges: [],
              direction: directionRef.current,
            });
          }, 0);
          return newNodes;
        });
        setCodeError(null);
        return;
      }

      // v4 修复#8：architecture 模式下根据 shape 创建对应类型节点
      if (diagramType === 'architecture') {
        if (shape === 'arch-group') {
          handleAddGroup();
        } else if (shape === 'arch-junction') {
          handleAddJunction();
        } else {
          // arch-service 或其他 shape 统一作为 service
          handleAddService();
        }
        return;
      }

      const newNode: MermaidNode = {
        id: generateNodeId(),
        type: shape,
        position: { x: Math.random() * 300 + 100, y: Math.random() * 200 + 100 },
        data: {
          label: '新节点',
          shape,
        },
      };
      setNodes((nds) => {
        const newNodes = [...nds, newNode];
        setTimeout(() => {
          onCanvasEdit({
            nodes: newNodes,
            edges: edgesRef.current,
            direction: directionRef.current,
          });
        }, 0);
        return newNodes;
      });
    },
    [setNodes, onCanvasEdit, diagramType, handleAddGroup, handleAddService, handleAddJunction]
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const shape = event.dataTransfer.getData('application/mermaid-shape') as MermaidShapeType;
      if (!shape) return;

      // v4 修复#8：architecture 模式下委托给专用处理函数
      // 注意：architecture 节点位置由布局算法决定，不使用拖放位置
      if (diagramType === 'architecture') {
        if (shape === 'arch-group') {
          handleAddGroup();
        } else if (shape === 'arch-junction') {
          handleAddJunction();
        } else {
          handleAddService();
        }
        return;
      }

      const position = reactFlow.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      position.x -= 70;
      position.y -= 25;

      const newNode: MermaidNode = {
        id: generateNodeId(),
        type: shape,
        position,
        data: { label: '新节点', shape },
      };
      setNodes((nds) => {
        const newNodes = [...nds, newNode];
        setTimeout(() => {
          onCanvasEdit({
            nodes: newNodes,
            edges: edgesRef.current,
            direction: directionRef.current,
          });
        }, 0);
        return newNodes;
      });
    },
    [reactFlow, setNodes, onCanvasEdit, diagramType, handleAddGroup, handleAddService, handleAddJunction]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onCanvasDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.classList.contains('react-flow__pane')) return;

      // mindmap: 画布为空时创建 root 节点，画布非空时通过树形面板添加子节点
      if (diagramType === 'mindmap') {
        if (nodesRef.current.length > 0) {
          setCodeError('mindmap 已有根节点，请通过树形面板添加子节点');
          return;
        }
        const position = reactFlow.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });
        const newNode: MermaidNode = {
          id: generateNodeId(),
          type: 'mindmap-default',
          position,
          data: {
            label: '根节点',
            shape: 'mindmap-default',
            mindmapType: 'default',
            isRoot: true,
          },
        };
        setNodes((nds) => {
          const newNodes = [...nds, newNode];
          setTimeout(() => {
            // mindmap 的 edges 从 parentId 派生，不存储在 CanvasState.edges 中
            onCanvasEdit({
              nodes: newNodes,
              edges: [],
              direction: directionRef.current,
            });
          }, 0);
          return newNodes;
        });
        setCodeError(null);
        return;
      }

      // v4 修复#8：architecture 模式下不通过双击创建节点
      // architecture 节点类型有特殊语义（service/junction/group），需通过节点库或树形面板创建
      if (diagramType === 'architecture') {
        setCodeError('architecture 请通过左侧节点库或树形面板添加节点');
        return;
      }

      const position = reactFlow.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      const newNode: MermaidNode = {
        id: generateNodeId(),
        type: 'rect',
        position,
        data: { label: '新节点', shape: 'rect' },
      };
      setNodes((nds) => {
        const newNodes = [...nds, newNode];
        setTimeout(() => {
          onCanvasEdit({
            nodes: newNodes,
            edges: edgesRef.current,
            direction: directionRef.current,
          });
        }, 0);
        return newNodes;
      });
    },
    [reactFlow, setNodes, onCanvasEdit, diagramType]
  );

  const onNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node) => {
    setEditingNodeId(node.id);
    setEditingEdgeId(null);
  }, []);

  const onEdgeDoubleClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setEditingEdgeId(edge.id);
    setEditingNodeId(null);
  }, []);

  const confirmNodeEdit = useCallback((nodeId: string, newLabel: string) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, label: newLabel } } : n))
    );
    setEditingNodeId(null);
    setTimeout(() => {
      onCanvasEdit(getCanvasSnapshot());
    }, 0);
  }, [setNodes, onCanvasEdit, getCanvasSnapshot]);

  const confirmEdgeEdit = useCallback((edgeId: string, newLabel: string) => {
    setEdges((eds) =>
      eds.map((e) => (e.id === edgeId ? { ...e, data: { ...e.data, label: newLabel || undefined } } : e))
    );
    setEditingEdgeId(null);
    setTimeout(() => {
      onCanvasEdit(getCanvasSnapshot());
    }, 0);
  }, [setEdges, onCanvasEdit, getCanvasSnapshot]);

  const handleCodeChange = useCallback((code: string) => {
    // M0: 统一使用 parseMermaid（自动检测图类型，支持空代码）
    const result = parseMermaid(code);
    if (!result.success) {
      setCodeError(result.errors.map((e) => e.message).join('; '));
      return;
    }

    const newCanvas = result.canvas;

    // 图类型变更：交给 onCanvasUpdate 处理（切换画布）
    if (newCanvas.diagramType !== diagramType) {
      if (onCanvasUpdate) {
        onCanvasUpdate(newCanvas);
        setCodeError(null);
      } else {
        setCodeError(`图表类型变更需要 onCanvasUpdate 回调`);
      }
      return;
    }

    // 同类型更新：应用解析结果到当前画布
    if (isGraphCanvasState(newCanvas)) {
      const { nodes, edges, direction, metadata: newMetadata } = newCanvas;
      const safeDirection = direction ?? 'TD';

      // flowchart 需要映射 subgraph 节点类型
      const mappedNodes = diagramType === 'flowchart'
        ? nodes.map(mapNodeTypeForFlowchart)
        : nodes;

      // 使用 dagre 布局计算节点位置（解析器输出的节点 position 可能为 0,0 导致重叠）
      const layouted = layoutFn(mappedNodes, edges, safeDirection, newMetadata);
      const layoutedNodes = diagramType === 'flowchart'
        ? layouted.nodes.map(mapNodeTypeForFlowchart)
        : layouted.nodes;

      setNodes(layoutedNodes);
      setEdges(layouted.edges);
      setLocalDirection(safeDirection);
      directionRef.current = safeDirection;
      if (newMetadata) {
        setMetadata(newMetadata);
      }
      setCodeError(null);

      setTimeout(() => {
        // mindmap 的 edges 从 parentId 派生，CanvasState.edges 为空数组
        const effectiveEdges = diagramType === 'mindmap' ? [] : layouted.edges;
        onCanvasEdit({
          nodes: layoutedNodes,
          edges: effectiveEdges,
          direction: safeDirection,
          ...(newMetadata ? { metadata: newMetadata } : {}),
        });
      }, 0);
    } else {
      setCodeError('内部错误：类型守卫不匹配');
    }
  }, [setNodes, setEdges, setLocalDirection, setMetadata, onCanvasEdit, diagramType, onCanvasUpdate, layoutFn]);

  const onSelectionChange = useCallback(({ nodes: selNodes, edges: selEdges }: { nodes: Node[]; edges: Edge[] }) => {
    setSelectedNodeId(selNodes.length === 1 ? selNodes[0].id : null);
    setSelectedEdgeId(selEdges.length === 1 ? selEdges[0].id : null);

    // v4：architecture 使用联合类型选中状态
    if (diagramType === 'architecture') {
      if (selNodes.length === 1) {
        const selectedNode = selNodes[0];
        // 检测是否为 group 节点（arch-group 类型或 shape === 'arch-group'）
        const isGroup = selectedNode.type === 'arch-group'
          || (selectedNode.data as Record<string, unknown>).shape === 'arch-group';
        if (isGroup) {
          setArchSelectedId({ type: 'group', id: selectedNode.id });
        } else {
          setArchSelectedId({ type: 'node', id: selectedNode.id });
        }
      } else if (selEdges.length === 1) {
        setArchSelectedId({ type: 'edge', id: selEdges[0].id });
      } else {
        setArchSelectedId(null);
      }
    }
  }, [diagramType]);

  const onMove = useCallback(
    (_event: unknown, viewport: { x: number; y: number; zoom: number }) => {
      if (isApplyingRemoteViewport.current) return;
      onViewportChange({ x: viewport.x, y: viewport.y, zoom: viewport.zoom });
    },
    [onViewportChange]
  );

  const handleUpdateNode = useCallback((id: string, data: Partial<MermaidNode['data']>) => {
    setNodes((nds) => nds.map((n) => {
      if (n.id !== id) return n;
      const newData = { ...n.data, ...data };
      const newType = data.shape ?? n.type;
      return { ...n, type: newType, data: newData };
    }));
    setTimeout(() => {
      onCanvasEdit(getCanvasSnapshot());
    }, 0);
  }, [setNodes, onCanvasEdit, getCanvasSnapshot]);

  const handleUpdateEdge = useCallback((id: string, data: Partial<MermaidEdge['data']>) => {
    setEdges((eds) => eds.map((e) => (e.id === id ? { ...e, data: { ...e.data, ...data } } : e)));
    setTimeout(() => {
      onCanvasEdit(getCanvasSnapshot());
    }, 0);
  }, [setEdges, onCanvasEdit, getCanvasSnapshot]);

  // ============================================================
  // mindmap 树形操作（M6 新增）
  // ============================================================

  /** 添加子节点：在选中节点下创建新子节点 */
  const handleAddChild = useCallback((parentId: string) => {
    const parentNode = nodesRef.current.find((n) => n.id === parentId);
    const parentX = parentNode?.position.x ?? 0;
    const parentY = parentNode?.position.y ?? 0;
    const newNode: MermaidNode = {
      id: generateNodeId(),
      type: 'mindmap-default',
      position: { x: parentX + 200, y: parentY + (Math.random() * 100 - 50) },
      data: {
        label: '新节点',
        shape: 'mindmap-default',
        mindmapType: 'default',
      },
      parentId,
      extent: 'parent',
    };
    setNodes((nds) => {
      const newNodes = [...nds, newNode];
      setTimeout(() => {
        // mindmap 的 edges 从 parentId 派生，不存储在 CanvasState.edges 中
        onCanvasEdit({
          nodes: newNodes,
          edges: [],
          direction: directionRef.current,
        });
      }, 0);
      return newNodes;
    });
    setSelectedNodeId(newNode.id);
  }, [setNodes, onCanvasEdit]);

  /** 添加兄弟节点：在选中节点的父节点下创建新子节点 */
  const handleAddSibling = useCallback((nodeId: string) => {
    const currentNode = nodesRef.current.find((n) => n.id === nodeId);
    if (!currentNode) return;
    const parentId = currentNode.parentId;
    if (!parentId) {
      // 根节点没有兄弟节点（mindmap 只能有一个根）
      return;
    }
    const newNode: MermaidNode = {
      id: generateNodeId(),
      type: 'mindmap-default',
      position: {
        x: currentNode.position.x + 50,
        y: currentNode.position.y + 80,
      },
      data: {
        label: '新节点',
        shape: 'mindmap-default',
        mindmapType: 'default',
      },
      parentId,
      extent: 'parent',
    };
    setNodes((nds) => {
      const newNodes = [...nds, newNode];
      setTimeout(() => {
        // mindmap 的 edges 从 parentId 派生，不存储在 CanvasState.edges 中
        onCanvasEdit({
          nodes: newNodes,
          edges: [],
          direction: directionRef.current,
        });
      }, 0);
      return newNodes;
    });
    setSelectedNodeId(newNode.id);
  }, [setNodes, onCanvasEdit]);

  /** 删除 mindmap 节点：递归删除选中节点及其所有子节点 */
  const handleDeleteMindmapNode = useCallback((nodeId: string) => {
    // 构建 parentId → children[] 的映射
    const childrenMap = new Map<string, MermaidNode[]>();
    for (const node of nodesRef.current) {
      const pid = node.parentId ?? '';
      if (pid) {
        const children = childrenMap.get(pid);
        if (children) {
          children.push(node);
        } else {
          childrenMap.set(pid, [node]);
        }
      }
    }
    // 递归收集要删除的节点 ID
    const idsToDelete = collectDescendantIds(nodeId, childrenMap);
    const idSet = new Set(idsToDelete);
    setNodes((nds) => {
      const newNodes = nds.filter((n) => !idSet.has(n.id));
      setTimeout(() => {
        // mindmap 的 edges 从 parentId 派生，不存储在 CanvasState.edges 中
        onCanvasEdit({
          nodes: newNodes,
          edges: [],
          direction: directionRef.current,
        });
      }, 0);
      return newNodes;
    });
    setSelectedNodeId(null);
  }, [setNodes, onCanvasEdit]);

  /** 选中 mindmap 节点 */
  const handleSelectMindmapNode = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
    // 同步 React Flow 选中状态
    setNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === nodeId })));
  }, [setNodes]);

  // ============================================================
  // architecture 操作（M7 新增）
  // ============================================================

  /** architecture: 完整节点更新（含 parentId 等） */
  const handleUpdateNodeFull = useCallback((id: string, updates: Partial<MermaidNode>) => {
    setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, ...updates } : n)));
    setTimeout(() => {
      onCanvasEdit(getCanvasSnapshot());
    }, 0);
  }, [setNodes, onCanvasEdit, getCanvasSnapshot]);

  /** architecture: 完整边更新（含 sourceHandle 等） */
  const handleUpdateEdgeFull = useCallback((id: string, updates: Partial<MermaidEdge>) => {
    setEdges((eds) => eds.map((e) => (e.id === id ? { ...e, ...updates } : e)));
    setTimeout(() => {
      onCanvasEdit(getCanvasSnapshot());
    }, 0);
  }, [setEdges, onCanvasEdit, getCanvasSnapshot]);

  /** architecture: 删除节点（v4：统一回调，支持 options.recursive）
   * v4 决策 11：废弃 handleDeleteNode/handleDeleteGroup/handleRemoveGroupMember，统一到此回调
   * v4 决策 7：group 删除支持两种模式
   *   - recursive=true：递归删除子节点
   *   - recursive=false（默认）：删除 group，子节点 parentId 清除（提升为顶层）
   * group 删除时由 GraphCanvas 弹出确认对话框让用户选择
   *
   * v4 根因修复：合并为单次 onCanvasEdit 调用，避免 stale refs 竞态
   */
  const handleDeleteNodeRecursive = useCallback((id: string, options?: { recursive?: boolean }) => {
    const targetNode = nodesRef.current.find((n) => n.id === id);
    if (!targetNode) return;

    const isGroup = targetNode.type === 'arch-group'
      || (targetNode.data as Record<string, unknown>).shape === 'arch-group';

    // group 删除：检查是否需要弹出确认对话框
    if (isGroup && options === undefined) {
      // 检查是否有子节点
      const hasChildren = nodesRef.current.some((n) => n.parentId === id);
      if (hasChildren) {
        // 弹出确认对话框（由 UI 渲染）
        const groupName = (targetNode.data as Record<string, unknown>).label as string ?? targetNode.id;
        setDeleteGroupConfirm({ groupId: id, groupName });
        return;
      }
      // 无子节点，直接删除
    }

    const recursive = options?.recursive ?? false;

    // 收集要删除的节点 ID
    const idsToDelete = new Set<string>([id]);
    if (recursive) {
      // 递归收集所有后代
      const childrenMap = new Map<string, MermaidNode[]>();
      for (const node of nodesRef.current) {
        const pid = node.parentId ?? '';
        if (pid) {
          const children = childrenMap.get(pid);
          if (children) {
            children.push(node);
          } else {
            childrenMap.set(pid, [node]);
          }
        }
      }
      const descendantIds = collectDescendantIds(id, childrenMap);
      for (const descId of descendantIds) {
        idsToDelete.add(descId);
      }
    }

    // v4 根因修复：同步计算所有新状态，避免多次 onCanvasEdit 竞态
    let newNodes = nodesRef.current.filter((n) => !idsToDelete.has(n.id));
    // 非 recursive 模式：清除子节点的 parentId（提升为顶层）
    if (!recursive) {
      newNodes = newNodes.map((n) => {
        if (n.parentId === id) {
          const { parentId: _p, extent: _e, ...rest } = n;
          void _p;
          void _e;
          return rest;
        }
        return n;
      });
    }
    const newEdges = edgesRef.current.filter(
      (e) => !idsToDelete.has(e.source) && !idsToDelete.has(e.target)
    );
    let newMetadata = metadataRef.current;
    if (isGroup && newMetadata?.groups) {
      newMetadata = { ...newMetadata, groups: newMetadata.groups.filter((g) => g.id !== id) };
    }

    // 一次性更新所有状态
    setNodes(newNodes);
    setEdges(newEdges);
    if (isGroup) {
      setMetadata(newMetadata);
    }
    setArchSelectedId(null);
    setDeleteGroupConfirm(null);

    // 单次 onCanvasEdit 调用，使用计算后的新状态
    setTimeout(() => {
      const snapshot: CanvasSnapshot = {
        nodes: newNodes,
        edges: newEdges,
        direction: directionRef.current,
        ...(newMetadata ? { metadata: newMetadata } : {}),
      };
      onCanvasEdit(snapshot);
    }, 0);
  }, [setNodes, setEdges, setMetadata, onCanvasEdit]);

  /** architecture: 删除边 */
  const handleDeleteEdge = useCallback((id: string) => {
    setEdges((eds) => {
      const newEdges = eds.filter((e) => e.id !== id);
      setTimeout(() => {
        onCanvasEdit(getCanvasSnapshot());
      }, 0);
      return newEdges;
    });
    setSelectedEdgeId(null);
    setArchSelectedId(null);
  }, [setEdges, onCanvasEdit, getCanvasSnapshot]);

  /** v4：architecture 移动节点到其他 group（含循环引用检测）
   * v4 决策 11：替代 handleRemoveGroupMember
   * targetGroupId 为 null 表示移出 group（提升为顶层）
   */
  const handleMoveToGroup = useCallback((nodeId: string, targetGroupId: string | null) => {
    // v4：循环引用检测
    if (detectCycle(nodesRef.current, nodeId, targetGroupId)) {
      setCodeError('无法移动节点到后代 group：会形成循环引用');
      return;
    }

    setNodes((nds) => {
      const newNodes = nds.map((n) => {
        if (n.id !== nodeId) return n;
        if (targetGroupId === null) {
          // 移出 group：清除 parentId 和 extent
          const { parentId: _p, extent: _e, ...rest } = n;
          void _p;
          void _e;
          return rest;
        }
        // 移入 group：设置 parentId 和 extent
        return { ...n, parentId: targetGroupId, extent: 'parent' as const };
      });
      setTimeout(() => {
        onCanvasEdit(getCanvasSnapshot());
      }, 0);
      return newNodes;
    });
    setCodeError(null);
  }, [setNodes, onCanvasEdit, getCanvasSnapshot]);

  // ============================================================
  // architecture 树形编辑回调（v3 新增，v4 修订）
  // 注意：handleAddGroup/handleAddService/handleAddJunction 已移至 addNodeFromLibrary 之前
  // ============================================================

  // ============================================================
  // architecture layout hints 回调（v4 新增）
  // ============================================================

  /** v4：添加 layout hint */
  const handleAddLayoutHint = useCallback((direction: 'row' | 'column', members: string[]) => {
    // v4 修复：同步计算 newMetadata，避免 metadataRef.current 时序问题
    const prev = metadataRef.current;
    const newHint: ArchitectureLayoutHint = { direction, members };
    const newHints = [...(prev?.layoutHints ?? []), newHint];
    const newMetadata = { ...prev, layoutHints: newHints };
    setMetadata(newMetadata);
    setTimeout(() => {
      const snapshot: CanvasSnapshot = {
        nodes: nodesRef.current,
        edges: edgesRef.current,
        direction: directionRef.current,
        metadata: newMetadata,
      };
      onCanvasEdit(snapshot);
    }, 0);
  }, [setMetadata, onCanvasEdit]);

  /** v4：更新 layout hint */
  const handleUpdateLayoutHint = useCallback((index: number, updates: Partial<ArchitectureLayoutHint>) => {
    // v4 修复：同步计算 newMetadata，避免 metadataRef.current 时序问题
    const prev = metadataRef.current;
    if (!prev?.layoutHints) return;
    const newHints = prev.layoutHints.map((h, i) => (i === index ? { ...h, ...updates } : h));
    const newMetadata = { ...prev, layoutHints: newHints };
    setMetadata(newMetadata);
    setTimeout(() => {
      const snapshot: CanvasSnapshot = {
        nodes: nodesRef.current,
        edges: edgesRef.current,
        direction: directionRef.current,
        metadata: newMetadata,
      };
      onCanvasEdit(snapshot);
    }, 0);
  }, [setMetadata, onCanvasEdit]);

  /** v4：删除 layout hint */
  const handleDeleteLayoutHint = useCallback((index: number) => {
    // v4 修复：同步计算 newMetadata，避免 metadataRef.current 时序问题
    const prev = metadataRef.current;
    if (!prev?.layoutHints) return;
    const newHints = prev.layoutHints.filter((_, i) => i !== index);
    const newMetadata = { ...prev, layoutHints: newHints };
    setMetadata(newMetadata);
    setTimeout(() => {
      const snapshot: CanvasSnapshot = {
        nodes: nodesRef.current,
        edges: edgesRef.current,
        direction: directionRef.current,
        metadata: newMetadata,
      };
      onCanvasEdit(snapshot);
    }, 0);
  }, [setMetadata, onCanvasEdit]);

  /** v4：切换成员是否在 layout hint 中 */
  const handleToggleLayoutMember = useCallback((hintIndex: number, nodeId: string) => {
    // v4 修复：同步计算 newMetadata，避免 metadataRef.current 时序问题
    const prev = metadataRef.current;
    if (!prev?.layoutHints) return;
    const newHints = prev.layoutHints.map((h, i) => {
      if (i !== hintIndex) return h;
      const isMember = h.members.includes(nodeId);
      return {
        ...h,
        members: isMember
          ? h.members.filter((id) => id !== nodeId)
          : [...h.members, nodeId],
      };
    });
    const newMetadata = { ...prev, layoutHints: newHints };
    setMetadata(newMetadata);
    setTimeout(() => {
      const snapshot: CanvasSnapshot = {
        nodes: nodesRef.current,
        edges: edgesRef.current,
        direction: directionRef.current,
        metadata: newMetadata,
      };
      onCanvasEdit(snapshot);
    }, 0);
  }, [setMetadata, onCanvasEdit]);

  /** v4：architecture 树形面板选中节点 */
  const handleSelectArchNode = useCallback((nodeId: string) => {
    setArchSelectedId({ type: 'node', id: nodeId });
    setNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === nodeId })));
  }, [setNodes]);

  /** v4：architecture 树形面板选中 group */
  const handleSelectArchGroup = useCallback((groupId: string) => {
    setArchSelectedId({ type: 'group', id: groupId });
    setNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === groupId })));
  }, [setNodes]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') {
          return;
        }
        const selectedNodes = nodesRef.current.filter((n) => n.selected);
        const selectedEdges = edgesRef.current.filter((e) => e.selected);
        if (selectedNodes.length > 0 || selectedEdges.length > 0) {
          e.preventDefault();
          // v4 修复#6：architecture 模式下，group 节点删除走 handleDeleteNodeRecursive
          if (diagramType === 'architecture' && selectedNodes.length === 1) {
            const node = selectedNodes[0];
            const isGroup = node.type === 'arch-group'
              || (node.data as Record<string, unknown>).shape === 'arch-group';
            if (isGroup) {
              // group 删除走 v4 逻辑（会弹出确认对话框）
              handleDeleteNodeRecursive(node.id);
              return;
            }
            // 非 group 节点也走 handleDeleteNodeRecursive（统一删除逻辑）
            handleDeleteNodeRecursive(node.id);
            return;
          }
          // 其他情况使用 reactFlow.deleteElements
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
  }, [reactFlow, onCanvasEdit, getCanvasSnapshot, diagramType, handleDeleteNodeRecursive]);

  // ============================================================
  // M1: flowchart 右键菜单 + subgraph 创建/管理
  // ============================================================

  /** 右键节点 — 显示上下文菜单 */
  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    if (diagramType !== 'flowchart') return;
    event.preventDefault();
    // 获取当前选中的节点 ID 列表
    const selectedIds = nodesRef.current
      .filter((n) => n.selected)
      .map((n) => n.id);
    const nodeIds = selectedIds.length > 0 ? selectedIds : [node.id];
    setContextMenu({ x: event.clientX, y: event.clientY, nodeIds });
  }, [diagramType]);

  /** 右键画布空白 — 显示上下文菜单（无选中节点） */
  const handlePaneContextMenu = useCallback((event: React.MouseEvent | MouseEvent) => {
    if (diagramType !== 'flowchart') return;
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, nodeIds: [] });
  }, [diagramType]);

  /** 创建空 subgraph */
  const handleCreateSubgraph = useCallback(() => {
    const subgraphId = `subgraph_${Date.now()}`;
    const newNode: MermaidNode = {
      id: subgraphId,
      type: 'subgraph',
      position: { x: Math.random() * 200 + 100, y: Math.random() * 200 + 100 },
      data: {
        label: '新子图',
        shape: 'rect',
        isSubgraph: true,
        subgraphNodes: [],
      },
    };
    setNodes((nds) => {
      const newNodes = [...nds, newNode];
      setTimeout(() => onCanvasEdit(getCanvasSnapshot()));
      return newNodes;
    });
    setSelectedNodeId(subgraphId);
  }, [setNodes, onCanvasEdit, getCanvasSnapshot]);

  /** 创建 subgraph 包含选中节点 */
  const handleCreateSubgraphWithSelected = useCallback(() => {
    if (!contextMenu || contextMenu.nodeIds.length === 0) return;
    const subgraphId = `subgraph_${Date.now()}`;
    const selectedNodeIds = contextMenu.nodeIds;

    // 计算选中节点的边界框，定位 subgraph
    const selectedNodes = nodesRef.current.filter((n) => selectedNodeIds.includes(n.id));
    if (selectedNodes.length === 0) return;

    const minX = Math.min(...selectedNodes.map((n) => n.position.x));
    const minY = Math.min(...selectedNodes.map((n) => n.position.y));

    const newNode: MermaidNode = {
      id: subgraphId,
      type: 'subgraph',
      position: { x: minX - 20, y: minY - 40 },
      data: {
        label: '新子图',
        shape: 'rect',
        isSubgraph: true,
        subgraphNodes: selectedNodeIds,
      },
    };

    setNodes((nds) => {
      // 将选中节点的 parentId 设为 subgraphId
      const newNodes = nds.map((n) =>
        selectedNodeIds.includes(n.id)
          ? { ...n, parentId: subgraphId, extent: 'parent' as const }
          : n,
      );
      newNodes.push(newNode);
      setTimeout(() => onCanvasEdit(getCanvasSnapshot()));
      return newNodes;
    });
    setSelectedNodeId(subgraphId);
  }, [contextMenu, setNodes, onCanvasEdit, getCanvasSnapshot]);

  /** 右键菜单切换形状 */
  const handleSwitchShapeFromMenu = useCallback((shape: MermaidShapeType) => {
    if (!contextMenu || contextMenu.nodeIds.length === 0) return;
    const ids = contextMenu.nodeIds;
    setNodes((nds) => {
      const newNodes = nds.map((n) =>
        ids.includes(n.id)
          ? { ...n, data: { ...n.data, shape } }
          : n,
      );
      setTimeout(() => onCanvasEdit(getCanvasSnapshot()));
      return newNodes;
    });
  }, [contextMenu, setNodes, onCanvasEdit, getCanvasSnapshot]);

  /** 移动节点到 subgraph（subgraphId 为 null 表示移出到顶层） */
  const handleMoveToSubgraph = useCallback((nodeId: string, subgraphId: string | null) => {
    setNodes((nds) => {
      const newNodes = nds.map((n) => {
        if (n.id !== nodeId) return n;
        if (subgraphId === null) {
          const { parentId, extent, ...rest } = n;
          return rest;
        }
        return { ...n, parentId: subgraphId, extent: 'parent' as const };
      });
      setTimeout(() => onCanvasEdit(getCanvasSnapshot()));
      return newNodes;
    });
  }, [setNodes, onCanvasEdit, getCanvasSnapshot]);

  /** 删除 subgraph 节点（子节点移出到顶层） */
  const handleDeleteSubgraph = useCallback((id: string) => {
    setNodes((nds) => {
      const newNodes = nds
        .filter((n) => n.id !== id)
        .map((n) => {
          if (n.parentId === id) {
            const { parentId, extent, ...rest } = n;
            return rest;
          }
          return n;
        });
      setTimeout(() => onCanvasEdit(getCanvasSnapshot()));
      return newNodes;
    });
    setSelectedNodeId(null);
  }, [setNodes, onCanvasEdit, getCanvasSnapshot]);

  const editingNode = editingNodeId ? nodes.find((n) => n.id === editingNodeId) : null;
  const editingEdge = editingEdgeId ? edges.find((e) => e.id === editingEdgeId) : null;
  const selectedNode = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) ?? null : null;
  const selectedEdge = selectedEdgeId ? edges.find((e) => e.id === selectedEdgeId) ?? null : null;

  // M0: 统一使用 serializeMermaid 序列化画布为 Mermaid 代码
  const mermaidCode = useMemo(() => {
    const canvas: GraphCanvasState = {
      diagramType,
      nodes,
      edges,
      direction: localDirection,
      ...(metadata ? { metadata } : {}),
    };
    const result = serializeMermaid(canvas);
    return result.mermaid;
  }, [diagramType, nodes, edges, localDirection, metadata]);

  return (
    <div className="app-container">
      <Toolbar
        diagramType={diagramType}
        direction={localDirection}
        mermaidCode={mermaidCode}
        connectionMode={connectionMode}
        onConnectionModeChange={handleConnectionModeChange}
        onDiagramTypeChange={onDiagramTypeChange}
        onDirectionChange={(dir) => {
          setLocalDirection(dir);
          directionRef.current = dir;
          // 使用 diagramType 对应的布局函数
          const { nodes: newNodes, edges: newEdges } = layoutFn(nodesRef.current, edgesRef.current, dir);
          setNodes(newNodes);
          setEdges(newEdges);
          setTimeout(() => {
            newNodes.forEach((node) => updateNodeInternals(node.id));
          }, 0);
          onDirectionChange(dir);
          setTimeout(() => {
            onCanvasEdit({
              nodes: newNodes,
              edges: newEdges,
              direction: dir,
            });
          }, 0);
        }}
      />

      <div className="main-content">
        <div className="left-panel">
          <NodeLibrary diagramType={diagramType} onAddNode={addNodeFromLibrary} />
          {diagramType === 'mindmap' && (
            <MindmapTreePanel
              nodes={nodes}
              selectedNodeId={selectedNodeId}
              onAddChild={handleAddChild}
              onAddSibling={handleAddSibling}
              onDeleteNode={handleDeleteMindmapNode}
              onSelectNode={handleSelectMindmapNode}
            />
          )}
          {diagramType === 'architecture' && (
            <>
              <ArchitectureTreePanel
                nodes={nodes}
                groups={metadata?.groups ?? []}
                selectedId={archSelectedId?.type === 'edge' ? null : archSelectedId}
                onAddGroup={handleAddGroup}
                onAddService={handleAddService}
                onAddJunction={handleAddJunction}
                onDeleteNode={handleDeleteNodeRecursive}
                onMoveToGroup={handleMoveToGroup}
                onSelectNode={handleSelectArchNode}
                onSelectGroup={handleSelectArchGroup}
              />
              <ArchitectureLayoutPanel
                nodes={nodes}
                layoutHints={metadata?.layoutHints ?? []}
                onAddLayoutHint={handleAddLayoutHint}
                onUpdateLayoutHint={handleUpdateLayoutHint}
                onDeleteLayoutHint={handleDeleteLayoutHint}
                onToggleLayoutMember={handleToggleLayoutMember}
              />
            </>
          )}
        </div>

        <div className="canvas-container" onDoubleClick={onCanvasDoubleClick}>
          <svg width="0" height="0" style={{ position: 'absolute' }}>
            <defs>
              {/* flowchart 边 marker（M1 新增，16 种边样式） */}
              <FlowchartEdgeMarkers color="#333333" />

              {/* 旧 marker（其他图表类型使用，将在 M2-M5 替换） */}
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
              {/* class 关系专用 marker */}
              <marker
                id="mermaid-hollow-triangle-marker"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="8"
                markerHeight="8"
                orient="auto"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#fff" stroke="#333" strokeWidth="1" />
              </marker>
              <marker
                id="mermaid-filled-diamond-marker"
                viewBox="0 0 10 10"
                refX="0"
                refY="5"
                markerWidth="8"
                markerHeight="8"
                orient="auto"
              >
                <path d="M 0 5 L 5 0 L 10 5 L 5 10 z" fill="#333" />
              </marker>
              <marker
                id="mermaid-hollow-diamond-marker"
                viewBox="0 0 10 10"
                refX="0"
                refY="5"
                markerWidth="8"
                markerHeight="8"
                orient="auto"
              >
                <path d="M 0 5 L 5 0 L 10 5 L 5 10 z" fill="#fff" stroke="#333" strokeWidth="1" />
              </marker>
            </defs>
          </svg>
          <DirectionContext.Provider value={localDirection}>
            <ConnectionModeContext.Provider value={connectionMode}>
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
                onDrop={onDrop}
                onDragOver={onDragOver}
                onNodeContextMenu={handleNodeContextMenu}
                onPaneContextMenu={handlePaneContextMenu}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                deleteKeyCode={null}
                zoomOnDoubleClick={false}
                fitView
                defaultEdgeOptions={{
                  type: connectionMode === 'nearest' ? 'floating' : 'smoothstep',
                }}
              >
                <Background />
                <Controls />
                <MiniMap />
              </ReactFlow>
            </ConnectionModeContext.Provider>
          </DirectionContext.Provider>

          {contextMenu && (
            <ContextMenu
              position={{ x: contextMenu.x, y: contextMenu.y }}
              selectedNodeIds={contextMenu.nodeIds}
              onCreateSubgraph={handleCreateSubgraph}
              onCreateSubgraphWithSelected={handleCreateSubgraphWithSelected}
              onSwitchShape={handleSwitchShapeFromMenu}
              onClose={() => setContextMenu(null)}
            />
          )}

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

          <ConsumedBadge
            consumed={consumed}
            canvasSource={canvasSource}
            lastConsumedAt={lastConsumedAt}
            onReset={onResetConsumed}
          />

          <ConnectionStatus status={connectionStatus} />
        </div>

        <div className="right-panel">
          <CodeEditor
            code={mermaidCode}
            onCodeChange={handleCodeChange}
            error={codeError}
            diagramType={diagramType}
          />
          <PropertyPanel
            diagramType={diagramType}
            selectedNode={selectedNode}
            selectedEdge={selectedEdge}
            onUpdateNode={handleUpdateNode}
            onUpdateEdge={handleUpdateEdge}
            nodes={nodes}
            groups={metadata?.groups}
            selectedId={archSelectedId}
            onUpdateNodeFull={handleUpdateNodeFull}
            onUpdateEdgeFull={handleUpdateEdgeFull}
            onDeleteNode={handleDeleteNodeRecursive}
            onDeleteEdge={handleDeleteEdge}
            onMoveToGroup={handleMoveToGroup}
            onMoveToSubgraph={handleMoveToSubgraph}
            onDeleteSubgraph={handleDeleteSubgraph}
          />
        </div>

        {deleteGroupConfirm && (
          <div
            className="delete-group-confirm-modal"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2000,
            }}
          >
            <div
              style={{
                background: '#fff',
                padding: 20,
                borderRadius: 8,
                minWidth: 360,
                maxWidth: 480,
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
              }}
            >
              <h3 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 600 }}>
                删除分组「{deleteGroupConfirm.groupName}」
              </h3>
              <p style={{ margin: '0 0 16px 0', fontSize: 13, color: '#555' }}>
                该分组下有子节点，请选择删除方式：
              </p>
              <ul style={{ margin: '0 0 16px 0', fontSize: 13, color: '#555', paddingLeft: 20 }}>
                <li>递归删除：删除分组及其所有子节点</li>
                <li>保留子节点：仅删除分组，子节点提升为顶层</li>
              </ul>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setDeleteGroupConfirm(null)}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid #ddd',
                    borderRadius: 4,
                    background: '#fff',
                    color: '#333',
                    cursor: 'pointer',
                  }}
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteNodeRecursive(deleteGroupConfirm.groupId, { recursive: false })}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid #1677ff',
                    borderRadius: 4,
                    background: '#1677ff',
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  保留子节点
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteNodeRecursive(deleteGroupConfirm.groupId, { recursive: true })}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid #ff4d4f',
                    borderRadius: 4,
                    background: '#ff4d4f',
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  递归删除
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * GraphCanvas 组件 — 包裹 ReactFlowProvider
 * 图结构类型专用画布，根据 diagramType 选择节点/边组件和布局算法
 */
export function GraphCanvas(props: GraphCanvasProps) {
  return (
    <ReactFlowProvider>
      <GraphCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
