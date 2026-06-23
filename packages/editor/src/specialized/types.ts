/**
 * 专用渲染器类型定义 — 数据图表渲染器共用接口
 *
 * 注意：Gantt 已移至专用 GanttCanvas，不再使用 SpecializedRendererProps
 */
import type {
  CanvasState,
  DiagramType,
  PieCanvasState,
  TimelineCanvasState,
  QuadrantCanvasState,
  XYChartCanvasState,
  Viewport,
  CanvasSource,
} from '@mermaid2aichat/serializer';
import type { ConnectionStatusType } from '../types.js';

/** 专用渲染器 Props（所有数据图表渲染器共用） */
export interface SpecializedRendererProps {
  /** 当前画布状态（具体子类型由各渲染器收窄） */
  syncCanvas: CanvasState;
  /** 服务端同步的视口 */
  syncViewport: Viewport | null;
  /** 消费状态 */
  consumed: boolean;
  /** 画布内容来源 */
  canvasSource: CanvasSource;
  /** 最后消费时间戳 */
  lastConsumedAt: number | null;
  /** WebSocket 连接状态 */
  connectionStatus: ConnectionStatusType;
  /** 画布状态更新回调（用户编辑触发，外部负责发送到服务端） */
  onCanvasUpdate: (canvas: CanvasState) => void;
  /** 重置消费状态回调 */
  onResetConsumed: () => void;
  /** 视口变化回调 */
  onViewportChange: (viewport: Viewport) => void;
  /** 图表类型切换回调（用户通过 Toolbar 下拉或代码编辑器首行修改触发） */
  onDiagramTypeChange?: (newType: DiagramType) => void;
}

/** Pie 渲染器 Props */
export interface PieRendererProps extends SpecializedRendererProps {
  syncCanvas: PieCanvasState;
}

/** Timeline 渲染器 Props */
export interface TimelineRendererProps extends SpecializedRendererProps {
  syncCanvas: TimelineCanvasState;
}

/** Quadrant 渲染器 Props */
export interface QuadrantRendererProps extends SpecializedRendererProps {
  syncCanvas: QuadrantCanvasState;
}

/** XYChart 渲染器 Props */
export interface XYChartRendererProps extends SpecializedRendererProps {
  syncCanvas: XYChartCanvasState;
}
