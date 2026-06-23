/**
 * GanttDB — 官方 GanttDB 移植版（M8 决策 1）
 *
 * 单一职责：存储 gantt 解析过程中的状态，编译任务（解析依赖、计算日期）
 *
 * 移植来源: mermaid-develop/packages/mermaid/src/diagrams/gantt/ganttDb.js
 *
 * 移植修改:
 *   - 去除 DOM/D3/getConfig 依赖（sanitizeUrl/window.open/document.querySelector/setClass/pushFun/bindFunctions）
 *   - 去除 commonClear 依赖（自己实现 clear）
 *   - 保留 dayjs 及其插件（日期计算核心）
 *   - 保留 compileTasks 逻辑（解析依赖、计算日期）
 *   - 适配 v4 类型：tags/dependencies/clickUrl（移除 status/afterId）
 *   - 改为类实现（避免模块级变量导致的多次解析互相干扰）
 *
 * 数据流:
 *   jison 解析器 → GanttDB.addTask/setLink/setDateFormat/... → GanttDB.getTasks() → 编译后的任务
 *
 * v4 根因修复:
 *   - 移除 status/afterId（统一使用 tags/dependencies）
 *   - 新增 clickUrl（click href URL 存储）
 *   - dateFormat 必填
 *   - weekday 收窄为 'sunday' | 'monday'
 */

import dayjs from 'dayjs';
import dayjsIsoWeek from 'dayjs/plugin/isoWeek.js';
import dayjsCustomParseFormat from 'dayjs/plugin/customParseFormat.js';
import dayjsAdvancedFormat from 'dayjs/plugin/advancedFormat.js';
import type { GanttTask } from '../types.js';
import type { ParseError } from '../types.js';
import { ErrorCollector } from '../error-collector.js';

dayjs.extend(dayjsIsoWeek);
dayjs.extend(dayjsCustomParseFormat);
dayjs.extend(dayjsAdvancedFormat);

/** dayjs 操作类型（对齐官方 parseDuration 返回值） */
type DayjsUnit = 'y' | 'M' | 'w' | 'd' | 'h' | 'm' | 's' | 'ms';

/** 周末起始日映射 */
const WEEKEND_START_DAY: Record<string, number> = { friday: 5, saturday: 6 };

/** 官方支持的标签（用于 getTaskTags 提取） */
const OFFICIAL_TAGS = ['active', 'done', 'crit', 'milestone'];

/**
 * GanttDB 内部任务类型（含 section 字段，用于按 section 分组）
 *
 * 转换为 GanttTask 时丢弃 section 字段（section 信息已通过 sections 结构表达）
 */
export interface GanttDBTask extends GanttTask {
  /** 所属 section 名称 */
  section: string;
  /** 解析后的开始时间（Date 对象，内部使用） */
  startTime?: Date | string;
  /** 解析后的结束时间（Date 对象，内部使用） */
  endTime?: Date | string;
  /** 渲染用的结束时间（排除后的实际结束时间） */
  renderEndTime?: Date | null;
  /** 是否手动设置结束时间 */
  manualEndTime?: boolean;
  /** 任务顺序（用于排序） */
  order?: number;
}

/** 原始任务数据（解析时存储，编译时处理） */
interface RawTask {
  section: string;
  type: string;
  processed: boolean;
  manualEndTime: boolean;
  renderEndTime: Date | null;
  raw: {
    data: string;
    startTime: { type: string; id?: string; startData?: string };
    endTime: { data: string };
  };
  task: string;
  classes: string[];
  id: string;
  prevTaskId: string | undefined;
  tags: string[];
  order: number;
  // 编译后填充
  startTime?: Date | string;
  endTime?: Date | string;
}

/**
 * GanttDB 移植版
 *
 * 每次 parseGantt 调用时创建新实例，避免状态污染
 */
