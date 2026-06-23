/**
 * Quadrant 解析器入口
 *
 * 单一职责：将 Mermaid quadrantChart 代码解析为 QuadrantCanvasState
 *
 * 数据流:
 *   源代码字符串
 *     → 创建 QuadrantDB 实例，作为 yy 传入 jison parser
 *     → parser.parse(source) 调用 QuadrantDB.setQuadrant1Text/setXAxisLeftText/addPoint/addClass/... 收集数据
 *     → 从 QuadrantDB 各个 getter 组装 QuadrantCanvasState
 *
 * 错误处理:
 *   - jison 抛出的语法错误被捕获，转换为 ParseError[]
 *   - QuadrantDB 内部错误通过 ErrorCollector 收集
 *   - 解析成功时 errors 为空数组
 *
 * 对齐 M10 timeline-parser.ts 模式（jison + DB）
 */

import { parser as quadrantParser } from './jison/quadrant-parser.js';
import { preprocessCode } from '../detector/preprocessor.js';
import type {
  ParseResult,
  QuadrantCanvasState,
  QuadrantPoint,
  StateClassDefInfo,
  NodeStyle,
} from '../types.js';
import { QuadrantDB } from './quadrant-db.js';
import type { StylesObject } from './quadrant-db.js';
import { buildParseError } from './quadrant-db.js';
import { ErrorCollector } from '../error-collector.js';

// ============================================================
// jison parser（静态 import，浏览器兼容）
// ============================================================

interface JisonParserInstance {
  parse(input: string): unknown;
  yy: unknown;
}

/** quadrant jison 解析器实例 */
const quadrantJisonParser: JisonParserInstance = quadrantParser as unknown as JisonParserInstance;

// ============================================================
// 主入口
// ============================================================

/**
 * 解析 quadrantChart 代码为 QuadrantCanvasState
 *
 * 预处理（架构修复）:
 *   - 内部调用 preprocessCode 清理 frontmatter/指令/注释（保持行号一致）
 *   - jison 解析清理后的 code，错误上下文使用原始 source
 *
 * @param source - Mermaid quadrantChart 源代码（可含 %% 注释、%%{directive}%%、frontmatter）
 * @param errorCollector - 可选的错误收集器，未提供时内部创建
 * @returns ParseResult，成功时 canvas 为 QuadrantCanvasState
 */
