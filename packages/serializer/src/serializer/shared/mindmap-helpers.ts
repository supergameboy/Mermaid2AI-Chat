/**
 * mindmap 序列化辅助函数
 *
 * 单一职责：提供 mindmap 序列化器所需的树形结构构建/层级计算/形状语法映射
 *
 * 注意:
 *   - mindmap 的 edges 不存储在 CanvasState.edges 中，从 nodes 的 parentId 派生
 *   - nodes 是唯一数据源
 */

import type { MermaidNode, MindmapNodeType } from '../../types.js';

// ============================================================
// 树形结构构建
// ============================================================

/**
 * 构建 parentId → children[] 映射
 *
 * @param nodes - 所有节点
 * @returns Map<parentId, childNodes[]>
 */
export function buildChildrenMap(nodes: MermaidNode[]): Map<string, MermaidNode[]> {
  const childrenMap = new Map<string, MermaidNode[]>();
  for (const node of nodes) {
    const parentId = node.parentId;
    if (parentId === undefined) {
      continue;
    }
    const children = childrenMap.get(parentId) ?? [];
    children.push(node);
    childrenMap.set(parentId, children);
  }
  return childrenMap;
}

/**
 * 找到 root 节点
 *
 * root 节点定义:
 *   - parentId 为 undefined
 *   - data.isRoot === true
 *
 * @param nodes - 所有节点
 * @returns root 节点（找不到返回 null）
 */
export function findRootNode(nodes: MermaidNode[]): MermaidNode | null {
  // 优先查找 isRoot 标记
  const markedRoot = nodes.find((n) => {
    const data = n.data as MermaidNode['data'] & { isRoot?: boolean };
    return data.isRoot === true;
  });
  if (markedRoot) {
    return markedRoot;
  }
  // 回退：查找无 parentId 的节点
  return nodes.find((n) => n.parentId === undefined) ?? null;
}

/**
 * 递归遍历树形结构（DFS）
 *
 * @param node - 当前节点
 * @param childrenMap - parentId → children[] 映射
 * @param visitor - 访问函数（参数: 节点, 层级）
 * @param level - 当前层级（root=0）
 */
export function traverseTree(
  node: MermaidNode,
  childrenMap: Map<string, MermaidNode[]>,
  visitor: (node: MermaidNode, level: number) => void,
  level: number = 0,
): void {
  visitor(node, level);
  const children = childrenMap.get(node.id) ?? [];
  for (const child of children) {
    traverseTree(child, childrenMap, visitor, level + 1);
  }
}

// ============================================================
// 形状语法映射
// ============================================================

/**
 * 形状 → 包裹语法映射（对齐官方 mindmap 语法）
 *
 * 映射规则:
 *   - default  → 无包裹（直接输出 nodeId）
 *   - rect     → nodeId[label]
 *   - rounded  → nodeId(label)
 *   - circle   → nodeId((label))
 *   - cloud    → nodeId)label)
 *   - bang     → nodeId))label)
 *   - hexagon  → nodeId{{label}}
 *
 * 注意:
 *   - 当 label === nodeId 时，仅输出 nodeId（对齐官方 nodeWithId 规则）
 *   - 当 label !== nodeId 时，输出完整形状语法
 *
 * @param nodeId - 节点 ID（用户定义的 nodeId）
 * @param label - 节点 label
 * @param type - 节点形状类型
 * @returns 序列化后的节点文本
 */
export function formatNodeSyntax(
  nodeId: string,
  label: string,
  type: MindmapNodeType,
): string {
  // 如果 label 与 nodeId 相同，使用 nodeId（无描述）
  // 对齐官方 nodeWithId 规则: NODE_ID 单独出现时使用 id 作为 descr
  if (label === nodeId) {
    return nodeId;
  }

  switch (type) {
    case 'default':
      // default 类型: label !== id 时仍输出 id（官方行为）
      // 官方 nodeWithId: NODE_ID → { id, descr: id, type: DEFAULT }
      // 即 default 类型不包裹 label，label 通过 descr 隐含
      return nodeId;
    case 'rect':
      return `${nodeId}[${label}]`;
    case 'rounded':
      return `${nodeId}(${label})`;
    case 'circle':
      return `${nodeId}((${label}))`;
    case 'cloud':
      return `${nodeId})${label})`;
    case 'bang':
      return `${nodeId}))${label})`;
    case 'hexagon':
      return `${nodeId}{{${label}}}`;
    default:
      return nodeId;
  }
}

/**
 * 从 MermaidNode 提取 nodeId（用户定义的 ID）
 *
 * mindmap 节点的 nodeId 保存在 data.nodeId 中（如果存在），
 * 否则使用 MermaidNode.id（数字字符串）。
 *
 * 注意: 解析器输出的 MermaidNode.id 是数字字符串（如 "0", "1"），
 * 而 data.nodeId 是用户定义的字符串（如 "root", "Origins"）。
 * 序列化时必须使用 data.nodeId 还原用户定义的 ID。
 */
export function extractNodeId(node: MermaidNode): string {
  const data = node.data as MermaidNode['data'] & { nodeId?: string };
  return data.nodeId ?? node.id;
}

/**
 * 从 MermaidNode 提取 mindmapType
 */
export function extractMindmapType(node: MermaidNode): MindmapNodeType {
  return node.data.mindmapType ?? 'default';
}

/**
 * 从 MermaidNode 提取 icon
 */
export function extractIcon(node: MermaidNode): string | undefined {
  return node.data.mindmapIcon;
}

/**
 * 从 MermaidNode 提取 class
 */
export function extractClass(node: MermaidNode): string | undefined {
  return node.data.mindmapClass;
}
