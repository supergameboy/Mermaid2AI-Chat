/**
 * XYChart AST 类型定义
 * 对齐官方 xychartDb.ts 的数据结构
 */

/** XYChart 坐标轴（AST 层） */
export interface XYAxisAST {
  type: 'band' | 'linear';
  title?: string;
  min?: number;
  max?: number;
  categories?: string[];
  data?: number[];
}

/** XYChart 数据系列（AST 层） */
export interface XYPlotAST {
  name?: string;
  type: 'line' | 'bar';
  data: number[];
  color?: string;
  className?: string;
}

/** XYChart AST 根节点 */
export interface XYChartAST {
  title?: string;
  accTitle?: string;
  accDescription?: string;
  orientation?: 'horizontal' | 'vertical';
  showDataLabel?: boolean;
  plotColorPalette?: string;
  xAxis: XYAxisAST;
  yAxis: XYAxisAST;
  plots: XYPlotAST[];
  classDefs: { name: string; style: string }[];
}
