/**
 * sequence 模块入口 — 时序图渲染组件统一导出
 *
 * 单一职责：导出时序图专用渲染组件（不使用 React Flow）
 */

export { SequenceCanvas } from './sequence-canvas.js';
export type { SequenceCanvasProps } from './sequence-canvas.js';

export { ParticipantRow } from './participant-row.js';
export { MessageRow } from './message-row.js';
export { NoteRow } from './note-row.js';
export { BlockFrame } from './block-frame.js';
export { BoxFrame } from './box-frame.js';
export { Lifeline } from './lifeline.js';
export { ActivationBar } from './activation-bar.js';

// 布局常量导出（供外部测试和扩展使用）
export {
  PARTICIPANT_TOP_Y,
  PARTICIPANT_HEIGHT,
  PARTICIPANT_WIDTH,
  PARTICIPANT_SPACING,
  PARTICIPANT_LEFT_PADDING,
  PARTICIPANT_CENTER_Y,
  PARTICIPANT_BOTTOM_Y,
  FIRST_MESSAGE_Y,
  MESSAGE_ROW_HEIGHT,
  LIFELINE_BOTTOM_PADDING,
  ACTIVATION_BAR_WIDTH,
  ACTIVATION_BAR_HEIGHT,
  NOTE_WIDTH,
  NOTE_HEIGHT,
  BLOCK_LABEL_HEIGHT,
  BLOCK_PADDING,
  BOX_LABEL_HEIGHT,
  BOX_PADDING,
  getParticipantX,
  getMessageY,
} from './layout-constants.js';
