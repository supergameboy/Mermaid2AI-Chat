/**
 * XYChart 解析器入口
 *
 * 单一职责：将 Mermaid xychart-beta 代码解析为 XYChartCanvasState
 *
 * 数据流:
 *   源代码字符串（可能含 YAML frontmatter）
 *     → 提取 frontmatter 配置（showDataLabel/chartOrientation/plotColorPalette）
 *     → 创建 XYChartDB 实例，应用 frontmatter 配置
 *     → 作为 yy 传入 jison parser
 *     → parser.parse(source) 调用 XYChartDB.setDiagramTitle/setXAxisTitle/addLinePlot/... 收集数据
 *     → 从 XYChartDB 各个 getter 组装 XYChartCanvasState
 *
 * 错误处理:
 *   - jison 抛出的语法错误被捕获，转换为 ParseError[]
 *   - XYChartDB 内部错误通过 ErrorCollector 收集
 *   - 解析成功时 errors 为空数组
 *
 * 对齐 M11 quadrant-parser.ts 模式（jison + DB）
 */

import * as yaml from 'js-yaml';
import { parser as xychartParser } from './jison/xychart-parser.js';
import { preprocessCode } from '../detector/preprocessor.js';
import type {
  ParseResult,
  ParseError,
  XYChartCanvasState,
  XYAxis,
  XYSeries,
  StateClassDefInfo,
} from '../types.js';
import { XYChartDB } from './xychart-db.js';
import type { PlotData, XYChartClassDef } from './xychart-db.js';
import { buildParseError } from './xychart-db.js';
import { ErrorCollector } from '../error-collector.js';
import { assignSeriesColor, DEFAULT_PLOT_COLOR_PALETTE_STR } from '../serializer/shared/xychart-helpers.js';

// ============================================================
// jison parser（静态 import，浏览器兼容）
// ============================================================

interface JisonParserInstance {
  parse(input: string): unknown;
  yy: unknown;
}

/** xychart jison 解析器实例 */
const xychartJisonParser: JisonParserInstance = xychartParser as unknown as JisonParserInstance;

// ============================================================
// Frontmatter 配置类型
// ============================================================

/** Frontmatter 中的 config 结构（对齐官方 frontmatter 格式） */
interface FrontmatterConfig {
  config?: {
    xyChart?: {
      showDataLabel?: boolean;
      chartOrientation?: string;
      plotColorPalette?: string;
    };
    themeVariables?: {
      xyChart?: {
        plotColorPalette?: string;
      };
    };
  };
}

// ============================================================
// 主入口
// ============================================================

/**
 * 解析 xychart-beta 代码为 XYChartCanvasState
 *
 * 预处理（架构修复）:
 *   - 先提取 frontmatter 配置（应用到 DB），再调用 preprocessCode 清理指令/注释
 *   - jison 解析清理后的 code，错误上下文使用原始 source
 *
 * @param source - Mermaid xychart-beta 源代码（可含 YAML frontmatter、%% 注释、%%{directive}%%）
 * @param errorCollector - 可选的错误收集器，未提供时内部创建
 * @returns ParseResult，成功时 canvas 为 XYChartCanvasState
 */
