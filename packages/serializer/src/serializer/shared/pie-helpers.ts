/**
 * Pie 辅助函数 — label 转义和百分比计算
 *
 * 单一职责：提供 pie 序列化器和渲染器共用的纯函数工具
 * 复用 escape-helpers.ts 的 escapeStringLiteral/unescapeStringLiteral，仅添加双引号包裹逻辑
 */

import { escapeStringLiteral, unescapeStringLiteral } from './escape-helpers.js';

/**
 * 转义 pie 切片 label（调用 escapeStringLiteral 转义 \" 和 \\，再用双引号包裹）
 *
 * 官方语法：`"Label" : value`，label 强制双引号包裹，内部支持转义 \" 和 \\
 */
export function escapePieLabel(label: string): string {
  return `"${escapeStringLiteral(label)}"`;
}

/**
 * 反转义 pie 切片 label（去除双引号包裹，调用 unescapeStringLiteral 反转义）
 *
 * 输入应为 `"Label"` 形式，若无双引号则原样返回（容错处理）
 */
export function unescapePieLabel(label: string): string {
  // 去除首尾双引号（仅当成对存在时）
  if (label.length >= 2 && label.startsWith('"') && label.endsWith('"')) {
    const inner = label.slice(1, -1);
    return unescapeStringLiteral(inner);
  }
  return label;
}

/**
 * 计算切片百分比
 *
 * @param value - 切片值
 * @param total - 总值
 * @returns 百分比（0-100），total 为 0 时返回 0
 */
export function calculatePercentage(value: number, total: number): number {
  if (total <= 0) return 0;
  return (value / total) * 100;
}
