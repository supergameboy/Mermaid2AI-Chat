/**
 * XYChart 序列化器
 *
 * 单一职责：将 XYChartCanvasState 序列化为 Mermaid xychart-beta 代码
 *
 * 数据流:
 *   XYChartCanvasState
 *     → serializeXYChart(canvas)
 *     → 输出 xychart-beta 代码（可能含 YAML frontmatter）
 *
 * 序列化规则（对齐官方 xychart-beta 语法，与 parseXYChartCode 解析顺序一致）:
 *   1. 输出 YAML frontmatter（如有 showDataLabel/plotColorPalette 非默认配置）
 *   2. 输出 'xychart-beta'（含可选 chartOrientation）
 *   3. 输出 title（如有，用双引号包裹）
 *   4. 输出 accTitle/accDescription（如有）
 *   5. 输出 x-axis：
 *      - band: x-axis "Label" [A, B, C] 或 x-axis [A, B, C]
 *      - linear: x-axis "Label" 0 --> 100 或 x-axis 0 --> 100
 *   6. 输出 y-axis（仅 linear）：
 *      - y-axis "Label" 0 --> 100 或 y-axis 0 --> 100
 *   7. 输出系列：
 *      - line [10, 20, 30]（无名）
 *      - line "Name" [10, 20, 30]（有名）
 *      - bar [10, 20, 30]
 *      - bar "Name" [10, 20, 30]
 *   8. 输出 classDef（如有）
 */

import type {
  XYChartCanvasState,
  XYSeries,
  XYAxis,
  SerializeResult,
} from '../types.js';
import {
  formatDataValue,
  escapeText,
  DEFAULT_PLOT_COLOR_PALETTE_STR,
} from './shared/xychart-helpers.js';

// ============================================================
// 默认值常量（用于判断是否需要输出 frontmatter）
// ============================================================

const DEFAULT_SHOW_DATA_LABEL = false;
const DEFAULT_ORIENTATION = 'vertical' as const;

// ============================================================
// 主入口
// ============================================================

/**
 * 序列化 XYChartCanvasState 为 Mermaid xychart-beta 代码
 *
 * @param canvas - XYChartCanvasState
 * @returns SerializeResult，包含 mermaid 代码和错误
 */
export function serializeXYChart(canvas: XYChartCanvasState): SerializeResult {
  if (canvas.diagramType !== 'xychart') {
    return {
      mermaid: '',
      errors: [{
        line: 0,
        column: 0,
        message: `serializeXYChart: diagramType 不匹配，期望 'xychart'，收到 '${canvas.diagramType}'`,
        severity: 'error',
      }],
    };
  }

  const lines: string[] = [];

  // 1. 输出 YAML frontmatter（如有非默认配置）
  const frontmatter = serializeFrontmatter(canvas);
  if (frontmatter) {
    lines.push(frontmatter);
  }

  // 2. 输出 'xychart-beta'（含可选 chartOrientation）
  const orientation = canvas.orientation ?? DEFAULT_ORIENTATION;
  if (orientation === 'horizontal') {
    lines.push('xychart-beta horizontal');
  } else {
    lines.push('xychart-beta');
  }

  // 3. title（如有，用双引号包裹）
  if (canvas.title !== undefined && canvas.title !== '') {
    lines.push(`title "${escapeText(canvas.title)}"`);
  }

  // 4. accTitle/accDescription（如有）
  if (canvas.accTitle !== undefined && canvas.accTitle !== '') {
    lines.push(`accTitle: ${canvas.accTitle}`);
  }
  if (canvas.accDescription !== undefined && canvas.accDescription !== '') {
    lines.push(`accDescription: ${canvas.accDescription}`);
  }

  // 5. x-axis
  lines.push(serializeXAxis(canvas.xAxis));

  // 6. y-axis（仅 linear）
  lines.push(serializeYAxis(canvas.yAxis));

  // 7. 系列
  for (const series of canvas.series) {
    lines.push(serializeSeries(series));
  }

  // 8. classDef（如有）
  if (canvas.classDefs) {
    for (const classDef of canvas.classDefs) {
      lines.push(`classDef ${classDef.name} ${classDef.style}`);
    }
  }

  return {
    mermaid: lines.join('\n'),
    errors: [],
  };
}

// ============================================================
// Frontmatter 序列化
// ============================================================

/**
 * 序列化 YAML frontmatter（仅在非默认配置时输出）
 *
 * 输出条件:
 *   - showDataLabel 为 true（默认 false）
 *   - plotColorPalette 非默认值
 *
 * 注意: chartOrientation 通过 jison 语法输出（xychart-beta horizontal），不放在 frontmatter
 *
 * 路径选择（对齐设计文档决策 8 字段映射表）:
 *   - showDataLabel → config.xyChart.showDataLabel
 *   - plotColorPalette → config.xyChart.plotColorPalette（单一数据源，与解析路径一致）
 *
 * 格式:
 *   ---
 *   config:
 *     xyChart:
 *       showDataLabel: true
 *       plotColorPalette: '#ECECEC, #9FB40F, ...'
 *   ---
 */
