/**
 * Timeline AST 类型定义
 * 对齐官方 timelineDb.js 的数据结构
 */

/** Timeline 事件（AST 层） */
export interface TimelineEventAST {
  label: string;
  time?: string;
}

/** Timeline 时间段（AST 层） */
export interface TimelinePeriodAST {
  label: string;
  events: TimelineEventAST[];
}

/** Timeline 区段（AST 层） */
export interface TimelineSectionAST {
  name?: string;
  periods: TimelinePeriodAST[];
}

/** Timeline AST 根节点 */
export interface TimelineAST {
  title?: string;
  accTitle?: string;
  accDescription?: string;
  direction?: 'LR' | 'TB';
  sections: TimelineSectionAST[];
}
