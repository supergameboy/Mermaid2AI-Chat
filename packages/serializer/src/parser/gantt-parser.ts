/**
 * Gantt 解析器入口
 *
 * 单一职责：将 Mermaid gantt 代码解析为 GanttCanvasState
 *
 * 数据流:
 *   源代码字符串
 *     → 创建 GanttDB 实例，作为 yy 传入 jison parser
 *     → parser.parse(source) 调用 GanttDB.setDateFormat/addTask/setLink/... 收集数据
 *     → GanttDB.getTasks() 编译任务（解析依赖、计算日期）
 *     → mapToGanttCanvasState(db) 转换为 GanttCanvasState
 *
 * 错误处理:
 *   - jison 抛出的语法错误被捕获，转换为 ParseError[]
 *   - GanttDB 内部错误通过 ErrorCollector 收集
 *   - 解析成功时 errors 为空数组
 *
 * v4 根因修复:
 *   - click URL 通过 GanttTask.clickUrl 存储（单一数据源）
 *   - tags/dependencies 统一使用数组（移除 status/afterId）
 *   - dateFormat 必填（缺失则报错）
 *   - weekday 收窄为 'sunday' | 'monday'
 */

import { parser as ganttParser } from './jison/gantt-parser.js';
import { preprocessCode } from '../detector/preprocessor.js';
import type {
  GanttCanvasState,
  GanttSection,
  GanttTask,
  ParseError,
  ParseResult,
} from '../types.js';
import { GanttDB } from './gantt-db.js';
import type { GanttDBTask } from './gantt-db.js';

// ============================================================
// jison parser（静态 import，浏览器兼容）
// ============================================================

interface JisonParserInstance {
  parse(input: string): unknown;
  yy: unknown;
}

/** gantt jison 解析器实例 */
const ganttJisonParser: JisonParserInstance = ganttParser as unknown as JisonParserInstance;

// ============================================================
// 主入口
// ============================================================

/**
 * 解析 gantt 代码为 GanttCanvasState
 *
 * 预处理（架构修复）:
 *   - 内部调用 preprocessCode 清理 frontmatter/指令/注释（保持行号一致）
 *   - jison 解析清理后的 code，错误上下文使用原始 source
 *
 * @param source - Mermaid gantt 源代码（可含 %% 注释、%%{directive}%%、frontmatter）
 * @returns ParseResult，成功时 canvas 为 GanttCanvasState
 */
export function parseGanttCode(source: string): ParseResult {
  const parser = ganttJisonParser;
  const db = new GanttDB();
  const errorCollector = db.getErrorCollector();

  // 将 GanttDB 实例作为 yy 传入 parser
  // jison 语法动作通过 yy.setDateFormat/yy.addTask/yy.setLink/... 调用 GanttDB 方法
  parser.yy = db;

  try {
    // 预处理：清理 frontmatter/指令/注释（替换为等长换行，保持行号一致）
    // jison 无法解析 %% 注释和 %%{directive}%%，必须预处理
    const preprocessedSource = preprocessCode(source);
    // jison 语法要求 gantt 关键字后必须有换行符
    const normalizedSource = preprocessedSource.endsWith('\n') ? preprocessedSource : preprocessedSource + '\n';
    parser.parse(normalizedSource);

    // 检查 dateFormat 是否设置（必填）
    if (!db.getDateFormat()) {
      errorCollector.addError(
        0, 0,
        'dateFormat is required for gantt diagram (e.g., "dateFormat YYYY-MM-DD")',
      );
    }

    // 获取编译后的任务（触发 compileTasks）
    const tasks = db.getTasks();

    // 收集 GanttDB 内部错误
    const dbErrors = errorCollector.getErrors();

    if (dbErrors.length > 0) {
      return {
        success: false,
        canvas: createEmptyCanvas(),
        errors: dbErrors,
      };
    }

    const canvas = mapToGanttCanvasState(db, tasks);

    return {
      success: true,
      canvas,
      errors: [],
    };
  } catch (err) {
    const error: ParseError = {
      line: extractLine(err),
      column: extractColumn(err),
      message: extractMessage(err),
      severity: 'error',
      context: source.split('\n')[extractLine(err) - 1] ?? undefined,
    };

    return {
      success: false,
      canvas: createEmptyCanvas(),
      errors: [error],
    };
  } finally {
    // 重置 parser.yy，避免泄漏
    parser.yy = {};
  }
}

