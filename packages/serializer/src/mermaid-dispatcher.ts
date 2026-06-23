/**
 * Mermaid 统一调度器 — 提供 serializeMermaid / parseMermaid 统一入口
 *
 * 单一职责：根据 diagramType 分发到对应图表类型的序列化器/解析器
 *
 * 数据流:
 *   serializeMermaid(canvas) → 按 canvas.diagramType 分发 → 各类型序列化器 → SerializeResult
 *   parseMermaid(code)       → 检测代码首行关键字 → 各类型解析器 → ParseResult
 *
 * 注意：M1 阶段仅实现 flowchart 的完整链路，其他类型在 M2-M12 逐步实现。
 * 未实现的类型返回明确的错误信息，不使用 fallback。
 */

import type {
  CanvasState,
  DiagramType,
  ParseError,
  ParseResult,
  SerializeResult,
} from './types.js';
import { serializeFlowchart } from './serializer/flowchart/index.js';
import { parseFlowchartCode } from './parser/flowchart/flowchart-parser.js';
import { serializeSequence } from './serializer/sequence/index.js';
import { parseSequence } from './parser/sequence/sequence-parser.js';
import { serializeClass } from './serializer/class/class-serializer.js';
import { parseClass } from './parser/class/class-parser.js';
import { serializeER } from './serializer/er/er-serializer.js';
import { parseER } from './parser/er/er-parser.js';

// ============================================================
// 序列化调度
// ============================================================

/**
 * 序列化 CanvasState 为 Mermaid 代码
 *
 * @param canvas - CanvasState（任意图表类型）
 * @returns 序列化结果（包含 mermaid 代码和错误列表）
 */
export function serializeMermaid(canvas: CanvasState): SerializeResult {
  switch (canvas.diagramType) {
    case 'flowchart':
      return serializeFlowchart(canvas);
    case 'sequenceDiagram':
      return serializeSequence(canvas);
    case 'classDiagram':
      return serializeClass(canvas);
    case 'erDiagram':
      return serializeER(canvas);
    case 'stateDiagram':
    case 'mindmap':
    case 'architecture':
    case 'gantt':
    case 'pie':
    case 'timeline':
    case 'quadrantChart':
    case 'xychart': {
      const error: ParseError = {
        line: 0,
        column: 0,
        message: `序列化器尚未实现: ${canvas.diagramType}（将在对应模块实现）`,
        severity: 'error',
      };
      return { mermaid: '', errors: [error] };
    }
  }
}

// ============================================================
// 解析调度
// ============================================================

/** 代码首行关键字 → DiagramType 映射 */
const KEYWORD_TO_TYPE: ReadonlyArray<{ keyword: string; type: DiagramType }> = [
  { keyword: 'flowchart', type: 'flowchart' },
  { keyword: 'graph', type: 'flowchart' },
  { keyword: 'sequenceDiagram', type: 'sequenceDiagram' },
  { keyword: 'classDiagram', type: 'classDiagram' },
  { keyword: 'erDiagram', type: 'erDiagram' },
  { keyword: 'stateDiagram', type: 'stateDiagram' },
  { keyword: 'mindmap', type: 'mindmap' },
  { keyword: 'architecture-beta', type: 'architecture' },
  { keyword: 'gantt', type: 'gantt' },
  { keyword: 'pie', type: 'pie' },
  { keyword: 'timeline', type: 'timeline' },
  { keyword: 'quadrantChart', type: 'quadrantChart' },
  { keyword: 'xychart-beta', type: 'xychart' },
];

/** 从代码首行检测图表类型 */
export function detectDiagramType(code: string): DiagramType | null {
  const trimmed = code.trim();
  if (trimmed.length === 0) return null;
  const firstWord = trimmed.split(/[\s\n]/, 1)[0] ?? '';
  const match = KEYWORD_TO_TYPE.find((k) => k.keyword === firstWord);
  return match ? match.type : null;
}

/** 构造解析失败结果 */
function buildParseFailure(message: string, code: string): ParseResult {
  const error: ParseError = {
    line: 1,
    column: 0,
    message,
    severity: 'error',
    context: code.split('\n')[0],
  };
  return {
    success: false,
    canvas: { diagramType: 'flowchart', nodes: [], edges: [], direction: 'TB' },
    errors: [error],
  };
}

/** parseMermaid 选项 */
export interface ParseMermaidOptions {
  /** 显式指定图表类型，跳过自动检测 */
  diagramType?: DiagramType;
}

/**
 * 解析 Mermaid 代码为 CanvasState
 *
 * @param code - Mermaid 源代码（任意图表类型）
 * @param options - 可选参数，可显式指定 diagramType 跳过自动检测
 * @returns 解析结果（包含 canvas 和 errors）
 */
export function parseMermaid(code: string, options?: ParseMermaidOptions): ParseResult {
  const diagramType = options?.diagramType ?? detectDiagramType(code);
  if (diagramType === null) {
    return buildParseFailure('无法识别图表类型（首行关键字未知）', code);
  }

  switch (diagramType) {
    case 'flowchart':
      return parseFlowchartCode(code);
    case 'sequenceDiagram':
      return parseSequence(code);
    case 'classDiagram':
      return parseClass(code);
    case 'erDiagram':
      return parseER(code);
    case 'stateDiagram':
    case 'mindmap':
    case 'architecture':
    case 'gantt':
    case 'pie':
    case 'timeline':
    case 'quadrantChart':
    case 'xychart':
      return buildParseFailure(
        `解析器尚未实现: ${diagramType}（将在对应模块实现）`,
        code
      );
  }
}
