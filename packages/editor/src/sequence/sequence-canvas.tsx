/**
 * SequenceCanvas — 时序图画布（专用渲染器，不使用 React Flow）
 *
 * 单一职责：管理时序图画布状态，渲染参与者/生命线/消息/注释/块结构/Box 分组
 *
 * 数据流设计（单向，无循环）：
 * - 服务端同步：syncCanvas → useEffect → 内部 state（nodes/edges/metadata）
 * - 本地操作：内部 state → onCanvasUpdate(CanvasState) → 外部发送到服务端
 *   时序图需要保留 metadata（blocks/notes/boxes），使用 onCanvasUpdate 而非 onCanvasEdit
 *
 * 渲染层次（从底到顶）：
 *   1. Box 分组框（背景层）
 *   2. Block 块结构框（背景层）
 *   3. 生命线（虚线）
 *   4. 激活条
 *   5. 消息箭头
 *   6. 注释框
 *   7. 参与者框（顶层）
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  serializeMermaid,
  parseMermaid,
  isGraphCanvasState,
  type CanvasState,
  type GraphCanvasState,
  type GraphMetadata,
  type MermaidEdge,
  type MermaidNode,
  type SequenceBlockInfo,
  type SequenceBoxInfo,
  type SequenceNoteInfo,
  type SequenceParticipantInfo,
  type DiagramType,
  type FlowchartDirection,
} from '@mermaid2aichat/serializer';
import type { CanvasProps } from '../types.js';
import { Toolbar } from '../components/toolbar.js';
import { NodeLibrary } from '../components/node-library.js';
import { ConsumedBadge } from '../components/consumed-badge.js';
import { ConnectionStatus } from '../components/connection-status.js';
import { CodeEditor } from '../components/code-editor.js';
import { InlineEditor } from '../components/inline-editor.js';
import type { ConnectionMode } from '../nodes/index.js';
import {
  ParticipantRow,
  MessageRow,
  NoteRow,
  BlockFrame,
  BoxFrame,
  Lifeline,
  ActivationBar,
} from './index.js';
import {
  PARTICIPANT_WIDTH,
  PARTICIPANT_LEFT_PADDING,
  PARTICIPANT_SPACING,
  PARTICIPANT_TOP_Y,
  PARTICIPANT_HEIGHT,
  PARTICIPANT_BOTTOM_Y,
  FIRST_MESSAGE_Y,
  MESSAGE_ROW_HEIGHT,
  LIFELINE_BOTTOM_PADDING,
  ACTIVATION_BAR_HEIGHT,
  getParticipantX,
  getMessageY,
} from './layout-constants.js';
import {
  ParticipantEditor,
  MessageEditor,
  NoteEditor,
  BlockEditor,
  BoxEditor,
} from '../components/sequence/index.js';
import '../styles.css';

// ============================================================
// 类型定义
// ============================================================

/** SequenceCanvas Props — 继承 CanvasProps，syncCanvas 为时序图专用 */
export interface SequenceCanvasProps extends CanvasProps {
  /** syncCanvas 是 GraphCanvasState 且 diagramType='sequenceDiagram' */
  syncCanvas: GraphCanvasState;
  /** 时序图必须使用 onCanvasUpdate（传递完整 CanvasState 含 metadata） */
  onCanvasUpdate: (canvas: CanvasState) => void;
}

/** 选中项类型 */
type SelectedType = 'participant' | 'message' | 'note' | 'block' | 'box';

/** 选中项标识 */
interface Selection {
  type: SelectedType;
  /** participant/message 使用 id，note/block/box 使用数组索引 */
  id: string | number;
}

/** 激活范围（某参与者在某消息区间内处于活动状态） */
interface ActivationRange {
  participantId: string;
  startSequence: number;
  endSequence: number;
}

// ============================================================
// 辅助函数
// ============================================================

let participantIdCounter = 0;
function generateParticipantId(): string {
  return `seq_part_${Date.now()}_${participantIdCounter++}`;
}

