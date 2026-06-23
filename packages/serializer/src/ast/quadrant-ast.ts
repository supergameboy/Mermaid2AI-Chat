/**
 * QuadrantChart AST 类型定义
 * 对齐官方 quadrantDb.ts 的数据结构
 */
import type { NodeStyle } from '../types.js';

/** QuadrantChart 数据点（AST 层，坐标 0-1 归一化） */
export interface QuadrantPointAST {
  label: string;
  x: number;  // 0-1
  y: number;  // 0-1
  className?: string;
  style?: NodeStyle;
}

/** QuadrantChart AST 根节点 */
export interface QuadrantAST {
  title?: string;
  accTitle?: string;
  accDescription?: string;
  quadrant1Text?: string;
  quadrant2Text?: string;
  quadrant3Text?: string;
  quadrant4Text?: string;
  xAxisLeftText?: string;
  xAxisRightText?: string;
  yAxisTopText?: string;
  yAxisBottomText?: string;
  points: QuadrantPointAST[];
  classDefs: { name: string; style: string }[];
}
