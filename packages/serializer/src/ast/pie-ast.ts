/**
 * Pie AST 类型定义
 * 对齐官方 pieDb.ts 的数据结构
 */

/** Pie 切片（AST 层） */
export interface PieSliceAST {
  label: string;
  value: number;
}

/** Pie AST 根节点 */
export interface PieAST {
  title?: string;
  accTitle?: string;
  accDescription?: string;
  showData?: boolean;
  slices: PieSliceAST[];
}