// ============================================================
// GanttDB → GanttCanvasState 映射
// ============================================================

/**
 * 将 GanttDB 转换为 GanttCanvasState
 *
 * v4 根因修复：
 *   - click URL 从 db.getLinks() 映射到 GanttTask.clickUrl
 *   - GanttDBTask 内部类型（含 section 字段），转换为 GanttTask 时丢弃 section
 *   - section 信息已通过 sections 结构表达，不需要冗余存储在 task 中
 *
 * @param db - GanttDB 实例
 * @param tasks - 编译后的任务列表（GanttDBTask[]，含 section 字段）
 * @returns GanttCanvasState
 */
function mapToGanttCanvasState(db: GanttDB, tasks: GanttDBTask[]): GanttCanvasState {
  const sections = db.getSections();
  const links = db.getLinks();

  // 按 section 分组任务
  const sectionList: GanttSection[] = sections.map((name) => {
    const sectionTasks = tasks
      .filter((t) => t.section === name)
      .map((t) => {
        // 丢弃 GanttDB 内部字段，转换为 GanttTask
        const { section: _section, order: _order, startTime: _startTime, endTime: _endTime, renderEndTime: _renderEndTime, manualEndTime: _manualEndTime, ...taskFields } = t;
        const task: GanttTask = { ...taskFields };
        // clickUrl 从 links 映射（单一数据源：db.getLinks()）
        const taskId = t.id;
        if (taskId) {
          const link = links.get(taskId);
          if (link) {
            task.clickUrl = link;
          }
        }
        return task;
      });
    return {
      name,
      tasks: sectionTasks,
    };
  });

  // 如果没有 section，但有任务，创建一个默认 section
  if (sectionList.length === 0 && tasks.length > 0) {
    sectionList.push({
      name: '',
      tasks: tasks.map((t) => {
        const { section: _section, order: _order, startTime: _startTime, endTime: _endTime, renderEndTime: _renderEndTime, manualEndTime: _manualEndTime, ...taskFields } = t;
        return taskFields as GanttTask;
      }),
    });
  }

  // 构建 GanttCanvasState
  const canvas: GanttCanvasState = {
    diagramType: 'gantt',
    dateFormat: db.getDateFormat(),
    sections: sectionList,
  };

  // 可选字段（仅在存在时设置）
  const title = db.getDiagramTitle();
  if (title) canvas.title = title;

  const accTitle = db.getAccTitle();
  if (accTitle) canvas.accTitle = accTitle;

  const accDescription = db.getAccDescription();
  if (accDescription) canvas.accDescription = accDescription;

  const axisFormat = db.getAxisFormat();
  if (axisFormat) canvas.axisFormat = axisFormat;

  const tickInterval = db.getTickInterval();
  if (tickInterval) canvas.tickInterval = tickInterval;

  const todayMarker = db.getTodayMarker();
  if (todayMarker) canvas.todayMarker = todayMarker;

  const excludes = db.getExcludes();
  if (excludes.length > 0) canvas.excludes = excludes;

  const includes = db.getIncludes();
  if (includes.length > 0) canvas.includes = includes;

  // weekday：仅接受 sunday/monday（v4 收窄）
  const weekday = db.getWeekday();
  if (weekday === 'sunday' || weekday === 'monday') {
    canvas.weekday = weekday;
  }

  const weekend = db.getWeekend();
  if (weekend) canvas.weekend = weekend;

  if (db.endDatesAreInclusive()) canvas.inclusiveEndDates = true;
  if (db.topAxisEnabled()) canvas.topAxis = true;

  const displayMode = db.getDisplayMode();
  if (displayMode) canvas.displayMode = displayMode;

  return canvas;
}

// ============================================================
// 辅助函数
// ============================================================

/** 创建空 GanttCanvasState（解析失败时使用） */
function createEmptyCanvas(): GanttCanvasState {
  return {
    diagramType: 'gantt',
    dateFormat: '',
    sections: [],
  };
}

function extractLine(err: unknown): number {
  if (err && typeof err === 'object') {
    const line = (err as { line?: unknown }).line;
    if (typeof line === 'number') return line;
  }
  return 1;
}

function extractColumn(err: unknown): number {
  if (err && typeof err === 'object') {
    const column = (err as { column?: unknown }).column;
    if (typeof column === 'number') return column;
  }
  return 1;
}

function extractMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message || 'gantt parse error';
  }
  if (typeof err === 'string') return err;
  return 'gantt parse error';
}
