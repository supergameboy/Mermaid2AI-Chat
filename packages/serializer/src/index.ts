/**
 * Mermaid 序列化器 — 公共 API
 *
 * 核心功能:
 * - parseMermaid: Mermaid 代码 → CanvasState（解析）
 * - serializeMermaid: CanvasState → Mermaid 代码（序列化）
 */

// 类型导出
export type {
  MermaidShapeType,
  MermaidEdgeStyle,
  FlowchartDirection,
  NodeStyle,
  EdgeMarker,
  MermaidNodeData,
  MermaidEdgeData,
  MermaidNode,
  MermaidEdge,
  CanvasState,
  Viewport,
  CanvasSource,
  ConsumedState,
  View,
  ViewSummary,
  ParseResult,
  ParseSuccessResult,
  ParseFailureResult,
  ParseError,
  SerializeResult,
} from './types.js';

// 解析器导出
export { parseMermaid } from './parser.js';

// 序列化器导出
export { serializeMermaid } from './serializer.js';
export { serializeNode, getShapeSyntax, unescapeLabel } from './node-serializer.js';
export { serializeEdge, getEdgeSyntax } from './edge-serializer.js';

// 工具导出
export { IdGenerator, idGenerator } from './id-generator.js';
export { ErrorCollector } from './error-collector.js';
export { layoutCanvas } from './layout.js';
