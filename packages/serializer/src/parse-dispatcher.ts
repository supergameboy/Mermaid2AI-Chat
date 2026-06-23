/**
 * 解析调度器 — 浏览器安全
 *
 * 单一职责：根据 diagramType 分发到对应专用解析器，将 Mermaid 代码解析为 CanvasState
 *
 * 数据流:
 *   parseMermaid(code, options) → 检测/指定 diagramType → 各类型专用解析器 → ParseResult
 *   解析结果的 canvas.rawCode 保留原始代码（用于增量序列化保持格式）
 *
 * 注意: 本文件依赖 jison 生成的 ESM 解析器（由 compile-jison.mts 后处理），
 * 通过静态 import 加载，浏览器兼容。detectDiagramType 位于 detector/index.ts。
 */

import type {
  DiagramType,
  ParseError,
  ParseResult,
} from './types.js';
import { detectDiagramType } from './detector/index.js';
import { parseFlowchartCode } from './parser/flowchart/flowchart-parser.js';
import { parseSequence } from './parser/sequence/sequence-parser.js';
import { parseClass } from './parser/class/class-parser.js';
import { parseER } from './parser/er/er-parser.js';
import { parseState } from './parser/state/state-parser.js';
import { parseMindmapCode } from './parser/mindmap/mindmap-parser.js';
import { parseArchitectureCode } from './parser/architecture/architecture-parser.js';
import { parseGanttCode } from './parser/gantt-parser.js';
import { parseTimelineCode } from './parser/timeline-parser.js';
import { parseQuadrantCode } from './parser/quadrant-parser.js';
import { parsePieCode } from './parser/handwritten/index.js';
import { parseXYChartCode } from './parser/xychart-parser.js';

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

/**
 * 为解析结果的 canvas 填充 rawCode（保留原始代码）
 * 不修改原 canvas 对象，返回带 rawCode 的新对象
 */
function withRawCode<T extends ParseResult>(result: T, code: string): T {
  if (result.success) {
    return { ...result, canvas: { ...result.canvas, rawCode: code } };
  }
  return result;
}

/** parseMermaid 选项 */
export interface ParseMermaidOptions {
  /** 显式指定图表类型，跳过自动检测 */
  diagramType?: DiagramType;
}

/**
 * 解析 Mermaid 代码为 CanvasState
 *
 * 空代码处理（M0 新增）:
 *   - 空字符串或纯空白 → 返回成功结果，canvas 为空 flowchart
 *   - 不报错，允许清空画布
 *
 * 预处理（架构修复）:
 *   - 各 parser 内部调用 preprocessCode 清理 frontmatter/指令/注释
 *   - 预处理保持行号一致（替换为等长换行），确保 _sourceLine 与 rawCode 行号一一对应
 *   - parser 收到的是原始 code，内部预处理后用于 jison 解析，rawCode 保留原始 code
 *
 * @param code - Mermaid 源代码（任意图表类型）
 * @param options - 可选参数，可显式指定 diagramType 跳过自动检测
 * @returns 解析结果（包含 canvas 和 errors，canvas.rawCode 保留原始代码）
 */
export function parseMermaid(code: string, options?: ParseMermaidOptions): ParseResult {
  // 空代码处理：返回空 flowchart 画布，不报错
  const trimmed = code.trim();
  if (trimmed.length === 0) {
    return {
      success: true,
      canvas: { diagramType: 'flowchart', nodes: [], edges: [], direction: 'TB', rawCode: code },
      errors: [],
    };
  }

  const diagramType = options?.diagramType ?? detectDiagramType(code);
  if (diagramType === null) {
    return buildParseFailure('无法识别图表类型（首行关键字未知）', code);
  }

  let result: ParseResult;
  switch (diagramType) {
    case 'flowchart':
      result = parseFlowchartCode(code);
      break;
    case 'sequenceDiagram':
      result = parseSequence(code);
      break;
    case 'classDiagram':
      result = parseClass(code);
      break;
    case 'erDiagram':
      result = parseER(code);
      break;
    case 'stateDiagram':
      result = parseState(code);
      break;
    case 'mindmap':
      result = parseMindmapCode(code);
      break;
    case 'architecture':
      result = parseArchitectureCode(code);
      break;
    case 'gantt':
      result = parseGanttCode(code);
      break;
    case 'pie':
      result = parsePieCode(code);
      break;
    case 'timeline':
      result = parseTimelineCode(code);
      break;
    case 'quadrantChart':
      result = parseQuadrantCode(code);
      break;
    case 'xychart':
      result = parseXYChartCode(code);
      break;
  }

  // 为成功的解析结果填充 rawCode（保留原始代码用于增量序列化）
  return withRawCode(result, code);
}
