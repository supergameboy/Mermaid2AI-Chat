/**
 * mindmap 序列化器 — CanvasState → Mermaid mindmap 代码
 *
 * 单一职责：将 GraphCanvasState (diagramType='mindmap') 序列化为 Mermaid 代码
 *
 * 数据流:
 *   GraphCanvasState
 *     → serializeMindmap(canvas) 入口
 *     → 分发到:
 *       1. header: "mindmap"
 *       2. 构建 childrenMap（parentId → children[]）
 *       3. 找到 root（parentId=undefined 且 isRoot=true）
 *       4. 递归序列化（DFS）:
 *          - 缩进 = '  '.repeat(level)
 *          - 形状语法映射（default/rect/rounded/circle/cloud/bang/hexagon）
 *          - icon 装饰: 下一行 '::icon(iconName)'
 *          - class 装饰: 下一行 '::class(className)'
 *       5. 递归处理 children（level + 1）
 *     → 合并为 Mermaid 代码字符串
 *
 * 输出顺序对齐 mermaid 官方 mindmap 语法:
 *   mindmap
 *     root((mindmap))
 *       Origins
 *         ::icon(fa fa-book)
 *         Long history
 *
 * 注意:
 *   - mindmap 的 edges 不存储在 CanvasState.edges 中，从 nodes 的 parentId 派生
 *   - 序列化时根据 parentId 重建树形结构
 */

import type {
  CanvasState,
  GraphCanvasState,
  SerializeResult,
  ParseError,
  MermaidNode,
} from '../types.js';
import {
  buildChildrenMap,
  findRootNode,
  traverseTree,
  formatNodeSyntax,
  extractNodeId,
  extractMindmapType,
  extractIcon,
  extractClass,
} from './shared/mindmap-helpers.js';

// ============================================================
// 公共 API
// ============================================================

/**
 * 序列化 CanvasState 为 Mermaid mindmap 代码
 *
 * @param canvas - CanvasState（必须为 GraphCanvasState 且 diagramType === 'mindmap'）
 * @returns 序列化结果（包含 mermaid 代码和错误列表）
 */
export function serializeMindmap(canvas: CanvasState): SerializeResult {
  if (canvas.diagramType !== 'mindmap') {
    const error: ParseError = {
      line: 0,
      column: 0,
      message: `Expected mindmap diagramType, got ${canvas.diagramType}`,
      severity: 'error',
    };
    return { mermaid: '', errors: [error] };
  }

  const graphCanvas = canvas as GraphCanvasState;
  const errors: ParseError[] = [];
  const lines: string[] = [];

  // 1. 图表头
  lines.push('mindmap');

  // 2. 构建 childrenMap（parentId → children[]）
  const childrenMap = buildChildrenMap(graphCanvas.nodes);

  // 3. 找到 root 节点
  const root = findRootNode(graphCanvas.nodes);

  if (!root) {
    // 空画布：仅输出 'mindmap' 头
    return {
      mermaid: lines.join('\n'),
      errors: [],
    };
  }

  // 4. 递归序列化（DFS）
  const serializedLines: string[] = [];
  traverseTree(
    root,
    childrenMap,
    (node, level) => {
      const indent = '  '.repeat(level);
      const nodeId = extractNodeId(node);
      const label = node.data.label;
      const mindmapType = extractMindmapType(node);
      const icon = extractIcon(node);
      const className = extractClass(node);

      // 节点行
      const nodeText = formatNodeSyntax(nodeId, label, mindmapType);
      serializedLines.push(`${indent}${nodeText}`);

      // icon 装饰行（缩进比节点多一级）
      // 官方语法: ::icon(iconName)
      if (icon) {
        serializedLines.push(`${indent}  ::icon(${icon})`);
      }

      // class 装饰行（缩进比节点多一级）
      // 官方语法: :::className（三个冒号后跟类名）
      if (className) {
        serializedLines.push(`${indent}  :::${className}`);
      }
    },
    0,
  );

  lines.push(...serializedLines);

  return {
    mermaid: lines.join('\n'),
    errors,
  };
}
