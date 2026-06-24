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

  const lines = rawCode.split('\n');
  let modified = false;

  // Bug8: 方向变更优先处理，不受 isIncrementalChange 限制
  // 方向变更不改变节点/边结构，应始终走增量路径
  if (canvas.direction !== previousCanvas.direction) {
    const directionLineInfo = findFlowchartDirectionLine(lines);
    if (directionLineInfo !== null) {
      const oldLine = lines[directionLineInfo.index];
      // Bug7+Bug8: 保留行首缩进和行尾注释
      const indent = oldLine.match(/^(\s*)/)?.[1] ?? '';
      const commentMatch = oldLine.match(/%%\s*.*$/);
      const comment = commentMatch ? ' ' + commentMatch[0] : '';
      const newDirection = canvas.direction ?? 'TB';
      lines[directionLineInfo.index] = `${indent}${directionLineInfo.keyword} ${newDirection}${comment}`;
      modified = true;
    }
    // 若找不到方向行（异常情况），不回退全量，保留原方向行
  }

  // 其他增量变更需要 isIncrementalChange 检查
  // Bug7: 即使 isIncrementalChange 返回 false，也尝试处理节点/边增删
  // 只有图类型变更或无法定位行号时才回退全量
  const isIncremental = isIncrementalChange(canvas, previousCanvas);

  // Bug7: 处理节点新增 — 追加顶点定义行到 rawCode
  const addedNodes = canvas.nodes.filter(
    (n) => !previousCanvas.nodes.some((p) => p.id === n.id),
  );
  // Bug7: 收集所有待删除行号，统一按降序删除，避免行号偏移导致后续删除定位错误
  const linesToDelete = new Set<number>();
  for (const node of addedNodes) {
    const vertexCode = serializeVertex(node);
    lines.push(vertexCode);
    modified = true;
  }

  // Bug7: 处理节点删除 — 收集待删除行号
  const removedNodes = previousCanvas.nodes.filter(
    (n) => !canvas.nodes.some((c) => c.id === n.id),
  );
  for (const node of removedNodes) {
    const sourceLine = readField<number>(node.data, '_sourceLine');
    if (sourceLine !== undefined && sourceLine >= 0 && sourceLine < lines.length) {
      linesToDelete.add(sourceLine);
      modified = true;
    }
    // 同时删除该节点的 style 语句行（若存在）
    const styleLinePattern = new RegExp(`^\\s*style\\s+${escapeRegExp(node.id)}\\b`);
    for (let i = lines.length - 1; i >= 0; i--) {
      if (styleLinePattern.test(lines[i])) {
        linesToDelete.add(i);
        modified = true;
        break;
      }
    }
  }

  // Bug7: 处理边新增 — 追加边定义行到 rawCode
  const addedEdges = canvas.edges.filter(
    (e) => !previousCanvas.edges.some((p) => p.id === e.id),
  );
  for (const edge of addedEdges) {
    const edgeCode = serializeEdge(edge);
    lines.push(edgeCode);
    modified = true;
  }

  // Bug7: 处理边删除 — 收集待删除行号
  const removedEdges = previousCanvas.edges.filter(
    (e) => !canvas.edges.some((c) => c.id === e.id),
  );
  for (const edge of removedEdges) {
    const sourceLine = readField<number>(edge.data, '_sourceLine');
    if (sourceLine !== undefined && sourceLine >= 0 && sourceLine < lines.length) {
      linesToDelete.add(sourceLine);
      modified = true;
    }
  }

  // Bug7: 统一按降序删除行，避免行号偏移导致后续删除定位错误
  // 从后向前删除，前面的行号不受影响
  const sortedDeletions = Array.from(linesToDelete).sort((a, b) => b - a);
  for (const lineIdx of sortedDeletions) {
    if (lineIdx < lines.length) {
      lines.splice(lineIdx, 1);
    }
  }

  // Bug7: 计算行号偏移映射 — 删除行后，_sourceLine 需要调整
  // sortedDeletions 是降序排列的已删除行号，需要转为升序来计算偏移
  const deletionAsc = Array.from(linesToDelete).sort((a, b) => a - b);
  /** 将原始 _sourceLine 转换为删除行后的实际行号 */
  function getActualLine(originalLine: number): number {
    let actual = originalLine;
    for (const deleted of deletionAsc) {
      if (originalLine > deleted) {
        actual--;
      }
    }
    return actual;
  }

  // 若有结构级变更且无法完全增量处理（如 subgraph 归属变更），回退全量
  // 但若已处理了增删且无其他结构变更，继续处理属性变更
  if (!isIncremental && modified) {
    // 检查是否还有未处理的结构变更（subgraph 归属变更、边 source/target 变更）
    const hasSubgraphChange = canvas.nodes.some((n) => {
      const prev = previousCanvas.nodes.find((p) => p.id === n.id);
      return prev && n.parentId !== prev.parentId;
    });
    const hasEdgeEndpointChange = canvas.edges.some((e) => {
      const prev = previousCanvas.edges.find((p) => p.id === e.id);
      return prev && (e.source !== prev.source || e.target !== prev.target);
    });
    if (hasSubgraphChange || hasEdgeEndpointChange) {
      return null; // subgraph 归属变更或边端点变更 → 回退全量
    }
    // 增删已处理，继续处理属性变更
  } else if (!isIncremental) {
    return modified ? lines.join('\n') : null;
  }

  // 处理节点属性变更
  // Bug7: 跳过新增节点（已在前面追加顶点定义行，无 prevNode 可比较）
  for (const node of canvas.nodes) {
    const prevNode = previousCanvas.nodes.find((n) => n.id === node.id);
    if (!prevNode) continue; // 新增节点，跳过属性变更检测

    if (!hasNodePropertyChanged(node, prevNode)) continue;

    // Bug5: 检查是否为 styles 变更
    // styles 是独立语句行（`style nodeId fill:#xxx`），不是顶点定义行的一部分
    // 需要单独搜索并更新 style 语句行，而非替换顶点定义行
    const currentStyles = readField<string[]>(node.data, 'styles');
    const prevStyles = readField<string[]>(prevNode.data, 'styles');
    const stylesChanged = !arrayEqual(currentStyles, prevStyles);

    if (stylesChanged) {
      // 搜索 rawCode 中的 style 语句行
      const styleLinePattern = new RegExp(`^\\s*style\\s+${escapeRegExp(node.id)}\\b`);
      let styleLineIndex = -1;
      for (let i = 0; i < lines.length; i++) {
        if (styleLinePattern.test(lines[i])) {
          styleLineIndex = i;
          break;
        }
      }

      if (currentStyles && currentStyles.length > 0) {
        // 有 styles：更新或新增 style 语句行
        const newStyleLine = `style ${node.id} ${currentStyles.join(',')}`;
        if (styleLineIndex >= 0) {
          lines[styleLineIndex] = newStyleLine;
        } else {
          lines.push(newStyleLine);
        }
        modified = true;
      } else if (styleLineIndex >= 0) {
        // styles 被清空：删除 style 语句行
        lines.splice(styleLineIndex, 1);
        modified = true;
      }

      // 如果同时有其他属性变更（label/shape），继续处理顶点定义行
      const labelChanged = node.data.label !== prevNode.data.label;
      const shapeChanged = node.data.shape !== prevNode.data.shape;
      if (!labelChanged && !shapeChanged) {
        continue; // 仅 styles 变更，已处理完毕
      }
    }

    // 其他属性变更（label/shape）：更新顶点定义行
    const sourceLine = readField<number>(node.data, '_sourceLine');
    if (sourceLine === undefined) return null; // 无 _sourceLine → 回退全量

    // Bug7: 使用偏移映射获取实际行号
    const actualLine = getActualLine(sourceLine);
    if (actualLine < 0 || actualLine >= lines.length) return null; // 行号越界 → 回退全量

    const newVertexCode = serializeVertex(node);
    const oldLine = lines[actualLine];
    const replacedLine = replaceVertexInLine(oldLine, node.id, newVertexCode);
    if (replacedLine === null) return null; // 行内容不匹配 → 回退全量

    lines[actualLine] = replacedLine;
    modified = true;
  }

  // 处理边属性变更
  // Bug7: 跳过新增边（已在前面追加边定义行，无 prevEdge 可比较）
  for (const edge of canvas.edges) {
    const prevEdge = previousCanvas.edges.find((e) => e.id === edge.id);
    if (!prevEdge) continue; // 新增边，跳过属性变更检测

    if (!hasEdgePropertyChanged(edge, prevEdge)) continue;

    const sourceLine = readField<number>(edge.data, '_sourceLine');
    if (sourceLine === undefined) return null;

    // Bug7: 使用偏移映射获取实际行号
    const actualLine = getActualLine(sourceLine);
    if (actualLine < 0 || actualLine >= lines.length) return null;

    const newEdgeCode = serializeEdge(edge);
    const oldLine = lines[actualLine];
    const replacedLine = replaceEdgeInLine(oldLine, edge, newEdgeCode);
    if (replacedLine === null) return null;

    lines[actualLine] = replacedLine;
    modified = true;
  }

  return modified ? lines.join('\n') : rawCode;
}

/**
 * 查找 flowchart 方向声明行
 *
 * 匹配格式:
 *   - `flowchart TD` / `flowchart TB` / `flowchart LR` / `flowchart RL` / `flowchart BT`
 *   - `graph TD` / `graph TB` / ...（graph 是 flowchart 的别名）
 *   - 行首可有空格，方向后可有注释（%% ...）、空格或行尾
 *
 * @param lines - 代码行数组
 * @returns 方向行信息（索引 + 关键字），未找到返回 null
 */
function findFlowchartDirectionLine(lines: string[]): { index: number; keyword: string } | null {
  // 匹配带方向的方向行（支持方向后跟注释、空格或行尾）
  const directionPattern = /^\s*(flowchart|graph)\s+(?:TB|TD|BT|LR|RL)\b/;
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(directionPattern);
    if (match) {
      return { index: i, keyword: match[1]! };
    }
  }
  // 兜底：匹配无方向的 `flowchart` 或 `graph` 声明（支持末尾空格和注释）
  const noDirPattern = /^\s*(flowchart|graph)\s*(?:%%.*)?$/;
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(noDirPattern);
    if (match) {
      return { index: i, keyword: match[1]! };
    }
  }
  return null;
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
