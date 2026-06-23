/**
 * flowchart 序列化器 — CanvasState → Mermaid flowchart 代码
 *
 * 单一职责：将 GraphCanvasState 序列化为 Mermaid flowchart 代码字符串（全量序列化）
 *
 * 数据流:
 *   GraphCanvasState
 *     → serializeFlowchart(canvas) 入口
 *     → 分发到:
 *       1. direction: direction → "flowchart TD\n"
 *       2. title: 图表标题（frontmatter 格式，对齐官方 metadata.title）
 *       3. accTitle/accDescription: 无障碍信息
 *       4. subgraph: subgraph 节点 → "subgraph id[Title]\n  ...\nend\n"
 *       5. vertex: 顶层节点 → "A[Label]\n" / "A@{ shape: xxx }\n"
 *       6. edge: 顶层边 + 跨 subgraph 边 → "A --> B\n"
 *       7. classDef: "classDef red fill:#f00\n"
 *       8. class: "class A red\n"
 *       9. style: "style A fill:#f00\n"
 *       10. linkStyle: "linkStyle 0 stroke:#f00\n"
 *       11. click: "click A callback()\n"
 *     → 合并为 Mermaid 代码字符串
 *
 * 注意: 增量序列化由 incremental-serializer.ts 处理，本文件只负责全量序列化
 */

import type {
  CanvasState,
  GraphCanvasState,
  SerializeResult,
  ParseError,
  MermaidNode,
  MermaidEdge,
} from '../../types.js';
import { serializeVertex, serializeVertexClassSuffix } from './vertex-serializer.js';
import { serializeEdge } from './edge-serializer.js';
import { serializeSubgraph } from './subgraph-serializer.js';
import {
  serializeClassDefs,
  serializeClassApplications,
  serializeNodeStyles,
  serializeLinkStyles,
} from './style-serializer.js';
import { serializeClickEvents } from './click-serializer.js';
import { serializeFrontmatterTitle } from '../../detector/preprocessor.js';

// ============================================================
// 公共 API
// ============================================================

/**
 * 序列化 CanvasState 为 Mermaid flowchart 代码（全量序列化）
 *
 * @param canvas - CanvasState（必须为 GraphCanvasState 且 diagramType === 'flowchart'）
 * @returns 序列化结果（包含 mermaid 代码和错误列表）
 */
export function serializeFlowchart(canvas: CanvasState): SerializeResult {
  if (canvas.diagramType !== 'flowchart') {
    const error: ParseError = {
      line: 0,
      column: 0,
      message: `Expected flowchart diagramType, got ${canvas.diagramType}`,
      severity: 'error',
    };
    return { mermaid: '', errors: [error] };
  }

  const graphCanvas = canvas as GraphCanvasState;
  const errors: ParseError[] = [];
  const lines: string[] = [];

  // 1. 图表标题（frontmatter 格式，对齐官方 Diagram.ts 的 metadata.title 处理）
  // title 不是 jison 语法，必须通过 frontmatter 设置
  const metadata = graphCanvas.metadata;
  const title = readField<string>(metadata, 'title');
  if (title) {
    lines.push(serializeFrontmatterTitle(title));
  }

  // 2. 图表头（direction）
  const direction = graphCanvas.direction ?? 'TB';
  lines.push(`flowchart ${direction}`);
  lines.push('');

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

  // 4. 分离 subgraph 节点和普通节点
  const subgraphNodes: MermaidNode[] = [];
  const topLevelNodes: MermaidNode[] = [];
  for (const node of graphCanvas.nodes) {
    const isSubgraph = readField<boolean>(node.data, 'isSubgraph');
    if (isSubgraph) {
      subgraphNodes.push(node);
    } else if (!node.parentId) {
      topLevelNodes.push(node);
    }
  }

  // 5. 序列化 subgraph（含其子节点和内部边）
  for (const subgraphNode of subgraphNodes) {
    // 只序列化顶层 subgraph（无 parentId 的）
    if (subgraphNode.parentId) {
      continue;
    }
    lines.push(serializeSubgraph(subgraphNode, graphCanvas.nodes, graphCanvas.edges));
    lines.push('');
  }

  // 6. 序列化顶层普通节点
  for (const node of topLevelNodes) {
    const vertexCode = serializeVertex(node);
    const classSuffix = serializeVertexClassSuffix(node);
    lines.push(`${vertexCode}${classSuffix}`);
  }

  // 7. 序列化顶层边 + 跨 subgraph 边
  // 顶层边：source 和 target 都无 parentId
  // 跨 subgraph 边：source 和 target 在不同 subgraph，或一端在 subgraph 一端在顶层
  // subgraph 内部边（source 和 target 都在同一 subgraph 直接子级）由 subgraph-serializer 处理
  const topLevelAndCrossEdges = graphCanvas.edges.filter((edge) => {
    const sourceNode = graphCanvas.nodes.find((n) => n.id === edge.source);
    const targetNode = graphCanvas.nodes.find((n) => n.id === edge.target);
    const sourceParent = sourceNode?.parentId;
    const targetParent = targetNode?.parentId;

    // subgraph 内部边（source 和 target 都在同一 subgraph 直接子级）→ 由 subgraph-serializer 处理
    if (sourceParent && targetParent && sourceParent === targetParent) {
      return false;
    }

    // 顶层边和跨 subgraph 边 → 顶层输出
    return true;
  });

  for (const edge of topLevelAndCrossEdges) {
    lines.push(serializeEdge(edge));
  }

  if (topLevelNodes.length > 0 || topLevelAndCrossEdges.length > 0) {
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

  // 10. style 语句
  const styleLines = serializeNodeStyles(graphCanvas.nodes);
  lines.push(...styleLines);
  if (styleLines.length > 0) {
    lines.push('');
  }

  // 11. linkStyle 语句
  const linkStyleLines = serializeLinkStyles(graphCanvas.edges, metadata);
  lines.push(...linkStyleLines);
  if (linkStyleLines.length > 0) {
    lines.push('');
  }

  // 12. click 语句
  const clickLines = serializeClickEvents(graphCanvas.nodes, metadata);
  lines.push(...clickLines);
  if (clickLines.length > 0) {
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

/** 安全读取扩展字段 */
function readField<T>(data: Record<string, unknown> | undefined, key: string): T | undefined {
  if (!data) return undefined;
  const value = data[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  return value as T;
}
