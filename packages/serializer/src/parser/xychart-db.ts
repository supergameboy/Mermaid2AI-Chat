/**
 * XYChartDB — 官方 XYChartDB 移植版（M12 决策 1）
 *
 * 单一职责：存储 xychart-beta 解析过程中的状态（title/坐标轴/数据系列/classDef）
 *
 * 移植来源: mermaid-develop/packages/mermaid/src/diagrams/xychart/xychartDb.ts
 *
 * 移植修改:
 *   - 去除 commonDb 依赖（setDiagramTitle/setAccTitle/setAccDescription 直接定义在类中）
 *   - 去除 getConfig/sanitizeText 依赖（text 直接 trim，不调用 sanitizeText）
 *   - 去除 setTmpSVGG（DOM 引用违反 serializer 模块边界，渲染器自己处理布局）
 *   - 去除 configApi/getThemeVariables/SVGGroup/cleanAndMerge 依赖
 *   - getChartDefaultConfig/getChartDefaultThemeConfig 替换为常量
 *   - transformDataWithoutCategory/setYAxisRangeFromPlotData 逻辑保留（自动计算轴范围，私有方法）
 *   - 构造函数接收外部 ErrorCollector（对齐 M10/M11，单一数据源原则）
 *   - 构造函数中 bind 所有方法（jison parser 遍历 this.yy 的 own 属性）
 *   - 模块级变量改为类字段（避免多次解析互相干扰，对齐 M10/M11）
 *   - addLinePlot/addBarPlot 接收 name: string|null, data: number[]（对齐设计文档接口签名）
 *   - 新增 getPlots() 返回所有系列（保持原始顺序，用于组装 canvas.series）
 *
 * 数据流:
 *   jison 解析器 → XYChartDB.setDiagramTitle/setXAxisTitle/addLinePlot/... → XYChartDB getters → mapToXYChartCanvasState
 */

import type { ParseError } from '../types.js';
import { ErrorCollector } from '../error-collector.js';
import { DEFAULT_PLOT_COLOR_PALETTE_STR } from '../serializer/shared/xychart-helpers.js';

// ============================================================
// 内部类型
// ============================================================

/** 坐标轴数据（DB 内部类型，联合类型） */
type AxisData =
  | { type: 'band'; title: string; categories: string[] }
  | { type: 'linear'; title: string; min: number; max: number };

/** 数据系列（DB 内部类型，对齐设计文档 PlotData） */
export interface PlotData {
  type: 'line' | 'bar';
  name?: string;
  data: number[];
  color?: string;
}

/** jison 传入的文本对象（对齐官方 LexTextObj） */
export interface LexTextObj {
  text: string;
  type: 'text' | 'markdown';
}

/** XYChart classDef 样式（DB 内部类型） */
export interface XYChartClassDef {
  styles: string[];
}

// ============================================================
// XYChartDB
// ============================================================

/**
 * XYChartDB 移植版
 *
 * 每次 parseXYChartCode 调用时创建新实例，避免状态污染
 *
 * 错误收集: 构造函数接收外部 ErrorCollector，确保内部错误传递到外部
 * （单一数据源原则，避免错误收集器分裂导致错误丢失）
 */
