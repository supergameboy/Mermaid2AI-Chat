/**
 * 浏览器安全入口 — 供浏览器环境（web-editor、editor、vscode-extension webview）导入
 *
 * 单一职责：聚合所有浏览器安全的导出（类型、序列化器、工具、DB 类、解析器、调度器）
 *
 * 架构变更（2026-06-22）:
 *   jison 0.4.18 生成的 CJS 代码已由 compile-jison.mts 后处理为 ESM，
 *   所有解析器（jison-parser.ts + 5 个专用解析器）改用静态 import，
 *   不再依赖 node:module/node:url/node:path，全部浏览器安全。
 *   因此 parseMermaid 也浏览器安全，本入口导出全部内容。
 *
 * 消费者通过 package.json exports 的 browser 条件自动路由到此入口，
 * 无需修改 import 路径。
 */

// ============================================================
// 类型导出（types.ts — 单一数据源）
// ============================================================
export type {
  // 基础类型
  MermaidShapeType,
  MermaidEdgeStyle,
  FlowchartDirection,
  NodeStyle,
  EdgeMarker,
  // 节点和边
  MermaidNodeData,
  MermaidEdgeData,
  MermaidNode,
  MermaidEdge,
  Viewport,
  // 图表类型
  DiagramType,
  GraphDiagramType,
  ChartDiagramType,
  // 类型专用子类型
  ClassRelationType,
  ClassLineType,
  ClassVisibility,
  ClassClassifier,
  ERCardinality,
  ERIdentification,
  ERAttributeKey,
  SequenceArrowType,
  SequenceBlockType,
  StateNodeType,
  StateStmtType,
  StateNotePosition,
  MindmapNodeType,
  ArchitectureDirection,
  ArchitectureAlignment,
  NodeMember,
  NodeAttribute,
  SequenceParticipantInfo,
  SequenceBlockInfo,
  SequenceNoteInfo,
  ClassNamespaceInfo,
  ClassNoteInfo,
  ArchitectureGroupInfo,
  ArchitectureEdgeInfo,
  ArchitectureLayoutHint,
  StateCompositeInfo,
  StateNoteInfo,
  StateClassDefInfo,
  FlowClassDefInfo,
  MindmapDecorationInfo,
  // 元数据
  GraphMetadata,
  // 画布状态
  CanvasState,
  GraphCanvasState,
  GraphCanvasUpdate,
  GanttCanvasState,
  GanttSection,
  GanttTask,
  PieCanvasState,
  PieSlice,
  TimelineCanvasState,
  TimelineSection,
  TimelinePeriod,
  TimelineEvent,
  QuadrantCanvasState,
  QuadrantPoint,
  XYChartCanvasState,
  XYAxis,
  XYSeries,
  // 来源和消费
  CanvasSource,
  ConsumedState,
  // 解析和序列化结果
  ParseResult,
  ParseSuccessResult,
  ParseFailureResult,
  ParseError,
  SerializeResult,
  // 多标签页视图
  ViewSource,
  ViewSummary,
  ViewContent,
  View,
  ActiveViewPayload,
} from './types.js';

// 函数导出（types.ts）
export {
  isGraphDiagramType,
  isChartDiagramType,
  isGraphCanvasState,
  isGanttCanvasState,
  isPieCanvasState,
  isTimelineCanvasState,
  isQuadrantCanvasState,
  isXYChartCanvasState,
  migrateCanvasState,
  createEmptyCanvasState,
} from './types.js';

