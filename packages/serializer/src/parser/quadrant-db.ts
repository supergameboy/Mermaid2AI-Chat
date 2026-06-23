/**
 * QuadrantDB — 官方 QuadrantDB 移植版（M11 决策 1）
 *
 * 单一职责：存储 quadrantChart 解析过程中的状态（象限文本/坐标轴标签/数据点/classDef）
 *
 * 移植来源: mermaid-develop/packages/mermaid/src/diagrams/quadrant-chart/quadrantDb.ts
 *
 * 移植修改:
 *   - 去除 commonDb 依赖（setDiagramTitle/setAccTitle/setAccDescription 直接定义在类中）
 *   - 去除 getConfig/sanitizeText 依赖（text 直接 trim，不调用 sanitizeText）
 *   - 去除 QuadrantBuilder 中间层（DB 直接用类字段存储数据，渲染器自己处理布局）
 *   - 去除 themeVariables/themeConfig（渲染器自己管理颜色）
 *   - 去除 setWidth/setHeight（渲染器自己管理尺寸，不映射到 CanvasState）
 *   - 构造函数接收外部 ErrorCollector（对齐 M10 timeline-db.ts，单一数据源原则）
 *   - 构造函数中 bind 所有方法（jison parser 遍历 this.yy 的 own 属性）
 *   - parseStyles 无效样式改为 ErrorCollector 记录（不抛异常中断，对齐 institution.md 第5章）
 *
 * 数据流:
 *   jison 解析器 → QuadrantDB.setQuadrant1Text/setXAxisLeftText/addPoint/addClass/...
 *   → QuadrantDB getters → mapToQuadrantCanvasState
 */

import type { ParseError } from '../types.js';
import { ErrorCollector } from '../error-collector.js';
import {
  validateHexCode,
  validateSizeInPixels,
  validateNumber,
} from './quadrant-utils.js';

// ============================================================
// 内部类型
// ============================================================

/**
 * 样式对象（DB 内部类型，对应官方 StylesObject）
 *
 * 解析时存储原始样式值，在 mapToQuadrantCanvasState 中转换为 NodeStyle
 */
export interface StylesObject {
  radius?: number;
  color?: string;
  strokeColor?: string;
  strokeWidth?: string;
}

/** jison 传入的文本对象（对齐官方 LexTextObj） */
export interface LexTextObj {
  text: string;
  type: 'text' | 'markdown';
}

/** DB 内部数据点类型 */
interface QuadrantDBPoint {
  x: number;
  y: number;
  text: string;
  className: string;
  radius?: number;
  color?: string;
  strokeColor?: string;
  strokeWidth?: string;
}

// ============================================================
// QuadrantDB
// ============================================================

/**
 * QuadrantDB 移植版
 *
 * 每次 parseQuadrantCode 调用时创建新实例，避免状态污染
 *
 * 错误收集: 构造函数接收外部 ErrorCollector，确保内部错误传递到外部
 * （单一数据源原则，避免错误收集器分裂导致错误丢失）
 */