function serializeFrontmatter(canvas: XYChartCanvasState): string {
  // 构建 xyChart 配置对象（结构化构建，避免字符串拼接错误）
  const xyChartConfig: Record<string, string | boolean> = {};

  // showDataLabel
  const showDataLabel = canvas.showDataLabel ?? DEFAULT_SHOW_DATA_LABEL;
  if (showDataLabel !== DEFAULT_SHOW_DATA_LABEL) {
    xyChartConfig.showDataLabel = showDataLabel;
  }

  // plotColorPalette（使用 config.xyChart.plotColorPalette 路径，对齐设计文档决策 8）
  const plotColorPalette = canvas.plotColorPalette;
  if (plotColorPalette && plotColorPalette !== DEFAULT_PLOT_COLOR_PALETTE_STR) {
    xyChartConfig.plotColorPalette = plotColorPalette;
  }

  if (Object.keys(xyChartConfig).length === 0) {
    return '';
  }

  // 构建 frontmatter YAML（结构化缩进，避免 filter 匹配错误）
  const lines: string[] = ['---', 'config:', '  xyChart:'];
  for (const [key, value] of Object.entries(xyChartConfig)) {
    if (typeof value === 'boolean') {
      lines.push(`    ${key}: ${value}`);
    } else {
      // 字符串值用单引号包裹（YAML 格式，对齐官方示例）
      lines.push(`    ${key}: '${value}'`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}

// ============================================================
// 坐标轴序列化
// ============================================================

/**
 * 序列化 x-axis 行
 *
 * 格式:
 *   - band 有标题: `x-axis "Title" [A, B, C]`
 *   - band 无标题: `x-axis [A, B, C]`
 *   - linear 有标题: `x-axis "Title" 0 --> 100`
 *   - linear 无标题: `x-axis 0 --> 100`
 */
function serializeXAxis(axis: XYAxis): string {
  const titlePart = axis.title ? `"${escapeText(axis.title)}" ` : '';

  if (axis.type === 'band') {
    const categories = axis.categories ?? [];
    const categoriesStr = categories.map(serializeCategory).join(', ');
    return `x-axis ${titlePart}[${categoriesStr}]`;
  }

  // linear
  const min = formatDataValue(axis.min ?? 0);
  const max = formatDataValue(axis.max ?? 0);
  return `x-axis ${titlePart}${min} --> ${max}`;
}

/**
 * 序列化 y-axis 行（仅 linear）
 *
 * 格式:
 *   - 有标题: `y-axis "Title" 0 --> 100`
 *   - 无标题: `y-axis 0 --> 100`
 */
function serializeYAxis(axis: XYAxis): string {
  const titlePart = axis.title ? `"${escapeText(axis.title)}" ` : '';
  const min = formatDataValue(axis.min ?? 0);
  const max = formatDataValue(axis.max ?? 0);
  return `y-axis ${titlePart}${min} --> ${max}`;
}

// ============================================================
// 数据系列序列化
// ============================================================

/**
 * 序列化数据系列行
 *
 * 格式:
 *   - line 无名: `line [10, 20, 30]`
 *   - line 有名: `line "Name" [10, 20, 30]`
 *   - bar 无名: `bar [10, 20, 30]`
 *   - bar 有名: `bar "Name" [10, 20, 30]`
 */
function serializeSeries(series: XYSeries): string {
  const namePart = series.name ? `"${escapeText(series.name)}" ` : '';
  const dataStr = series.data.map(formatDataValue).join(', ');
  return `${series.type} ${namePart}[${dataStr}]`;
}

// ============================================================
// 类别序列化
// ============================================================

/**
 * 序列化类别文本
 *
 * - 简单字母数字（无空格/特殊字符）→ 直接输出
 * - 含空格或特殊字符 → 用双引号包裹
 *
 * 对齐官方示例:
 *   - `jan, feb, mar` → 直接输出
 *   - `"Cold Brew"` → 含空格，用引号包裹
 */
function serializeCategory(category: string): string {
  // 简单字母数字（含 _ - .）不需要引号
  if (/^[A-Za-z0-9_\-\.]+$/.test(category)) {
    return category;
  }
  return `"${escapeText(category)}"`;
}

// ============================================================
// XYChartSerializer 类（对齐其他序列化器的类形式）
// ============================================================

/**
 * XYChart 序列化器类
 * 提供 OOP 风格的序列化接口，与 FlowchartSerializer/SequenceSerializer 等保持一致
 */
export class XYChartSerializer {
  readonly diagramType = 'xychart' as const;

  serialize(canvas: XYChartCanvasState): SerializeResult {
    return serializeXYChart(canvas);
  }
}
