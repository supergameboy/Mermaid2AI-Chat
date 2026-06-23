/**
 * State Diagram AST 类型定义
 *
 * 单一职责：定义 StateDB 内部数据结构（AST 层）
 *
 * 注意：这些类型是 StateDB 内部使用的 AST 层类型，
 * 与 M0 types.ts 中的 StateNodeType/StateNotePosition 等公共类型不同。
 * 公共类型由 M0 统一定义，本文件仅定义 DB 内部数据结构。
 */

import type {
  StateNodeType,
  StateNotePosition,
  FlowchartDirection,
} from '../../types.js';

// ============================================================
// AST 层 — jison 产物
// ============================================================

/** StateDB 内部 Note 结构（AST 层，非 MermaidNodeData.note） */
export interface StateASTNote {
  position?: StateNotePosition;
  text: string;
}

/** StateDB 语句类型（jison 产物，联合类型） */
export type StateStmt =
  | { stmt: 'applyClass'; id: string; styleClass: string }
  | { stmt: 'classDef'; id: string; classes: string }
  | { stmt: 'dir'; value: FlowchartDirection }
  | {
      stmt: 'relation';
      state1: StateStmtRef;
      state2: StateStmtRef;
      description?: string;
    }
  | {
      stmt: 'state';
      id: string;
      type: StateNodeType;
      description?: string | string[];
      descriptions?: string[];
      doc?: StateStmt[];
      note?: StateASTNote;
      start?: boolean;
      classes?: string[];
      styles?: string[];
      textStyles?: string[];
    }
  | { stmt: 'style'; id: string; styleClass: string }
  | { stmt: 'root'; id: 'root'; doc?: StateStmt[] }
  | { stmt: 'click'; id: string | StateStmt; url: string; tooltip: string };

/** StateDB 内部节点引用（AST 层，relation 中的 state1/state2） */
export type StateStmtRef = string | StateStmt;

// ============================================================
// DB 层 — getData() 返回类型
// ============================================================

/** StateDB 样式类（classDef 产物） */
export interface StateStyleClass {
  id: string;
  styles: string[];
  textStyles: string[];
}

/** StateDB 内部节点数据（getData 返回） */
export interface StateDBNode {
  id: string;
  shape: string;
  label?: string | string[];
  description?: string | string[];
  type?: string;
  isGroup?: boolean;
  parentId?: string;
  classes?: string;
  cssClasses?: string;
  cssCompiledStyles?: string[];
  cssStyles?: string[];
  dir?: string;
  explicitDir?: boolean;
  domId?: string;
  padding?: number;
  rx?: number;
  ry?: number;
  centerLabel?: boolean;
  position?: string;
  labelType?: string;
  labelStyle?: string;
  look?: string;
}

/** StateDB 内部边数据（getData 返回） */
export interface StateDBEdge {
  id: string;
  start: string;
  end: string;
  arrowhead: string;
  arrowTypeEnd: string;
  style: string;
  labelStyle: string;
  label?: string;
  arrowheadStyle: string;
  labelpos: string;
  labelType: string;
  thickness: string;
  classes: string;
}

/** StateDB getData() 返回类型 */
export interface StateDBData {
  nodes: StateDBNode[];
  edges: StateDBEdge[];
  other: Record<string, unknown>;
  direction: string;
}

/** StateDB 链接信息（click 产物） */
export interface StateLinkInfo {
  url: string;
  tooltip: string;
}