// ============================================================
// AST 类型导出
// ============================================================
export type {
  FlowchartAST,
  FlowVertex,
  FlowEdge,
  FlowLink,
  FlowClass,
  FlowSubGraph,
  FlowClickEvent,
  SequenceAST,
  SequenceSignalType,
  Actor,
  Message,
  Note,
  Box,
  AddMessageParams,
  ClassAST,
  ClassNode,
  ClassRelation,
  ClassNote,
  NamespaceNode,
  ERAST,
  EntityNode,
  Attribute,
  Relationship,
  RelSpec,
  EntityClass,
  ErSubGraph,
  EntityMap,
  EntityClassMap,
  StateStmt,
  StateASTNote,
  StateDBNode,
  StateDBEdge,
  StateDBData,
  StateStyleClass,
  StateLinkInfo,
  MindmapAST,
  MindmapNodeAST,
  GanttAST,
  GanttTaskAST,
  GanttSectionAST,
  TimelineAST,
  TimelineSectionAST,
  TimelinePeriodAST,
  TimelineEventAST,
  QuadrantAST,
  QuadrantPointAST,
  XYChartAST,
  XYAxisAST,
  XYPlotAST,
  PieAST,
  PieSliceAST,
  ArchitectureAST,
  ArchitectureServiceAST,
  ArchitectureJunctionAST,
  ArchitectureGroupAST,
  ArchitectureEdgeAST,
} from './ast/index.js';

// ============================================================
// 手写解析器（pie + architecture）— 浏览器安全
// ============================================================
export {
  parsePie,
  mapToPieCanvasState,
  parseArchitecture,
  PieTokenizer,
  ArchitectureTokenizer,
  BaseTokenizer,
} from './parser/handwritten/index.js';
export type {
  Token,
  TokenType,
  TokenizeError,
  TokenizeResult,
  PieParseResult,
  ArchitectureParseResult,
} from './parser/handwritten/index.js';

// ============================================================
// DB 类（纯类定义，不含 jison 加载逻辑）— 浏览器安全
// ============================================================

// flowchart DB
export { FlowDB } from './parser/flowchart/flow-db.js';
export type { FlowDBYY } from './parser/flowchart/flow-db.js';

// sequence DB + 常量
export { SequenceDB } from './parser/sequence/sequence-db.js';
export type { SequenceDBYY } from './parser/sequence/sequence-db.js';
export { LINETYPE, ARROWTYPE, PLACEMENT, PARTICIPANT_TYPE } from './parser/sequence/constants.js';
export {
  LINETYPE_TO_ARROW_TYPE,
  LINETYPE_TO_BLOCK_TYPE,
} from './parser/sequence/constants.js';

// class DB + 常量
export { ClassDB } from './parser/class/class-db.js';
export type { ClassDBYY } from './parser/class/types.js';
export { ClassMember } from './parser/class/class-member.js';
export {
  RELATION_TYPE,
  LINE_TYPE,
  VISIBILITY_VALUES,
  resolveRelationType,
} from './parser/class/constants.js';

// er DB + 常量
export { ErDB } from './parser/er/er-db.js';
export type { ErDBYY } from './parser/er/types.js';
export {
  CARDINALITY,
  IDENTIFICATION,
  CARDINALITY_TO_SYMBOL,
  IDENTIFICATION_TO_SYMBOL,
  CARDINALITY_TO_ER_CARDINALITY,
  IDENTIFICATION_TO_ER_IDENTIFICATION,
  resolveCardinality,
  resolveIdentification,
} from './parser/er/constants.js';

// state DB
export { StateDB } from './parser/state/state-db.js';

// mindmap DB + 类型
export { MindmapDB } from './parser/mindmap/mindmap-db.js';
export type {
  MindmapDBNode,
  MindmapLayoutNode,
  MindmapDBData,
  MindmapNodeTypeValue,
} from './parser/mindmap/mindmap-types.js';
export { MindmapNodeTypeConst } from './parser/mindmap/mindmap-types.js';

// ============================================================
// 序列化器导出 — 浏览器安全
// ============================================================

// flowchart 序列化器
export {
  serializeFlowchart,
  serializeVertex,
  serializeVertexClassSuffix,
  serializeEdge,
  serializeSubgraph,
  serializeClassDefs,
  serializeClassApplications,
  serializeNodeStyles,
  serializeLinkStyles,
  serializeClickEvents,
  isIncrementalChange,
  applyIncrementalChanges,
} from './serializer/flowchart/index.js';

