/**
 * Architecture 序列化器
 *
 * 单一职责：将 GraphCanvasState (architecture) 序列化为 Mermaid 代码
 *
 * 数据流:
 *   GraphCanvasState
 *     → serializeArchitecture(canvas)
 *     → 输出 architecture-beta 代码
 *
 * 序列化规则（对齐官方 architecture-beta 语法）:
 *   1. 输出 'architecture-beta'
 *   2. 输出 groups: group id(icon)[title] in parentId
 *   3. 输出 services: service id(icon)[title] in groupId
 *   4. 输出 junctions: junction id
 *   5. 输出 edges: A:L -- R:B / A:L --> R:B / A:L -- R:B : Title
 *
 * v4 根因修复：
 *   - group 的 title 从 node.data.label 派生（不再从 metadata.groups[i].title 读取）
 *   - group 的 in 从 node.parentId 派生（不再从 metadata.groups[i].in 读取）
 *   - serializeNode 跳过 arch-group 节点（由 serializeGroup 输出）
 */

import type {
  GraphCanvasState,
  MermaidNode,
  MermaidEdge,
  SerializeResult,
  ParseError,
  ArchitectureGroupInfo,
  ArchitectureEdgeInfo,
  ArchitectureLayoutHint,
} from '../types.js';

// ============================================================
// 主入口
// ============================================================

/**
 * 序列化 architecture GraphCanvasState 为 Mermaid 代码
 *
 * @param canvas - GraphCanvasState (diagramType='architecture')
 * @returns SerializeResult，包含 mermaid 代码和错误
 */
export function serializeArchitecture(canvas: GraphCanvasState): SerializeResult {
  if (canvas.diagramType !== 'architecture') {
    return {
      mermaid: '',
      errors: [{
        line: 0,
        column: 0,
        message: `Expected architecture canvas, got ${canvas.diagramType}`,
        severity: 'error',
      }],
    };
  }

  const lines: string[] = ['architecture-beta'];
  const errors: ParseError[] = [];

  // 构建 group id → MermaidNode 映射（用于从 node 派生 title/in）
  const groupNodeMap = new Map<string, MermaidNode>();
  for (const node of canvas.nodes) {
    if (node.type === 'arch-group' || node.data.shape === 'arch-group') {
      groupNodeMap.set(node.id, node);
    }
  }

  // ============================================================
  // 1. 输出 groups
  // v4 根因修复：title/in 从 node 派生，按嵌套层级输出（父 group 先输出）
  // ============================================================
  const groups = canvas.metadata?.groups ?? [];
  const sortedGroups = sortGroupsByNesting(groups, groupNodeMap);
  for (const group of sortedGroups) {
    const groupNode = groupNodeMap.get(group.id);
    lines.push(serializeGroup(group, groupNode));
  }

  // ============================================================
  // 2. 输出 services 和 junctions（跳过 arch-group，由 serializeGroup 输出）
  // ============================================================
  for (const node of canvas.nodes) {
    const line = serializeNode(node);
    if (line) {
      lines.push(line);
    }
  }

  // ============================================================
  // 3. 输出 edges
  // ============================================================
  for (const edge of canvas.edges) {
    const line = serializeEdge(edge);
    if (line) {
      lines.push(line);
    }
  }

  // ============================================================
  // 4. 输出 layout hints（v4 新增）
  // ============================================================
  const layoutHints = canvas.metadata?.layoutHints ?? [];
  for (const hint of layoutHints) {
    lines.push(serializeLayoutHint(hint));
  }

  return {
    mermaid: lines.join('\n'),
    errors,
  };
}

// ============================================================
// 序列化辅助函数
// ============================================================

/**
 * 序列化 group（v4 根因修复：title/in/icon 全部从 node 派生）
 *
 * 语法: group id(icon)[title] in parentId
 *
 * @param group - ArchitectureGroupInfo（仅含 id，作为 group 索引）
 * @param groupNode - 对应的 arch-group MermaidNode（提供 title=label, in=parentId, icon=archIcon）
 */
function serializeGroup(group: ArchitectureGroupInfo, groupNode: MermaidNode | undefined): string {
  let line = `group ${group.id}`;
  // icon：从 node.data.archIcon 派生（v4 根因修复：单一数据源）
  const icon = groupNode?.data.archIcon as string | undefined;
  if (icon) {
    line += `(${icon})`;
  }
  // title：从 node.data.label 派生（v4 根因修复）
  const title = groupNode?.data.label;
  if (title && title !== group.id) {
    line += `[${title}]`;
  }
  // in：从 node.parentId 派生（v4 根因修复）
  const parentId = groupNode?.parentId;
  if (parentId) {
    line += ` in ${parentId}`;
  }
  return line;
}