export class QuadrantDB {
  private title = '';
  private accTitle = '';
  private accDescription = '';
  private quadrant1Text = '';
  private quadrant2Text = '';
  private quadrant3Text = '';
  private quadrant4Text = '';
  private xAxisLeftText = '';
  private xAxisRightText = '';
  private yAxisTopText = '';
  private yAxisBottomText = '';
  private points: QuadrantDBPoint[] = [];
  private classes: Record<string, StylesObject> = {};
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
    // 使其成为实例的 own 属性（对齐 TimelineDB/GanttDB 的处理方式）
    this.clear = this.clear.bind(this);
    this.getErrorCollector = this.getErrorCollector.bind(this);
    this.setDiagramTitle = this.setDiagramTitle.bind(this);
    this.getDiagramTitle = this.getDiagramTitle.bind(this);
    this.setAccTitle = this.setAccTitle.bind(this);
    this.getAccTitle = this.getAccTitle.bind(this);
    this.setAccDescription = this.setAccDescription.bind(this);
    this.getAccDescription = this.getAccDescription.bind(this);
    this.setQuadrant1Text = this.setQuadrant1Text.bind(this);
    this.setQuadrant2Text = this.setQuadrant2Text.bind(this);
    this.setQuadrant3Text = this.setQuadrant3Text.bind(this);
    this.setQuadrant4Text = this.setQuadrant4Text.bind(this);
    this.getQuadrant1Text = this.getQuadrant1Text.bind(this);
    this.getQuadrant2Text = this.getQuadrant2Text.bind(this);
    this.getQuadrant3Text = this.getQuadrant3Text.bind(this);
    this.getQuadrant4Text = this.getQuadrant4Text.bind(this);
    this.setXAxisLeftText = this.setXAxisLeftText.bind(this);
    this.setXAxisRightText = this.setXAxisRightText.bind(this);
    this.setYAxisTopText = this.setYAxisTopText.bind(this);
    this.setYAxisBottomText = this.setYAxisBottomText.bind(this);
    this.getXAxisLeftText = this.getXAxisLeftText.bind(this);
    this.getXAxisRightText = this.getXAxisRightText.bind(this);
    this.getYAxisTopText = this.getYAxisTopText.bind(this);
    this.getYAxisBottomText = this.getYAxisBottomText.bind(this);
    this.addPoint = this.addPoint.bind(this);
    this.getPoints = this.getPoints.bind(this);
    this.addClass = this.addClass.bind(this);
    this.getClasses = this.getClasses.bind(this);
    this.parseStyles = this.parseStyles.bind(this);
  }

  // ============================================================
  // 清理和初始化
  // ============================================================

  clear(): void {
    this.title = '';
    this.accTitle = '';
    this.accDescription = '';
    this.quadrant1Text = '';
    this.quadrant2Text = '';
    this.quadrant3Text = '';
    this.quadrant4Text = '';
    this.xAxisLeftText = '';
    this.xAxisRightText = '';
    this.yAxisTopText = '';
    this.yAxisBottomText = '';
    this.points = [];
    this.classes = {};
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
  // 象限文本
  // ============================================================

  setQuadrant1Text(textObj: LexTextObj): void {
    this.quadrant1Text = textObj.text.trim();
  }

  setQuadrant2Text(textObj: LexTextObj): void {
    this.quadrant2Text = textObj.text.trim();
  }

  setQuadrant3Text(textObj: LexTextObj): void {
    this.quadrant3Text = textObj.text.trim();
  }

  setQuadrant4Text(textObj: LexTextObj): void {
    this.quadrant4Text = textObj.text.trim();
  }

  getQuadrant1Text(): string {
    return this.quadrant1Text;
  }

  getQuadrant2Text(): string {
    return this.quadrant2Text;
  }

  getQuadrant3Text(): string {
    return this.quadrant3Text;
  }

  getQuadrant4Text(): string {
    return this.quadrant4Text;
  }

  // ============================================================
  // 坐标轴标签
  // ============================================================

  setXAxisLeftText(textObj: LexTextObj): void {
    this.xAxisLeftText = textObj.text.trim();
  }

  setXAxisRightText(textObj: LexTextObj): void {
    this.xAxisRightText = textObj.text.trim();
  }

  setYAxisTopText(textObj: LexTextObj): void {
    this.yAxisTopText = textObj.text.trim();
  }

  setYAxisBottomText(textObj: LexTextObj): void {
    this.yAxisBottomText = textObj.text.trim();
  }

  getXAxisLeftText(): string {
    return this.xAxisLeftText;
  }

  getXAxisRightText(): string {
    return this.xAxisRightText;
  }

  getYAxisTopText(): string {
    return this.yAxisTopText;
  }

  getYAxisBottomText(): string {
    return this.yAxisBottomText;
  }

  // ============================================================
  // 数据点
  // ============================================================

  /**
   * 添加数据点
   *
   * jison 文法中 point_x/point_y 规则匹配 `(1)|(0(\.\d+)?)` 返回字符串，
   * 此处用 parseFloat 转换为数字，确保 CanvasState 中 x/y 为 number 类型。
   * NaN 检查：如果 parseFloat 返回 NaN（理论上 jison 文法不会传入非数字字符串，
   * 但作为边界校验），通过 ErrorCollector 记录错误并跳过该数据点。
   *
   * @param textObj - 数据点标签文本对象
   * @param className - 样式类名（空字符串表示无类）
   * @param x - x 坐标（0-1 归一化，jison 传入字符串）
   * @param y - y 坐标（0-1 归一化，jison 传入字符串）
   * @param styles - 样式字符串数组（如 ['radius: 9', 'color: #ff3300']）
   */
  addPoint(
    textObj: LexTextObj,
    className: string,
    x: number | string,
    y: number | string,
    styles: string[],
  ): void {
    const numX = typeof x === 'string' ? parseFloat(x) : x;
    const numY = typeof y === 'string' ? parseFloat(y) : y;

    // 边界校验：NaN 坐标跳过（理论上 jison 文法不会传入非数字，但防御性检查）
    if (Number.isNaN(numX) || Number.isNaN(numY)) {
      this.errorCollector.addError(
        0, 0,
        `addPoint: 数据点 "${textObj.text}" 坐标无效 (x=${x}, y=${y})`,
      );
      return;
    }

    const stylesObject = this.parseStyles(styles);
    this.points.push({
      x: numX,
      y: numY,
      text: textObj.text.trim(),
      className,
      ...stylesObject,
    });
  }

  /**
   * 获取所有数据点
   *
   * @returns 数据点数组（含 x/y/text/className/style）
   */
  getPoints(): QuadrantDBPoint[] {
    return this.points;
  }

  // ============================================================
  // classDef
  // ============================================================

  /**
   * 添加样式类
   *
   * @param className - 类名
   * @param styles - 样式字符串数组（如 ['color: #ff3300', 'radius: 9']）
   */
  addClass(className: string, styles: string[]): void {
    this.classes[className] = this.parseStyles(styles);
  }

  /**
   * 获取所有样式类
   *
   * @returns 类名 → StylesObject 的映射
   */
  getClasses(): Record<string, StylesObject> {
    return this.classes;
  }

  // ============================================================
  // 样式解析
  // ============================================================

  /**
   * 解析样式字符串数组为 StylesObject
   *
   * 支持的样式:
   *   - radius: N（数字）→ radius: number
   *   - color: #RRGGBB（hex）→ color: string
   *   - stroke-color: #RRGGBB（hex）→ strokeColor: string
   *   - stroke-width: Npx（像素）→ strokeWidth: string
   *
   * 错误处理:
   *   - 无效样式 → ErrorCollector 记录错误，跳过该样式（不抛异常中断）
   *   - 对齐 institution.md 第5章"解析错误用错误收集器，不抛异常中断"
   *
   * @param styles - 样式字符串数组
   * @returns StylesObject
   */
  parseStyles(styles: string[]): StylesObject {
    const stylesObject: StylesObject = {};
    for (const style of styles) {
      // 只按第一个冒号分割，避免值中含冒号时被过度分割
      const colonIdx = style.indexOf(':');
      if (colonIdx === -1) {
        this.errorCollector.addError(
          0, 0,
          `Invalid style: "${style}" missing ":" separator`,
        );
        continue;
      }
      const key = style.slice(0, colonIdx).trim();
      const value = style.slice(colonIdx + 1).trim();
      if (key === 'radius') {
        if (validateNumber(value)) {
          this.errorCollector.addError(
            0, 0,
            `Invalid style: radius value "${value}" is not a valid number`,
          );
          continue;
        }
        stylesObject.radius = parseInt(value, 10);
      } else if (key === 'color') {
        if (validateHexCode(value)) {
          this.errorCollector.addError(
            0, 0,
            `Invalid style: color value "${value}" is not a valid hex code`,
          );
          continue;
        }
        stylesObject.color = value;
      } else if (key === 'stroke-color') {
        if (validateHexCode(value)) {
          this.errorCollector.addError(
            0, 0,
            `Invalid style: stroke-color value "${value}" is not a valid hex code`,
          );
          continue;
        }
        stylesObject.strokeColor = value;
      } else if (key === 'stroke-width') {
        if (validateSizeInPixels(value)) {
          this.errorCollector.addError(
            0, 0,
            `Invalid style: stroke-width value "${value}" is not a valid pixel size (e.g. "10px")`,
          );
          continue;
        }
        stylesObject.strokeWidth = value;
      } else {
        this.errorCollector.addError(
          0, 0,
          `Unsupported style: "${key}" is not a supported style (supported: radius, color, stroke-color, stroke-width)`,
        );
      }
    }
    return stylesObject;
  }
}

// ============================================================
// 错误提取辅助函数（对齐 timeline-db.ts 模式）
// ============================================================

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
    return err.message || 'quadrantChart parse error';
  }
  if (typeof err === 'string') return err;
  return 'quadrantChart parse error';
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
