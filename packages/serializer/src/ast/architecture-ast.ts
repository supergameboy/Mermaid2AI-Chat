/**
 * Architecture AST 类型定义
 * 对齐官方 architectureDb.ts 的数据结构
 */
import type { ArchitectureDirection } from '../types.js';

/** Architecture 服务（AST 层） */
export interface ArchitectureServiceAST {
  id: string;
  title?: string;
  icon?: string;
  iconText?: string;
  edges: string[];
  width?: number;
  height?: number;
  /** 所属 group id（用于 service in group 语法） */
  in?: string;
}

/** Architecture 连接点（AST 层） */
export interface ArchitectureJunctionAST {
  id: string;
  edges: string[];
  width?: number;
  height?: number;
  /** 所属 group id（用于 junction in group 语法） */
  in?: string;
}

/** Architecture 分组（AST 层，v4：in 改为 string 单值） */
export interface ArchitectureGroupAST {
  id: string;
  icon?: string;
  title?: string;
  /** 父 group ID（v4：从 string[] 改为 string，支持嵌套） */
  in?: string;
}

/** Architecture 边（AST 层） */
export interface ArchitectureEdgeAST {
  lhsId: string;
  lhsDir: ArchitectureDirection;
  lhsInto: boolean;
  lhsGroup?: string;
  rhsId: string;
  rhsDir: ArchitectureDirection;
  rhsInto: boolean;
  rhsGroup?: string;
  title?: string;
}

/** Architecture layout hint（AST 层，v4 新增） */
export interface ArchitectureLayoutHintAST {
  direction: 'row' | 'column';
  members: string[];
}

/** Architecture AST 根节点（v4：新增 layoutHints 字段） */
export interface ArchitectureAST {
  services: ArchitectureServiceAST[];
  junctions: ArchitectureJunctionAST[];
  groups: ArchitectureGroupAST[];
  edges: ArchitectureEdgeAST[];
  /** v4 新增：layout hints */
  layoutHints: ArchitectureLayoutHintAST[];
  title?: string;
  accTitle?: string;
  accDescription?: string;
}
