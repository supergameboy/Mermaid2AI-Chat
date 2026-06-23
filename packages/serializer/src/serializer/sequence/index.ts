/**
 * sequence 序列化器入口
 *
 * 统一导出 sequence 序列化相关的公共 API
 */

export { serializeSequence } from './sequence-serializer.js';
export type { SequenceBoxInfo } from './sequence-serializer.js';
export { serializeParticipants } from './participant-serializer.js';
export { serializeMessage, serializeActivate } from './message-serializer.js';
export { serializeNotes } from './note-serializer.js';
export {
  serializeBlockStart,
  serializeBlockEnd,
  serializeBlockMid,
  hasBlockMid,
} from './block-serializer.js';
