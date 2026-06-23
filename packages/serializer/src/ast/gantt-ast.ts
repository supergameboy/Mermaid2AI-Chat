/**
 * Gantt AST 类型定义
 * 对齐官方 ganttDb.js 的数据结构
 *
 * v4 根因修复：与 types.ts 的 GanttTask/GanttCanvasState 保持一致
 *   - 移除 status/afterId（统一用 tags/dependencies）
 *   - 新增 clickUrl
 *   - dateFormat 必填
 *   - weekday 收窄为 'sunday' | 'monday'
 */

/** Gantt 任务（AST 层） */
export interface GanttTaskAST {
  id?: string;
  label: string;
  startDate?: string;
  duration?: string;
  endDate?: string;
  /** 多标签组合（如 ['done', 'crit']） */
  tags?: string[];
  /** 多依赖（如 ['t1', 't2']） */
  dependencies?: string[];
  priority?: 'high' | 'medium' | 'low';
  /** click href URL */
  clickUrl?: string;
}

/** Gantt 区段（AST 层） */
export interface GanttSectionAST {
  name: string;
  tasks: GanttTaskAST[];
}

/** Gantt AST 根节点 */
export interface GanttAST {
  title?: string;
  accTitle?: string;
  accDescription?: string;
  /** dateFormat 必填（官方 gantt 语法要求） */
  dateFormat: string;
  axisFormat?: string;
  tickInterval?: string;
  todayMarker?: string;
  excludes?: string[];
  includes?: string[];
  weekday?: 'sunday' | 'monday';
  weekend?: 'friday' | 'saturday';
  inclusiveEndDates?: boolean;
  topAxis?: boolean;
  displayMode?: 'compact' | 'regular';
  sections: GanttSectionAST[];
}
