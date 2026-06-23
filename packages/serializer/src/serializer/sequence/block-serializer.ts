/**
 * sequence 序列化器 — 块结构序列化
 *
 * 单一职责：将 SequenceBlockInfo[] 序列化为 Mermaid 块结构代码
 *
 * 输出格式:
 *   - "alt desc\n  ...\nelse desc\n  ...\nend\n"
 *   - "opt desc\n  ...\nend\n"
 *   - "loop desc\n  ...\nend\n"
 *   - "par desc\n  ...\nand desc\n  ...\nend\n"
 *   - "critical desc\n  ...\noption desc\n  ...\nend\n"
 *   - "break desc\n  ...\nend\n"
 *   - "rect rgb(255,0,0)\n  ...\nend\n"
 */

import type { SequenceBlockInfo, SequenceBlockType } from '../../types.js';

/** 块类型 → 起始关键字 */
const BLOCK_START_KEYWORD: Record<SequenceBlockType, string> = {
  'alt': 'alt',
  'opt': 'opt',
  'loop': 'loop',
  'par': 'par',
  'par-over': 'par',
  'critical': 'critical',
  'break': 'break',
  'rect': 'rect',
  'autonumber': 'autonumber',
};

/** 块类型 → 中间分支关键字 */
const BLOCK_MID_KEYWORD: Partial<Record<SequenceBlockType, string>> = {
  'alt': 'else',
  'par': 'and',
  'par-over': 'and',
  'critical': 'option',
};

/**
 * 序列化块结构
 *
 * 注意：块结构本身只生成框架，块内的消息/Note 由主序列化器按 messageIndex 范围插入
 *
 * @param blocks - 块信息列表
 * @param indent - 缩进
 * @returns 序列化后的代码行数组（仅块框架，不含块内消息）
 */
export function serializeBlockStart(
  block: SequenceBlockInfo,
  indent = '',
): string {
  const keyword = BLOCK_START_KEYWORD[block.type] ?? 'loop';
  const label = block.label ?? '';

  // rect 块的 label 是颜色
  if (block.type === 'rect') {
    return `${indent}rect ${label}`;
  }

  return `${indent}${keyword} ${label}`;
}

/**
 * 序列化块结束
 */
export function serializeBlockEnd(indent = ''): string {
  return `${indent}end`;
}

/**
 * 序列化块中间分支（else/and/option）
 */
export function serializeBlockMid(
  block: SequenceBlockInfo,
  indent = '',
): string | null {
  const keyword = BLOCK_MID_KEYWORD[block.type];
  if (!keyword) {
    return null;
  }
  const label = block.label ?? '';
  return `${indent}${keyword} ${label}`;
}

/**
 * 判断块类型是否有中间分支
 */
export function hasBlockMid(type: SequenceBlockType): boolean {
  return type in BLOCK_MID_KEYWORD;
}
