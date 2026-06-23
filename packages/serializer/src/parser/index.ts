/**
 * 解析器统一导出
 * 单一职责：导出所有解析器入口
 *
 * 包含:
 *   - jison 解析器（10 种图表类型）
 *   - 手写解析器（pie + architecture）
 *   - 通用类型
 */

// jison 解析器
// 注：gantt 不在此导出，使用独立的 parseGanttCode 入口（GanttDB 模式）
export {
  parseFlowchart,
  parseSequence,
  parseClass,
  parseER,
  parseMindmap,
  parseTimeline,
  parseQuadrant,
  parseXYChart,
  clearParserCache,
} from './jison-parser.js';
export type { JisonParseResult, JisonParser } from './jison-parser.js';

// state 专用解析器（基于 StateDB，返回 CanvasState）
export { parseState } from './state/state-parser.js';

// mindmap 专用解析器（基于 MindmapDB，返回 CanvasState）
export { parseMindmapCode } from './mindmap/mindmap-parser.js';

// 手写解析器
export {
  parsePie,
  parseArchitecture,
  PieTokenizer,
  ArchitectureTokenizer,
  BaseTokenizer,
} from './handwritten/index.js';
export type {
  Token,
  TokenType,
  TokenizeError,
  TokenizeResult,
  PieParseResult,
  ArchitectureParseResult,
} from './handwritten/index.js';