export class XYChartDB {
  private title = '';
  private accTitle = '';
  private accDescription = '';
  private chartOrientation: 'horizontal' | 'vertical' = 'vertical';
  private showDataLabel = false;
  private plotColorPalette: string = DEFAULT_PLOT_COLOR_PALETTE_STR;
  private xAxisData: AxisData = { type: 'band', title: '', categories: [] };
  private yAxisData: AxisData = { type: 'linear', title: '', min: Infinity, max: -Infinity };
  private plots: PlotData[] = [];
  private classes: Record<string, XYChartClassDef> = {};
  private plotIndex = 0;
  private hasSetXAxis = false;
  private hasSetYAxis = false;
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
    // 使其成为实例的 own 属性（对齐 TimelineDB/GanttDB/QuadrantDB 的处理方式）
    this.clear = this.clear.bind(this);
    this.getErrorCollector = this.getErrorCollector.bind(this);
    this.setDiagramTitle = this.setDiagramTitle.bind(this);
    this.getDiagramTitle = this.getDiagramTitle.bind(this);
    this.setAccTitle = this.setAccTitle.bind(this);
    this.getAccTitle = this.getAccTitle.bind(this);
    this.setAccDescription = this.setAccDescription.bind(this);
    this.getAccDescription = this.getAccDescription.bind(this);
    this.setOrientation = this.setOrientation.bind(this);
    this.getOrientation = this.getOrientation.bind(this);
    this.setShowDataLabel = this.setShowDataLabel.bind(this);
    this.getShowDataLabel = this.getShowDataLabel.bind(this);
    this.setPlotColorPalette = this.setPlotColorPalette.bind(this);
    this.getPlotColorPalette = this.getPlotColorPalette.bind(this);
    this.setXAxisTitle = this.setXAxisTitle.bind(this);
    this.getXAxisTitle = this.getXAxisTitle.bind(this);
    this.setXAxisRangeData = this.setXAxisRangeData.bind(this);
    this.getXAxisRangeData = this.getXAxisRangeData.bind(this);
    this.setXAxisBand = this.setXAxisBand.bind(this);
    this.getXAxisBand = this.getXAxisBand.bind(this);
    this.getXAxisType = this.getXAxisType.bind(this);
    this.setYAxisTitle = this.setYAxisTitle.bind(this);
    this.getYAxisTitle = this.getYAxisTitle.bind(this);
    this.setYAxisRangeData = this.setYAxisRangeData.bind(this);
    this.getYAxisRangeData = this.getYAxisRangeData.bind(this);
    this.addLinePlot = this.addLinePlot.bind(this);
    this.addBarPlot = this.addBarPlot.bind(this);
    this.getLinePlots = this.getLinePlots.bind(this);
    this.getBarPlots = this.getBarPlots.bind(this);
    this.getPlots = this.getPlots.bind(this);
    this.addClass = this.addClass.bind(this);
    this.getClasses = this.getClasses.bind(this);
  }

  // ============================================================
  // 清理和初始化
  // ============================================================

  clear(): void {
    this.title = '';
    this.accTitle = '';
    this.accDescription = '';
    this.chartOrientation = 'vertical';
    this.showDataLabel = false;
    this.plotColorPalette = DEFAULT_PLOT_COLOR_PALETTE_STR;
    this.xAxisData = { type: 'band', title: '', categories: [] };
    this.yAxisData = { type: 'linear', title: '', min: Infinity, max: -Infinity };
    this.plots = [];
    this.classes = {};
    this.plotIndex = 0;
    this.hasSetXAxis = false;
    this.hasSetYAxis = false;
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
  // chartOrientation / showDataLabel / plotColorPalette
  // ============================================================

  /**
   * 设置图表方向
   *
   * jison 文法中 CHART_ORIENTATION 匹配 "vertical"|"horizontal"
   * 非法值默认为 'vertical'（对齐官方 setOrientation 实现）
   */
  setOrientation(orientation: 'horizontal' | 'vertical'): void {
    this.chartOrientation = orientation === 'horizontal' ? 'horizontal' : 'vertical';
  }

  getOrientation(): 'horizontal' | 'vertical' {
    return this.chartOrientation;
  }

  setShowDataLabel(show: boolean): void {
    this.showDataLabel = show;
  }

  getShowDataLabel(): boolean {
    return this.showDataLabel;
  }

  setPlotColorPalette(palette: string): void {
    this.plotColorPalette = palette;
  }

  getPlotColorPalette(): string {
    return this.plotColorPalette;
  }

  // ============================================================
  // x-axis（支持 band/linear）
  // ============================================================

  setXAxisTitle(title: { text: string }): void {
    this.xAxisData.title = title.text.trim();
  }

  getXAxisTitle(): string {
    return this.xAxisData.title;
  }

  /**
   * 设置 x-axis 为 linear 类型并指定范围
   *
   * 调用后 getXAxisType() 返回 'linear'
   */
  setXAxisRangeData(min: number, max: number): void {
    this.xAxisData = { type: 'linear', title: this.xAxisData.title, min, max };
    this.hasSetXAxis = true;
  }

  getXAxisRangeData(): { min: number; max: number } {
    if (this.xAxisData.type === 'linear') {
      return { min: this.xAxisData.min, max: this.xAxisData.max };
    }
    // band 轴无 range，返回默认值
    return { min: 0, max: 0 };
  }

  /**
   * 设置 x-axis 为 band 类型并指定类别
   *
   * 调用后 getXAxisType() 返回 'band'
   */
  setXAxisBand(categories: { text: string }[]): void {
    this.xAxisData = {
      type: 'band',
      title: this.xAxisData.title,
      categories: categories.map((c) => c.text.trim()),
    };
    this.hasSetXAxis = true;
  }

  getXAxisBand(): string[] {
    if (this.xAxisData.type === 'band') {
      return this.xAxisData.categories;
    }
    // linear 轴无 categories
    return [];
  }

  /**
   * 推断 x-axis 类型
   *
   * 判断逻辑（对齐设计文档 C1 修复）:
   *   - 若调用过 setXAxisBand() → 'band'
   *   - 若调用过 setXAxisRangeData() → 'linear'
   *   - 都未调用 → 默认 'band'（对齐 createEmptyCanvasState）
   *
   * 实现说明: xAxisData.type 初始为 'band'，setXAxisBand/setXAxisRangeData
   * 会覆盖 xAxisData 为对应类型，因此直接返回 xAxisData.type 即可
   */
  getXAxisType(): 'band' | 'linear' {
    return this.xAxisData.type;
  }

  // ============================================================
  // y-axis（仅 linear，jison 文法层面禁止 y-axis band 语法）
  // ============================================================

  setYAxisTitle(title: { text: string }): void {
    this.yAxisData.title = title.text.trim();
  }

  getYAxisTitle(): string {
    return this.yAxisData.title;
  }

  /**
   * 设置 y-axis 范围
   *
   * y-axis 仅支持 linear 类型（jison 文法层面禁止 y-axis band 语法，路径 A）
   * DB 层不定义 setYAxisBand 方法
   */
  setYAxisRangeData(min: number, max: number): void {
    this.yAxisData = { type: 'linear', title: this.yAxisData.title, min, max };
    this.hasSetYAxis = true;
  }

  getYAxisRangeData(): { min: number; max: number } {
    if (this.yAxisData.type === 'linear') {
      return { min: this.yAxisData.min, max: this.yAxisData.max };
    }
    return { min: 0, max: 0 };
  }

  // ============================================================
  // 数据系列
  // ============================================================

  /**
   * 添加 line 系列
   *
   * @param name - 系列名称，null 表示无名（对齐设计文档决策 7）
   * @param data - 数据值数组
   *
   * 内部调用 transformDataWithoutCategory（自动计算轴范围，私有方法）
   * 颜色由 getPlotColorFromPalette 分配（对齐官方 setLineData）
   */
  addLinePlot(name: string | null, data: number[]): void {
    this.transformDataWithoutCategory(data);
    const plot: PlotData = {
      type: 'line',
      data,
      color: this.getPlotColorFromPalette(this.plotIndex),
    };
    if (name !== null) {
      plot.name = name;
    }
    this.plots.push(plot);
    this.plotIndex++;
  }

  /**
   * 添加 bar 系列
   *
   * @param name - 系列名称，null 表示无名
   * @param data - 数据值数组
   */
  addBarPlot(name: string | null, data: number[]): void {
    this.transformDataWithoutCategory(data);
    const plot: PlotData = {
      type: 'bar',
      data,
      color: this.getPlotColorFromPalette(this.plotIndex),
    };
    if (name !== null) {
      plot.name = name;
    }
    this.plots.push(plot);
    this.plotIndex++;
  }

  /**
   * 获取所有 line 系列
   */
  getLinePlots(): PlotData[] {
    return this.plots.filter((p) => p.type === 'line');
  }

  /**
   * 获取所有 bar 系列
   */
  getBarPlots(): PlotData[] {
    return this.plots.filter((p) => p.type === 'bar');
  }

  /**
   * 获取所有系列（保持原始顺序）
   *
   * 用于组装 canvas.series（XYSeries[]），保持 line/bar 交替的原始顺序
   * 渲染器依赖顺序正确分组 bar 系列和叠加 line 系列
   */
  getPlots(): PlotData[] {
    return this.plots;
  }

  // ============================================================
  // classDef
  // ============================================================

  addClass(className: string, styles: string[]): void {
    this.classes[className] = { styles };
  }

  getClasses(): Record<string, XYChartClassDef> {
    return this.classes;
  }

  // ============================================================
  // 私有方法（对齐官方 transformDataWithoutCategory/setYAxisRangeFromPlotData/getPlotColorFromPalette）
  // ============================================================

  /**
   * 自动计算轴范围（私有方法）
   *
   * 调用时机: 在 addLinePlot/addBarPlot 中调用（对齐官方 setLineData/setBarData）
   *
   * 作用:
   *   1. 若用户未设置 x-axis（hasSetXAxis=false）→ 自动设置为 linear 范围 [1, data.length]
   *   2. 若 x-axis 为 band 且 data 长度 > categories 长度 → 截断 data（仅用于 y 轴范围计算）
   *   3. 若用户未设置 y-axis（hasSetYAxis=false）→ 从 data 自动计算 y 轴范围
   *
   * 注意: 此方法不存储变换后的数据（CanvasState 存储原始 number[]，渲染器负责配对）
   *
   * @param data - 数据值数组（不会被修改）
   */
  private transformDataWithoutCategory(data: number[]): void {
    if (data.length === 0) {
      return;
    }

    // 1. 自动设置 x-axis 范围（若用户未设置）
    if (!this.hasSetXAxis) {
      const prevMinValue = this.xAxisData.type === 'linear' ? this.xAxisData.min : Infinity;
      const prevMaxValue = this.xAxisData.type === 'linear' ? this.xAxisData.max : -Infinity;
      this.setXAxisRangeData(Math.min(prevMinValue, 1), Math.max(prevMaxValue, data.length));
    }

    // 2. 截断 data 以匹配 band 轴 categories（仅用于 y 轴范围计算，不修改原数组）
    // 当 band 轴定义后，截断多余数据点防止未标记空间的孤儿 bar/line 影响 y 轴范围
    let truncatedData = data;
    if (this.xAxisData.type === 'band' && data.length > this.xAxisData.categories.length) {
      truncatedData = data.slice(0, this.xAxisData.categories.length);
    }

    // 3. 自动设置 y-axis 范围（若用户未设置）
    if (!this.hasSetYAxis) {
      this.setYAxisRangeFromPlotData(truncatedData);
    }
  }

  /**
   * 从数据计算 y 轴范围（私有方法）
   *
   * 合并多个系列的 y 轴范围（取所有系列的最小值/最大值）
   *
   * @param data - 数据值数组
   */
  private setYAxisRangeFromPlotData(data: number[]): void {
    if (data.length === 0) {
      return;
    }
    const minValue = Math.min(...data);
    const maxValue = Math.max(...data);
    const prevMinValue = this.yAxisData.type === 'linear' ? this.yAxisData.min : Infinity;
    const prevMaxValue = this.yAxisData.type === 'linear' ? this.yAxisData.max : -Infinity;
    this.yAxisData = {
      type: 'linear',
      title: this.yAxisData.title,
      min: Math.min(prevMinValue, minValue),
      max: Math.max(prevMaxValue, maxValue),
    };
  }

  /**
   * 从调色板分配颜色（私有方法）
   *
   * 对齐官方 getPlotColorFromPalette:
   *   - plotIndex=0 → palette[0]
   *   - plotIndex>0 → palette[plotIndex % palette.length]
   */
  private getPlotColorFromPalette(plotIndex: number): string {
    const palette = this.plotColorPalette.split(',').map((c) => c.trim());
    return palette[plotIndex === 0 ? 0 : plotIndex % palette.length];
  }
}

// ============================================================
// 错误提取辅助函数（对齐 QuadrantDB 模式）
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
    return err.message || 'xychart parse error';
  }
  if (typeof err === 'string') return err;
  return 'xychart parse error';
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
