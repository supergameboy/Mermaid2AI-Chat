/**
 * @mermaid2aichat/editor — Mermaid2AIChat 画布组件库
 *
 * 提供 Canvas 组件，封装 React Flow 画布、节点库、工具栏、属性面板等 UI。
 * 不包含 WebSocket 逻辑，由外部通过 CanvasProps 注入状态和回调。
 */
export { Canvas } from './canvas.js';
export type { CanvasDispatcherProps } from './canvas.js';
export { GraphCanvas } from './graph-canvas.js';
export type { GraphCanvasProps } from './graph-canvas.js';
export { SequenceCanvas } from './sequence/sequence-canvas.js';
export type { SequenceCanvasProps } from './sequence/sequence-canvas.js';
export { GanttCanvas } from './gantt-canvas.js';
export { Toolbar } from './components/toolbar.js';
export { NodeLibrary } from './components/node-library.js';
export { ConsumedBadge } from './components/consumed-badge.js';
export { ConnectionStatus } from './components/connection-status.js';
export { PropertyPanel } from './components/property-panel.js';
export { InlineEditor } from './components/inline-editor.js';
export { CodeEditor } from './components/code-editor.js';
export { TabBar } from './components/tab-bar.js';
export { TypeSwitchDialog } from './components/type-switch-dialog.js';

// 节点/边组件导出
export { getNodeTypes } from './nodes/index.js';
export { getEdgeTypes } from './edges/index.js';
export { getLayoutFn } from './layouts/index.js';

// mindmap 节点组件导出（M6 新增，7 种节点形状）
export {
  MindmapDefaultComponent,
  MindmapRectComponent,
  MindmapRoundedComponent,
  MindmapCircleComponent,
  MindmapCloudComponent,
  MindmapBangComponent,
  MindmapHexagonComponent,
} from './nodes/mindmap-nodes.js';
export type {
  MindmapDefaultFlowNode,
  MindmapRectFlowNode,
  MindmapRoundedFlowNode,
  MindmapCircleFlowNode,
  MindmapCloudFlowNode,
  MindmapBangFlowNode,
  MindmapHexagonFlowNode,
} from './nodes/mindmap-nodes.js';

// mindmap 形状样式工具导出（M6 新增）
export { getShapeStyle, getSectionColor, SECTION_COLORS } from './nodes/mindmap-shapes.js';

// 数据图表专用渲染器导出（gantt 已移至专用 GanttCanvas）
export { PieRenderer } from './specialized/pie-renderer.js';
export { TimelineRenderer } from './specialized/timeline-renderer.js';
export { QuadrantRenderer } from './specialized/quadrant-renderer.js';
export { XYChartRenderer } from './specialized/xychart-renderer.js';
export { SpecializedShell } from './specialized/shared/specialized-shell.js';
export { renderSpecialized } from './specialized/index.js';
export type {
  SpecializedRendererProps,
  PieRendererProps,
  TimelineRendererProps,
  QuadrantRendererProps,
  XYChartRendererProps,
} from './specialized/types.js';

// 时序图专用编辑面板导出
export {
  ParticipantEditor,
  MessageEditor,
  NoteEditor,
  BlockEditor,
  BoxEditor,
} from './components/sequence/index.js';
export type {
  ParticipantEditorProps,
  MessageEditorProps,
  NoteEditorProps,
  BlockEditorProps,
  BoxEditorProps,
} from './components/sequence/index.js';

// mindmap 专用编辑面板导出（M6 新增）
export { MindmapPropertyEditor, MindmapTreePanel } from './components/mindmap/index.js';
export type { MindmapPropertyEditorProps, MindmapTreePanelProps } from './components/mindmap/index.js';

// 类型导出
export type {
  CanvasProps,
  CanvasSnapshot,
  ConnectionStatusType,
} from './types.js';
export type { TabBarProps } from './components/tab-bar.js';
