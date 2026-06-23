/**
 * namespace 序列化器 — namespace 节点 → Mermaid namespace 代码
 *
 * 单一职责：将 namespace 节点及其子节点序列化为 Mermaid namespace 语法
 *
 * 语法:
 *   namespace A {
 *     namespace B {
 *       class ClassName {
 *         ...
 *       }
 *     }
 *   }
 *
 * 数据流:
 *   MermaidNode (type='namespace')
 *     → serializeNamespace(node, allNodes)
 *     → 递归序列化嵌套 namespace 和 class-box 子节点
 *     → 输出 Mermaid namespace 代码块
 *
 * 嵌套通过 parentId 关系确定，子节点缩进 2 空格
 */

import type { MermaidNode } from '../../types.js';
import { serializeClassNode } from './class-node-serializer.js';

// ============================================================
// 类型
// ============================================================

/** namespace 序列化上下文 */
interface NamespaceContext {
  /** 所有节点（按 ID 索引） */
  nodesById: Map<string, MermaidNode>;
  /** parent ID → 直接子节点 ID 列表 */
  childrenMap: Map<string, string[]>;
}

// ============================================================
// 公共 API
// ============================================================

/**
 * 序列化 namespace 及其所有子节点
 *
 * @param namespaceNode - namespace 节点 (type='namespace')
 * @param allNodes - 画布所有节点
 * @returns Mermaid namespace 代码块（含嵌套 namespace 和类定义）
 */
export function serializeNamespace(
  namespaceNode: MermaidNode,
  allNodes: MermaidNode[],
): string {
  const ctx = buildContext(allNodes);
  return serializeNamespaceNode(namespaceNode, ctx, 0);
}

// ============================================================
// 内部实现
// ============================================================

/** 构建序列化上下文 */
function buildContext(allNodes: MermaidNode[]): NamespaceContext {
  const nodesById = new Map<string, MermaidNode>();
  const childrenMap = new Map<string, string[]>();

  for (const node of allNodes) {
    nodesById.set(node.id, node);
    if (node.parentId) {
      const siblings = childrenMap.get(node.parentId) ?? [];
      siblings.push(node.id);
      childrenMap.set(node.parentId, siblings);
    }
  }

  return { nodesById, childrenMap };
}

/**
 * 递归序列化 namespace 节点
 *
 * 输出格式:
 *   namespace Name {
 *     class InnerClass { ... }
 *     namespace Nested { ... }
 *   }
 */
function serializeNamespaceNode(
  node: MermaidNode,
  ctx: NamespaceContext,
  depth: number,
): string {
  const lines: string[] = [];
  const indent = '  '.repeat(depth);

  // namespace 头部: `namespace Name {`
  const label = node.data.label ?? node.id;
  lines.push(`${indent}namespace ${label} {`);

  // 序列化直接子节点
  const childIds = ctx.childrenMap.get(node.id) ?? [];
  const childIndent = '  '.repeat(depth + 1);

  for (const childId of childIds) {
    const childNode = ctx.nodesById.get(childId);
    if (!childNode) {
      continue;
    }

    if (childNode.type === 'namespace') {
      // 递归序列化嵌套 namespace
      lines.push(serializeNamespaceNode(childNode, ctx, depth + 1));
    } else if (childNode.type === 'class-box') {
      // 类节点
      lines.push(serializeClassNode(childNode, childIndent));
    }
    // note 节点不在 namespace 内序列化（由 note-serializer 处理）
  }

  lines.push(`${indent}}`);
  return lines.join('\n');
}
