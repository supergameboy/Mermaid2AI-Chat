/**
 * 树布局 — mindmap 专用
 *
 * 单一职责：根据 parentId 构建树形结构，水平分层排列
 * 根节点在最左侧，子节点向右扩展
 */
import type { MermaidNode } from '@mermaid2aichat/serializer';

/** 水平层级间距 */
const LEVEL_SPACING = 200;
/** 同层节点垂直间距 */
const NODE_SPACING = 60;
/** 起始坐标 */
const START_X = 100;
const START_Y = 100;

/**
 * 树布局（mindmap 专用）
 * 根据 parentId 构建树，水平分层排列
 */
export function layoutMindmap(nodes: MermaidNode[]): MermaidNode[] {
  if (nodes.length === 0) return nodes;

  // 构建 parentId → children 索引
  const childrenMap = new Map<string | null, MermaidNode[]>();
  for (const node of nodes) {
    const parentId = node.parentId ?? null;
    if (!childrenMap.has(parentId)) {
      childrenMap.set(parentId, []);
    }
    childrenMap.get(parentId)!.push(node);
  }

  // 找到根节点
  const roots = childrenMap.get(null) ?? [];
  const positionedNodes = new Map<string, MermaidNode>();

  // 递归布局：返回子树高度（用于父节点垂直居中）
  function layoutSubtree(node: MermaidNode, level: number, startY: number): number {
    const children = childrenMap.get(node.id) ?? [];

    if (children.length === 0) {
      // 叶子节点：固定高度
      positionedNodes.set(node.id, {
        ...node,
        position: { x: START_X + level * LEVEL_SPACING, y: startY },
      });
      return NODE_SPACING;
    }

    // 递归布局子节点
    let currentY = startY;
    let totalHeight = 0;
    for (const child of children) {
      const childHeight = layoutSubtree(child, level + 1, currentY);
      currentY += childHeight;
      totalHeight += childHeight;
    }

    // 父节点垂直居中于子节点
    const centerY = startY + totalHeight / 2 - NODE_SPACING / 2;
    positionedNodes.set(node.id, {
      ...node,
      position: { x: START_X + level * LEVEL_SPACING, y: centerY },
    });

    return Math.max(totalHeight, NODE_SPACING);
  }

  // 布局所有根节点
  let currentY = START_Y;
  for (const root of roots) {
    const height = layoutSubtree(root, 0, currentY);
    currentY += height;
  }

  // 保持未处理节点（无 parentId 但不在 roots 中的情况）的原位置
  return nodes.map((node) => positionedNodes.get(node.id) ?? node);
}
