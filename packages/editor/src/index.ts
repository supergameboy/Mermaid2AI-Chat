/**
 * @mermaid2aichat/editor — Mermaid2AIChat 画布组件库
 *
 * 提供 Canvas 组件，封装 React Flow 画布、节点库、工具栏、属性面板等 UI。
 * 不包含 WebSocket 逻辑，由外部通过 CanvasProps 注入状态和回调。
 */
export { Canvas } from './canvas.js';
export { Toolbar } from './components/toolbar.js';
export { NodeLibrary } from './components/node-library.js';
export { ConsumedBadge } from './components/consumed-badge.js';
export { ConnectionStatus } from './components/connection-status.js';
export { PropertyPanel } from './components/property-panel.js';
export { InlineEditor } from './components/inline-editor.js';
export { CodeEditor } from './components/code-editor.js';
export { TabBar } from './components/tab-bar.js';
export { nodeTypes } from './nodes/mermaid-nodes.js';
export { edgeTypes, MermaidEdgeComponent } from './edges/mermaid-edge.js';
export { MermaidNodeComponent } from './nodes/mermaid-nodes.js';

export type {
  CanvasProps,
  CanvasSnapshot,
  ConnectionStatusType,
} from './types.js';
export type { TabBarProps } from './components/tab-bar.js';