export function parseQuadrantCode(
  source: string,
  errorCollector?: ErrorCollector,
): ParseResult {
  const collector = errorCollector ?? new ErrorCollector();
  const parser = quadrantJisonParser;
  const db = new QuadrantDB(collector);

  // 将 QuadrantDB 实例作为 yy 传入 parser
  // jison 语法动作通过 yy.setQuadrant1Text/yy.setXAxisLeftText/yy.addPoint/yy.addClass/... 调用 QuadrantDB 方法
  parser.yy = db;

  try {
    // 预处理：清理 frontmatter/指令/注释（替换为等长换行，保持行号一致）
    // jison 无法解析 %% 注释和 %%{directive}%%，必须预处理
    const preprocessedSource = preprocessCode(source);
    // jison 语法要求 quadrantChart 关键字后必须有换行符
    const normalizedSource = preprocessedSource.endsWith('\n') ? preprocessedSource : preprocessedSource + '\n';
    parser.parse(normalizedSource);

    // 收集 QuadrantDB 内部错误（通过共享的 ErrorCollector）
    const dbErrors = collector.getErrors();

    if (dbErrors.length > 0) {
      return {
        success: false,
        canvas: createEmptyCanvas(),
        errors: dbErrors,
      };
    }

    const canvas = mapToQuadrantCanvasState(db);

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
// QuadrantDB → QuadrantCanvasState 映射
// ============================================================

/**
 * 将 QuadrantDB 转换为 QuadrantCanvasState
 *
 * 映射规则:
 *   - db.getDiagramTitle() → canvas.title
 *   - db.getXAxisLeftText()/getXAxisRightText() → canvas.xAxis
 *   - db.getYAxisTopText()/getYAxisBottomText() → canvas.yAxis
 *   - db.getQuadrant1Text()~4Text() → canvas.quadrants
 *   - db.getPoints() → canvas.points（含 x/y/label/className/style/radius）
 *   - db.getClasses() → canvas.classDefs
 *
 * @param db - QuadrantDB 实例
 * @returns QuadrantCanvasState
 */
function mapToQuadrantCanvasState(db: QuadrantDB): QuadrantCanvasState {
  const canvas: QuadrantCanvasState = {
    diagramType: 'quadrantChart',
    quadrants: {
      '1': db.getQuadrant1Text(),
      '2': db.getQuadrant2Text(),
      '3': db.getQuadrant3Text(),
      '4': db.getQuadrant4Text(),
    },
    xAxis: {
      leftText: db.getXAxisLeftText(),
      rightText: db.getXAxisRightText(),
    },
    yAxis: {
      topText: db.getYAxisTopText(),
      bottomText: db.getYAxisBottomText(),
    },
    points: db.getPoints().map(mapPoint),
  };

  // 可选字段（仅在存在时设置）
  const title = db.getDiagramTitle();
  if (title) canvas.title = title;

  const accTitle = db.getAccTitle();
  if (accTitle) canvas.accTitle = accTitle;

  const accDescription = db.getAccDescription();
  if (accDescription) canvas.accDescription = accDescription;

  // classDefs（仅在存在时设置）
  const classes = db.getClasses();
  const classDefs = mapClassDefs(classes);
  if (classDefs.length > 0) {
    canvas.classDefs = classDefs;
  }

  return canvas;
}

/**
 * 将 QuadrantDBPoint 转换为 QuadrantPoint
 *
 * 映射规则:
 *   - x → x
 *   - y → y
 *   - text → label
 *   - className（空字符串 → undefined）
 *   - radius → radius
 *   - color → style.fill（quadrant 的 color 是填充色）
 *   - strokeColor → style.stroke
 *   - strokeWidth（"Npx" → N）→ style.strokeWidth
 */
function mapPoint(point: {
  x: number;
  y: number;
  text: string;
  className: string;
  radius?: number;
  color?: string;
  strokeColor?: string;
  strokeWidth?: string;
}): QuadrantPoint {
  const result: QuadrantPoint = {
    label: point.text,
    x: point.x,
    y: point.y,
  };

  // className（空字符串 → undefined）
  if (point.className) {
    result.className = point.className;
  }

  // radius
  if (point.radius !== undefined) {
    result.radius = point.radius;
  }

  // style（color/strokeColor/strokeWidth → NodeStyle）
  const style = mapStyle(point);
  if (style) {
    result.style = style;
  }

  return result;
}

/**
 * 将 QuadrantDBPoint 的样式转换为 NodeStyle
 *
 * 映射规则:
 *   - color → fill（quadrant 的 color 是填充色）
 *   - strokeColor → stroke
 *   - strokeWidth（"Npx" → N）→ strokeWidth
 *
 * @returns NodeStyle 或 undefined（无样式时）
 */
function mapStyle(point: {
  color?: string;
  strokeColor?: string;
  strokeWidth?: string;
}): NodeStyle | undefined {
  const style: NodeStyle = {};

  if (point.color) {
    style.fill = point.color;
  }
  if (point.strokeColor) {
    style.stroke = point.strokeColor;
  }
  if (point.strokeWidth) {
    // "10px" → 10
    const match = point.strokeWidth.match(/^(\d+)px$/);
    if (match) {
      style.strokeWidth = parseInt(match[1], 10);
    }
  }

  // 无任何样式时返回 undefined
  if (style.fill === undefined && style.stroke === undefined && style.strokeWidth === undefined) {
    return undefined;
  }

  return style;
}

/**
 * 将 QuadrantDB classes 转换为 StateClassDefInfo[]
 *
 * 映射规则:
 *   - 类名 → name
 *   - StylesObject → style 字符串（逗号分隔，对齐官方 quadrant 语法）
 *
 * 样式字符串格式: `color: #ff3300, radius: 9, stroke-color: #000, stroke-width: 10px`
 */
function mapClassDefs(classes: Record<string, StylesObject>): StateClassDefInfo[] {
  const result: StateClassDefInfo[] = [];
  for (const [name, styles] of Object.entries(classes)) {
    const styleStr = stylesObjectToString(styles);
    if (styleStr) {
      result.push({ name, style: styleStr });
    }
  }
  return result;
}

/**
 * 将 StylesObject 转换为样式字符串
 *
 * 格式: `color: #ff3300, radius: 9, stroke-color: #000, stroke-width: 10px`
 * 顺序: color → radius → stroke-color → stroke-width（对齐官方语法顺序）
 */
function stylesObjectToString(styles: StylesObject): string {
  const parts: string[] = [];
  if (styles.color) {
    parts.push(`color: ${styles.color}`);
  }
  if (styles.radius !== undefined) {
    parts.push(`radius: ${styles.radius}`);
  }
  if (styles.strokeColor) {
    parts.push(`stroke-color: ${styles.strokeColor}`);
  }
  if (styles.strokeWidth) {
    parts.push(`stroke-width: ${styles.strokeWidth}`);
  }
  return parts.join(', ');
}

/** 创建空 QuadrantCanvasState（解析失败时使用） */
function createEmptyCanvas(): QuadrantCanvasState {
  return {
    diagramType: 'quadrantChart',
    quadrants: { '1': '', '2': '', '3': '', '4': '' },
    xAxis: { leftText: '', rightText: '' },
    yAxis: { topText: '', bottomText: '' },
    points: [],
  };
}
