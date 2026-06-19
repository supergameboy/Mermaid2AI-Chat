/**
 * AST 映射器 — @crafter/mermaid-parser AST → 画布数据模型
 *
 * 单一职责：仅处理 AST 类型声明、类型守卫、形状/方向映射、AST 修复逻辑。
 * 不依赖 React、DOM，不调用 IdGenerator、layoutCanvas 等业务模块。
 */
import type {
  FlowchartDirection,
  MermaidEdgeStyle,
  MermaidShapeType,
} from './types.js';

// === 类型声明（@crafter/mermaid-parser 的 AST 类型）===
export interface FlowchartAST {
  type: string;
  direction: string;
  nodes: Map<string, FlowchartNode>;
  edges: FlowchartEdge[];
  subgraphs: unknown[];
}

export interface FlowchartNode {
  id: string;
  label: string;
  shape: string;
}

export interface FlowchartEdge {
  source: string;
  target: string;
  label?: string;
  style: string;
  hasArrowStart: boolean;
  hasArrowEnd: boolean;
}

/**
 * 类型守卫：判断 ast 是否为 FlowchartAST
 * 替代 as 断言，确保类型安全
 */
export function isFlowchartAST(ast: unknown): ast is FlowchartAST {
  return (
    typeof ast === 'object' &&
    ast !== null &&
    'type' in ast &&
    'direction' in ast &&
    'nodes' in ast &&
    'edges' in ast
  );
}

// === 形状映射：@crafter/mermaid-parser NodeShape → MermaidShapeType ===
export const SHAPE_MAP: Record<string, MermaidShapeType> = {
  rect: 'rect',
  round: 'rounded',
  stadium: 'stadium',
  diamond: 'diamond',
  circle: 'circle',
  cylinder: 'cylinder',
  hexagon: 'hexagon',
  parallelogram: 'parallelogram',
  subroutine: 'subroutine',
  doublecircle: 'doublecircle',
  // 扩展形状
  asymmetric: 'asymmetric',
  'parallelogram-reverse': 'parallelogram-reverse',
  // @crafter/mermaid-parser 使用连字符（trapezoid-alt），同时保留下划线变体兼容
  trapezoid: 'trapezoid',
  'trapezoid-reverse': 'trapezoid-reverse',
  'trapezoid-alt': 'trapezoid-reverse',
  'trapezoid_alt': 'trapezoid-reverse',
  // 兼容可能的变体
  rounded: 'rounded',
  square: 'rect',
  rectangle: 'rect',
};

// === 方向映射 ===
export const DIRECTION_MAP: Record<string, FlowchartDirection> = {
  TB: 'TB',
  TD: 'TD',
  BT: 'BT',
  RL: 'RL',
  LR: 'LR',
};

/**
 * 修复 @crafter/mermaid-parser 不支持的节点形状
 *
 * 库缺失 parallelogram ([/.../]) 和 parallelogram-reverse ([\...\]) 的正则规则，
 * 两者都被错误解析为 rectangle。此函数从原始代码中识别这些形状，修正 AST。
 */
export function fixUnsupportedNodeShapes(
  source: string,
  astNodes: Map<string, FlowchartNode>,
): void {
  // parallelogram: A[/文本/] — 库解析为 rectangle，label="/文本/"
  // parallelogram-reverse: A[\文本\] — 库解析为 rectangle，label="\文本\"
  const patterns: { regex: RegExp; shape: MermaidShapeType; labelGroup: number }[] = [
    { regex: /^([\w-]+)\[\/(.+?)\/\]/, shape: 'parallelogram', labelGroup: 2 },
    { regex: /^([\w-]+)\[\\(.+?)\\\]/, shape: 'parallelogram-reverse', labelGroup: 2 },
  ];

  for (const [originalId, astNode] of astNodes) {
    // 只修正被错误解析为 rectangle 的节点
    if (astNode.shape !== 'rectangle') continue;

    // 从原始代码中提取该节点的定义行
    const lines = source.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      // 检查是否以节点 ID 开头
      if (!trimmed.startsWith(originalId)) continue;

      for (const { regex, shape, labelGroup } of patterns) {
        const match = trimmed.match(regex);
        if (match && match[1] === originalId) {
          astNode.shape = shape;
          astNode.label = match[labelGroup];
          break;
        }
      }
    }
  }
}

/**
 * 修复 @crafter/mermaid-parser 不支持的边样式
 *
 * 库的 ARROW_REGEX 不匹配 ---o（circle）和 ---x（cross），
 * 导致 `A ---o B` 被错误解析为 source=A, target=o（o 被当作节点 ID），B 被完全忽略（不添加为节点）。
 * 此函数从原始代码中识别这些边样式，修正 AST 的 target 和 style，并用正确的 target 节点替换错误的 o/x 节点（保持原顺序）。
 *
 * 返回已修正的行号集合（用于过滤库的误报诊断）
 */