export class GanttDB {
  private dateFormat = '';
  private axisFormat = '';
  private tickInterval: string | undefined = undefined;
  private todayMarker = '';
  private includes: string[] = [];
  private excludes: string[] = [];
  private links = new Map<string, string>();
  private sections: string[] = [];
  private tasks: GanttDBTask[] = [];
  private currentSection = '';
  private displayMode = '';
  private diagramId = '';
  private inclusiveEndDates = false;
  private topAxis = false;
  private weekday: string = 'sunday';
  private weekend: string = 'saturday';
  private lastOrder = 0;
  private taskCnt = 0;
  private lastTaskID: string | undefined = undefined;
  private rawTasks: RawTask[] = [];
  private taskDb: Record<string, number> = {};
  private title = '';
  private accTitle = '';
  private accDescription = '';
  private errorCollector = new ErrorCollector();

  // ============================================================
  // 构造函数
  // ============================================================

  constructor() {
    // jison parser 的 parse 函数会遍历 this.yy 的 own 属性复制到 sharedState
    // 方法在原型链上不会被复制，因此所有 jison 调用的方法都在构造函数中 bind
    // 使其成为实例的 own 属性（对齐 FlowDB 的处理方式）
    this.setDiagramId = this.setDiagramId.bind(this);
    this.setDiagramTitle = this.setDiagramTitle.bind(this);
    this.getDiagramTitle = this.getDiagramTitle.bind(this);
    this.setAccTitle = this.setAccTitle.bind(this);
    this.getAccTitle = this.getAccTitle.bind(this);
    this.setAccDescription = this.setAccDescription.bind(this);
    this.getAccDescription = this.getAccDescription.bind(this);
    this.setDateFormat = this.setDateFormat.bind(this);
    this.getDateFormat = this.getDateFormat.bind(this);
    this.setAxisFormat = this.setAxisFormat.bind(this);
    this.getAxisFormat = this.getAxisFormat.bind(this);
    this.setTickInterval = this.setTickInterval.bind(this);
    this.getTickInterval = this.getTickInterval.bind(this);
    this.setTodayMarker = this.setTodayMarker.bind(this);
    this.getTodayMarker = this.getTodayMarker.bind(this);
    this.setIncludes = this.setIncludes.bind(this);
    this.getIncludes = this.getIncludes.bind(this);
    this.setExcludes = this.setExcludes.bind(this);
    this.getExcludes = this.getExcludes.bind(this);
    this.setWeekday = this.setWeekday.bind(this);
    this.getWeekday = this.getWeekday.bind(this);
    this.setWeekend = this.setWeekend.bind(this);
    this.getWeekend = this.getWeekend.bind(this);
    this.enableInclusiveEndDates = this.enableInclusiveEndDates.bind(this);
    this.endDatesAreInclusive = this.endDatesAreInclusive.bind(this);
    this.enableTopAxis = this.enableTopAxis.bind(this);
    this.topAxisEnabled = this.topAxisEnabled.bind(this);
    this.setDisplayMode = this.setDisplayMode.bind(this);
    this.getDisplayMode = this.getDisplayMode.bind(this);
    this.addSection = this.addSection.bind(this);
    this.getSections = this.getSections.bind(this);
    this.setLink = this.setLink.bind(this);
    this.getLinks = this.getLinks.bind(this);
    this.setClickEvent = this.setClickEvent.bind(this);
    this.addTask = this.addTask.bind(this);
    this.getTasks = this.getTasks.bind(this);
    this.isInvalidDate = this.isInvalidDate.bind(this);
    this.parseDuration = this.parseDuration.bind(this);
    this.getErrorCollector = this.getErrorCollector.bind(this);
  }

  // ============================================================
  // 清理和初始化
  // ============================================================

