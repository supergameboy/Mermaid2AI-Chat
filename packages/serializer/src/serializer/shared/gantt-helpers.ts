/**
 * Gantt 辅助函数（v4 新增）
 *
 * 单一职责：提供 gantt 序列化器的任务行格式化、依赖格式化、标签验证工具
 *
 * 设计依据:
 *   - v4 根因修复：GanttTask 移除 status/afterId，统一使用 tags/dependencies
 *   - round-trip 一致性：序列化格式必须能被解析器还原
 *
 * 官方 gantt 任务行语法（对齐 ganttDb.js parseData）:
 *   1 字段: :duration                     → start=prevTaskEnd, end=duration, id 自动生成
 *   2 字段: :start, end                    → id 自动生成
 *   3 字段: :id, start, end                → 无 tags
 *   4+ 字段: :tag1, tag2, id, start, end   → tags 在前，id 倒数第 3，start 倒数第 2，end 最后
 *
 * 序列化规则（保证 round-trip 一致性）:
 *   - 有 tags 时必须输出 id（否则解析时 id 会被错误识别为 start）
 *   - 无 tags 时 id 可选
 *   - dependencies 优先于 startDate 作为 start 字段
 *   - duration 优先于 endDate 作为 end 字段
 */

import type { GanttTask } from '../../types.js';

/** 官方支持的标签（用于 isOfficialTag 判断） */
const OFFICIAL_TAGS = new Set(['active', 'done', 'crit', 'milestone']);

/**
 * 判断标签是否为官方标签
 *
 * 官方标签: active/done/crit/milestone
 * 非官方标签也会被保留（tags: string[] 不限制具体值），但渲染时可能被忽略
 */
export function isOfficialTag(tag: string): boolean {
  return OFFICIAL_TAGS.has(tag);
}

/**
 * 验证 dateFormat 是否有效
 *
 * dateFormat 必填，不能为空
 * 不验证具体格式字符串（dayjs 会处理），仅检查非空
 */
export function validateDateFormat(dateFormat: string): boolean {
  return dateFormat.trim().length > 0;
}

/**
 * 格式化依赖数组为 "after t1 t2" 表达式
 *
 * @param dependencies - 依赖任务 ID 数组（如 ['t1', 't2']）
 * @returns "after t1 t2" 表达式，或 null（无依赖时）
 */
export function formatDependencies(dependencies: string[] | undefined): string | null {
  if (!dependencies || dependencies.length === 0) {
    return null;
  }
  return `after ${dependencies.join(' ')}`;
}

/**
 * 格式化 tags 数组为逗号分隔的字符串
 *
 * @param tags - 标签数组（如 ['done', 'crit']）
 * @returns "done, crit" 或空字符串
 */
export function formatTags(tags: string[] | undefined): string {
  if (!tags || tags.length === 0) {
    return '';
  }
  return tags.join(', ');
}

/**
 * 格式化 GanttTask 为完整的任务行
 *
 * 输出格式（对齐官方 gantt 语法）:
 *   - 有 tags + id + start + end: "TaskLabel :done, crit, id, 2024-01-01, 7d"
 *   - 有 tags + id + dependencies + end: "TaskLabel :active, id, after t1 t2, 5d"
 *   - 有 id + start + end: "TaskLabel :id, 2024-01-01, 7d"
 *   - 有 start + end: "TaskLabel :2024-01-01, 7d"
 *   - 只有 duration: "TaskLabel :7d"
 *   - 无任何字段: "TaskLabel"
 *
 * round-trip 一致性:
 *   - 有 tags 时必须输出 id（否则解析时 id 会被错误识别为 start）
 *   - dependencies 优先于 startDate 作为 start 字段
 *   - duration 优先于 endDate 作为 end 字段
 *
 * @param task - GanttTask
 * @returns 任务行字符串
 */
export function formatTaskLine(task: GanttTask): string {
  const { tags, id, dependencies, startDate, duration, endDate } = task;

  const hasTags = tags !== undefined && tags.length > 0;
  const hasId = id !== undefined && id !== '';
  const hasDependencies = dependencies !== undefined && dependencies.length > 0;
  const hasStartDate = startDate !== undefined && startDate !== '';
  const hasDuration = duration !== undefined && duration !== '';
  const hasEndDate = endDate !== undefined && endDate !== '';

  // 有 tags 时必须输出 id（否则解析时 id 会被错误识别为 start，破坏 round-trip 一致性）
  // 这是数据创建时的程序错误，不可包容，必须抛异常暴露
  if (hasTags && !hasId) {
    throw new Error(
      `GanttTask "${task.label}" has tags but no id: tags require id for round-trip consistency`
    );
  }

  const parts: string[] = [];

  // 1. 标签（在前）— 类型守卫已确保 tags 非空
  if (tags !== undefined && tags.length > 0) {
    parts.push(...tags);
  }

  // 2. id（如果有 tags 或有其他字段需要输出）— 类型守卫已确保 id 非空
  if (id !== undefined && id !== '') {
    parts.push(id);
  }

  // 3. start（dependencies 优先于 startDate）
  if (dependencies !== undefined && dependencies.length > 0) {
    const depStr = formatDependencies(dependencies);
    if (depStr !== null) {
      parts.push(depStr);
    }
  } else if (startDate !== undefined && startDate !== '') {
    parts.push(startDate);
  }

  // 4. end（duration 优先于 endDate）
  if (duration !== undefined && duration !== '') {
    parts.push(duration);
  } else if (endDate !== undefined && endDate !== '') {
    parts.push(endDate);
  }

  // 组装
  if (parts.length > 0) {
    return `${task.label} :${parts.join(', ')}`;
  }
  return task.label;
}

/**
 * 格式化 click URL 为 click 语句
 *
 * 官方语法: click taskId href "url"
 *
 * @param taskId - 任务 ID
 * @param url - click URL
 * @returns "click taskId href \"url\"" 或 null（无 url 时）
 */
export function formatClickStatement(taskId: string, url: string | undefined): string | null {
  if (!url) {
    return null;
  }
  return `click ${taskId} href "${url}"`;
}

/**
 * 格式化 excludes/includes 列表为字符串
 *
 * 官方语法: excludes weekends, monday, 2024-01-15
 *
 * @param list - 排除/包含列表
 * @returns "weekends, monday, 2024-01-15" 或空字符串
 */
export function formatExcludesList(list: string[] | undefined): string {
  if (!list || list.length === 0) {
    return '';
  }
  return list.join(', ');
}