export function fixUnsupportedEdgeStyles(
  source: string,
  astEdges: FlowchartEdge[],
  astNodes: Map<string, FlowchartNode>,
): Set<number> {
  // 匹配 A ---o B 和 A ---x B（可能有空格和标签）
  const circleRegex = /^([\w-]+)\s+---o\s+([\w-]+)/;
  const crossRegex = /^([\w-]+)\s+---x\s+([\w-]+)/;

  // 记录需要修正的边：sourceId → { correctTarget, style, line }
  const edgeFixes = new Map<string, { correctTarget: string; style: string; line: number }>();

  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    const circleMatch = trimmed.match(circleRegex);
    if (circleMatch) {
      edgeFixes.set(circleMatch[1], { correctTarget: circleMatch[2], style: 'circle', line: i + 1 });
      continue;
    }

    const crossMatch = trimmed.match(crossRegex);
    if (crossMatch) {
      edgeFixes.set(crossMatch[1], { correctTarget: crossMatch[2], style: 'cross', line: i + 1 });
    }
  }

  if (edgeFixes.size === 0) return new Set();

  // 已修正的行号集合
  const fixedLines = new Set<number>();
  for (const [, fix] of edgeFixes) {
    fixedLines.add(fix.line);
  }

  // 记录需要处理的错误节点：错误节点 ID（o 或 x）→ 正确节点 ID
  // 如果正确节点已存在于 astNodes 中，只删除错误节点；否则用正确节点替换错误节点（保持原顺序）
  const wrongNodeToCorrect = new Map<string, string>();

  // 修正 AST 边
  for (const astEdge of astEdges) {
    const fix = edgeFixes.get(astEdge.source);
    if (fix) {
      const wrongTargetId = astEdge.target;
      const correctTargetId = fix.correctTarget;

      // 只有当 wrongTargetId 与 correctTargetId 不同时，才需要处理错误节点
      // （库可能把 o/x 当作 target，也可能正确解析了 target）
      if (wrongTargetId !== correctTargetId && astNodes.has(wrongTargetId) && !wrongNodeToCorrect.has(wrongTargetId)) {
        wrongNodeToCorrect.set(wrongTargetId, correctTargetId);
      }

      // 修正 target 和 style
      astEdge.target = correctTargetId;
      astEdge.style = fix.style;
      astEdge.hasArrowEnd = false; // ---o / ---x 不是箭头端点
    }
  }

  // 重建 astNodes：处理错误节点（o/x）
  // - 如果正确节点已存在于 astNodes 中，删除错误节点（跳过）
  // - 如果正确节点不存在，用正确节点替换错误节点（保持原顺序）
  if (wrongNodeToCorrect.size > 0) {
    const newNodes = new Map<string, FlowchartNode>();
    for (const [originalId, astNode] of astNodes) {
      const correctTargetId = wrongNodeToCorrect.get(originalId);
      if (correctTargetId) {
        // 这是一个错误节点（o 或 x）
        // 只有当正确节点不存在时，才用正确节点替换（保持原顺序）
        if (!astNodes.has(correctTargetId) && !newNodes.has(correctTargetId)) {
          newNodes.set(correctTargetId, {
            id: correctTargetId,
            label: correctTargetId,
            shape: 'rectangle',
          });
        }
        // 如果正确节点已存在（或已被添加），跳过错误节点（相当于删除）
      } else {
        // 保留正常节点
        newNodes.set(originalId, astNode);
      }
    }

    // 清空原 Map，重新填充（保持新顺序）
    astNodes.clear();
    for (const [id, node] of newNodes) {
      astNodes.set(id, node);
    }
  }

  return fixedLines;
}

/**
 * 映射边样式：AST EdgeStyle + hasArrowStart/hasArrowEnd → MermaidEdgeStyle
 */
export function mapEdgeStyle(astEdge: FlowchartEdge): MermaidEdgeStyle {
  const style = astEdge.style as string;
  const hasArrowStart = astEdge.hasArrowStart;
  const hasArrowEnd = astEdge.hasArrowEnd;

  // 双向箭头
  if (hasArrowStart && hasArrowEnd) {
    return 'bidirectional';
  }

  // 无箭头
  if (!hasArrowStart && !hasArrowEnd) {
    // 虚线无箭头
    if (style === 'dotted' || style === 'dashed') {
      return 'dotted';
    }
    // 粗线无箭头
    if (style === 'thick' || style === 'bold') {
      return 'thick';
    }
    // 圆形端点（---o，由 fixUnsupportedEdgeStyles 修正）
    if (style === 'circle') {
      return 'circle';
    }
    // 交叉端点（---x，由 fixUnsupportedEdgeStyles 修正）
    if (style === 'cross') {
      return 'cross';
    }
    return 'line';
  }

  // 有结束箭头
  if (hasArrowEnd) {
    // 虚线箭头
    if (style === 'dotted' || style === 'dashed') {
      return 'dotted-arrow';
    }
    // 粗线箭头
    if (style === 'thick' || style === 'bold') {
      return 'thick';
    }
    // 圆圈箭头
    if (style === 'circle') {
      return 'circle';
    }
    // 叉号箭头
    if (style === 'cross') {
      return 'cross';
    }
    return 'arrow';
  }

  return 'arrow';
}
