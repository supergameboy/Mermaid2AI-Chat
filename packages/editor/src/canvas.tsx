/**
 * Canvas — Mermaid2AIChat 主画布组件（分发器）
 *
 * 职责：根据 diagramType 分发到对应渲染器
 * - sequenceDiagram → SequenceCanvas（专用 SVG 渲染器，时序图专用）
 * - gantt → GanttCanvas（专用画布，时间轴布局，非 React Flow）
 * - 其他图结构类型（6种）→ GraphCanvas（React Flow）
 * - 数据图表类型（4种）→ SpecializedRenderer（专用 SVG/HTML 渲染器）
 *
 * 数据流设计（单向，无循环）：
 * - 服务端同步：syncCanvas → 各渲染器内部 useEffect → 内部 state
 * - 本地操作：
 *   - 图结构类型：内部 state → onCanvasEdit(CanvasSnapshot) → 外部
 *   - 数据图表类型：内部 state → onCanvasUpdate(CanvasState) → 外部
 */
import type { CanvasState } from '@mermaid2aichat/serializer';
import type { CanvasProps } from './types.js';
import { isGraphCanvasState, isGanttCanvasState } from '@mermaid2aichat/serializer';
import { GraphCanvas } from './graph-canvas.js';
import { SequenceCanvas } from './sequence/sequence-canvas.js';
import { GanttCanvas } from './gantt-canvas.js';
import { renderSpecialized, isChartCanvasState } from './specialized/index.js';
import type { SpecializedRendererProps } from './specialized/types.js';

/** Canvas Props 扩展 — 增加 syncCanvas 用于分发 */
export interface CanvasDispatcherProps extends CanvasProps {
  /** 当前画布状态（判别联合类型，包含 diagramType） */
  syncCanvas: CanvasState;
  /** 画布状态更新回调（数据图表类型和时序图使用，其他图结构类型使用 onCanvasEdit） */
  onCanvasUpdate?: (canvas: CanvasState) => void;
}

/**
 * Canvas 组件 — 主分发器
 * 根据 syncCanvas.diagramType 分发到对应渲染器
 */
export function Canvas(props: CanvasDispatcherProps) {
  const { syncCanvas } = props;

  // 时序图 → SequenceCanvas（专用 SVG 渲染器，不使用 React Flow）
  // 时序图使用时间轴布局（参与者水平 + 消息垂直），与 React Flow 的自由布局不匹配
  if (syncCanvas.diagramType === 'sequenceDiagram' && isGraphCanvasState(syncCanvas)) {
    if (!props.onCanvasUpdate) {
      throw new Error('时序图需要 onCanvasUpdate 回调');
    }
    return (
      <SequenceCanvas
        {...props}
        syncCanvas={syncCanvas}
        onCanvasUpdate={props.onCanvasUpdate}
      />
    );
  }

  // 甘特图 → GanttCanvas（专用画布，时间轴布局，不使用 React Flow）
  // gantt 是时间线布局（任务条 + 时间轴），与 React Flow 的节点+边模型不匹配
  if (isGanttCanvasState(syncCanvas)) {
    if (!props.onCanvasUpdate) {
      throw new Error('甘特图需要 onCanvasUpdate 回调');
    }
    return (
      <GanttCanvas
        {...props}
        syncCanvas={syncCanvas}
        onCanvasUpdate={props.onCanvasUpdate}
      />
    );
  }

  // 其他图结构类型 → GraphCanvas（React Flow）
  if (isGraphCanvasState(syncCanvas)) {
    return (
      <GraphCanvas
        {...props}
        diagramType={syncCanvas.diagramType}
      />
    );
  }

  // 数据图表类型 → 专用渲染器
  // onCanvasUpdate 是数据图表类型的必需回调
  if (!props.onCanvasUpdate) {
    throw new Error('数据图表类型需要 onCanvasUpdate 回调');
  }

  // 类型守卫收窄到 ChartCanvasState，确保 renderSpecialized 的穷尽检查生效
  if (!isChartCanvasState(syncCanvas)) {
    // 理论上不可达：CanvasState 仅含图结构类型和数据图表类型
    // 此处 syncCanvas 已被收窄为 never
    throw new Error('未支持的画布类型');
  }

  // 构造专用渲染器 Props（从 CanvasDispatcherProps 提取）
  const specializedProps: SpecializedRendererProps = {
    syncCanvas,
    syncViewport: props.syncViewport,
    consumed: props.consumed,
    canvasSource: props.canvasSource,
    lastConsumedAt: props.lastConsumedAt,
    connectionStatus: props.connectionStatus,
    onCanvasUpdate: props.onCanvasUpdate,
    onResetConsumed: props.onResetConsumed,
    onViewportChange: props.onViewportChange,
    onDiagramTypeChange: props.onDiagramTypeChange,
  };

  return renderSpecialized(syncCanvas, specializedProps);
}
