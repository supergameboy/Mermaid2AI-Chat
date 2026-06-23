/**
 * sequence 序列化器 — Note 序列化
 *
 * 单一职责：将 SequenceNoteInfo[] 序列化为 Mermaid Note 代码
 *
 * 输出格式:
 *   - "Note left of A: note text\n"
 *   - "Note right of B: note text\n"
 *   - "Note over A: note text\n"
 *   - "Note over A,B: note text\n"
 */

import type { SequenceNoteInfo } from '../../types.js';

/** Note 位置 → 关键字 */
const PLACEMENT_KEYWORD: Record<SequenceNoteInfo['position'], string> = {
  left: 'left of',
  right: 'right of',
  over: 'over',
};

/**
 * 序列化 Note 列表
 *
 * @param notes - Note 信息列表
 * @param indent - 缩进（用于块内 Note）
 * @returns 序列化后的代码行数组
 */
export function serializeNotes(
  notes: SequenceNoteInfo[],
  indent = '',
): string[] {
  const lines: string[] = [];

  for (const note of notes) {
    const placement = PLACEMENT_KEYWORD[note.position] ?? 'over';
    const label = note.label ?? '';
    lines.push(`${indent}Note ${placement} ${note.participantId}: ${label}`);
  }

  if (notes.length > 0) {
    lines.push('');
  }

  return lines;
}