export function parseXYChartCode(
  source: string,
  errorCollector?: ErrorCollector,
): ParseResult {
  const collector = errorCollector ?? new ErrorCollector();
  const parser = xychartJisonParser;
  const db = new XYChartDB(collector);

  // 1. 提取 frontmatter 配置并应用到 DB
  // xychart 的 frontmatter 包含 config 配置（showDataLabel/chartOrientation/plotColorPalette），
  // 需要先提取并应用到 DB，不能简单清理
  const { frontmatter, body, error } = extractFrontmatter(source);
  if (error) {
    return {
      success: false,
      canvas: createEmptyCanvas(),
      errors: [error],
    };
  }
  if (frontmatter) {
    applyFrontmatterConfig(db, frontmatter);
  }

  // 2. 将 XYChartDB 实例作为 yy 传入 parser
  // jison 语法动作通过 yy.setDiagramTitle/yy.setXAxisTitle/yy.addLinePlot/... 调用 XYChartDB 方法
  parser.yy = db;

  try {
    // 预处理：清理指令/注释（替换为等长换行，保持行号一致）
    // frontmatter 已由 extractFrontmatter 提取，此处仅清理 %% 注释和 %%{directive}%%
    // jison 无法解析 %% 注释和 %%{directive}%%，必须预处理
    const preprocessedSource = preprocessCode(body);
    // jison 语法要求 xychart-beta 关键字后必须有换行符
    const normalizedSource = preprocessedSource.endsWith('\n') ? preprocessedSource : preprocessedSource + '\n';
    parser.parse(normalizedSource);

    // 收集 XYChartDB 内部错误（通过共享的 ErrorCollector）
    const dbErrors = collector.getErrors();

    if (dbErrors.length > 0) {
      return {
        success: false,
        canvas: createEmptyCanvas(),
        errors: dbErrors,
      };
    }

    // 检查是否有数据系列（对齐官方 getDrawableElem 的校验）
    if (db.getPlots().length === 0) {
      return {
        success: false,
        canvas: createEmptyCanvas(),
        errors: [{
          line: 0,
          column: 0,
          message: 'No plot data, please provide at least one line or bar series',
          severity: 'error',
        }],
      };
    }

    const canvas = mapToXYChartCanvasState(db);

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
// Frontmatter 提取
// ============================================================

/**
 * 提取 YAML frontmatter
 *
 * 格式:
 *   ---
 *   config:
 *     xyChart:
 *       showDataLabel: true
 *   ---
 *   xychart-beta
 *       ...
 *
 * @param source - 原始源代码
 * @returns frontmatter 配置、剩余代码、解析错误（YAML 解析失败时返回错误而非静默丢弃）
 */
function extractFrontmatter(source: string): {
  frontmatter: FrontmatterConfig | null;
  body: string;
  error: ParseError | null;
} {
  // 匹配开头的 ---\n...\n---\n 格式
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { frontmatter: null, body: source, error: null };
  }

  try {
    const frontmatter = yaml.load(match[1]) as FrontmatterConfig;
    return { frontmatter, body: match[2], error: null };
  } catch (err) {
    // YAML 解析失败，返回错误而非静默丢弃（禁止 fallback 掩盖缺陷）
    const message = err instanceof Error ? err.message : String(err);
    return {
      frontmatter: null,
      body: source,
      error: {
        line: 0,
        column: 0,
        message: `YAML frontmatter 解析失败: ${message}`,
        severity: 'error',
      },
    };
  }
}

/**
 * 将 frontmatter 配置应用到 DB
 *
 * 字段映射（对齐官方 config 路径）:
 *   - config.xyChart.showDataLabel → db.setShowDataLabel
 *   - config.xyChart.chartOrientation → db.setOrientation
 *   - config.xyChart.plotColorPalette → db.setPlotColorPalette（设计文档路径）
 *   - config.themeVariables.xyChart.plotColorPalette → db.setPlotColorPalette（官方示例路径）
 *
 * 注意: frontmatter 配置在 jison 解析前应用，jison 语法中的 chartOrientation 会覆盖 frontmatter 设置
 */
function applyFrontmatterConfig(db: XYChartDB, frontmatter: FrontmatterConfig): void {
  const xyChartConfig = frontmatter.config?.xyChart;
  const themeVarXyChart = frontmatter.config?.themeVariables?.xyChart;

  // showDataLabel（仅 config.xyChart 路径）
  if (xyChartConfig && typeof xyChartConfig.showDataLabel === 'boolean') {
    db.setShowDataLabel(xyChartConfig.showDataLabel);
  }

  // chartOrientation（仅 config.xyChart 路径，jison 语法中的 orientation 会覆盖此设置）
  if (xyChartConfig && typeof xyChartConfig.chartOrientation === 'string') {
    if (xyChartConfig.chartOrientation === 'horizontal') {
      db.setOrientation('horizontal');
    } else if (xyChartConfig.chartOrientation === 'vertical') {
      db.setOrientation('vertical');
    }
  }

  // plotColorPalette — 优先使用 config.xyChart.plotColorPalette（设计文档路径），
  // 其次使用 config.themeVariables.xyChart.plotColorPalette（官方示例路径）
  const palette = xyChartConfig?.plotColorPalette
    ?? themeVarXyChart?.plotColorPalette;
  if (typeof palette === 'string' && palette.length > 0) {
    db.setPlotColorPalette(palette);
  }
}

// ============================================================
// XYChartDB → XYChartCanvasState 映射
// ============================================================

/**
 * 将 XYChartDB 转换为 XYChartCanvasState
 *
 * 映射规则:
 *   - db.getDiagramTitle() → canvas.title
 *   - db.getAccTitle()/getAccDescription() → canvas.accTitle/accDescription
 *   - db.getOrientation() → canvas.orientation
 *   - db.getShowDataLabel() → canvas.showDataLabel
 *   - db.getPlotColorPalette() → canvas.plotColorPalette
 *   - db.getXAxisType()/getXAxisTitle()/getXAxisBand()/getXAxisRangeData() → canvas.xAxis
 *   - db.getYAxisTitle()/getYAxisRangeData() → canvas.yAxis（强制 linear）
 *   - db.getPlots() → canvas.series（保持原始顺序）
 *   - db.getClasses() → canvas.classDefs
 *
 * @param db - XYChartDB 实例
 * @returns XYChartCanvasState
 */
function mapToXYChartCanvasState(db: XYChartDB): XYChartCanvasState {
  const canvas: XYChartCanvasState = {
    diagramType: 'xychart',
    xAxis: mapXAxis(db),
    yAxis: mapYAxis(db),
    series: mapSeries(db),
  };

  // 可选字段（仅在存在时设置）
  const title = db.getDiagramTitle();
  if (title) canvas.title = title;

  const accTitle = db.getAccTitle();
  if (accTitle) canvas.accTitle = accTitle;

  const accDescription = db.getAccDescription();
  if (accDescription) canvas.accDescription = accDescription;

  // orientation（仅在非默认值时设置）
  const orientation = db.getOrientation();
  if (orientation !== 'vertical') {
    canvas.orientation = orientation;
  }

  // showDataLabel（仅在 true 时设置）
  const showDataLabel = db.getShowDataLabel();
  if (showDataLabel) {
    canvas.showDataLabel = showDataLabel;
  }

  // plotColorPalette（仅在非默认值时设置）
  const plotColorPalette = db.getPlotColorPalette();
  if (plotColorPalette && plotColorPalette !== DEFAULT_PLOT_COLOR_PALETTE_STR) {
    canvas.plotColorPalette = plotColorPalette;
  }

  // classDefs（仅在存在时设置）
  const classes = db.getClasses();
  const classDefs = mapClassDefs(classes);
  if (classDefs.length > 0) {
    canvas.classDefs = classDefs;
  }

  return canvas;
}

/**
 * 将 DB x-axis 数据映射为 XYAxis
 *
 * - band 类型: { type: 'band', title, categories }
 * - linear 类型: { type: 'linear', title, min, max }
 */
function mapXAxis(db: XYChartDB): XYAxis {
  const type = db.getXAxisType();
  const title = db.getXAxisTitle();

  if (type === 'band') {
    const categories = db.getXAxisBand();
    const axis: XYAxis = { type: 'band', categories };
    if (title) axis.title = title;
    return axis;
  }

  // linear
  const { min, max } = db.getXAxisRangeData();
  const axis: XYAxis = { type: 'linear', min, max };
  if (title) axis.title = title;
  return axis;
}

/**
 * 将 DB y-axis 数据映射为 XYAxis（强制 linear）
 *
 * y-axis 仅支持 linear 类型（jison 文法层面禁止 y-axis band 语法）
 */
function mapYAxis(db: XYChartDB): XYAxis {
  const title = db.getYAxisTitle();
  const { min, max } = db.getYAxisRangeData();
  const axis: XYAxis = { type: 'linear', min, max };
  if (title) axis.title = title;
  return axis;
}

/**
 * 将 DB plots 映射为 XYSeries[]
 *
 * 保持原始顺序（line/bar 交替），颜色由 DB 已分配
 * 若 series.color 未设置，使用 assignSeriesColor 重新分配
 */
function mapSeries(db: XYChartDB): XYSeries[] {
  const plots = db.getPlots();
  const palette = db.getPlotColorPalette();

  return plots.map((plot, index) => {
    const series: XYSeries = {
      type: plot.type,
      data: [...plot.data],
    };

    // name（可选）
    if (plot.name !== undefined) {
      series.name = plot.name;
    }

    // color（DB 已分配，若未设置则使用 assignSeriesColor）
    series.color = plot.color ?? assignSeriesColor(series, index, palette);

    return series;
  });
}

/**
 * 将 XYChartDB classes 转换为 StateClassDefInfo[]
 *
 * 映射规则:
 *   - 类名 → name
 *   - styles[] → style 字符串（空格分隔，对齐官方 classDef 语法）
 */
function mapClassDefs(classes: Record<string, XYChartClassDef>): StateClassDefInfo[] {
  const result: StateClassDefInfo[] = [];
  for (const [name, classDef] of Object.entries(classes)) {
    if (classDef.styles.length > 0) {
      result.push({ name, style: classDef.styles.join(' ') });
    }
  }
  return result;
}

/** 创建空 XYChartCanvasState（解析失败时使用） */
function createEmptyCanvas(): XYChartCanvasState {
  return {
    diagramType: 'xychart',
    xAxis: { type: 'band', categories: [] },
    yAxis: { type: 'linear', min: 0, max: 0 },
    series: [],
  };
}
