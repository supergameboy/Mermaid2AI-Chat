/**
 * Timeline 辅助函数
 *
 * 单一职责：提供 timeline 序列化器和渲染器共用的纯函数工具
 *
 * 设计依据:
 *   - 决策 6：续行事件解析（`: Event` 格式）
 *   - 决策 7：多事件序列化用 `: Event1 : Event2` 格式
 *   - 决策 8：section 用虚线框分组
 */

import type { TimelineSection } from '../../types.js';

/**
 * 检测续行事件（行首为 `:` 表示追加到上一时间段）
 *
 * 官方语法：`2004 : Facebook` 后续行 `: Google` 表示追加 Google 到 2004 的事件列表
 *
 * @param line - 单行文本（已 trim）
 * @returns true 表示该行是续行事件
 */
export function isContinuationEvent(line: string): boolean {
  const trimmed = line.trimStart();
  return trimmed.startsWith(':') && trimmed.length > 1;
}

/**
 * 分割多事件行（`Period : Event1 : Event2` → { period, events }）
 *
 * 官方语法：`January : Team hired : Tech stack chosen` 表示 January 有两个事件
 *
 * @param line - 单行文本（含 period 和 events）
 * @returns period 标签和 events 数组
 */
export function splitPeriodAndEvents(line: string): { period: string; events: string[] } {
  // 按 ` : ` 分割（冒号前后可能有空格）
  // 官方 jison event 正则：`:\s(?:[^:\n]|":"(?!\s))+`
  // 即 event 以 `:` 开头，后跟非空内容，内容中不含 `:` 后接空格
  const parts = line.split(/\s*:\s*/);
  const period = (parts[0] ?? '').trim();
  const events = parts.slice(1).map((e) => e.trim()).filter((e) => e.length > 0);
  return { period, events };
}

/**
 * 计算 section 数量（用于布局）
 *
 * Timeline sections 是扁平结构（非嵌套），返回 section 数量
 * 渲染器根据 section 数量决定是否显示 section 分组框
 *
 * @param sections - TimelineSection 数组
 * @returns section 数量（0 表示无 section，所有 periods 在默认区域）
 */
export function calculateSectionDepth(sections: TimelineSection[]): number {
  return sections.length;
}

/**
 * 格式化时间段行（多事件同行格式）
 *
 * 决策 7：序列化统一用多事件同行格式 `PeriodLabel : Event1 : Event2`
 * 续行事件格式仅用于解析，序列化时不使用
 *
 * @param periodLabel - 时间段标签
 * @param eventLabels - 事件标签数组
 * @returns 格式化的行（如 `January : Team hired : Tech stack chosen`）
 */
export function formatPeriodLine(periodLabel: string, eventLabels: string[]): string {
  if (eventLabels.length === 0) {
    return periodLabel;
  }
  return `${periodLabel} : ${eventLabels.join(' : ')}`;
}
