/**
 * 消费状态机 — 状态转换逻辑
 *
 * 修复后的状态转换:
 * - CONSUME: AI 调用 get_input 成功读取 → consumed=true
 * - RESET: 用户点击"重新启用" → consumed=false
 * - CANVAS_EDIT: 用户编辑画布 → consumed=false（修复：原设计不重置，导致数据流转断裂）
 * - CREATE_VIEW: AI 调用 create_view 写入 → consumed=true, canvasSource='ai'（修复：原设计 consumed=false，导致AI图被误读）
 */
import type { ConsumedState, CanvasSource } from '@mermaid-editor/serializer';

export type ConsumedEvent =
  | { type: 'CONSUME' }
  | { type: 'RESET' }
  | { type: 'CANVAS_EDIT' }
  | { type: 'CREATE_VIEW' };

export function consumedReducer(state: ConsumedState, event: ConsumedEvent): ConsumedState {
  switch (event.type) {
    case 'CONSUME':
      // AI 成功读取画布，标记为已消费
      return { ...state, consumed: true, lastConsumedAt: Date.now() };

    case 'RESET':
      // 用户主动点击"重新启用"，恢复待消费
      return { ...state, consumed: false, lastConsumedAt: state.lastConsumedAt };

    case 'CANVAS_EDIT':
      // 用户编辑画布 → 产生新内容 → 必须重置为待消费
      // 修复说明：原设计 return state 导致数据流转断裂（用户编辑后AI仍读到"已消费"）
      return { ...state, consumed: false, canvasSource: 'user' as CanvasSource, lastConsumedAt: state.lastConsumedAt };

    case 'CREATE_VIEW':
      // AI 通过 create_view 写入画布 → 标记为已消费
      // 修复说明：原设计 consumed=false 导致AI生成的图被get_input误读为"用户画的图"
      return { ...state, consumed: true, canvasSource: 'ai' as CanvasSource, lastConsumedAt: Date.now() };
  }
}
