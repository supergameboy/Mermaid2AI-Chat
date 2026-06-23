/**
 * Mindmap AST 类型定义
 * 对齐官方 mindmapDb.ts 的数据结构
 */
import type { MindmapNodeType } from '../types.js';

/** Mindmap 节点（AST 层） */
export interface MindmapNodeAST {
  id: string;
  nodeId: string;
  level: number;
  description: string;
  type: MindmapNodeType;
  children: MindmapNodeAST[];
  icon?: string;
  className?: string;
  section?: number;
}

/** Mindmap AST 根节点 */
export interface MindmapAST {
  root: MindmapNodeAST;
  title?: string;
  accTitle?: string;
  accDescription?: string;
}
