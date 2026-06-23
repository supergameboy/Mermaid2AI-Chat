/**
 * Architecture 辅助函数（v4 新增）
 *
 * 单一职责：提供 architecture group 成员派生与循环引用检测工具
 *
 * 设计依据:
 *   - v4 修订：ArchitectureGroupInfo 移除 nodeIds，成员通过 parentId 派生（单一数据源）
 *   - v4 修订：handleMoveToGroup 需要循环引用检测，避免 group 嵌套形成环
 */

import type { MermaidNode } from '../../types.js';

/**
 * 从 nodes 中派生指定 group 的成员（基于 parentId）
 *
 * v4 单一数据源原则：
 *   - group 的成员关系唯一由 nodes[].parentId 表达
 *   - 不再从 metadata.groups[i].nodeIds 读取（已移除该字段）
 *
 * @param nodes - 所有节点列表
 * @param groupId - group 节点 ID
 * @returns 所有 parentId === groupId 的节点（含 service/junction/嵌套 group）
 */
export function deriveGroupMembers(nodes: MermaidNode[], groupId: string): MermaidNode[] {
  return nodes.filter((n) => n.parentId === groupId);
}

/**
 * 检测移动 nodeId 到 targetGroupId 是否会形成循环引用
 *
 * 循环场景：
 *   - targetGroupId === nodeId（移动到自身）
 *   - targetGroupId 是 nodeId 的后代（移动到自己的子 group）
 *
 * 算法：从 targetGroupId 向上追溯 parentId 链，若遇到 nodeId 则有环
 *
 * @param nodes - 所有节点列表
 * @param nodeId - 待移动的节点 ID
 * @param targetGroupId - 目标 group ID（null 表示移出 group，不会形成循环）
 * @returns true 表示会形成循环引用，应拒绝操作
 */
export function detectCycle(
  nodes: MermaidNode[],
  nodeId: string,
  targetGroupId: string | null,
): boolean {
  // 移出 group（targetGroupId 为 null）不会形成循环
  if (targetGroupId === null) {
    return false;
  }

  // 移动到自身 — 形成循环
  if (targetGroupId === nodeId) {
    return true;
  }

  // 从 targetGroupId 向上追溯 parentId 链
  // 若遇到 nodeId，说明 nodeId 是 targetGroupId 的祖先，
  // 把 nodeId 移到 targetGroupId 下会形成环
  const nodeMap = new Map<string, MermaidNode>();
  for (const n of nodes) {
    nodeMap.set(n.id, n);
  }

  let currentId: string | undefined = targetGroupId;
  const visited = new Set<string>(); // 防御性：避免数据异常导致的死循环

  while (currentId !== undefined) {
    // 遇到 nodeId — 说明 nodeId 是 targetGroupId 的祖先，会形成循环
    if (currentId === nodeId) {
      return true;
    }

    // 防御性：已访问过，说明数据有环（异常情况），停止追溯
    if (visited.has(currentId)) {
      return false;
    }
    visited.add(currentId);

    // 向上追溯
    const current = nodeMap.get(currentId);
    currentId = current?.parentId;
  }

  // 追溯到顶层未遇到 nodeId — 无循环
  return false;
}
