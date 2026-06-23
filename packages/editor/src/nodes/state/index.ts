/**
 * state 节点组件注册表 — 统一导出 state 节点组件和注册表
 *
 * 单一职责：导出 stateDiagram 的节点组件，提供 nodeTypes 注册表
 *
 * 注册类型（9 种）:
 *   - 'state-default':   StateBoxComponent       — 默认状态节点（圆角矩形 + label + 可选描述）
 *   - 'state-start':     StateStartComponent     — 起始状态（实心圆 ●）
 *   - 'state-end':       StateEndComponent       — 结束状态（双圆 ◎）
 *   - 'state-fork':      StateForkComponent      — 分叉状态（实心矩形 ▬）
 *   - 'state-join':      StateJoinComponent      — 汇合状态（实心矩形 ▬）
 *   - 'state-choice':    StateChoiceComponent    — 选择状态（菱形 ◆）
 *   - 'state-divider':   StateDividerComponent   — 分隔线（———）
 *   - 'state-composite': StateCompositeComponent — 复合状态容器（标题栏 + 子节点）
 *   - 'state-note':      StateNoteComponent      — Note 节点（黄色背景文本框）
 */

export { StateBoxComponent } from './state-box.js';
export type { StateBoxFlowNode } from './state-box.js';

export {
  StateStartComponent,
  StateEndComponent,
  StateForkComponent,
  StateJoinComponent,
  StateChoiceComponent,
  StateDividerComponent,
} from './state-special.js';
export type {
  StateStartFlowNode,
  StateEndFlowNode,
  StateForkFlowNode,
  StateJoinFlowNode,
  StateChoiceFlowNode,
  StateDividerFlowNode,
} from './state-special.js';

export { StateCompositeComponent } from './state-composite.js';
export type { StateCompositeFlowNode, StateCompositeNodeData } from './state-composite.js';

export { StateNoteComponent } from './state-note.js';
export type { StateNoteFlowNode } from './state-note.js';

import type { NodeTypes } from '@xyflow/react';
import { StateBoxComponent } from './state-box.js';
import {
  StateStartComponent,
  StateEndComponent,
  StateForkComponent,
  StateJoinComponent,
  StateChoiceComponent,
  StateDividerComponent,
} from './state-special.js';
import { StateCompositeComponent } from './state-composite.js';
import { StateNoteComponent } from './state-note.js';

/** state 节点类型注册表（供 nodes/index.ts 注册） */
export const stateNodeTypes: NodeTypes = {
  'state-default': StateBoxComponent,
  'state-start': StateStartComponent,
  'state-end': StateEndComponent,
  'state-fork': StateForkComponent,
  'state-join': StateJoinComponent,
  'state-choice': StateChoiceComponent,
  'state-divider': StateDividerComponent,
  'state-composite': StateCompositeComponent,
  'state-note': StateNoteComponent,
};
