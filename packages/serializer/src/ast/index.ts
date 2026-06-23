/**
 * AST 类型定义统一导出
 * 所有图表类型的 AST 类型定义汇总
 */

export type {
  FlowchartAST,
  FlowVertex,
  FlowEdge,
  FlowLink,
  FlowClass,
  FlowSubGraph,
  FlowClickEvent,
  FlowText,
  FlowVertexTypeParam,
  FlowLabelType,
} from './flowchart-ast.js';
export type { SequenceAST, SequenceSignalType } from './sequence-ast.js';
// Sequence 专用 AST 层类型（从 parser/sequence/types.ts 引用）
export type { Actor, Message, Note, Box, AddMessageParams } from '../parser/sequence/types.js';
export type { ClassAST } from './class-ast.js';
// Class 专用 AST 层类型（从 parser/class/types.ts 引用）
export type {
  ClassNode,
  ClassRelation,
  ClassNote,
  NamespaceNode,
  Interface,
  StyleClass,
  ClassMap,
  ClassNoteMap,
  NamespaceMap,
  ClassDBYY,
} from '../parser/class/types.js';
export type { ClassMember } from '../parser/class/class-member.js';
export type {
  ERAST,
  EntityNode,
  Attribute,
  Relationship,
  RelSpec,
  EntityClass,
  ErSubGraph,
  EntityMap,
  EntityClassMap,
} from './er-ast.js';
// State 专用 AST 层类型（从 parser/state/state-types.ts 引用）
export type {
  StateStmt,
  StateASTNote,
  StateDBNode,
  StateDBEdge,
  StateDBData,
  StateStyleClass,
  StateLinkInfo,
} from '../parser/state/state-types.js';
export type { MindmapAST, MindmapNodeAST } from './mindmap-ast.js';
export type { GanttAST, GanttTaskAST, GanttSectionAST } from './gantt-ast.js';
export type { TimelineAST, TimelineSectionAST, TimelinePeriodAST, TimelineEventAST } from './timeline-ast.js';
export type { QuadrantAST, QuadrantPointAST } from './quadrant-ast.js';
export type { XYChartAST, XYAxisAST, XYPlotAST } from './xychart-ast.js';
export type { PieAST, PieSliceAST } from './pie-ast.js';
export type { ArchitectureAST, ArchitectureServiceAST, ArchitectureJunctionAST, ArchitectureGroupAST, ArchitectureEdgeAST, ArchitectureLayoutHintAST } from './architecture-ast.js';