  clear(): void {
    this.sections = [];
    this.tasks = [];
    this.currentSection = '';
    this.taskCnt = 0;
    this.lastTaskID = undefined;
    this.rawTasks = [];
    this.taskDb = {};
    this.dateFormat = '';
    this.axisFormat = '';
    this.displayMode = '';
    this.tickInterval = undefined;
    this.todayMarker = '';
    this.includes = [];
    this.excludes = [];
    this.inclusiveEndDates = false;
    this.topAxis = false;
    this.lastOrder = 0;
    this.links = new Map();
    this.diagramId = '';
    this.title = '';
    this.accTitle = '';
    this.accDescription = '';
    this.weekday = 'sunday';
    this.weekend = 'saturday';
    this.errorCollector.clear();
  }

  setDiagramId(id: string): void {
    this.diagramId = id;
  }

  getErrorCollector(): ErrorCollector {
    return this.errorCollector;
  }

  // ============================================================
  // title / accTitle / accDescription
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
  // dateFormat / axisFormat / tickInterval / todayMarker
  // ============================================================

  setDateFormat(txt: string): void {
    this.dateFormat = txt.trim();
  }

  getDateFormat(): string {
    return this.dateFormat;
  }

  setAxisFormat(txt: string): void {
    this.axisFormat = txt;
  }

  getAxisFormat(): string {
    return this.axisFormat;
  }

  setTickInterval(txt: string): void {
    this.tickInterval = txt;
  }

  getTickInterval(): string | undefined {
    return this.tickInterval;
  }

  setTodayMarker(txt: string): void {
    this.todayMarker = txt;
  }

  getTodayMarker(): string {
    return this.todayMarker;
  }

  // ============================================================
  // includes / excludes
  // ============================================================

  private mergeTokens(existing: string[], txt: string): string[] {
    const tokens = txt
      .toLowerCase()
      .split(/[\s,]+/)
      .filter((t) => t !== '');
    return [...new Set([...existing, ...tokens])];
  }

  setIncludes(txt: string): void {
    this.includes = this.mergeTokens(this.includes, txt);
  }

  getIncludes(): string[] {
    return this.includes;
  }

  setExcludes(txt: string): void {
    this.excludes = this.mergeTokens(this.excludes, txt);
  }

  getExcludes(): string[] {
    return this.excludes;
  }

  // ============================================================
  // weekday / weekend
  // ============================================================

  /**
   * v4 修正：weekday 类型收窄为 'sunday' | 'monday'（官方只支持这两个值）
   * jison 文法支持 7 天，但 GanttDB 内部只接受 sunday/monday，其他值记录错误
   */
  setWeekday(day: string): void {
    if (day === 'sunday' || day === 'monday') {
      this.weekday = day;
    } else {
      this.errorCollector.addError(
        0, 0,
        `Unsupported weekday value: ${day} (only 'sunday' and 'monday' are supported)`,
      );
    }
  }

  getWeekday(): string {
    return this.weekday;
  }

  setWeekend(day: 'friday' | 'saturday'): void {
    this.weekend = day;
  }

  getWeekend(): 'friday' | 'saturday' {
    return this.weekend as 'friday' | 'saturday';
  }

  // ============================================================
  // inclusiveEndDates / topAxis / displayMode
  // ============================================================

  enableInclusiveEndDates(): void {
    this.inclusiveEndDates = true;
  }

  endDatesAreInclusive(): boolean {
    return this.inclusiveEndDates;
  }

  enableTopAxis(): void {
    this.topAxis = true;
  }

  topAxisEnabled(): boolean {
    return this.topAxis;
  }

  setDisplayMode(mode: string): void {
    if (mode === 'compact' || mode === 'regular') {
      this.displayMode = mode;
    } else {
      this.errorCollector.addError(
        0, 0,
        `Unsupported displayMode value: ${mode} (only 'compact' and 'regular' are supported)`,
      );
    }
  }

