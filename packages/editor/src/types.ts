/**
 * editor 包类型定义 — Canvas 组件接口
 */
import type {
  CanvasSource,
  FlowchartDirection,
  MermaidEdge,
  MermaidNode,
  Viewport,
} from '@mermaid-editor/serializer';

/** 连接状态 */
export type ConnectionStatusType = 'connected' | 'reconnecting' | 'disconnected';

/** 画布快照（用于发送到服务端） */
export interface CanvasSnapshot {
  nodes: MermaidNode[];
  edges: MermaidEdge[];
  direction: FlowchartDirection;
}

/**
 * Canvas 组件 Props
 *
 * 数据流设计（单向，无循环）：
 * - 服务端同步：syncNodes/syncEdges/syncDirection/syncViewport → Canvas 内部 useEffect → React Flow state
 * - 本地操作：React Flow state → ref → onCanvasEdit/onViewportChange 回调 → 外部发送到服务端
 */
export interface CanvasProps {
  /** 服务端同步的节点（变化时覆盖 Canvas 内部 state） */
  syncNodes: MermaidNode[];
  /** 服务端同步的边 */
  syncEdges: MermaidEdge[];
  /** 服务端同步的方向 */
  syncDirection: FlowchartDirection;
  /** 服务端同步的视口（平移/缩放） */
  syncViewport: Viewport | null;

  /** 消费状态 */
  consumed: boolean;
  /** 画布内容来源 */
  canvasSource: CanvasSource;
  /** 最后消费时间戳 */
  lastConsumedAt: number | null;

  /** WebSocket 连接状态 */
  connectionStatus: ConnectionStatusType;

  /** 画布编辑回调（用户操作触发，外部负责发送到服务端） */
  onCanvasEdit: (canvas: CanvasSnapshot) => void;
  /** 方向变化回调 */
  onDirectionChange: (dir: FlowchartDirection) => void;
  /** 重置消费状态回调 */
  onResetConsumed: () => void;
  /** 视口变化回调（用户平移/缩放触发，外部负责发送 viewport_edit 到服务端） */
  onViewportChange: (viewport: Viewport) => void;
}
