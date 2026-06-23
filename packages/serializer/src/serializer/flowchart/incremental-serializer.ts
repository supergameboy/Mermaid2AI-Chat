/**
 * 增量序列化器 — 基于 rawCode 的行级增量序列化
 *
 * 单一职责：判断变更类型（属性级 vs 结构级），属性级变更基于 _sourceLine 定位 rawCode 行并替换
 *
 * 数据流:
 *   canvas + previousCanvas
 *     → isIncrementalChange() 判断变更类型
 *     → 若为属性级: applyIncrementalChanges() 基于 _sourceLine 替换 rawCode 行
 *     → 若为结构级: 返回 null，调用方回退到全量序列化
 *
 * 增量变更精确定义:
 *   - 属性级（增量）: 节点 label/shape/style 修改、边 label/style 修改
 *   - 结构级（全量）: 节点/边/subgraph 增删、图类型变更
 *
 * 行映射机制:
 *   - _sourceLine 在解析阶段记录（flowchart-parser.ts inferSourceLines）
 *   - 表示该节点/边在原始代码中的行号（0-based）
 *   - 增量序列化时通过 _sourceLine 定位 rawCode 对应行，用新序列化的行替换
 *   - 无 _sourceLine 的节点/边（用户新增的）→ 无法增量，回退到全量
 */

import type { GraphCanvasState, MermaidNode, MermaidEdge } from '../../types.js';
import { serializeVertex } from './vertex-serializer.js';
import { serializeEdge } from './edge-serializer.js';

// ============================================================
// 公共 API
// ============================================================

/**
 * 判断变更是否为属性级（增量）还是结构级（全量）
 *
 * 属性级：仅 label/shape/style 等属性修改，节点/边/subgraph 数量不变且 id 集合一致
 * 结构级：节点/边/subgraph 增删，或图类型变更
 *
 * @param canvas - 当前画布状态
 * @param previousCanvas - 前一次画布状态（undefined 视为结构级）
 * @returns true 表示属性级变更（可增量），false 表示结构级变更（需全量）
 */
export function isIncrementalChange(
  canvas: GraphCanvasState,
  previousCanvas: GraphCanvasState | undefined,
): boolean {
  // 无前一次状态 → 结构级
  if (!previousCanvas) return false;

  // 图类型变更 → 结构级
  if (canvas.diagramType !== previousCanvas.diagramType) return false;

  // 节点数量变更 → 结构级
  if (canvas.nodes.length !== previousCanvas.nodes.length) return false;

  // 边数量变更 → 结构级
  if (canvas.edges.length !== previousCanvas.edges.length) return false;

  // 节点 id 集合不一致 → 结构级
  const currentNodeIds = new Set(canvas.nodes.map((n) => n.id));
  const previousNodeIds = new Set(previousCanvas.nodes.map((n) => n.id));
  if (currentNodeIds.size !== previousNodeIds.size) return false;
  for (const id of currentNodeIds) {
    if (!previousNodeIds.has(id)) return false;
  }

  // 边 id 集合不一致 → 结构级
  const currentEdgeIds = new Set(canvas.edges.map((e) => e.id));
  const previousEdgeIds = new Set(previousCanvas.edges.map((e) => e.id));
  if (currentEdgeIds.size !== previousEdgeIds.size) return false;
  for (const id of currentEdgeIds) {
    if (!previousEdgeIds.has(id)) return false;
  }

  // subgraph 结构变更（parentId 变更）→ 结构级
  for (const node of canvas.nodes) {
    const prevNode = previousCanvas.nodes.find((n) => n.id === node.id);
    if (!prevNode) return false;
    if (node.parentId !== prevNode.parentId) return false;
  }

  // 边的 source/target 变更 → 结构级
  for (const edge of canvas.edges) {
    const prevEdge = previousCanvas.edges.find((e) => e.id === edge.id);
    if (!prevEdge) return false;
    if (edge.source !== prevEdge.source || edge.target !== prevEdge.target) return false;
  }

  return true;
}

/**
 * 基于 rawCode 应用增量变更
 *
 * 通过 _sourceLine 定位 rawCode 中对应行，替换该行内容
 * 保留原始格式（注释、空行、缩进、顺序）
 *
 * @param rawCode - 原始 Mermaid 代码
 * @param canvas - 当前画布状态
 * @param previousCanvas - 前一次画布状态
 * @returns 增量序列化后的代码，若无法增量则返回 null（调用方应回退到全量）
 */
