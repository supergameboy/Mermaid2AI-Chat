/**
 * 核心类型定义 — 所有包共享的数据模型
 * 单一数据源：其他包通过 import 引用，禁止重新定义
 */

// === 节点形状（14种：10种精选 + 4种扩展）===
export type MermaidShapeType =
  | 'rect'
  | 'rounded'
  | 'stadium'
  | 'diamond'
  | 'circle'
  | 'cylinder'
  | 'hexagon'
  | 'parallelogram'
  | 'subroutine'
  | 'doublecircle'
  // 扩展形状
  | 'asymmetric'           // A>文本] 不对称/旗帜
  | 'parallelogram-reverse' // A[\文本\] 反向平行四边形
  | 'trapezoid'            // A[/文本\] 梯形
  | 'trapezoid-reverse';   // A[\文本/] 反向梯形

// === 边样式（8种）===
export type MermaidEdgeStyle =
  | 'arrow'
  | 'line'
  | 'dotted'
  | 'dotted-arrow'
  | 'thick'
  | 'circle'
  | 'cross'
  | 'bidirectional';

// === 流程图方向 ===
export type FlowchartDirection = 'TB' | 'TD' | 'BT' | 'RL' | 'LR';

// === 节点样式（可选）===
export interface NodeStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  color?: string;
}

// === 边标记（与 React Flow EdgeMarker 兼容）===
export interface EdgeMarker {
  type: 'arrow' | 'arrowclosed';
  width?: number;
  height?: number;
  color?: string;
}

// === 节点数据（索引签名满足 React Flow Record<string, unknown> 约束）===
export interface MermaidNodeData {
  label: string;
  shape: MermaidShapeType;
  style?: NodeStyle;
  [key: string]: unknown;
}

// === 边数据（索引签名满足 React Flow Record<string, unknown> 约束）===
export interface MermaidEdgeData {
  edgeStyle: MermaidEdgeStyle;
  label?: string;
  [key: string]: unknown;
}

// === 画布节点（与 React Flow Node 结构兼容）===
// 注意：顶层不加索引签名，否则 NodeProps 的 Pick 会将 width/height 等视为 required
export interface MermaidNode {
  id: string;
  type: MermaidShapeType;
  position: { x: number; y: number };
  data: MermaidNodeData;
  parentId?: string;
  // 与 React Flow CoordinateExtent = [[number, number], [number, number]] 对齐
  extent?: 'parent' | [[number, number], [number, number]];
  // 与 React Flow NodeBase 兼容的运行时状态字段
  selected?: boolean;
  dragging?: boolean;
  width?: number;
  height?: number;
  zIndex?: number;
}

// === 画布边（与 React Flow Edge 结构兼容）===
export interface MermaidEdge {
  id: string;
  source: string;
  target: string;
  // React Flow 路径类型，使用 string 与 EdgeBase.type 兼容
  type?: string;
  data: MermaidEdgeData;
  markerStart?: EdgeMarker;
  markerEnd?: EdgeMarker;
  // 与 React Flow EdgeBase 兼容的运行时状态字段
  selected?: boolean;
  animated?: boolean;
  zIndex?: number;
}

// === 画布视口 ===
export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

// === 画布状态 ===
export interface CanvasState {
  nodes: MermaidNode[];
  edges: MermaidEdge[];
  direction: FlowchartDirection;
}

// === 画布内容来源 ===
export type CanvasSource = 'user' | 'ai' | null;

// === 消费状态 ===
export interface ConsumedState {
  consumed: boolean;
  lastConsumedAt: number | null;
  canvasSource: CanvasSource;
}

// === 解析结果 ===
export interface ParseSuccessResult {
  success: true;
  canvas: CanvasState;
  errors: ParseError[];
}

export interface ParseFailureResult {
  success: false;
  canvas: CanvasState;
  errors: ParseError[];
}

export type ParseResult = ParseSuccessResult | ParseFailureResult;

// === 解析错误 ===
export interface ParseError {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning';
  context?: string;
}

// === 序列化结果 ===
export interface SerializeResult {
  mermaid: string;
  errors: ParseError[];
}

// === 多标签页视图类型 ===

/** 视图来源 */
export type ViewSource = 'user' | 'ai';

/** 视图元数据（轻量，全内存） */
export interface ViewSummary {
  /** 视图唯一 ID（UUID v4） */
  id: string;
  /** 视图标题（用户可编辑，null 表示未命名） */
  title: string | null;
  /** 创建时间戳 */
  createdAt: number;
  /** 最后更新时间戳 */
  updatedAt: number;
  /** AI 会话 ID（source='ai' 时关联 MCP 会话，source='user' 时为 null） */
  sessionId: string | null;
  /** 视图来源 */
  source: ViewSource;
}

/** 视图内容（重量，仅活动视图在内存） */
export interface ViewContent {
  /** 画布状态 */
  canvas: CanvasState;
  /** 消费状态 */
  consumed: ConsumedState;
  /** 视口 */
  viewport: Viewport;
}

/** 完整视图（元数据 + 内容，用于持久化和全量同步） */
export interface View extends ViewSummary, ViewContent {}

/** 活动视图完整内容（用于 active_view_update 消息） */
export interface ActiveViewPayload {
  /** 视图 ID */
  viewId: string;
  /** 画布状态 */
  canvas: CanvasState;
  /** 消费状态 */
  consumed: ConsumedState;
  /** 视口 */
  viewport: Viewport;
  /** 标题 */
  title: string | null;
}
