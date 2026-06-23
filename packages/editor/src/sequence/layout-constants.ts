/**
 * 时序图布局常量 — 所有时序图组件共用的几何参数
 *
 * 单一职责：定义画布坐标系中的固定数值，确保各组件对齐一致
 */

/** 参与者顶部 Y 坐标（参与者框顶部） */
export const PARTICIPANT_TOP_Y = 40;

/** 参与者框高度 */
export const PARTICIPANT_HEIGHT = 48;

/** 参与者框宽度 */
export const PARTICIPANT_WIDTH = 140;

/** 参与者中心间距（水平） */
export const PARTICIPANT_SPACING = 200;

/** 第一个参与者左侧留白 */
export const PARTICIPANT_LEFT_PADDING = 80;

/** 参与者中心 Y 坐标 */
export const PARTICIPANT_CENTER_Y = PARTICIPANT_TOP_Y + PARTICIPANT_HEIGHT / 2;

/** 参与者框底部 Y 坐标（生命线起点） */
export const PARTICIPANT_BOTTOM_Y = PARTICIPANT_TOP_Y + PARTICIPANT_HEIGHT;

/** 第一条消息的 Y 坐标 */
export const FIRST_MESSAGE_Y = PARTICIPANT_BOTTOM_Y + 60;

/** 消息行高（垂直间距） */
export const MESSAGE_ROW_HEIGHT = 50;

/** 生命线底部相对最后一条消息的额外延伸 */
export const LIFELINE_BOTTOM_PADDING = 40;

/** 激活条宽度 */
export const ACTIVATION_BAR_WIDTH = 10;

/** 激活条高度（默认占一条消息行） */
export const ACTIVATION_BAR_HEIGHT = 30;

/** Note 框宽度 */
export const NOTE_WIDTH = 100;

/** Note 框高度 */
export const NOTE_HEIGHT = 36;

/** 块结构标签高度 */
export const BLOCK_LABEL_HEIGHT = 22;

/** 块结构内边距 */
export const BLOCK_PADDING = 8;

/** Box 框标签高度 */
export const BOX_LABEL_HEIGHT = 24;

/** Box 框内边距 */
export const BOX_PADDING = 6;

/** 计算参与者中心 X 坐标 */
export function getParticipantX(index: number): number {
  return PARTICIPANT_LEFT_PADDING + index * PARTICIPANT_SPACING + PARTICIPANT_WIDTH / 2;
}

/** 计算消息 Y 坐标 */
export function getMessageY(sequence: number): number {
  return FIRST_MESSAGE_Y + sequence * MESSAGE_ROW_HEIGHT;
}