export function applyIncrementalChanges(
  rawCode: string,
  canvas: GraphCanvasState,
  previousCanvas: GraphCanvasState | undefined,
): string | null {
  if (!previousCanvas) return null;
  if (!isIncrementalChange(canvas, previousCanvas)) return null;

  const lines = rawCode.split('\n');
  let modified = false;

  // 处理节点属性变更
  for (const node of canvas.nodes) {
    const prevNode = previousCanvas.nodes.find((n) => n.id === node.id);
    if (!prevNode) return null;

    if (!hasNodePropertyChanged(node, prevNode)) continue;

    const sourceLine = readField<number>(node.data, '_sourceLine');
    if (sourceLine === undefined) return null; // 无 _sourceLine → 回退全量

    if (sourceLine < 0 || sourceLine >= lines.length) return null; // 行号越界 → 回退全量

    const newVertexCode = serializeVertex(node);
    const oldLine = lines[sourceLine];
    const replacedLine = replaceVertexInLine(oldLine, node.id, newVertexCode);
    if (replacedLine === null) return null; // 行内容不匹配 → 回退全量

    lines[sourceLine] = replacedLine;
    modified = true;
  }

  // 处理边属性变更
  for (const edge of canvas.edges) {
    const prevEdge = previousCanvas.edges.find((e) => e.id === edge.id);
    if (!prevEdge) return null;

    if (!hasEdgePropertyChanged(edge, prevEdge)) continue;

    const sourceLine = readField<number>(edge.data, '_sourceLine');
    if (sourceLine === undefined) return null;

    if (sourceLine < 0 || sourceLine >= lines.length) return null;

    const newEdgeCode = serializeEdge(edge);
    const oldLine = lines[sourceLine];
    const replacedLine = replaceEdgeInLine(oldLine, edge, newEdgeCode);
    if (replacedLine === null) return null;

    lines[sourceLine] = replacedLine;
    modified = true;
  }

  return modified ? lines.join('\n') : rawCode;
}

// ============================================================
// 内部实现
// ============================================================

/** 判断节点属性是否变更（label/shape/style/props 等） */
function hasNodePropertyChanged(node: MermaidNode, prevNode: MermaidNode): boolean {
  if (node.data.label !== prevNode.data.label) return true;
  if (node.data.shape !== prevNode.data.shape) return true;

  const currentStyles = readField<string[]>(node.data, 'styles');
  const prevStyles = readField<string[]>(prevNode.data, 'styles');
  if (!arrayEqual(currentStyles, prevStyles)) return true;

  const currentClassNames = readField<string[]>(node.data, 'classNames');
  const prevClassNames = readField<string[]>(prevNode.data, 'classNames');
  if (!arrayEqual(currentClassNames, prevClassNames)) return true;

  return false;
}

/** 判断边属性是否变更（label/style/edgeStyle 等） */
function hasEdgePropertyChanged(edge: MermaidEdge, prevEdge: MermaidEdge): boolean {
  if (edge.data.label !== prevEdge.data.label) return true;
  if (edge.data.edgeStyle !== prevEdge.data.edgeStyle) return true;

  const currentStyles = readField<string[]>(edge.data, 'styles');
  const prevStyles = readField<string[]>(prevEdge.data, 'styles');
  if (!arrayEqual(currentStyles, prevStyles)) return true;

  const currentInterpolate = readField<string>(edge.data, 'interpolate');
  const prevInterpolate = readField<string>(prevEdge.data, 'interpolate');
  if (currentInterpolate !== prevInterpolate) return true;

  return false;
}

/**
 * 替换行中的顶点定义
 *
 * 保留行前后的缩进和边语法（如 `  A[old] --> B` → `  A[new] --> B`）
 * 若行不包含该顶点定义 → 返回 null
 */
function replaceVertexInLine(line: string, nodeId: string, newVertexCode: string): string | null {
  // 匹配行中的顶点定义：可选缩进 + nodeId + 形状语法
  // 形状语法起始符: [ ( { < @ | （rect-with-prop）
  const pattern = new RegExp(`(^|\\s)(${escapeRegExp(nodeId)})([\\[\\(\\{\\<\\@|])`);
  const match = line.match(pattern);
  if (!match) return null;

  // 找到顶点定义的起始位置
  const prefix = match[1] ?? '';
  const startPos = match.index ?? 0;
  const idStart = startPos + prefix.length;

  // 从 idStart 开始，匹配完整的顶点定义
  const vertexDef = extractVertexDefinition(line, idStart, nodeId);
  if (vertexDef === null) return null;

  // 替换顶点定义部分，保留前后内容
  const before = line.substring(0, idStart);
  const after = line.substring(idStart + vertexDef.length);
  return before + newVertexCode + after;
}

/**
 * 替换行中的边定义
 *
 * 保留行前缩进、source 顶点定义、target 顶点定义
 * 仅替换边符号 + 标签部分
 *
 * 支持的行格式:
 *   - `A --> B` (纯边)
 *   - `A[Hello] --> B[World]` (带顶点定义的边)
 *   - `A -->|Yes| B` (带标签的边)
 *
 * 若行不包含该边定义 → 返回 null
 */