let messageIdCounter = 0;
function generateMessageId(): string {
  return `seq_msg_${Date.now()}_${messageIdCounter++}`;
}

/** 从 metadata 安全读取 SequenceBoxInfo[] */
function readSequenceBoxes(metadata: GraphMetadata | undefined): SequenceBoxInfo[] {
  if (!metadata) return [];
  const v = (metadata as Record<string, unknown>)['sequenceBoxes'];
  if (!Array.isArray(v)) return [];
  return v as SequenceBoxInfo[];
}

/** 从 metadata 安全读取 createdActors */
function readCreatedActors(metadata: GraphMetadata | undefined): Record<string, number> {
  if (!metadata) return {};
  const v = (metadata as Record<string, unknown>)['createdActors'];
  if (typeof v !== 'object' || v === null) return {};
  return v as Record<string, number>;
}

/** 从 metadata 安全读取 destroyedActors */
function readDestroyedActors(metadata: GraphMetadata | undefined): Record<string, number> {
  if (!metadata) return {};
  const v = (metadata as Record<string, unknown>)['destroyedActors'];
  if (typeof v !== 'object' || v === null) return {};
  return v as Record<string, number>;
}

/** 计算所有参与者的激活范围 */
function computeActivationRanges(edges: MermaidEdge[]): ActivationRange[] {
  const ranges: ActivationRange[] = [];
  const sortedEdges = [...edges].sort((a, b) => {
    const sa = typeof a.data.sequence === 'number' ? a.data.sequence : 0;
    const sb = typeof b.data.sequence === 'number' ? b.data.sequence : 0;
    return sa - sb;
  });

  // 每个参与者的活动起点
  const activeStart = new Map<string, number>();

  for (const edge of sortedEdges) {
    const seq = typeof edge.data.sequence === 'number' ? edge.data.sequence : 0;
    const target = edge.target;

    if (edge.data.activate === true) {
      if (!activeStart.has(target)) {
        activeStart.set(target, seq);
      }
    }

    if (edge.data.deactivate === true) {
      const start = activeStart.get(target);
      if (start !== undefined) {
        ranges.push({
          participantId: target,
          startSequence: start,
          endSequence: seq + 1,
        });
        activeStart.delete(target);
      }
    }
  }

  // 未关闭的激活延伸到最后
  const lastEdge = sortedEdges[sortedEdges.length - 1];
  const lastSeq = lastEdge && typeof lastEdge.data.sequence === 'number'
    ? lastEdge.data.sequence
    : 0;
  for (const [participantId, start] of activeStart) {
    ranges.push({
      participantId,
      startSequence: start,
      endSequence: lastSeq + 1,
    });
  }

  return ranges;
}

/** 计算块结构嵌套深度 */
function computeBlockDepth(block: SequenceBlockInfo, allBlocks: SequenceBlockInfo[]): number {
  let depth = 0;
  for (const other of allBlocks) {
    if (other === block) continue;
    const otherStart = other.startMessage;
    const otherEnd = other.endMessage ?? Number.MAX_SAFE_INTEGER;
    if (block.startMessage >= otherStart && block.startMessage < otherEnd) {
      depth++;
    }
  }
  return depth;
}

// ============================================================
// 主组件
// ============================================================

