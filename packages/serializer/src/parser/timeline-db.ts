/**
 * TimelineDB — 官方 TimelineDB 移植版（M10 决策 1）
 *
 * 单一职责：存储 timeline 解析过程中的状态（direction/sections/tasks/events）
 *
 * 移植来源: mermaid-develop/packages/mermaid/src/diagrams/timeline/timelineDb.js
 *
 * 移植修改:
 *   - 去除 commonDb 依赖（setDiagramTitle/setAccTitle/setAccDescription 直接定义在类中）
 *   - 去除模块级变量（改为类字段，避免多次解析互相干扰，对齐 M8 gantt-db.ts）
 *   - 构造函数中 bind 所有方法（jison parser 遍历 this.yy 的 own 属性）
 *   - 新增 ErrorCollector 集成
 *   - direction 类型收窄为 'LR' | 'TB'（对齐 types.ts）
 *
 * 数据流:
 *   jison 解析器 → TimelineDB.addSection/addTask/addEvent/setDirection/... → TimelineDB.getTasks() → TimelineTask[]
 *
 * 注意:
 *   - compileTasks 是空操作（官方实现仅标记 processed，保留以对齐官方结构）
 *   - addTask(period, length, event) 三参数完整支持（官方 jison 传 0, ''）
 *   - score 字段是官方内部字段，不映射到 TimelinePeriod（types.ts 无此字段）
 */

import type { ParseError } from '../types.js';
import { ErrorCollector } from '../error-collector.js';

/**
 * Timeline 任务（时间段 + 事件，DB 内部类型）
 *
 * 对应 TimelinePeriod:
 *   - task → label
 *   - events (string[]) → events (TimelineEvent[])（在 parser 中映射）
 *   - score 不映射（types.ts TimelinePeriod 无此字段）
 */
export interface TimelineTask {
  id: number;
  section: string;
  type: string;
  task: string;
  score: number;
  events: string[];
  processed?: boolean;
}

/**
 * TimelineDB 移植版
 *
 * 每次 parseTimelineCode 调用时创建新实例，避免状态污染
 *
 * 错误收集: 构造函数接收外部 ErrorCollector，确保内部错误传递到外部
 * （单一数据源原则，避免错误收集器分裂导致错误丢失）
 */
export class TimelineDB {
  private currentSection = '';
  private currentTaskId = 0;
  private direction: 'LR' | 'TB' = 'LR';
  private sections: string[] = [];
  private tasks: TimelineTask[] = [];
  private rawTasks: TimelineTask[] = [];
  private title = '';
  private accTitle = '';
  private accDescription = '';
  private readonly errorCollector: ErrorCollector;

  // ============================================================
  // 构造函数
  // ============================================================

  /**
   * @param errorCollector - 外部错误收集器，未提供时内部创建
   */
  constructor(errorCollector?: ErrorCollector) {
    this.errorCollector = errorCollector ?? new ErrorCollector();
    // jison parser 的 parse 函数会遍历 this.yy 的 own 属性复制到 sharedState
    // 方法在原型链上不会被复制，因此所有 jison 调用的方法都在构造函数中 bind
    // 使其成为实例的 own 属性（对齐 GanttDB 的处理方式）
    this.clear = this.clear.bind(this);
    this.setDirection = this.setDirection.bind(this);
    this.getDirection = this.getDirection.bind(this);
    this.addSection = this.addSection.bind(this);
    this.getSections = this.getSections.bind(this);
    this.addTask = this.addTask.bind(this);
    this.addEvent = this.addEvent.bind(this);
    this.addTaskOrg = this.addTaskOrg.bind(this);
    this.getTasks = this.getTasks.bind(this);
    this.setDiagramTitle = this.setDiagramTitle.bind(this);
    this.getDiagramTitle = this.getDiagramTitle.bind(this);
    this.setAccTitle = this.setAccTitle.bind(this);
    this.getAccTitle = this.getAccTitle.bind(this);
    this.setAccDescription = this.setAccDescription.bind(this);
    this.getAccDescription = this.getAccDescription.bind(this);
    this.getErrorCollector = this.getErrorCollector.bind(this);
  }

  // ============================================================
  // 清理和初始化
  // ============================================================

  clear(): void {
    this.sections = [];
    this.tasks = [];
    this.currentSection = '';
    this.currentTaskId = 0;
    this.rawTasks = [];
    this.direction = 'LR';
    this.title = '';
    this.accTitle = '';
    this.accDescription = '';
    this.errorCollector.clear();
  }

