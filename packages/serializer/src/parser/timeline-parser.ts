/**
 * Timeline 解析器入口
 *
 * 单一职责：将 Mermaid timeline 代码解析为 TimelineCanvasState
 *
 * 数据流:
 *   源代码字符串
 *     → 创建 TimelineDB 实例，作为 yy 传入 jison parser
 *     → parser.parse(source) 调用 TimelineDB.setDirection/addSection/addTask/addEvent/... 收集数据
 *     → TimelineDB.getTasks() 获取编译后的任务
 *     → mapToTimelineCanvasState(db) 转换为 TimelineCanvasState
 *
 * 错误处理:
 *   - jison 抛出的语法错误被捕获，转换为 ParseError[]
 *   - TimelineDB 内部错误通过 ErrorCollector 收集
 *   - 解析成功时 errors 为空数组
 *
 * 对齐 M8 gantt-parser.ts 模式（jison + DB）
 */

import { parser as timelineParser } from './jison/timeline-parser.js';
import { preprocessCode } from '../detector/preprocessor.js';
import type {
  ParseResult,
  TimelineCanvasState,
  TimelineSection,
  TimelinePeriod,
  TimelineEvent,
} from '../types.js';
import { TimelineDB } from './timeline-db.js';
import type { TimelineTask } from './timeline-db.js';
import { buildParseError } from './timeline-db.js';
import { ErrorCollector } from '../error-collector.js';

// ============================================================
// jison parser（静态 import，浏览器兼容）
// ============================================================

interface JisonParserInstance {
  parse(input: string): unknown;
  yy: unknown;
}

/** timeline jison 解析器实例 */
const timelineJisonParser: JisonParserInstance = timelineParser as unknown as JisonParserInstance;

// ============================================================
// 主入口
// ============================================================

/**
 * 解析 timeline 代码为 TimelineCanvasState
 *
 * 预处理（架构修复）:
 *   - 内部调用 preprocessCode 清理 frontmatter/指令/注释（保持行号一致）
 *   - jison 解析清理后的 code，错误上下文使用原始 source
 *
 * @param source - Mermaid timeline 源代码（可含 %% 注释、%%{directive}%%、frontmatter）
 * @param errorCollector - 可选的错误收集器，未提供时内部创建
 * @returns ParseResult，成功时 canvas 为 TimelineCanvasState
 */
export function parseTimelineCode(
  source: string,
  errorCollector?: ErrorCollector,
): ParseResult {
  const collector = errorCollector ?? new ErrorCollector();
  const parser = timelineJisonParser;
  const db = new TimelineDB(collector);

  // 将 TimelineDB 实例作为 yy 传入 parser
  // jison 语法动作通过 yy.setDirection/yy.addSection/yy.addTask/yy.addEvent/... 调用 TimelineDB 方法
  parser.yy = db;

  try {
    // 预处理：清理 frontmatter/指令/注释（替换为等长换行，保持行号一致）
    // jison 无法解析 %% 注释和 %%{directive}%%，必须预处理
    const preprocessedSource = preprocessCode(source);
    // jison 语法要求 timeline 关键字后必须有换行符
    const normalizedSource = preprocessedSource.endsWith('\n') ? preprocessedSource : preprocessedSource + '\n';
    parser.parse(normalizedSource);

    // 获取编译后的任务（触发 compileTasks）
    const tasks = db.getTasks();

    // 收集 TimelineDB 内部错误（通过共享的 ErrorCollector）
    const dbErrors = collector.getErrors();

    if (dbErrors.length > 0) {
      return {
        success: false,
        canvas: createEmptyCanvas(),
        errors: dbErrors,
      };
    }

    const canvas = mapToTimelineCanvasState(db, tasks);

    return {
      success: true,
      canvas,
      errors: [],
    };
  } catch (err) {
    const error = buildParseError(err, source);

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
// TimelineDB → TimelineCanvasState 映射
// ============================================================

/**
 * 将 TimelineDB 转换为 TimelineCanvasState
 *
 * 映射规则:
 *   - db.getSections() → sections（按 section 分组 tasks）
 *   - TimelineTask.task → TimelinePeriod.label
 *   - TimelineTask.events (string[]) → TimelinePeriod.events (TimelineEvent[])
 *   - 无 section 的 tasks 放在默认 section（name 为 undefined）
 *
 * @param db - TimelineDB 实例
 * @param tasks - 编译后的任务列表
 * @returns TimelineCanvasState
 */
function mapToTimelineCanvasState(db: TimelineDB, tasks: TimelineTask[]): TimelineCanvasState {
  const sections = db.getSections();

  // 按 section 分组任务
  const sectionList: TimelineSection[] = sections.map((name) => {
    const sectionTasks = tasks.filter((t) => t.section === name);
    return {
      name,
      periods: sectionTasks.map(taskToPeriod),
    };
  });

  // 无 section 的 tasks 放在默认 section（name 为 undefined）
  const tasksWithoutSection = tasks.filter(
    (t) => !sections.includes(t.section),
  );
  if (tasksWithoutSection.length > 0) {
    sectionList.push({
      name: undefined,
      periods: tasksWithoutSection.map(taskToPeriod),
    });
  }

  // 构建 TimelineCanvasState
  const canvas: TimelineCanvasState = {
    diagramType: 'timeline',
    sections: sectionList,
  };

  // 可选字段（仅在存在时设置）
  const title = db.getDiagramTitle();
  if (title) canvas.title = title;

  const accTitle = db.getAccTitle();
  if (accTitle) canvas.accTitle = accTitle;

  const accDescription = db.getAccDescription();
  if (accDescription) canvas.accDescription = accDescription;

  const direction = db.getDirection();
  if (direction !== 'LR') canvas.direction = direction;

  return canvas;
}

/**
 * 将 TimelineTask 转换为 TimelinePeriod
 *
 * - task → label
 * - events (string[]) → events (TimelineEvent[])
 */
function taskToPeriod(task: TimelineTask): TimelinePeriod {
  const events: TimelineEvent[] = task.events.map((label) => ({ label }));
  return {
    label: task.task,
    events,
  };
}

/** 创建空 TimelineCanvasState（解析失败时使用） */
function createEmptyCanvas(): TimelineCanvasState {
  return {
    diagramType: 'timeline',
    sections: [],
  };
}
