/**
 * state 专用 UI 组件注册表 — 统一导出编辑面板组件
 *
 * 单一职责：导出 stateDiagram 各元素的属性编辑面板组件
 */

export { StatePropertyEditor } from './state-property-editor.js';
export type { StatePropertyEditorProps } from './state-property-editor.js';

export { StateRelationEditor } from './state-relation-editor.js';
export type { StateRelationEditorProps } from './state-relation-editor.js';