  getErrorCollector(): ErrorCollector {
    return this.errorCollector;
  }

  // ============================================================
  // title / accTitle / accDescription（从 commonDb 移植）
  // ============================================================

  setDiagramTitle(txt: string): void {
    this.title = txt;
  }

  getDiagramTitle(): string {
    return this.title;
  }

  setAccTitle(txt: string): void {
    this.accTitle = txt;
  }

  getAccTitle(): string {
    return this.accTitle;
  }

  setAccDescription(txt: string): void {
    this.accDescription = txt;
  }

  getAccDescription(): string {
    return this.accDescription;
  }

  // ============================================================
  // direction
  // ============================================================

  setDirection(dir: 'LR' | 'TB'): void {
    this.direction = dir;
  }

  getDirection(): 'LR' | 'TB' {
    return this.direction;
  }

  // ============================================================
  // section
  // ============================================================

  addSection(txt: string): void {
    this.currentSection = txt.trim();
    this.sections.push(this.currentSection);
  }

  getSections(): string[] {
    return this.sections;
  }

  // ============================================================
  // task 管理
  // ============================================================

  /**
   * 添加任务（时间段）
   *
   * @param period - 时间段标签（如 'January'）
   * @param length - 时间段长度（官方 jison 传 0，未使用）
   * @param event - 初始事件（官方 jison 传 ''，表示无初始事件）
   */
  addTask(period: string, length: number | undefined, event: string | undefined): void {
    const trimmedPeriod = period.trim();
    const rawTask: TimelineTask = {
      id: this.currentTaskId++,
      section: this.currentSection,
      type: this.currentSection,
      task: trimmedPeriod,
      score: length ? length : 0,
      events: event ? [event] : [],
    };
    this.rawTasks.push(rawTask);
  }

  /**
   * 追加事件到当前 task（续行事件 `: Event` 或多事件同行 `: Event1 : Event2`）
   *
   * 当前 task = currentTaskId - 1（最近一次 addTask 创建的 task）
   *
   * 注意: 官方实现 trim 事件标签，避免 jison event 正则捕获尾随空格
   */
  addEvent(event: string): void {
    const currentTask = this.rawTasks.find((task) => task.id === this.currentTaskId - 1);
    if (currentTask) {
      currentTask.events.push(event.trim());
    } else {
      this.errorCollector.addError(
        0, 0,
        `addEvent called without a current task: "${event}"`,
      );
    }
  }

  /**
   * 添加任务（无事件，官方 addTaskOrg，保留以对齐官方结构）
   */
  addTaskOrg(descr: string): void {
    const newTask: TimelineTask = {
      id: this.currentTaskId++,
      section: this.currentSection,
      type: this.currentSection,
      task: descr,
      score: 0,
      events: [],
    };
    this.tasks.push(newTask);
  }

  /**
   * 获取编译后的任务列表
   *
   * compileTasks 是空操作（官方实现仅标记 processed，保留以对齐官方结构）
   * 将 rawTasks 合并到 tasks 后返回，并清空 rawTasks 避免重复调用导致任务重复
   */
  getTasks(): TimelineTask[] {
    compileTasks();
    this.tasks.push(...this.rawTasks);
    this.rawTasks = [];
    return this.tasks;
  }
}

/**
 * 编译任务（官方实现是空操作，仅标记 processed）
 *
 * 保留以对齐官方结构
 */
function compileTasks(): boolean {
  // 官方实现仅标记 processed，实际无操作
  return true;
}

/**
 * 从错误对象提取行号
 */
export function extractLine(err: unknown): number {
  if (err && typeof err === 'object') {
    const line = (err as { line?: unknown }).line;
    if (typeof line === 'number') return line;
  }
  return 1;
}

/**
 * 从错误对象提取列号
 */
export function extractColumn(err: unknown): number {
  if (err && typeof err === 'object') {
    const column = (err as { column?: unknown }).column;
    if (typeof column === 'number') return column;
  }
  return 1;
}

/**
 * 从错误对象提取消息
 */
export function extractMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message || 'timeline parse error';
  }
  if (typeof err === 'string') return err;
  return 'timeline parse error';
}

/**
 * 从错误对象构建 ParseError
 */
export function buildParseError(err: unknown, source: string): ParseError {
  const line = extractLine(err);
  return {
    line,
    column: extractColumn(err),
    message: extractMessage(err),
    severity: 'error',
    context: source.split('\n')[line - 1] ?? undefined,
  };
}
