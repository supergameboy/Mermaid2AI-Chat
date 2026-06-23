/**
 * er 序列化器 — CanvasState → Mermaid erDiagram 代码
 *
 * 单一职责：将 GraphCanvasState (diagramType='erDiagram') 序列化为 Mermaid 代码
 *
 * 数据流:
 *   GraphCanvasState
 *     → serializeER(canvas) 入口
 *     → 分发到:
 *       1. header: "erDiagram\n"
 *       2. direction: "direction LR\n"
 *       3. accTitle/accDescription: 无障碍信息
 *       4. relationship: 关系边（cardinality + identification + role）
 *       5. subgraph: 子图块（含节点 ID 列表）
 *       6. entity: 顶层实体定义（含属性）
 *       7. classDef: 样式类定义
 *       8. class: 样式类应用
 *       9. style: 内联样式
 *     → 合并为 Mermaid 代码字符串
 *
 * 输出顺序对齐 mermaid 官方 erDb 渲染顺序:
 *   erDiagram → direction → accTitle → 关系 → 实体 → classDef → class → style
 */

import type {
  CanvasState,
  GraphCanvasState,
  SerializeResult,
  ParseError,
  GraphMetadata,
  MermaidNode,
  ErSubGraphInfo,
} from '../../types.js';
import { serializeEntity } from './entity-serializer.js';
import { serializeRelationship } from './relationship-serializer.js';

// ============================================================
// 公共 API
// ============================================================

/**
 * 序列化 CanvasState 为 Mermaid erDiagram 代码
 *
 * @param canvas - CanvasState（必须为 GraphCanvasState 且 diagramType === 'erDiagram'）
 * @returns 序列化结果（包含 mermaid 代码和错误列表）
 */
export function serializeER(canvas: CanvasState): SerializeResult {
  if (canvas.diagramType !== 'erDiagram') {
    const error: ParseError = {
      line: 0,
      column: 0,
      message: `Expected erDiagram diagramType, got ${canvas.diagramType}`,
      severity: 'error',
    };
    return { mermaid: '', errors: [error] };
  }

  const graphCanvas = canvas as GraphCanvasState;
  const errors: ParseError[] = [];
  const lines: string[] = [];

  // 1. 图表头
  lines.push('erDiagram');
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

  // 4. 关系边（先关系后实体，对齐 er-parser 解析顺序）
  const relationEdges = graphCanvas.edges.filter((e) => e.type === 'er-relation');
  for (const edge of relationEdges) {
    const result = serializeRelationship(edge, graphCanvas.nodes);
    errors.push(...result.errors);
    if (result.line) {
      lines.push(result.line);
    }
  }
  if (relationEdges.length > 0) {
    lines.push('');
  }

  // 5. subgraph 块（从 metadata.erSubgraphs 读取，仅列出节点 ID 引用）
  const erSubgraphs = metadata?.erSubgraphs ?? [];
  const subgraphNodeIds = new Set<string>();
  for (const sg of erSubgraphs) {
    for (const nodeId of sg.nodes) {
      subgraphNodeIds.add(nodeId);
    }
  }
  for (const sg of erSubgraphs) {
    lines.push(serializeSubgraph(sg));
    lines.push('');
  }

  // 6. 顶层实体节点（跳过 subgraph 内的实体，避免重复输出）
  const topLevelEntities = graphCanvas.nodes.filter(
    (n) => n.type === 'er-box' && !subgraphNodeIds.has(n.id),
  );
  for (const node of topLevelEntities) {
    lines.push(serializeEntity(node));
  }
  if (topLevelEntities.length > 0) {
    lines.push('');
  }

  // 7. classDef 语句（从 metadata.erClasses 读取）
  const classDefLines = serializeClassDefs(metadata);
  lines.push(...classDefLines);
  if (classDefLines.length > 0) {
    lines.push('');
  }

  // 8. class 应用语句（从节点的 data.classNames 读取）
  const classLines = serializeClassApplications(graphCanvas.nodes);
  lines.push(...classLines);
  if (classLines.length > 0) {
    lines.push('');
  }

  // 9. style 语句（从节点的 data.styles 读取内联样式）
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
// 内部实现 — subgraph 序列化
// ============================================================

/**
 * 序列化 subgraph 块
 *
 * 语法（对齐 mermaid erDiagram subgraph 语法）:
 *   subgraph "Title" {
 *     direction LR
 *     NODE1
 *     NODE2
 *   }
 *
 * 注意: 块内仅列出节点 ID 引用，实体定义在顶层输出
 *       direction 在块内输出，class 应用语句在块内输出
 */
function serializeSubgraph(sg: ErSubGraphInfo): string {
  const lines: string[] = [];
  lines.push(`subgraph "${sg.title}" {`);

  // direction（块内方向）
  if (sg.dir) {
    lines.push(`  direction ${sg.dir}`);
  }

  // 节点 ID 引用
  for (const nodeId of sg.nodes) {
    lines.push(`  ${nodeId}`);
  }

  // class 应用语句（subgraph 级别的 CSS 类）
  if (sg.classes && sg.classes.length > 0) {
    lines.push(`  class ${sg.id} ${sg.classes.join(',')}`);
  }

  lines.push('}');

  return lines.join('\n');
}

// ============================================================
// 内部实现 — classDef / class / style 序列化
// ============================================================

/**
 * 序列化 classDef 语句
 *
 * 语法: `classDef id style1,style2,...`
 * 合并 styles 和 textStyles（对齐官方 erDb.ts 的 defineClass 逻辑）
 */
function serializeClassDefs(metadata: GraphMetadata | undefined): string[] {
  const classes = metadata?.erClasses;
  if (!classes || classes.length === 0) {
    return [];
  }

  return classes.map((cls) => {
    const allStyles = [...cls.styles, ...cls.textStyles];
    return `classDef ${cls.id} ${allStyles.join(',')}`;
  });
}

/**
 * 序列化 class 应用语句
 *
 * 语法: `class nodeId className`（多个 className 用逗号分隔）
 * 仅处理 er-box 类型节点
 */
function serializeClassApplications(nodes: MermaidNode[]): string[] {
  const lines: string[] = [];

  for (const node of nodes) {
    if (node.type !== 'er-box') {
      continue;
    }

    const classNames = node.data.classNames;
    if (!classNames || classNames.length === 0) {
      continue;
    }

    lines.push(`class ${node.id} ${classNames.join(',')}`);
  }

  return lines;
}

/**
 * 序列化 style 语句（内联样式）
 *
 * 语法: `style nodeId style1,style2,...`
 * 从节点的 data.styles 扩展字段读取
 * 仅处理 er-box 类型节点
 */
function serializeNodeStyles(nodes: MermaidNode[]): string[] {
  const lines: string[] = [];

  for (const node of nodes) {
    if (node.type !== 'er-box') {
      continue;
    }

    const styles = readField<string[]>(node.data, 'styles');
    if (!styles || styles.length === 0) {
      continue;
    }

    lines.push(`style ${node.id} ${styles.join(',')}`);
  }

  return lines;
}

// ============================================================
// 辅助函数
// ============================================================

/**
 * 安全读取扩展字段
 *
 * 支持 GraphMetadata 和 MermaidNodeData（两者均有 `[key: string]: unknown` 索引签名）
 */
function readField<T>(
  data: Record<string, unknown> | undefined,
  key: string,
): T | undefined {
  if (!data) {
    return undefined;
  }
  const value = data[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  return value as T;
}
