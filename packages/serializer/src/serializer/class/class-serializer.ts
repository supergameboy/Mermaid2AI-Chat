/**
 * class 序列化器 — CanvasState → Mermaid classDiagram 代码
 *
 * 单一职责：将 GraphCanvasState (diagramType='classDiagram') 序列化为 Mermaid 代码
 *
 * 数据流:
 *   GraphCanvasState
 *     → serializeClass(canvas) 入口
 *     → 分发到:
 *       1. header: "classDiagram\n"
 *       2. direction: "direction LR\n"
 *       3. accTitle/accDescription: 无障碍信息
 *       4. namespace: namespace 嵌套结构（含内部类）
 *       5. class: 顶层类定义（不在 namespace 内的类）
 *       6. relation: 关系边（6 种类型 + 基数 + 标签）
 *       7. note: note 注释（note for Class "text"）
 *       8. classDef: 样式类定义
 *       9. class: 样式类应用
 *       10. style: 内联样式
 *     → 合并为 Mermaid 代码字符串
 */

import type {
  CanvasState,
  GraphCanvasState,
  SerializeResult,
  ParseError,
  ClassNoteInfo,
  GraphMetadata,
} from '../../types.js';
import { serializeClassNode } from './class-node-serializer.js';
import { serializeRelation } from './relation-serializer.js';
import { serializeNamespace } from './namespace-serializer.js';
import { serializeNotes } from './note-serializer.js';
import {
  serializeClassDefs,
  serializeClassApplications,
  serializeNodeStyles,
} from './style-serializer.js';

// ============================================================
// 公共 API
// ============================================================

/**
 * 序列化 CanvasState 为 Mermaid classDiagram 代码
 *
 * @param canvas - CanvasState（必须为 GraphCanvasState 且 diagramType === 'classDiagram'）
 * @returns 序列化结果（包含 mermaid 代码和错误列表）
 */
export function serializeClass(canvas: CanvasState): SerializeResult {
  if (canvas.diagramType !== 'classDiagram') {
    const error: ParseError = {
      line: 0,
      column: 0,
      message: `Expected classDiagram diagramType, got ${canvas.diagramType}`,
      severity: 'error',
    };
    return { mermaid: '', errors: [error] };
  }

  const graphCanvas = canvas as GraphCanvasState;
  const errors: ParseError[] = [];
  const lines: string[] = [];

  // 1. 图表头
  lines.push('classDiagram');
  lines.push('');

  // 2. 方向（优先使用 metadata.direction，其次 graphCanvas.direction）
  const metadata = graphCanvas.metadata;
  const direction = readField<string>(metadata, 'direction')
    ?? (typeof graphCanvas.direction === 'string' ? graphCanvas.direction : undefined);
  if (direction) {
    lines.push(`direction ${direction}`);
    lines.push('');
  }

  // 3. 无障碍信息
  const accTitle = metadata?.accTitle;
  const accDescription = metadata?.accDescription;
  if (accTitle) {
    lines.push(`accTitle: ${accTitle}`);
  }
  if (accDescription) {
    lines.push(`accDescr: ${accDescription}`);
  }
  if (accTitle || accDescription) {
    lines.push('');
  }

  // 4. namespace 序列化（含其内部的类）
  // 只序列化顶层 namespace（无 parentId 的），嵌套 namespace 由递归处理
  const namespaceNodes = graphCanvas.nodes.filter(
    (n) => n.type === 'namespace' && !n.parentId,
  );
  for (const namespaceNode of namespaceNodes) {
    lines.push(serializeNamespace(namespaceNode, graphCanvas.nodes));
    lines.push('');
  }

  // 5. 顶层类节点（不在 namespace 内的类）
  const topLevelClassNodes = graphCanvas.nodes.filter(
    (n) => n.type === 'class-box' && !n.parentId,
  );
  for (const node of topLevelClassNodes) {
    lines.push(serializeClassNode(node));
  }
  if (topLevelClassNodes.length > 0) {
    lines.push('');
  }

  // 6. 关系边
  const relationEdges = graphCanvas.edges.filter((e) => e.type === 'class-relation');
  for (const edge of relationEdges) {
    lines.push(serializeRelation(edge));
  }
  if (relationEdges.length > 0) {
    lines.push('');
  }

  // 7. note 注释
  const classNotes = readField<ClassNoteInfo[]>(metadata, 'classNotes');
  const noteLines = serializeNotes(classNotes, graphCanvas.nodes, graphCanvas.edges);
  lines.push(...noteLines);
  if (noteLines.length > 0) {
    lines.push('');
  }

  // 8. classDef 语句
  const classDefLines = serializeClassDefs(metadata);
  lines.push(...classDefLines);
  if (classDefLines.length > 0) {
    lines.push('');
  }

  // 9. class 应用语句
  const classLines = serializeClassApplications(graphCanvas.nodes);
  lines.push(...classLines);
  if (classLines.length > 0) {
    lines.push('');
  }

  // 10. style 语句（内联样式）
  const styleLines = serializeNodeStyles(graphCanvas.nodes);
  lines.push(...styleLines);
  if (styleLines.length > 0) {
    lines.push('');
  }

  // 合并为最终代码（去除尾部空行）
  const mermaid = lines.join('\n').replace(/\n+$/, '\n');

  return {
    mermaid,
    errors,
  };
}

// ============================================================
// 辅助函数
// ============================================================

/** 安全读取 GraphMetadata 的扩展字段 */
function readField<T>(
  data: GraphMetadata | undefined,
  key: string,
): T | undefined {
  if (!data) {
    return undefined;
  }
  const value = (data as Record<string, unknown>)[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  return value as T;
}
