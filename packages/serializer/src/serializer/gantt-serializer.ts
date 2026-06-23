/**
 * Gantt 序列化器
 *
 * 单一职责：将 GanttCanvasState 序列化为 Mermaid gantt 代码
 *
 * 数据流:
 *   GanttCanvasState
 *     → serializeGantt(canvas)
 *     → 输出 gantt 代码
 *
 * 序列化规则（对齐官方 gantt 语法）:
 *   1. 输出 'gantt'
 *   2. 输出 title（如有）
 *   3. 输出 accTitle（如有）
 *   4. 输出 accDescription（如有）
 *   5. 输出 dateFormat（必填，缺失则报错）
 *   6. 输出 axisFormat/tickInterval/todayMarker（如有）
 *   7. 输出 excludes/includes（如有）
 *   8. 输出 weekday/weekend（如有非默认值）
 *   9. 输出 inclusiveEndDates/topAxis/displayMode（如有）
 *   10. 遍历 sections：输出 section + tasks
 *   11. 遍历 tasks：输出 click（如有 task.clickUrl）
 *
 * v4 根因修复:
 *   - tags/dependencies 统一使用数组（移除 status/afterId）
 *   - clickUrl 从 GanttTask.clickUrl 读取（单一数据源）
 *   - dateFormat 必填
 */

import type {
  GanttCanvasState,
  GanttSection,
  GanttTask,
  SerializeResult,
  ParseError,
} from '../types.js';
import {
  formatTaskLine,
  formatClickStatement,
  formatExcludesList,
  validateDateFormat,
} from './shared/gantt-helpers.js';

// ============================================================
// 主入口
// ============================================================

/**
 * 序列化 GanttCanvasState 为 Mermaid gantt 代码
 *
 * @param canvas - GanttCanvasState
 * @returns SerializeResult，包含 mermaid 代码和错误
 */
export function serializeGantt(canvas: GanttCanvasState): SerializeResult {
  if (canvas.diagramType !== 'gantt') {
    return {
      mermaid: '',
      errors: [{
        line: 0,
        column: 0,
        message: `Expected gantt canvas, got ${canvas.diagramType}`,
        severity: 'error',
      }],
    };
  }

  const errors: ParseError[] = [];
  const lines: string[] = ['gantt'];

  // 1. title（如有）
  if (canvas.title) {
    lines.push(`title ${canvas.title}`);
  }

  // 2. accTitle（如有）— jison 文法要求 "accTitle: value"（带冒号）
  if (canvas.accTitle) {
    lines.push(`accTitle: ${canvas.accTitle}`);
  }

  // 3. accDescription（如有）— jison 文法支持 "accDescription value"（不带冒号）
  if (canvas.accDescription) {
    lines.push(`accDescription ${canvas.accDescription}`);
  }

  // 4. dateFormat（必填）
  if (!validateDateFormat(canvas.dateFormat)) {
    errors.push({
      line: 0,
      column: 0,
      message: 'dateFormat is required for gantt diagram (e.g., "dateFormat YYYY-MM-DD")',
      severity: 'error',
    });
  } else {
    lines.push(`dateFormat ${canvas.dateFormat}`);
  }

  // 5. axisFormat（如有）
  if (canvas.axisFormat) {
    lines.push(`axisFormat ${canvas.axisFormat}`);
  }

  // 6. tickInterval（如有）
  if (canvas.tickInterval) {
    lines.push(`tickInterval ${canvas.tickInterval}`);
  }

  // 7. excludes（如有）
  const excludesStr = formatExcludesList(canvas.excludes);
  if (excludesStr) {
    lines.push(`excludes ${excludesStr}`);
  }

  // 8. includes（如有）
  const includesStr = formatExcludesList(canvas.includes);
  if (includesStr) {
    lines.push(`includes ${includesStr}`);
  }

  // 9. todayMarker（如有）
  if (canvas.todayMarker) {
    lines.push(`todayMarker ${canvas.todayMarker}`);
  }

  // 10. weekday（如有，默认 sunday）
  if (canvas.weekday && canvas.weekday !== 'sunday') {
    lines.push(`weekday ${canvas.weekday}`);
  }

  // 11. weekend（如有，默认 saturday）
  if (canvas.weekend && canvas.weekend !== 'saturday') {
    lines.push(`weekend ${canvas.weekend}`);
  }

  // 12. inclusiveEndDates（如有）
  if (canvas.inclusiveEndDates) {
    lines.push('inclusiveEndDates');
  }

  // 13. topAxis（如有）
  if (canvas.topAxis) {
    lines.push('topAxis');
  }

  // 14. displayMode（如有）
  if (canvas.displayMode) {
    lines.push(`displayMode ${canvas.displayMode}`);
  }

  // 15. 遍历 sections
  for (const section of canvas.sections) {
    lines.push(...serializeSection(section));
  }

  // 16. 遍历 sections 中的 tasks，输出 click 语句
  for (const section of canvas.sections) {
    for (const task of section.tasks) {
      if (task.id && task.clickUrl) {
        const clickLine = formatClickStatement(task.id, task.clickUrl);
        if (clickLine) {
          lines.push(clickLine);
        }
      }
    }
  }

  return {
    mermaid: lines.join('\n'),
    errors,
  };
}

// ============================================================
// 序列化辅助函数
// ============================================================

/**
 * 序列化 section
 *
 * 输出格式:
 *   section SectionName
 *   Task1 :tag1, id, start, end
 *   Task2 :tag2, id, after t1, 5d
 *
 * 如果 section.name 为空，仍然输出 "section" 头（官方语法要求）
 */
function serializeSection(section: GanttSection): string[] {
  const lines: string[] = [];
  lines.push(`section ${section.name}`);

  for (const task of section.tasks) {
    lines.push(formatTaskLine(task));
  }

  return lines;
}