export function SequenceCanvas(props: SequenceCanvasProps) {
  const {
    syncCanvas,
    consumed,
    canvasSource,
    lastConsumedAt,
    connectionStatus,
    onCanvasUpdate,
    onResetConsumed,
    onDiagramTypeChange,
  } = props;

  // ============================================================
  // 内部状态
  // ============================================================

  const [nodes, setNodes] = useState<MermaidNode[]>(syncCanvas.nodes);
  const [edges, setEdges] = useState<MermaidEdge[]>(syncCanvas.edges);
  const [metadata, setMetadata] = useState<GraphMetadata | undefined>(syncCanvas.metadata);

  const [selection, setSelection] = useState<Selection | null>(null);
  const [editingParticipantId, setEditingParticipantId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [connectionMode] = useState<ConnectionMode>('direction');
  const [localDirection] = useState<FlowchartDirection>('TD');

  // refs 用于回调中读取最新值
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const metadataRef = useRef(metadata);
  nodesRef.current = nodes;
  edgesRef.current = edges;
  metadataRef.current = metadata;

  // ============================================================
  // 同步外部状态
  // ============================================================

  useEffect(() => {
    setNodes(syncCanvas.nodes);
  }, [syncCanvas.nodes]);

  useEffect(() => {
    setEdges(syncCanvas.edges);
  }, [syncCanvas.edges]);

  useEffect(() => {
    setMetadata(syncCanvas.metadata);
  }, [syncCanvas.metadata]);

  // ============================================================
  // 派生数据
  // ============================================================

  const participants: SequenceParticipantInfo[] = useMemo(() => {
    return metadata?.participants ?? nodes.map((n) => ({
      id: n.id,
      label: n.data.label,
      participantType: (n.data.participantType ?? 'participant') as 'participant' | 'actor',
    }));
  }, [metadata, nodes]);

  const blocks = useMemo(() => metadata?.blocks ?? [], [metadata]);
  const notes = useMemo(() => metadata?.notes ?? [], [metadata]);
  const boxes = useMemo(() => readSequenceBoxes(metadata), [metadata]);
  const autonumber = useMemo(() => metadata?.autonumber === true, [metadata]);

  const sortedEdges = useMemo(() => {
    return [...edges].sort((a, b) => {
      const sa = typeof a.data.sequence === 'number' ? a.data.sequence : 0;
      const sb = typeof b.data.sequence === 'number' ? b.data.sequence : 0;
      return sa - sb;
    });
  }, [edges]);

  const lastSequence = useMemo(() => {
    if (sortedEdges.length === 0) return 0;
    const last = sortedEdges[sortedEdges.length - 1];
    return typeof last.data.sequence === 'number' ? last.data.sequence : 0;
  }, [sortedEdges]);

  const lastMessageY = useMemo(() => {
    if (sortedEdges.length === 0) return FIRST_MESSAGE_Y;
    return getMessageY(lastSequence);
  }, [sortedEdges, lastSequence]);

  const activationRanges = useMemo(() => computeActivationRanges(edges), [edges]);

  // 参与者 id → 索引映射
  const participantIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    participants.forEach((p, i) => map.set(p.id, i));
    return map;
  }, [participants]);

  // ============================================================
  // 画布尺寸
  // ============================================================

  const canvasWidth = useMemo(() => {
    const lastX = getParticipantX(Math.max(participants.length - 1, 0));
    return lastX + PARTICIPANT_WIDTH / 2 + PARTICIPANT_LEFT_PADDING;
  }, [participants.length]);

  const canvasHeight = useMemo(() => {
    return Math.max(
      lastMessageY + LIFELINE_BOTTOM_PADDING + 40,
      PARTICIPANT_BOTTOM_Y + 200,
    );
  }, [lastMessageY]);

  // ============================================================
  // 序列化
  // ============================================================

  const mermaidCode = useMemo(() => {
    const canvas: GraphCanvasState = {
      diagramType: 'sequenceDiagram',
      nodes,
      edges,
      metadata,
    };
    // M0: 统一使用 serializeMermaid
    const result = serializeMermaid(canvas);
    return result.mermaid;
  }, [nodes, edges, metadata]);

  // ============================================================
  // 通知外部更新
  // ============================================================

  const notifyUpdate = useCallback(() => {
    const canvas: GraphCanvasState = {
      diagramType: 'sequenceDiagram',
      nodes: nodesRef.current,
      edges: edgesRef.current,
      metadata: metadataRef.current,
    };
    onCanvasUpdate(canvas);
  }, [onCanvasUpdate]);

  // ============================================================
  // 代码编辑
  // ============================================================

  const handleCodeChange = useCallback((code: string) => {
    // M0: 统一使用 parseMermaid（自动检测图类型，支持空代码）
    const result = parseMermaid(code);
    if (!result.success) {
      setCodeError(result.errors.map((e) => e.message).join('; '));
      return;
    }

    const newCanvas = result.canvas;
    if (newCanvas.diagramType !== 'sequenceDiagram') {
      // 图类型变更：交给 onCanvasUpdate 处理
      onCanvasUpdate(newCanvas);
      setCodeError(null);
      return;
    }

    // 同类型更新：应用解析结果（使用类型守卫而非类型断言）
    if (!isGraphCanvasState(newCanvas)) {
      setCodeError('内部错误：解析结果不是 GraphCanvasState');
      return;
    }
    setNodes(newCanvas.nodes);
    setEdges(newCanvas.edges);
    setMetadata(newCanvas.metadata);
    setCodeError(null);
    setSelection(null);
    setTimeout(() => {
      onCanvasUpdate(newCanvas);
    }, 0);
  }, [onCanvasUpdate]);

  // ============================================================
  // 选中和编辑
  // ============================================================

  const handleSelectParticipant = useCallback((id: string) => {
    setSelection({ type: 'participant', id });
  }, []);

  const handleEditParticipant = useCallback((id: string) => {
    setEditingParticipantId(id);
    setSelection({ type: 'participant', id });
  }, []);

  const handleSelectMessage = useCallback((id: string) => {
    setSelection({ type: 'message', id });
  }, []);

  const handleEditMessage = useCallback((id: string) => {
    setEditingMessageId(id);
    setSelection({ type: 'message', id });
  }, []);

  const handleSelectNote = useCallback((noteIndex: number) => {
    setSelection({ type: 'note', id: noteIndex });
  }, []);

  const handleSelectBlock = useCallback((blockIndex: number) => {
    setSelection({ type: 'block', id: blockIndex });
  }, []);

  const handleSelectBox = useCallback((boxIndex: number) => {
    setSelection({ type: 'box', id: boxIndex });
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelection(null);
  }, []);

  // ============================================================
  // 内联编辑确认
  // ============================================================

  const confirmParticipantEdit = useCallback((id: string, newLabel: string) => {
    setNodes((nds) => nds.map((n) =>
      n.id === id ? { ...n, data: { ...n.data, label: newLabel } } : n
    ));
    // 同步更新 metadata.participants
    setMetadata((prev) => {
      if (!prev?.participants) return prev;
      return {
        ...prev,
        participants: prev.participants.map((p) =>
          p.id === id ? { ...p, label: newLabel } : p
        ),
      };
    });
    setEditingParticipantId(null);
    setTimeout(() => notifyUpdate(), 0);
  }, [notifyUpdate]);

  const confirmMessageEdit = useCallback((id: string, newLabel: string) => {
    setEdges((eds) => eds.map((e) =>
      e.id === id ? { ...e, data: { ...e.data, label: newLabel || undefined } } : e
    ));
    setEditingMessageId(null);
    setTimeout(() => notifyUpdate(), 0);
  }, [notifyUpdate]);

  // ============================================================
  // 属性面板更新
  // ============================================================

  const handleUpdateParticipant = useCallback((id: string, data: Partial<MermaidNode['data']>) => {
    setNodes((nds) => nds.map((n) =>
      n.id === id ? { ...n, data: { ...n.data, ...data } } : n
    ));
    // 同步 metadata.participants
    setMetadata((prev) => {
      if (!prev?.participants) return prev;
      return {
        ...prev,
        participants: prev.participants.map((p) =>
          p.id === id
            ? {
                ...p,
                ...(data.label !== undefined ? { label: data.label } : {}),
                ...(data.participantType !== undefined ? { participantType: data.participantType as 'participant' | 'actor' } : {}),
              }
            : p
        ),
      };
    });
    setTimeout(() => notifyUpdate(), 0);
  }, [notifyUpdate]);

  const handleUpdateMessage = useCallback((id: string, data: Partial<MermaidEdge['data']>) => {
    setEdges((eds) => eds.map((e) =>
      e.id === id ? { ...e, data: { ...e.data, ...data } } : e
    ));
    setTimeout(() => notifyUpdate(), 0);
  }, [notifyUpdate]);

  const handleUpdateMessageSource = useCallback((id: string, source: string) => {
    setEdges((eds) => eds.map((e) =>
      e.id === id ? { ...e, source } : e
    ));
    setTimeout(() => notifyUpdate(), 0);
  }, [notifyUpdate]);

  const handleUpdateMessageTarget = useCallback((id: string, target: string) => {
    setEdges((eds) => eds.map((e) =>
      e.id === id ? { ...e, target } : e
    ));
    setTimeout(() => notifyUpdate(), 0);
  }, [notifyUpdate]);

  const handleUpdateNote = useCallback((noteIndex: number, data: Partial<SequenceNoteInfo>) => {
    setMetadata((prev) => {
      if (!prev?.notes) return prev;
      const newNotes = prev.notes.map((n, i) =>
        i === noteIndex ? { ...n, ...data } : n
      );
      return { ...prev, notes: newNotes };
    });
    setTimeout(() => notifyUpdate(), 0);
  }, [notifyUpdate]);

  const handleUpdateBlock = useCallback((blockIndex: number, data: Partial<SequenceBlockInfo>) => {
    setMetadata((prev) => {
      if (!prev?.blocks) return prev;
      const newBlocks = prev.blocks.map((b, i) =>
        i === blockIndex ? { ...b, ...data } : b
      );
      return { ...prev, blocks: newBlocks };
    });
    setTimeout(() => notifyUpdate(), 0);
  }, [notifyUpdate]);

  const handleUpdateBox = useCallback((boxIndex: number, data: Partial<SequenceBoxInfo>) => {
    setMetadata((prev) => {
      const currentBoxes = readSequenceBoxes(prev);
      if (currentBoxes.length === 0) return prev;
      const newBoxes = currentBoxes.map((b, i) =>
        i === boxIndex ? { ...b, ...data } : b
      );
      return { ...prev, sequenceBoxes: newBoxes } as GraphMetadata;
    });
    setTimeout(() => notifyUpdate(), 0);
  }, [notifyUpdate]);

  // ============================================================
  // 添加参与者
  // ============================================================

  const handleAddParticipant = useCallback((_shape: MermaidNode['data']['shape']) => {
    const newId = generateParticipantId();
    const isActor = _shape === 'rounded';
    const newNode: MermaidNode = {
      id: newId,
      type: 'sequence-participant',
      position: { x: 0, y: 0 },
      data: {
        label: `参与者${participants.length + 1}`,
        shape: _shape,
        participantType: isActor ? 'actor' : 'participant',
      },
    };
    setNodes((nds) => [...nds, newNode]);
    setMetadata((prev) => {
      const newParticipant: SequenceParticipantInfo = {
        id: newId,
        label: newNode.data.label,
        participantType: isActor ? 'actor' : 'participant',
      };
      return {
        ...prev,
        participants: [...(prev?.participants ?? []), newParticipant],
      };
    });
    setTimeout(() => notifyUpdate(), 0);
  }, [participants.length, notifyUpdate]);

  // ============================================================
  // 删除选中项
  // ============================================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') {
        return;
      }
      if (!selection) return;
      e.preventDefault();

      if (selection.type === 'participant') {
        const id = selection.id as string;
        setNodes((nds) => nds.filter((n) => n.id !== id));
        setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
        setMetadata((prev) => ({
          ...prev,
          participants: prev?.participants?.filter((p) => p.id !== id) ?? [],
          notes: prev?.notes?.filter((n) => n.participantId !== id) ?? [],
        }));
      } else if (selection.type === 'message') {
        const id = selection.id as string;
        setEdges((eds) => eds.filter((e) => e.id !== id));
      } else if (selection.type === 'note') {
        const idx = selection.id as number;
        setMetadata((prev) => ({
          ...prev,
          notes: prev?.notes?.filter((_, i) => i !== idx) ?? [],
        }));
      } else if (selection.type === 'block') {
        const idx = selection.id as number;
        setMetadata((prev) => ({
          ...prev,
          blocks: prev?.blocks?.filter((_, i) => i !== idx) ?? [],
        }));
      } else if (selection.type === 'box') {
        const idx = selection.id as number;
        const currentBoxes = readSequenceBoxes(metadataRef.current);
        const newBoxes = currentBoxes.filter((_, i) => i !== idx);
        setMetadata((prev) => ({
          ...prev,
          sequenceBoxes: newBoxes,
        } as GraphMetadata));
      }

      setSelection(null);
      setTimeout(() => notifyUpdate(), 0);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selection, notifyUpdate]);

  // ============================================================
  // 当前选中项的数据
  // ============================================================

  const selectedParticipant = useMemo(() => {
    if (!selection || selection.type !== 'participant') return null;
    const id = selection.id as string;
    return nodes.find((n) => n.id === id) ?? null;
  }, [selection, nodes]);

  const selectedMessage = useMemo(() => {
    if (!selection || selection.type !== 'message') return null;
    const id = selection.id as string;
    return edges.find((e) => e.id === id) ?? null;
  }, [selection, edges]);

  const selectedNote = useMemo(() => {
    if (!selection || selection.type !== 'note') return null;
    const idx = selection.id as number;
    return notes[idx] ?? null;
  }, [selection, notes]);

  const selectedBlock = useMemo(() => {
    if (!selection || selection.type !== 'block') return null;
    const idx = selection.id as number;
    return blocks[idx] ?? null;
  }, [selection, blocks]);

  const selectedBox = useMemo(() => {
    if (!selection || selection.type !== 'box') return null;
    const idx = selection.id as number;
    return boxes[idx] ?? null;
  }, [selection, boxes]);

  const editingParticipant = editingParticipantId
    ? nodes.find((n) => n.id === editingParticipantId) ?? null
    : null;
  const editingMessage = editingMessageId
    ? edges.find((e) => e.id === editingMessageId) ?? null
    : null;

  // ============================================================
  // 渲染
  // ============================================================

  return (
    <div className="app-container">
      <Toolbar
        diagramType="sequenceDiagram"
        direction={localDirection}
        mermaidCode={mermaidCode}
        connectionMode={connectionMode}
        onConnectionModeChange={() => {
          // 时序图不支持连线模式切换
        }}
        onDiagramTypeChange={onDiagramTypeChange as (newType: DiagramType) => void}
        onDirectionChange={() => {
          // 时序图不支持方向切换
        }}
      />

      <div className="main-content">
        <div className="left-panel">
          <NodeLibrary diagramType="sequenceDiagram" onAddNode={handleAddParticipant} />
        </div>

        <div
          className="canvas-container"
          onClick={handleClearSelection}
          style={{ overflow: 'auto' }}
        >
          <svg
            width={canvasWidth}
            height={canvasHeight}
            style={{ display: 'block', background: '#fafafa' }}
          >
            <defs>
              {/* 实心三角箭头 */}
              <marker
                id="seq-arrow-filled"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="8"
                markerHeight="8"
                orient="auto"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#333" />
              </marker>
              {/* 开放三角箭头 */}
              <marker
                id="seq-arrow-open"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="8"
                markerHeight="8"
                orient="auto"
              >
                <path d="M 0 0 L 10 5 L 0 10" fill="none" stroke="#333" strokeWidth="1.5" />
              </marker>
              {/* 十字箭头 */}
              <marker
                id="seq-arrow-cross"
                viewBox="0 0 10 10"
                refX="5"
                refY="5"
                markerWidth="8"
                markerHeight="8"
                orient="auto"
              >
                <path d="M 0 0 L 10 10 M 10 0 L 0 10" stroke="#333" strokeWidth="2" fill="none" />
              </marker>
              {/* 圆点箭头 */}
              <marker
                id="seq-arrow-point"
                viewBox="0 0 10 10"
                refX="5"
                refY="5"
                markerWidth="8"
                markerHeight="8"
                orient="auto"
              >
                <circle cx="5" cy="5" r="4" fill="#333" />
              </marker>
              {/* 双向箭头（起点） */}
              <marker
                id="seq-arrow-bidirectional"
                viewBox="0 0 10 10"
                refX="0"
                refY="5"
                markerWidth="8"
                markerHeight="8"
                orient="auto"
              >
                <path d="M 10 0 L 0 5 L 10 10 z" fill="#333" />
              </marker>
            </defs>

            {/* 1. Box 分组框（背景层） */}
            {boxes.map((box, idx) => {
              // 计算 box 的左右边界
              const actorIndices = box.actorKeys
                .map((key) => participantIndexMap.get(key))
                .filter((v): v is number => v !== undefined);
              if (actorIndices.length === 0) return null;
              const minIdx = Math.min(...actorIndices);
              const maxIdx = Math.max(...actorIndices);
              const leftX = getParticipantX(minIdx) - PARTICIPANT_WIDTH / 2 - 6;
              const rightX = getParticipantX(maxIdx) + PARTICIPANT_WIDTH / 2 + 6;
              return (
                <BoxFrame
                  key={`box-${idx}`}
                  box={box}
                  boxIndex={idx}
                  leftX={leftX}
                  rightX={rightX}
                  lastMessageY={lastMessageY}
                  selected={selection?.type === 'box' && selection.id === idx}
                  onSelect={handleSelectBox}
                />
              );
            })}

            {/* 2. Block 块结构框（背景层） */}
            {blocks.map((block, idx) => {
              const depth = computeBlockDepth(block, blocks);
              // 块的左右边界覆盖所有参与者
              const leftX = participants.length > 0
                ? getParticipantX(0) - PARTICIPANT_WIDTH / 2 - 20
                : 40;
              const rightX = participants.length > 0
                ? getParticipantX(participants.length - 1) + PARTICIPANT_WIDTH / 2 + 20
                : 400;
              return (
                <BlockFrame
                  key={`block-${idx}`}
                  type={block.type}
                  label={block.label}
                  startMessage={block.startMessage}
                  endMessage={block.endMessage}
                  lastSequence={lastSequence}
                  leftX={leftX}
                  rightX={rightX}
                  depth={depth}
                  selected={selection?.type === 'block' && selection.id === idx}
                  blockIndex={idx}
                  onSelect={handleSelectBlock}
                />
              );
            })}

            {/* 3. 生命线 */}
            {participants.map((p, i) => (
              <Lifeline
                key={`lifeline-${p.id}`}
                x={getParticipantX(i)}
                lastMessageY={lastMessageY}
                selected={selection?.type === 'participant' && selection.id === p.id}
              />
            ))}

            {/* 4. 激活条 */}
            {activationRanges.map((range, idx) => {
              const participantIdx = participantIndexMap.get(range.participantId);
              if (participantIdx === undefined) return null;
              const x = getParticipantX(participantIdx);
              const y = getMessageY(range.startSequence) - ACTIVATION_BAR_HEIGHT / 2;
              const height = (range.endSequence - range.startSequence) * MESSAGE_ROW_HEIGHT;
              return (
                <ActivationBar
                  key={`activation-${idx}`}
                  x={x}
                  y={y}
                  height={height}
                  selected={false}
                />
              );
            })}

            {/* 5. 消息箭头 */}
            {sortedEdges.map((edge) => {
              const sourceIdx = participantIndexMap.get(edge.source);
              const targetIdx = participantIndexMap.get(edge.target);
              if (sourceIdx === undefined || targetIdx === undefined) return null;
              const seq = typeof edge.data.sequence === 'number' ? edge.data.sequence : 0;
              return (
                <MessageRow
                  key={edge.id}
                  message={edge}
                  sourceX={getParticipantX(sourceIdx)}
                  targetX={getParticipantX(targetIdx)}
                  y={getMessageY(seq)}
                  selected={selection?.type === 'message' && selection.id === edge.id}
                  showSequenceNumber={autonumber}
                  onSelect={handleSelectMessage}
                  onEdit={handleEditMessage}
                />
              );
            })}

            {/* 6. 注释框 */}
            {notes.map((note, idx) => {
              const participantIdx = participantIndexMap.get(note.participantId);
              if (participantIdx === undefined) return null;
              return (
                <NoteRow
                  key={`note-${idx}`}
                  note={note}
                  noteIndex={idx}
                  participantX={getParticipantX(participantIdx)}
                  selected={selection?.type === 'note' && selection.id === idx}
                  onSelect={handleSelectNote}
                />
              );
            })}

            {/* 7. 参与者框（顶层） */}
            {participants.map((p, i) => {
              const node = nodes.find((n) => n.id === p.id);
              if (!node) return null;
              return (
                <ParticipantRow
                  key={p.id}
                  participant={node}
                  x={getParticipantX(i)}
                  selected={selection?.type === 'participant' && selection.id === p.id}
                  onSelect={handleSelectParticipant}
                  onEdit={handleEditParticipant}
                />
              );
            })}
          </svg>

          {/* 内联编辑器：参与者 */}
          {editingParticipant && (
            <div
              className="inline-editor-overlay"
              style={{
                position: 'absolute',
                top: PARTICIPANT_TOP_Y + PARTICIPANT_HEIGHT + 8,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 1000,
                background: '#fff',
                padding: '8px',
                borderRadius: '4px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                width: 240,
              }}
            >
              <InlineEditor
                value={editingParticipant.data.label}
                onConfirm={(value) => confirmParticipantEdit(editingParticipant.id, value)}
                onCancel={() => setEditingParticipantId(null)}
              />
            </div>
          )}

          {/* 内联编辑器：消息 */}
          {editingMessage && (
            <div
              className="inline-editor-overlay"
              style={{
                position: 'absolute',
                top: 80,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 1000,
                background: '#fff',
                padding: '8px',
                borderRadius: '4px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                width: 320,
              }}
            >
              <InlineEditor
                value={editingMessage.data.label ?? ''}
                onConfirm={(value) => confirmMessageEdit(editingMessage.id, value)}
                onCancel={() => setEditingMessageId(null)}
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
            diagramType="sequenceDiagram"
          />
          {/* 属性面板：根据选中类型显示不同编辑器 */}
          <div className="property-panel">
            <h3 className="panel-title">属性面板</h3>
            {!selection && (
              <p className="panel-hint">选中参与者/消息/注释/块/Box 以编辑属性</p>
            )}
            {selectedParticipant && (
              <ParticipantEditor
                participant={selectedParticipant}
                boxes={boxes}
                onUpdate={(data) => handleUpdateParticipant(selectedParticipant.id, data)}
              />
            )}
            {selectedMessage && (
              <MessageEditor
                message={selectedMessage}
                participants={participants}
                onUpdate={(data) => handleUpdateMessage(selectedMessage.id, data)}
                onUpdateSource={(source) => handleUpdateMessageSource(selectedMessage.id, source)}
                onUpdateTarget={(target) => handleUpdateMessageTarget(selectedMessage.id, target)}
              />
            )}
          {selectedNote && (
            <NoteEditor
              note={selectedNote}
              participants={participants}
              noteIndex={selection?.type === 'note' ? selection.id as number : 0}
              onUpdate={(data) => {
                const idx = selection?.type === 'note' ? selection.id as number : 0;
                handleUpdateNote(idx, data);
              }}
            />
          )}
          {selectedBlock && (
            <BlockEditor
              block={selectedBlock}
              blockIndex={selection?.type === 'block' ? selection.id as number : 0}
              onUpdate={(data) => {
                const idx = selection?.type === 'block' ? selection.id as number : 0;
                handleUpdateBlock(idx, data);
              }}
            />
          )}
          {selectedBox && (
            <BoxEditor
              box={selectedBox}
              boxIndex={selection?.type === 'box' ? selection.id as number : 0}
              participants={participants}
              onUpdate={(data) => {
                const idx = selection?.type === 'box' ? selection.id as number : 0;
                handleUpdateBox(idx, data);
              }}
            />
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
