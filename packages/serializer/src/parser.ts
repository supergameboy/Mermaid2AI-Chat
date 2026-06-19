/**
 * 解析器 — Mermaid 代码 → CanvasState
 * 使用 @crafter/mermaid-parser 解析 AST，再映射为画布节点/边
 *
 * 单一职责：仅负责调用解析库、收集诊断、应用 AST 映射、生成画布节点/边。
 * AST 类型声明、类型守卫、形状/方向映射、AST 修复逻辑统一在 ast-mapper.ts。
 */
import { parse } from '@crafter/mermaid-parser';
import type {
  MermaidEdge,
  MermaidNode,
  ParseResult,
} from './types.js';
import type { ErrorCollector } from './error-collector.js';
import { ErrorCollector as ErrorCollectorImpl } from './error-collector.js';
import { IdGenerator } from './id-generator.js';
import { layoutCanvas } from './layout.js';
import {
  DIRECTION_MAP,
  SHAPE_MAP,
  fixUnsupportedEdgeStyles,
  fixUnsupportedNodeShapes,
  isFlowchartAST,
  mapEdgeStyle,
} from './ast-mapper.js';

/**
 * 解析 Mermaid 代码为画布状态
 * 宽容模式：即使有错误也返回部分结果
 */
export function parseMermaid(source: string, errorCollector?: ErrorCollector): ParseResult {
  const errors = errorCollector ?? new ErrorCollectorImpl();
  const idGen = new IdGenerator();

  let result;
  try {
    result = parse(source);
  } catch (e) {
    errors.addError(0, 0, `解析失败: ${e instanceof Error ? e.message : String(e)}`);
    return {
      success: false,
      canvas: { nodes: [], edges: [], direction: 'TD' },
      errors: errors.getErrors(),
    };
  }

  // AST 为空，收集诊断后返回空画布
  if (!result.ast) {
    if (result.diagnostics) {
      for (const diag of result.diagnostics) {
        const line = diag.span?.start?.line ?? 0;
        const column = diag.span?.start?.column ?? 0;
        if (diag.severity === 'error') {
          errors.addError(line, column, diag.message);
        } else {
          errors.addWarning(line, column, diag.message);
        }
      }
    }
    return {
      success: false,
      canvas: { nodes: [], edges: [], direction: 'TD' },
      errors: errors.getErrors(),
    };
  }

  // 类型守卫判断 ast 是否为 FlowchartAST
  if (!isFlowchartAST(result.ast)) {
    if (result.diagnostics) {
      for (const diag of result.diagnostics) {
        const line = diag.span?.start?.line ?? 0;
        const column = diag.span?.start?.column ?? 0;
        if (diag.severity === 'error') {
          errors.addError(line, column, diag.message);
        } else {
          errors.addWarning(line, column, diag.message);
        }
      }
    }
    errors.addError(0, 0, '解析结果不是 flowchart 类型');
    return {
      success: false,
      canvas: { nodes: [], edges: [], direction: 'TD' },
      errors: errors.getErrors(),
    };
  }

  const ast = result.ast;

  // 解析方向
  const direction = DIRECTION_MAP[ast.direction] ?? 'TD';

  const astNodes = ast.nodes;
  const astEdges = ast.edges;

  // 修复 @crafter/mermaid-parser 不支持的节点形状（parallelogram/parallelogram-reverse）
  // 必须在 diagnostics 收集之前调用，以便过滤库的误报警告
  fixUnsupportedNodeShapes(source, astNodes);

  // 修复 @crafter/mermaid-parser 不支持的边样式（---o / ---x）
  // 必须在节点解析之前调用，因为会修正 astNodes（删除错误的 o/x 节点，添加正确的 target 节点）
  // 返回已修正的行号集合，用于过滤库对 ---o / ---x 行的误报 "Skipping unrecognized line" 警告
  const fixedLines = fixUnsupportedEdgeStyles(source, astEdges, astNodes);

  // 收集诊断信息（过滤已被 fixUnsupportedEdgeStyles 修正的行号的误报警告）
  if (result.diagnostics) {
    for (const diag of result.diagnostics) {
      const line = diag.span?.start?.line ?? 0;
      const column = diag.span?.start?.column ?? 0;
      // 跳过已被 fixUnsupportedEdgeStyles 修正的行号的 "Skipping unrecognized line" 警告
      // 库对 ---o / ---x 行报告此警告，但实际上已被我们修正
      if (fixedLines.has(line) && diag.message.includes('Skipping unrecognized line')) {
        continue;
      }
      if (diag.severity === 'error') {
        errors.addError(line, column, diag.message);
      } else {
        errors.addWarning(line, column, diag.message);
      }
    }
  }

  // 解析节点
  const nodes: MermaidNode[] = [];
  const nodeIdMap = new Map<string, string>(); // 原始ID → 画布ID

  // 先注册所有原始 ID 到 IdGenerator，避免后续生成冲突 ID
  // 这样画布 ID = 原始 ID，保证"代码→画布→代码"双向幂等
  for (const [originalId] of astNodes) {
    idGen.register(originalId);
  }

  for (const [originalId, astNode] of astNodes) {
    const shape = SHAPE_MAP[astNode.shape] ?? 'rect';
    const canvasId = originalId; // 保留原始 ID，确保双向幂等
    nodeIdMap.set(originalId, canvasId);

    // 位置占位，由 layoutCanvas 统一计算
    const position = { x: 0, y: 0 };

    nodes.push({
      id: canvasId,
      type: shape,
      position,
      data: {
        label: astNode.label || originalId,
        shape,
      },
    });
  }

  // 解析边
  const edges: MermaidEdge[] = [];
  let edgeIndex = 0;
  for (const astEdge of astEdges) {
    const sourceId = nodeIdMap.get(astEdge.source);
    const targetId = nodeIdMap.get(astEdge.target);

    if (!sourceId || !targetId) {
      errors.addWarning(0, 0, `边引用了不存在的节点: ${astEdge.source} → ${astEdge.target}`);
      continue;
    }

    const edgeStyle = mapEdgeStyle(astEdge);
    edges.push({
      id: `e${edgeIndex + 1}`,
      source: sourceId,
      target: targetId,
      type: 'smoothstep',
      data: {
        edgeStyle,
        label: astEdge.label,
      },
      markerEnd: astEdge.hasArrowEnd ? { type: 'arrowclosed' } : undefined,
      markerStart: astEdge.hasArrowStart ? { type: 'arrowclosed' } : undefined,
    });
    edgeIndex++;
  }

  // 应用 dagre 布局算法生成节点位置（Mermaid AST 不含位置信息）
  layoutCanvas(nodes, edges, direction);

  return {
    success: !errors.hasErrors(),
    canvas: { nodes, edges, direction },
    errors: errors.getErrors(),
  };
}
