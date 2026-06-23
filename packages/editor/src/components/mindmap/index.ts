/**
 * mindmap 专用 UI 组件注册表 — 统一导出编辑面板组件
 *
 * 单一职责：导出 mindmap 各元素的属性编辑面板组件
 */

export { MindmapPropertyEditor } from './mindmap-property-editor.js';
export type { MindmapPropertyEditorProps } from './mindmap-property-editor.js';

export { MindmapTreePanel } from './mindmap-tree-panel.js';
export type { MindmapTreePanelProps } from './mindmap-tree-panel.js';
export { collectDescendantIds, buildChildrenMap } from './mindmap-tree-panel.js';