// sequence 序列化器
export {
  serializeSequence,
  serializeParticipants,
  serializeMessage,
  serializeActivate,
  serializeNotes,
  serializeBlockStart,
  serializeBlockEnd,
  serializeBlockMid,
  hasBlockMid,
} from './serializer/sequence/index.js';
export type { SequenceBoxInfo } from './serializer/sequence/index.js';

// class 序列化器
export {
  serializeClass,
  serializeClassNode,
  serializeRelation,
  serializeNamespace,
  serializeNotes as serializeClassNotes,
  serializeClassStyleDefs,
  serializeClassStyleApplications,
  serializeClassNodeStyles,
} from './serializer/class/index.js';

// er 序列化器
export {
  serializeER,
  serializeEntity,
  serializeRelationship,
  cardinalityToSymbol,
  identificationToSymbol,
} from './serializer/er/index.js';

// state 序列化器
export { serializeState } from './serializer/state-serializer.js';

// mindmap 序列化器
export { serializeMindmap } from './serializer/mindmap-serializer.js';

// architecture 序列化器
export { serializeArchitecture } from './serializer/architecture-serializer.js';

// gantt 序列化器
export { serializeGantt } from './serializer/gantt-serializer.js';

// pie 序列化器（M9 新增）
export { serializePie, PieSerializer } from './serializer/pie-serializer.js';

// timeline 序列化器（M10 新增）
export { serializeTimeline, TimelineSerializer } from './serializer/timeline-serializer.js';

// quadrant 序列化器（M11 新增）
export { serializeQuadrant, QuadrantSerializer } from './serializer/quadrant-serializer.js';

// xychart 序列化器（M12 新增）
export { serializeXYChart, XYChartSerializer } from './serializer/xychart-serializer.js';

// ============================================================
// 工具导出 — 浏览器安全
// ============================================================
export { IdGenerator, idGenerator } from './id-generator.js';
export { ErrorCollector } from './error-collector.js';

// 转义辅助函数
export {
  escapeLabel,
  escapeEdgeLabel,
  escapeStringLiteral,
  unescapeStringLiteral,
  unescapeLabel,
} from './serializer/shared/escape-helpers.js';

// architecture 辅助函数（v4 新增）
export {
  deriveGroupMembers,
  detectCycle,
} from './serializer/shared/architecture-helpers.js';

// gantt 辅助函数（v4 新增）
export {
  formatTaskLine as formatGanttTaskLine,
  formatDependencies as formatGanttDependencies,
  formatTags as formatGanttTags,
  validateDateFormat,
  isOfficialTag,
  formatClickStatement,
  formatExcludesList,
} from './serializer/shared/gantt-helpers.js';

// pie 辅助函数（M9 新增）
export {
  escapePieLabel,
  unescapePieLabel,
  calculatePercentage,
} from './serializer/shared/pie-helpers.js';

// timeline 辅助函数（M10 新增）
export {
  isContinuationEvent,
  splitPeriodAndEvents,
  calculateSectionDepth,
  formatPeriodLine,
} from './serializer/shared/timeline-helpers.js';

// quadrant 辅助函数（M11 新增）
export {
  isValidNormalizedCoordinate,
  formatCoordinate,
  serializePointStyle,
  mergeClassDefStyle,
  parseClassDefStyle,
  serializeClassDefStatement,
  serializePointLine,
} from './serializer/shared/quadrant-helpers.js';

// xychart 辅助函数（M12 新增）
export {
  DEFAULT_PLOT_COLOR_PALETTE,
  DEFAULT_PLOT_COLOR_PALETTE_STR,
  parsePlotColorPalette,
  assignSeriesColor,
  formatDataValue,
  escapeText,
} from './serializer/shared/xychart-helpers.js';

// ============================================================
// 序列化调度（浏览器安全）
// ============================================================
export { serializeMermaid, detectDiagramType } from './serialize-dispatcher.js';