/**
 * 按嵌套层级排序 groups（父 group 先输出）
 *
 * v4 根因修复：从 node.parentId 读取嵌套关系（不再从 group.in 读取）
 *
 * 使用拓扑排序，无父的 group 先输出，然后逐层向下
 */
function sortGroupsByNesting(
  groups: ArchitectureGroupInfo[],
  groupNodeMap: Map<string, MermaidNode>,
): ArchitectureGroupInfo[] {
  const groupMap = new Map<string, ArchitectureGroupInfo>();
  for (const g of groups) {
    groupMap.set(g.id, g);
  }

  // 计算每个 group 的深度（0 = 顶层）
  const depthMap = new Map<string, number>();
  const getDepth = (id: string, visited: Set<string>): number => {
    if (depthMap.has(id)) return depthMap.get(id)!;
    if (visited.has(id)) return 0; // 防御性：循环引用（异常情况）
    const g = groupMap.get(id);
    if (!g) {
      depthMap.set(id, 0);
      return 0;
    }
    // v4 根因修复：从 node.parentId 读取嵌套关系
    const node = groupNodeMap.get(id);
    const parentId = node?.parentId;
    if (!parentId) {
      depthMap.set(id, 0);
      return 0;
    }
    visited.add(id);
    const depth = getDepth(parentId, visited) + 1;
    depthMap.set(id, depth);
    return depth;
  };

  for (const g of groups) {
    getDepth(g.id, new Set());
  }

  // 按深度排序（同深度保持原顺序）
  return [...groups].sort((a, b) => (depthMap.get(a.id) ?? 0) - (depthMap.get(b.id) ?? 0));
}

/**
 * 序列化 layout hint（v4 新增）
 *
 * 语法: layout:row [a, b, c] / layout:column [a, b, c]
 */
function serializeLayoutHint(hint: ArchitectureLayoutHint): string {
  return `layout:${hint.direction} [${hint.members.join(', ')}]`;
}

/**
 * 序列化节点（service 或 junction）
 *
 * v4 根因修复：跳过 arch-group 节点（由 serializeGroup 从 metadata.groups 输出）
 *
 * service 语法: service id(icon)[title] in groupId
 * junction 语法: junction id
 */
function serializeNode(node: MermaidNode): string | null {
  const data = node.data;

  // v4 根因修复：跳过 arch-group 节点（由 serializeGroup 输出）
  if (node.type === 'arch-group' || data.shape === 'arch-group') {
    return null;
  }

  // junction 节点
  if (data.archIsJunction) {
    return `junction ${node.id}`;
  }

  // service 节点
  let line = `service ${node.id}`;

  // icon: (iconName)
  if (data.archIcon) {
    line += `(${data.archIcon})`;
  }

  // title: [title]（仅当 title 与 id 不同时输出）
  if (data.label && data.label !== node.id) {
    line += `[${data.label}]`;
  }

  // in groupId
  if (node.parentId) {
    line += ` in ${node.parentId}`;
  }

  return line;
}

/**
 * 序列化边
 *
 * v4 修复：支持 4 种箭头操作符
 *
 * 语法:
 *   A:L -- R:B           // 无箭头（lhsInto=false, rhsInto=false）
 *   A:L --> R:B          // 右箭头（lhsInto=false, rhsInto=true）
 *   A:L <-- R:B          // 左箭头（lhsInto=true, rhsInto=false）
 *   A:L <--> R:B         // 双向箭头（lhsInto=true, rhsInto=true）
 *   A:L -- R:B : Title   // 带标题
 */
function serializeEdge(edge: MermaidEdge): string | null {
  const archEdge = edge.data.archEdge;
  if (!archEdge) {
    // 没有 archEdge 信息的边无法序列化
    return null;
  }

  const lhsPart = `${archEdge.lhsId}:${archEdge.lhsDir}`;
  const rhsPart = `${archEdge.rhsDir}:${archEdge.rhsId}`;

  // v4 修复：根据 lhsInto/rhsInto 组合输出 4 种箭头操作符
  const arrow = deriveArrowOperator(archEdge.lhsInto, archEdge.rhsInto);

  let line = `${lhsPart} ${arrow} ${rhsPart}`;

  // 标题
  if (archEdge.title) {
    line += ` : ${archEdge.title}`;
  }

  return line;
}

/** v4 修复：根据 lhsInto/rhsInto 派生箭头操作符 */
function deriveArrowOperator(lhsInto: boolean, rhsInto: boolean): string {
  if (lhsInto && rhsInto) return '<-->';
  if (lhsInto) return '<--';
  if (rhsInto) return '-->';
  return '--';
}