function replaceEdgeInLine(line: string, edge: MermaidEdge, newEdgeCode: string): string | null {
  const sourceId = edge.source;
  const targetId = edge.target;

  // 1. 在行中查找 source ID
  const sourcePattern = new RegExp(`(^|\\s)${escapeRegExp(sourceId)}\\b`);
  const sourceMatch = line.match(sourcePattern);
  if (!sourceMatch) return null;

  const sourceStart = (sourceMatch.index ?? 0) + (sourceMatch[1] ?? '').length;
  let pos = sourceStart + sourceId.length;

  // 2. 跳过空格
  while (pos < line.length && /\s/.test(line[pos])) pos++;

  // 3. 跳过 source 顶点定义（如 [Hello] / (Hello) / @{...}）
  if (pos < line.length && '[(<{@'.includes(line[pos])) {
    const closePos = skipVertexDefInLine(line, pos);
    if (closePos >= 0) {
      pos = closePos + 1;
      while (pos < line.length && /\s/.test(line[pos])) pos++;
    }
  }

  // 4. 查找边符号 + 标签
  const edgeSymbolStart = pos;
  const edgeSymbolMatch = line.substring(pos).match(/^([-=~<>~o.x]+)(\|[^|]*\|)?/);
  if (!edgeSymbolMatch) return null;

  const edgePartEnd = pos + edgeSymbolMatch[0].length;

  // 5. 从 newEdgeCode 提取新的边符号 + 标签
  // newEdgeCode 格式: `source edgeSymbol|label| target`
  const newEdgePartMatch = newEdgeCode.match(
    new RegExp(`^${escapeRegExp(sourceId)}\\s+(.+?)\\s+${escapeRegExp(targetId)}`),
  );
  if (!newEdgePartMatch) return null;

  const newEdgePart = newEdgePartMatch[1]!;

  // 6. 替换边符号 + 标签，保留顶点定义
  const before = line.substring(0, edgeSymbolStart);
  const after = line.substring(edgePartEnd);
  return before + newEdgePart + after;
}

/**
 * 跳过顶点定义，返回闭合括号的位置
 *
 * 支持的顶点定义语法: [...] / (...) / {...} / <...] / @{...}
 */
function skipVertexDefInLine(line: string, startPos: number): number {
  if (startPos >= line.length) return -1;
  const startChar = line[startPos];

  if (startChar === '@') {
    const braceStart = line.indexOf('{', startPos);
    if (braceStart === -1) return -1;
    return findMatchingBrace(line, braceStart, '{', '}');
  }

  let openChar: string;
  let closeChar: string;
  switch (startChar) {
    case '[': openChar = '['; closeChar = ']'; break;
    case '(': openChar = '('; closeChar = ')'; break;
    case '{': openChar = '{'; closeChar = '}'; break;
    case '<': openChar = '<'; closeChar = ']'; break; // odd 形状
    default: return -1;
  }

  return findMatchingBrace(line, startPos, openChar, closeChar);
}

/** 从指定位置提取完整的顶点定义（匹配括号/花括号等） */
function extractVertexDefinition(line: string, startPos: number, nodeId: string): string | null {
  // 简化实现：从 id 后的起始符开始，匹配到对应的结束符
  const idEnd = startPos + nodeId.length;
  if (idEnd >= line.length) return null;

  const startChar = line[idEnd];
  const endChar = getClosingChar(startChar);
  if (!endChar) return null;

  // 处理 @{} 语法
  if (startChar === '@') {
    // @{ shape: xxx, ... }
    const braceStart = line.indexOf('{', idEnd);
    if (braceStart === -1) return null;
    const braceEnd = findMatchingBrace(line, braceStart, '{', '}');
    if (braceEnd === -1) return null;
    return line.substring(startPos, braceEnd + 1);
  }

  // 处理 [|prop|label] 语法
  if (startChar === '[' && idEnd + 1 < line.length && line[idEnd + 1] === '|') {
    const bracketEnd = findMatchingBrace(line, idEnd, '[', ']');
    if (bracketEnd === -1) return null;
    return line.substring(startPos, bracketEnd + 1);
  }

  // 处理普通形状语法 [label] (label) {label} <label] 等
  const endPos = findMatchingBrace(line, idEnd, startChar, endChar);
  if (endPos === -1) return null;
  return line.substring(startPos, endPos + 1);
}

/** 获取对应的闭合字符 */
function getClosingChar(open: string): string | null {
  switch (open) {
    case '[':
      return ']';
    case '(':
      return ')';
    case '{':
      return '}';
    case '<':
      return ']'; // odd 形状: >label]
    default:
      return null;
  }
}

/** 查找匹配的闭合括号（考虑嵌套） */
function findMatchingBrace(line: string, startPos: number, open: string, close: string): number {
  let depth = 0;
  for (let i = startPos; i < line.length; i++) {
    if (line[i] === open) depth++;
    else if (line[i] === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** 转义正则表达式特殊字符 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 比较两个字符串数组是否相等 */
function arrayEqual(a: string[] | undefined, b: string[] | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

/** 安全读取扩展字段 */
function readField<T>(data: Record<string, unknown>, key: string): T | undefined {
  const value = data[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  return value as T;
}