// ============================================================
// Detector 模块（M0 新增，浏览器安全）
// ============================================================
export {
  detectDiagramType as detectDiagramTypeFromDetector,
  registerBuiltinDetectors,
  preprocessCode,
  detectorRegistry,
  BUILTIN_DETECTORS,
} from './detector/index.js';
export type {
  DiagramDetector,
  DetectorRecord,
  DetectorRegistry,
} from './detector/index.js';

// ============================================================
// jison 解析器导出（浏览器安全 — 静态 import ESM）
// ============================================================
export {
  parseFlowchart,
  parseSequence,
  parseClass,
  parseER,
  parseStateJison,
  parseMindmap,
  parseTimeline,
  parseQuadrant,
  parseXYChart,
  clearParserCache,
} from './parser/jison-parser.js';
export type { JisonParseResult, JisonParser } from './parser/jison-parser.js';

// ============================================================
// 专用解析器导出（浏览器安全 — 返回 CanvasState）
// ============================================================

// flowchart 专用解析器
export { parseFlowchartCode } from './parser/flowchart/flowchart-parser.js';
export type { FlowchartParseResult } from './parser/flowchart/flowchart-parser.js';

// sequence 专用解析器
export { parseSequence as parseSequenceCode } from './parser/sequence/sequence-parser.js';
export type { SequenceParseResult } from './parser/sequence/sequence-parser.js';

// class 专用解析器
export { parseClass as parseClassCode } from './parser/class/class-parser.js';
export type { ClassParseResult } from './parser/class/class-parser.js';

// er 专用解析器
// 注意：使用别名 parseERCode 避免与 jison-parser 的 parseER 冲突
export { parseER as parseERCode } from './parser/er/er-parser.js';
export type { ERParseResult } from './parser/er/er-parser.js';

// state 专用解析器
export { parseState } from './parser/state/state-parser.js';

// mindmap 专用解析器
export { parseMindmapCode } from './parser/mindmap/mindmap-parser.js';

// architecture 专用解析器
export { parseArchitectureCode } from './parser/architecture/architecture-parser.js';

// gantt 专用解析器
export { parseGanttCode } from './parser/gantt-parser.js';

// timeline 专用解析器（M10 新增，返回 CanvasState）
export { parseTimelineCode } from './parser/timeline-parser.js';

// quadrant 专用解析器（M11 新增，返回 CanvasState）
export { parseQuadrantCode } from './parser/quadrant-parser.js';

// xychart 专用解析器（M12 新增，返回 CanvasState）
export { parseXYChartCode } from './parser/xychart-parser.js';

// pie 专用解析器（M9 新增，返回 CanvasState）
export { parsePieCode } from './parser/handwritten/index.js';

// gantt DB 类（浏览器安全）
export { GanttDB } from './parser/gantt-db.js';
export type { GanttDBTask } from './parser/gantt-db.js';

// timeline DB 类（M10 新增，浏览器安全）
export { TimelineDB } from './parser/timeline-db.js';
export type { TimelineTask } from './parser/timeline-db.js';

// quadrant DB 类（M11 新增，浏览器安全）
export { QuadrantDB } from './parser/quadrant-db.js';
export type { StylesObject, LexTextObj } from './parser/quadrant-db.js';

// xychart DB 类（M12 新增，浏览器安全）
export { XYChartDB } from './parser/xychart-db.js';
export type { PlotData, XYChartClassDef } from './parser/xychart-db.js';

// quadrant 样式验证工具（M11 新增，浏览器安全）
export {
  validateHexCode,
  validateNumber,
  validateSizeInPixels,
  InvalidStyleError,
} from './parser/quadrant-utils.js';

// ============================================================
// 解析调度（浏览器安全）
// ============================================================
export { parseMermaid } from './parse-dispatcher.js';
export type { ParseMermaidOptions } from './parse-dispatcher.js';
