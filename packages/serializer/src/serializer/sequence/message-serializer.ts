/**
 * sequence 序列化器 — 消息序列化
 *
 * 单一职责：将 MermaidEdge[]（消息）序列化为 Mermaid 消息代码
 *
 * 输出格式:
 *   - "A->>B: message\n"
 *   - "activate A\n" / "deactivate A\n"
 *   - "create participant C\n" + "A->>C: message\n"
 *   - "destroy C\n" + "A->>C: message\n"
 */

import type { MermaidEdge, SequenceArrowType } from '../../types.js';

/** SequenceArrowType → Mermaid 箭头语法 */
const ARROW_SYNTAX: Record<SequenceArrowType, string> = {
  // 基本箭头
  'solid-arrow': '->>',
  'dotted-arrow': '-->>',
  'solid-open': '->',
  'dotted-open': '-->',
  'solid-cross': '-x',
  'dotted-cross': '--x',
  'solid-point': '-)',
  'dotted-point': '--)',
  // 双向箭头
  'bidirectional-solid': '<<->>',
  'bidirectional-dotted': '<<-->>',
  // 异步箭头实线
  'solid-top': '-|\\',
  'solid-bottom': '-|/',
  'stick-top': '-\\\\',
  'stick-bottom': '-/\\',
  // 异步箭头点线
  'solid-top-dotted': '--|\\',
  'solid-bottom-dotted': '--|/',
  'stick-top-dotted': '--\\\\',
  'stick-bottom-dotted': '--/\\',
  // 反向异步箭头实线
  'solid-arrow-top-reverse': '/|-',
  'solid-arrow-bottom-reverse': '\\|-',
  'stick-arrow-top-reverse': '/\\-',
  'stick-arrow-bottom-reverse': '\\\\-',
  // 反向异步箭头点线
  'solid-arrow-top-reverse-dotted': '/|--',
  'solid-arrow-bottom-reverse-dotted': '\\|--',
  'stick-arrow-top-reverse-dotted': '/\\--',
  'stick-arrow-bottom-reverse-dotted': '\\\\--',
  // 中心连接
  'central-connection': '--',
  'central-connection-reverse': '--',
  'central-connection-dual': '--',
};

/**
 * 序列化单条消息
 *
 * @param edge - 消息边
 * @param indent - 缩进（用于块内消息）
 * @returns 序列化后的代码行（不含换行）
 */
export function serializeMessage(edge: MermaidEdge, indent = ''): string[] {
  const lines: string[] = [];
  const arrowType = (edge.data.messageType ?? 'solid-arrow') as SequenceArrowType;
  const arrow = ARROW_SYNTAX[arrowType] ?? '->>';
  const message = edge.data.label ?? '';
  const activate = readBooleanField(edge.data, 'activate');
  const deactivate = readBooleanField(edge.data, 'deactivate');

  // activate 简写：若 activate=true，使用 + 后缀（不再输出独立 activate 语句）
  // deactivate 简写：若 deactivate=true，使用 - 后缀
  // 注意：+ 加在 target 前，- 也加在 target 前（mermaid 语法约定）
  let suffix = '';
  if (activate && deactivate) {
    // 同时激活和停用：mermaid 不支持同一条消息同时 +/-，优先 activate
    suffix = '+';
  } else if (activate) {
    suffix = '+';
  } else if (deactivate) {
    suffix = '-';
  }

  // 双向箭头特殊语法
  if (arrowType === 'bidirectional-solid' || arrowType === 'bidirectional-dotted') {
    lines.push(`${indent}${edge.source}${arrow}${suffix}${edge.target}: ${message}`);
    return lines;
  }

  lines.push(`${indent}${edge.source}${arrow}${suffix}${edge.target}: ${message}`);
  return lines;
}

/**
 * 序列化 activate/deactivate 语句
 * 当使用 +/- 后缀时，不再输出独立 activate/deactivate 语句
 * 仅当消息未使用后缀但需要显式 activate/deactivate 时才输出（保留兼容）
 */
export function serializeActivate(edge: MermaidEdge, indent = ''): string[] {
  // 使用 +/- 后缀后，不再需要独立 activate/deactivate 语句
  // 保留此函数为空实现，避免破坏调用方接口
  void edge;
  void indent;
  return [];
}

/** 安全读取布尔字段 */
function readBooleanField(data: Record<string, unknown>, key: string): boolean | undefined {
  const v = data[key];
  return typeof v === 'boolean' ? v : undefined;
}
