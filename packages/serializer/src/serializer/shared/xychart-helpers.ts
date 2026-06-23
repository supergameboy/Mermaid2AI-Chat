/**
 * XYChart 序列化/解析辅助函数
 *
 * 单一职责：提供 xychart 颜色分配和数值格式化辅助函数
 *
 * 功能:
 *   - 默认颜色调色板常量（对齐官方 defaultConfig.xyChart.plotColorPalette）
 *   - 数据系列颜色分配（assignSeriesColor）
 *   - 调色板字符串解析（parsePlotColorPalette）
 *   - 数值格式化（formatDataValue）
 *   - 文本转义（escapeText）
 */

import type { XYSeries } from '../../types.js';

// ============================================================
// 常量
// ============================================================

/**
 * 默认颜色调色板（对齐官方 defaultConfig.xyChart.plotColorPalette）
 *
 * 用于 addLinePlot/addBarPlot 时按系列索引分配颜色
 * 渲染器直接读取 series.color，不需要再调用 assignSeriesColor
 */
export const DEFAULT_PLOT_COLOR_PALETTE: readonly string[] = [
  '#ECECEC',
  '#9FB40F',
  '#F5C944',
  '#DB6128',
  '#8C1B1B',
  '#574B42',
  '#4A4A4A',
  '#6E6E6E',
  '#8C8C8C',
  '#B0B0B0',
  '#C8C8C8',
  '#DCDCDC',
];

/**
 * 默认调色板字符串（CSV 格式，用于 DB 初始化和序列化输出）
 */
export const DEFAULT_PLOT_COLOR_PALETTE_STR = DEFAULT_PLOT_COLOR_PALETTE.join(', ');

// ============================================================
// 调色板解析
// ============================================================

/**
 * 解析调色板字符串为颜色数组
 *
 * @param palette - CSV 颜色字符串（如 "#ECECEC, #9FB40F, ..."）
 * @returns 颜色数组（已 trim）
 */
export function parsePlotColorPalette(palette: string): string[] {
  return palette
    .split(',')
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
}

// ============================================================
// 颜色分配
// ============================================================

/**
 * 为数据系列分配颜色
 *
 * 分配规则（对齐官方 getPlotColorFromPalette）:
 *   - 若 series.color 已指定 → 使用指定颜色
 *   - 否则按系列索引从 plotColorPalette 分配
 *   - plotColorPalette 为 CSV 颜色列表
 *
 * 调用时机: 在 mapToXYChartCanvasState 中调用（解析时分配），渲染器直接读取 series.color
 *
 * @param series - 数据系列
 * @param index - 系列索引（0-based）
 * @param palette - 可选的调色板 CSV 字符串，未提供时使用 DEFAULT_PLOT_COLOR_PALETTE
 * @returns 颜色字符串
 */
export function assignSeriesColor(
  series: XYSeries,
  index: number,
  palette?: string,
): string {
  // 若系列已指定颜色，直接使用
  if (series.color) {
    return series.color;
  }

  // 解析调色板
  const colors = palette
    ? parsePlotColorPalette(palette)
    : [...DEFAULT_PLOT_COLOR_PALETTE];

  // 对齐官方: plotIndex=0 → palette[0], plotIndex>0 → palette[plotIndex % palette.length]
  return colors[index === 0 ? 0 : index % colors.length];
}

// ============================================================
// 数值格式化
// ============================================================

/**
 * 格式化数据值
 *
 * - 整数直接输出（10 → "10"）
 * - 浮点保留必要小数位（10.5 → "10.5"）
 * - 截断浮点精度噪声（0.1 + 0.2 = 0.30000000000000004 → "0.3"）
 *
 * @param value - 数值
 * @returns 格式化后的字符串
 */
export function formatDataValue(value: number): string {
  // 截断精度噪声：toFixed(6) 保留 6 位小数，parseFloat 去除尾随零
  const truncated = parseFloat(value.toFixed(6));
  return String(truncated);
}

// ============================================================
// 文本转义
// ============================================================

/**
 * 转义文本中的双引号
 *
 * 用于 title/x-axis title/y-axis title/series name 序列化时
 * 将文本用双引号包裹时，内部双引号需转义为 \"
 *
 * @param text - 原始文本
 * @returns 转义后的文本
 */
export function escapeText(text: string): string {
  return text.replace(/"/g, '\\"');
}
