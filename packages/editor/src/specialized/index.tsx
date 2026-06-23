/**
 * 数据图表专用渲染器入口
 *
 * 单一职责：导出 4 种数据图表渲染器和分发函数
 * - PieRenderer: 饼图
 * - TimelineRenderer: 时间线
 * - QuadrantRenderer: 四象限图
 * - XYChartRenderer: 坐标图
 *
 * 注意：Gantt 已移至专用 GanttCanvas（packages/editor/src/gantt-canvas.tsx），
 * 不再由 SpecializedRenderer 处理。
 */
import type {
  CanvasState,
  PieCanvasState,
  TimelineCanvasState,
  QuadrantCanvasState,
  XYChartCanvasState,
} from '@mermaid2aichat/serializer';
import { PieRenderer } from './pie-renderer.js';
import { TimelineRenderer } from './timeline-renderer.js';
import { QuadrantRenderer } from './quadrant-renderer.js';
import { XYChartRenderer } from './xychart-renderer.js';
import type { SpecializedRendererProps } from './types.js';

export { PieRenderer } from './pie-renderer.js';
export { TimelineRenderer } from './timeline-renderer.js';
export { QuadrantRenderer } from './quadrant-renderer.js';
export { XYChartRenderer } from './xychart-renderer.js';
export { SpecializedShell } from './shared/specialized-shell.js';
export type {
  SpecializedRendererProps,
  PieRendererProps,
  TimelineRendererProps,
  QuadrantRendererProps,
  XYChartRendererProps,
} from './types.js';

/** 数据图表 CanvasState 联合类型（仅 4 种数据图表，gantt 已移至专用 GanttCanvas） */
export type ChartCanvasState =
  | PieCanvasState
  | TimelineCanvasState
  | QuadrantCanvasState
  | XYChartCanvasState;

/**
 * 根据 CanvasState.diagramType 分发到对应专用渲染器
 *
 * 使用穷尽检查：新增 ChartDiagramType 未处理时编译报错
 * 注意：调用方需保证传入的是数据图表类型（非图结构类型、非 gantt）
 */
export function renderSpecialized(
  canvas: ChartCanvasState,
  props: SpecializedRendererProps
) {
  switch (canvas.diagramType) {
    case 'pie':
      return <PieRenderer {...props} syncCanvas={canvas} />;
    case 'timeline':
      return <TimelineRenderer {...props} syncCanvas={canvas} />;
    case 'quadrantChart':
      return <QuadrantRenderer {...props} syncCanvas={canvas} />;
    case 'xychart':
      return <XYChartRenderer {...props} syncCanvas={canvas} />;
    default: {
      // 穷尽检查：新增 ChartDiagramType 未处理，编译时报错
      const _exhaustive: never = canvas;
      throw new Error(`未支持的数据图表类型: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

/**
 * 类型守卫：判断 CanvasState 是否为数据图表类型
 * 用于 canvas.tsx 分发前的类型收窄
 * 注意：gantt 不在此列，由 isGanttCanvasState 单独处理
 */
export function isChartCanvasState(state: CanvasState): state is ChartCanvasState {
  return (
    state.diagramType === 'pie' ||
    state.diagramType === 'timeline' ||
    state.diagramType === 'quadrantChart' ||
    state.diagramType === 'xychart'
  );
}