  getDisplayMode(): 'compact' | 'regular' | undefined {
    return this.displayMode === 'compact' || this.displayMode === 'regular'
      ? this.displayMode
      : undefined;
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
  // links（click href）
  // ============================================================

  getLinks(): Map<string, string> {
    return this.links;
  }

  /**
   * 设置任务链接（click href）
   *
   * 移植说明：
   *   - 去除 sanitizeUrl（简化为直接存储 URL）
   *   - 去除 getConfig().securityLevel 检查
   *   - 去除 pushFun（DOM 操作）
   *   - 去除 setClass（CSS 类）
   *   - 保留逗号分隔的 ID 支持
   */
  setLink(ids: string, url: string): void {
    ids.split(',').forEach((id) => {
      this.links.set(id.trim(), url);
    });
  }

  /**
   * 设置点击事件回调（jison 文法调用）
   *
   * 移植说明：
   *   - 官方实现使用 pushFun 注册 DOM 事件监听器
   *   - 本移植版去除 DOM 依赖，setClickEvent 简化为空操作
   *   - click 事件由编辑器层（React）处理，不需要在解析时注册
   */
  setClickEvent(_ids: string, _functionName: string, _functionArgs: string | null): void {
    // 空操作：DOM 事件注册由编辑器层处理
  }

  // ============================================================
  // task 管理
  // ============================================================

  /**
   * 添加任务（jison 文法调用）
   *
   * @param descr - 任务标签
   * @param data - 任务数据字符串（如 ":done, crit, id, 2024-01-01, 7d"）
   */
  addTask(descr: string, data: string): void {
    // trim label：jison 文法解析 taskTxt 时使用 /^(?:[^:\n]+)/i 规则
    // 会匹配到 `:` 前的所有字符，包括尾随空格，需要 trim
    const trimmedDescr = descr.trim();
    const rawTask: RawTask = {
      section: this.currentSection,
      type: this.currentSection,
      processed: false,
      manualEndTime: false,
      renderEndTime: null,
      raw: { data: data, startTime: { type: '' }, endTime: { data: '' } },
      task: trimmedDescr,
      classes: [],
      id: '',
      prevTaskId: this.lastTaskID,
      tags: [],
      order: this.lastOrder,
    };

    const taskInfo = this.parseData(this.lastTaskID, data);
    rawTask.raw.startTime = taskInfo.raw.startTime;
    rawTask.raw.endTime = taskInfo.raw.endTime;
    rawTask.id = taskInfo.id;
    rawTask.tags = taskInfo.tags;

    this.lastOrder++;
    const pos = this.rawTasks.push(rawTask);
    this.lastTaskID = rawTask.id;
    this.taskDb[rawTask.id] = pos - 1;
  }

  findTaskById(id: string): RawTask | undefined {
    const pos = this.taskDb[id];
    if (pos === undefined) return undefined;
    return this.rawTasks[pos];
  }

  /**
   * 解析任务数据字符串
   *
   * 数据格式: ":tag1, tag2, id, start, end" 或 "tag1, tag2, id, start, end"
   *
   * @param prevTaskId - 前一个任务的 ID（用于 prevTaskEnd 类型）
   * @param dataStr - 任务数据字符串
   * @returns 解析后的任务信息
   */
  private parseData(
    prevTaskId: string | undefined,
    dataStr: string,
  ): {
    id: string;
    tags: string[];
    raw: {
      startTime: { type: string; id?: string; startData?: string };
      endTime: { data: string };
    };
  } {
    let ds = dataStr;
    if (ds.startsWith(':')) {
      ds = ds.slice(1);
    }

    const data = ds.split(',');
    const tags: string[] = [];

    // 提取标签（active/done/crit/milestone）
    this.getTaskTags(data, tags);

    // trim 所有数据项
    for (let i = 0; i < data.length; i++) {
      data[i] = data[i].trim();
    }

    let id: string;
    let startTime: { type: string; id?: string; startData?: string };
    let endTime: { data: string };

    switch (data.length) {
      case 1:
        id = this.parseId(undefined);
        startTime = { type: 'prevTaskEnd', id: prevTaskId };
        endTime = { data: data[0] };
        break;
      case 2:
        id = this.parseId(undefined);
        startTime = { type: 'getStartDate', startData: data[0] };
        endTime = { data: data[1] };
        break;
      case 3:
        id = this.parseId(data[0]);
        startTime = { type: 'getStartDate', startData: data[1] };
        endTime = { data: data[2] };
        break;
      default:
        // 多于 3 个字段时，前几个是标签，最后两个是 start/end
        id = this.parseId(data[data.length - 3]);
        startTime = { type: 'getStartDate', startData: data[data.length - 2] };
        endTime = { data: data[data.length - 1] };
        break;
    }

    return {
      id,
      tags,
      raw: { startTime, endTime },
    };
  }

  /**
   * 提取任务标签（active/done/crit/milestone）
   *
   * 移植自官方 getTaskTags，改为返回 tags 数组（v4：统一使用 tags）
   */
  private getTaskTags(data: string[], tags: string[]): void {
    let matchFound = true;
    while (matchFound) {
      matchFound = false;
      for (const t of OFFICIAL_TAGS) {
        if (data.length === 0) break;
        const pattern = '^\\s*' + t + '\\s*$';
        const regex = new RegExp(pattern, 'i');
        if (regex.test(data[0])) {
          tags.push(t);
          data.shift();
          matchFound = true;
        }
      }
    }
  }

  private parseId(idStr: string | undefined): string {
    if (idStr === undefined || idStr.trim() === '') {
      this.taskCnt = this.taskCnt + 1;
      return 'task' + this.taskCnt;
    }
    return idStr.trim();
  }

  // ============================================================
  // 日期计算（移植官方）
  // ============================================================

  /**
   * 判断日期是否无效（被排除）
   *
   * @param date - dayjs 日期对象
   * @param dateFormat - 日期格式字符串
   * @param excludes - 排除列表
   * @param includes - 包含列表（优先于排除）
   * @returns true 表示日期无效（被排除）
   */
  isInvalidDate(
    date: dayjs.Dayjs,
    dateFormat: string,
    excludes: string[],
    includes: string[],
  ): boolean {
    const formattedDate = date.format(dateFormat.trim());
    const dateOnly = date.format('YYYY-MM-DD');

    // includes 优先
    if (includes.includes(formattedDate) || includes.includes(dateOnly)) {
      return false;
    }

    // weekends 排除
    if (
      excludes.includes('weekends') &&
      (date.isoWeekday() === WEEKEND_START_DAY[this.weekend] ||
        date.isoWeekday() === WEEKEND_START_DAY[this.weekend] + 1)
    ) {
      return true;
    }

    // 星期几排除
    if (excludes.includes(date.format('dddd').toLowerCase())) {
      return true;
    }

    return excludes.includes(formattedDate) || excludes.includes(dateOnly);
  }

  /**
   * 解析开始日期
   *
   * 支持:
   *   - 时间戳格式 (x/X)
   *   - after 表达式 (after id1 id2)
   *   - 日期字符串 (按 dateFormat 解析)
   *
   * @returns Date 对象，或 undefined（解析失败时记录错误）
   */
  private getStartDate(
    _prevTime: unknown,
    dateFormat: string,
    str: string,
  ): Date | undefined {
    str = str.trim();

    // 时间戳格式 (x/X)
    const isTimestampFormat = (format: string): boolean => {
      const trimmedFormat = format.trim();
      return trimmedFormat === 'x' || trimmedFormat === 'X';
    };

    if (isTimestampFormat(dateFormat) && /^\d+$/.test(str)) {
      return new Date(Number(str));
    }

    // after 表达式
    const afterRePattern = /^after\s+(?<ids>[\d\w- ]+)/;
    const afterStatement = afterRePattern.exec(str);

    if (afterStatement !== null && afterStatement.groups) {
      const ids = afterStatement.groups.ids.split(' ').filter((s) => s.trim() !== '');
      let latestTask: RawTask | undefined = undefined;
      for (const id of ids) {
        const task = this.findTaskById(id);
        if (task !== undefined && (!latestTask || (task.endTime instanceof Date && latestTask.endTime instanceof Date && task.endTime > latestTask.endTime))) {
          latestTask = task;
        }
      }

      if (latestTask && latestTask.endTime instanceof Date) {
        return latestTask.endTime;
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return today;
    }

    // 日期字符串（按 dateFormat 解析）
    const mDate = dayjs(str, dateFormat.trim(), true);
    if (mDate.isValid()) {
      return mDate.toDate();
    }

    // 回退到 new Date()
    const d = new Date(str);
    if (
      isNaN(d.getTime()) ||
      d.getFullYear() < -10000 ||
      d.getFullYear() > 10000
    ) {
      this.errorCollector.addError(0, 0, `Invalid date: ${str} (dateFormat: ${dateFormat})`);
      return undefined;
    }
    return d;
  }

  /**
   * 解析持续时间字符串
   *
   * 支持: y/M/w/d/h/s/ms
   *
   * @returns [value, unit]，或 [NaN, 'ms']（无效时）
   */
  parseDuration(str: string): [number, DayjsUnit] {
    const statement = /^(\d+(?:\.\d+)?)([Mdhmswy]|ms)$/.exec(str.trim());
    if (statement !== null) {
      return [Number.parseFloat(statement[1]), statement[2] as DayjsUnit];
    }
    return [NaN, 'ms'];
  }

  /**
   * 解析结束日期
   *
   * 支持:
   *   - until 表达式 (until id1 id2)
   *   - 日期字符串 (按 dateFormat 解析)
   *   - 持续时间 (如 7d, 2w)
   */
  private getEndDate(
    prevTime: Date | string | undefined,
    dateFormat: string,
    str: string,
    inclusive: boolean = false,
  ): Date | undefined {
    str = str.trim();

    // until 表达式
    const untilRePattern = /^until\s+(?<ids>[\d\w- ]+)/;
    const untilStatement = untilRePattern.exec(str);

    if (untilStatement !== null && untilStatement.groups) {
      const ids = untilStatement.groups.ids.split(' ').filter((s) => s.trim() !== '');
      let earliestTask: RawTask | undefined = undefined;
      for (const id of ids) {
        const task = this.findTaskById(id);
        if (task !== undefined && task.startTime !== undefined && (!earliestTask || (earliestTask.startTime !== undefined && this.compareTime(task.startTime, earliestTask.startTime) < 0))) {
          earliestTask = task;
        }
      }

      if (earliestTask && earliestTask.startTime !== undefined) {
        return earliestTask.startTime instanceof Date
          ? earliestTask.startTime
          : new Date(earliestTask.startTime);
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return today;
    }

    // 日期字符串（按 dateFormat 解析）
    const parsedDate = dayjs(str, dateFormat.trim(), true);
    if (parsedDate.isValid()) {
      if (inclusive) {
        return parsedDate.add(1, 'd').toDate();
      }
      return parsedDate.toDate();
    }

    // 持续时间
    if (!prevTime) {
      this.errorCollector.addError(0, 0, `Cannot parse duration without start time: ${str}`);
      return undefined;
    }
    const endTime = dayjs(prevTime);
    const [durationValue, durationUnit] = this.parseDuration(str);
    if (!Number.isNaN(durationValue)) {
      const newEndTime = endTime.add(durationValue, durationUnit);
      if (newEndTime.isValid()) {
        return newEndTime.toDate();
      }
    }

    // 无法解析
    this.errorCollector.addError(0, 0, `Invalid end date or duration: ${str}`);
    return undefined;
  }

  /** 比较两个时间（Date 或字符串） */
  private compareTime(a: Date | string, b: Date | string): number {
    const aTime = a instanceof Date ? a.getTime() : new Date(a).getTime();
    const bTime = b instanceof Date ? b.getTime() : new Date(b).getTime();
    return aTime - bTime;
  }

  /**
   * 检查任务日期（排除无效日期）
   */
  private checkTaskDates(
    task: RawTask,
    dateFormat: string,
    excludes: string[],
    includes: string[],
  ): void {
    if (!excludes.length || task.manualEndTime) {
      return;
    }

    let startTime: dayjs.Dayjs;
    if (task.startTime instanceof Date) {
      startTime = dayjs(task.startTime);
    } else if (typeof task.startTime === 'string') {
      startTime = dayjs(task.startTime, dateFormat, true);
    } else {
      return;
    }
    startTime = startTime.add(1, 'd');

    let originalEndTime: dayjs.Dayjs;
    if (task.endTime instanceof Date) {
      originalEndTime = dayjs(task.endTime);
    } else if (typeof task.endTime === 'string') {
      originalEndTime = dayjs(task.endTime, dateFormat, true);
    } else {
      return;
    }

    const [fixedEndTime, renderEndTime] = this.fixTaskDates(
      startTime,
      originalEndTime,
      dateFormat,
      excludes,
      includes,
    );
    task.endTime = fixedEndTime.toDate();
    task.renderEndTime = renderEndTime;
  }

  /**
   * 修复任务日期（跳过被排除的日期）
   */
  private fixTaskDates(
    startTime: dayjs.Dayjs,
    endTime: dayjs.Dayjs,
    dateFormat: string,
    excludes: string[],
    includes: string[],
  ): [dayjs.Dayjs, Date | null] {
    let invalid = false;
    let renderEndTime: Date | null = null;
    const maxEndTime = endTime.add(10000, 'd');
    while (startTime <= endTime) {
      if (!invalid) {
        renderEndTime = endTime.toDate();
      }
      invalid = this.isInvalidDate(startTime, dateFormat, excludes, includes);
      if (invalid) {
        endTime = endTime.add(1, 'd');
        if (endTime > maxEndTime) {
          this.errorCollector.addError(
            0, 0,
            'Failed to find a valid date that was not excluded by `excludes` after 10,000 iterations.',
          );
          break;
        }
      }
      startTime = startTime.add(1, 'd');
    }
    return [endTime, renderEndTime];
  }

  // ============================================================
  // 任务编译（核心逻辑）
  // ============================================================

  /**
   * 编译任务（解析依赖、计算日期）
   *
   * 多次迭代直到所有任务都处理完成（或达到最大迭代次数）
   */
  private compileTasks(): boolean {
    const compileTask = (pos: number): boolean => {
      const task = this.rawTasks[pos];
      if (!task) return false;

      // 解析开始时间
      switch (task.raw.startTime.type) {
        case 'prevTaskEnd': {
          const prevTask = task.prevTaskId ? this.findTaskById(task.prevTaskId) : undefined;
          if (prevTask && prevTask.endTime instanceof Date) {
            task.startTime = prevTask.endTime;
          } else if (prevTask && typeof prevTask.endTime === 'string') {
            task.startTime = new Date(prevTask.endTime);
          }
          break;
        }
        case 'getStartDate': {
          if (task.raw.startTime.startData) {
            const startTime = this.getStartDate(undefined, this.dateFormat, task.raw.startTime.startData);
            if (startTime) {
              task.startTime = startTime;
            }
          }
          break;
        }
        default:
          // 未知类型，跳过
          break;
      }

      // 解析结束时间
      if (task.startTime) {
        const endTime = this.getEndDate(
          task.startTime,
          this.dateFormat,
          task.raw.endTime.data,
          this.inclusiveEndDates,
        );
        if (endTime) {
          task.endTime = endTime;
          task.processed = true;
          task.manualEndTime = dayjs(task.raw.endTime.data, 'YYYY-MM-DD', true).isValid();
          this.checkTaskDates(task, this.dateFormat, this.excludes, this.includes);
        }
      }

      return task.processed;
    };

    let allProcessed = true;
    for (let i = 0; i < this.rawTasks.length; i++) {
      compileTask(i);
      const rawTask = this.rawTasks[i];
      if (rawTask) {
        allProcessed = allProcessed && rawTask.processed;
      }
    }
    return allProcessed;
  }

  /**
   * 获取编译后的任务列表
   *
   * 多次迭代 compileTasks 直到所有任务都处理完成（或达到最大迭代次数）
   *
   * 循环依赖检测：迭代结束后仍有未处理任务时，通过 ErrorCollector 报错（决策 11）
   */
  getTasks(): GanttDBTask[] {
    let allItemsProcessed = this.compileTasks();
    const maxDepth = 10;
    let iterationCount = 0;
    while (!allItemsProcessed && iterationCount < maxDepth) {
      allItemsProcessed = this.compileTasks();
      iterationCount++;
    }

    // 循环依赖检测：迭代结束后仍有未处理任务，说明存在循环依赖或依赖链过长
    // 通过 ErrorCollector 报错（不抛异常，遵循"解析错误用错误收集器"原则）
    if (!allItemsProcessed) {
      const unprocessedTasks = this.rawTasks.filter((t) => !t.processed);
      for (const task of unprocessedTasks) {
        this.errorCollector.addError(
          0, 0,
          `Gantt task "${task.task}" could not be resolved: possible circular dependency or dependency chain exceeds maxDepth=${maxDepth}`,
        );
      }
    }

    // 转换 rawTasks 为 GanttDBTask
    this.tasks = this.rawTasks.map((rawTask) => {
      // 解析 dependencies（从 raw.startTime.startData 提取 after 表达式）
      const dependencies: string[] = [];
      if (rawTask.raw.startTime.startData) {
        const afterMatch = /^after\s+(?<ids>[\d\w- ]+)/.exec(rawTask.raw.startTime.startData);
        if (afterMatch && afterMatch.groups) {
          const ids = afterMatch.groups.ids.split(' ').filter((s) => s.trim() !== '');
          dependencies.push(...ids);
        }
      }

      // 格式化日期为字符串
      const startDateStr = this.formatDate(rawTask.startTime);

      // 区分 duration 和 endDate（保证 round-trip 一致性）
      // 原始输入是 duration 格式（如 7d, 2w）时，设置 duration 字段
      // 原始输入是日期字符串时，设置 endDate 字段
      const rawEndData = rawTask.raw.endTime.data.trim();
      const [durationValue] = this.parseDuration(rawEndData);
      const isDuration = !Number.isNaN(durationValue);

      const task: GanttDBTask = {
        id: rawTask.id,
        label: rawTask.task,
        section: rawTask.section,
        ...(startDateStr ? { startDate: startDateStr } : {}),
        ...(isDuration
          ? { duration: rawEndData }
          : (() => {
              const endDateStr = this.formatDate(rawTask.endTime);
              return endDateStr ? { endDate: endDateStr } : {};
            })()),
        ...(rawTask.tags.length > 0 ? { tags: rawTask.tags } : {}),
        ...(dependencies.length > 0 ? { dependencies } : {}),
        order: rawTask.order,
      };

      // clickUrl 不在此设置：由 mapToGanttCanvasState 统一从 db.getLinks() 映射（单一数据源）

      return task;
    });

    return this.tasks;
  }

  /** 格式化 Date 为字符串（按 dateFormat） */
  private formatDate(date: Date | string | undefined): string | undefined {
    if (!date) return undefined;
    if (typeof date === 'string') return date;
    if (!this.dateFormat) return date.toISOString().slice(0, 10);
    try {
      return dayjs(date).format(this.dateFormat);
    } catch {
      return date.toISOString().slice(0, 10);
    }
  }
}
