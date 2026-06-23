/**
 * dagre 布局 — 用于 flowchart/class/er/state/architecture 图结构类型
 *
 * 单一职责：使用 dagre 计算节点位置，返回带位置的节点数组
 *
 * 数据流:
 *   MermaidNode[] + MermaidEdge[] + FlowchartDirection + GraphMetadata
 *     → dagre.layout（compound graph + 动态尺寸 + minlen + 自环排除）
 *     → { nodes: MermaidNode[]（带位置）, edges: MermaidEdge[]（自环标记） }
 *
 * 关键设计:
 *   - compound: true 支持 subgraph 嵌套（parentId → dagre parent）
 *   - 动态节点尺寸（node.width/height 或 measured.dimensions 或默认值）
 *   - 边 minlen 支持（edge.data.length → dagre minlen）
 *   - 自环边特殊处理（source === target，不参与 dagre 排名，绕节点一圈）
 *   - ranksep=120, nodesep=60（增大间距减少交叉）
 */

import dagre from 'dagre';
console.log('DAGRE_LAYOUT_LOADED_v20260624');
import type {
  FlowchartDirection,
  GraphMetadata,
  MermaidEdge,
  MermaidNode,
  MermaidShapeType,
} from '@mermaid2aichat/serializer';
import { computeNodeSize } from '../nodes/flowchart/shapes/node-size.js';

// ============================================================
// 常量
// ============================================================


const RANK_SEP = 120;
const NODE_SEP = 60;
const SUBGRAPH_DEFAULT_WIDTH = 300;
const SUBGRAPH_DEFAULT_HEIGHT = 200;
const SUBGRAPH_MIN_WIDTH = 200;
const SUBGRAPH_MIN_HEIGHT = 100;
/** 标题栏高度，需与 subgraph-node.tsx 保持一致 */
const SUBGRAPH_TITLE_HEIGHT = 28;
/** 子图内容区水平内边距（dagre 已含内部 padding，这里额外留边） */
const SUBGRAPH_HORIZONTAL_PADDING = 16;
/** 子图内容区底部垂直内边距 */
const SUBGRAPH_VERTICAL_PADDING = 16;

// ============================================================
// 布局函数
// ============================================================

/**
 * 使用 dagre 计算节点位置
 *
 * @param nodes - 画布节点（subgraph 节点通过 parentId 标识父子关系）
 * @param edges - 画布边（自环边会被排除出 dagre 排名）
 * @param direction - 布局方向（TB/BT/LR/RL）
 * @param metadata - 图元数据（预留，用于读取 subgraph 方向等）
 * @returns 带位置的节点数组 + 自环标记的边数组
 */
export function layoutWithDagre(
  nodes: MermaidNode[],
  edges: MermaidEdge[],
  direction: FlowchartDirection = 'TD',
  metadata?: GraphMetadata,
): { nodes: MermaidNode[]; edges: MermaidEdge[] } {
  // 空画布直接返回
  if (nodes.length === 0) return { nodes, edges };

  const g = new dagre.graphlib.Graph({ compound: true });
  g.setGraph({
    rankdir: toDagreRankDir(direction),
    ranksep: RANK_SEP,
    nodesep: NODE_SEP,
    marginx: 20,
    marginy: 20,
    edgesep: 20,
  });
  g.setDefaultEdgeLabel(() => ({}));

  // 添加节点（含 subgraph 容器节点）
  for (const node of nodes) {
    const { width, height } = getNodeSize(node);
    g.setNode(node.id, { width, height });
    // subgraph 父子关系（compound graph）
    if (node.parentId) {
      g.setParent(node.id, node.parentId);
    }
  }

  // 添加边（排除自环边，自环边不参与 dagre 排名）
  const selfLoopEdgeIds = new Set<string>();
  for (const edge of edges) {
    if (edge.source === edge.target) {
      selfLoopEdgeIds.add(edge.id);
      continue; // 自环边不加入 dagre
    }
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      const minlen = readEdgeLength(edge);
      g.setEdge(edge.source, edge.target, minlen > 1 ? { minlen } : {});
    }
  }

  // 计算布局
  dagre.layout(g);

  // 1. 收集 dagre 输出的绝对位置（节点中心 → 左上角）
  const absolutePositions = new Map<string, { x: number; y: number }>();
  for (const node of nodes) {
    const dagreNode = g.node(node.id);
    if (!dagreNode) continue;
    const { width, height } = getNodeSize(node);
    absolutePositions.set(node.id, {
      x: dagreNode.x - width / 2,
      y: dagreNode.y - height / 2,
    });
  }

  // 2. 将子节点位置转换为相对父 subgraph 的坐标，并向下偏移标题栏高度
  const relativePositions = new Map<string, { x: number; y: number }>();
  for (const node of nodes) {
    const abs = absolutePositions.get(node.id);
    if (!abs) continue;
    if (node.parentId && absolutePositions.has(node.parentId)) {
      const parentAbs = absolutePositions.get(node.parentId)!;
      relativePositions.set(node.id, {
        x: abs.x - parentAbs.x,
        y: abs.y - parentAbs.y + SUBGRAPH_TITLE_HEIGHT,
      });
    } else {
      relativePositions.set(node.id, { ...abs });
    }
  }

  // 3. 计算子图真实尺寸：优先使用 dagre 计算的 cluster 尺寸
  const subgraphSizeMap = new Map<string, { width: number; height: number }>();
  for (const node of nodes) {
    if (!isSubgraph(node)) continue;
    const dagreNode = g.node(node.id);
    if (!dagreNode) continue;

    const children = nodes.filter((n) => n.parentId === node.id);
    if (children.length === 0) {
      // 空子图使用默认尺寸
      subgraphSizeMap.set(node.id, {
        width: node.width ?? SUBGRAPH_DEFAULT_WIDTH,
        height: node.height ?? SUBGRAPH_DEFAULT_HEIGHT,
      });
      continue;
    }

    // 基于子节点包围盒计算内容区尺寸
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const child of children) {
      const childPos = relativePositions.get(child.id);
      const childSize = getNodeSize(child);
      if (!childPos) continue;
      minX = Math.min(minX, childPos.x);
      minY = Math.min(minY, childPos.y);
      maxX = Math.max(maxX, childPos.x + childSize.width);
      maxY = Math.max(maxY, childPos.y + childSize.height);
    }

    const contentWidth = Number.isFinite(minX) ? maxX - minX : 0;
    const contentHeight = Number.isFinite(minY) ? maxY - minY : 0;

    const width = Math.max(
      SUBGRAPH_MIN_WIDTH,
      contentWidth + SUBGRAPH_HORIZONTAL_PADDING * 2,
      dagreNode.width,
    );
    const height = Math.max(
      SUBGRAPH_MIN_HEIGHT,
      contentHeight + SUBGRAPH_VERTICAL_PADDING + SUBGRAPH_TITLE_HEIGHT,
      dagreNode.height + SUBGRAPH_TITLE_HEIGHT,
    );

    subgraphSizeMap.set(node.id, { width, height });
  }

  // 4. 映射回 MermaidNode
  const newNodes = nodes.map((node) => {
    const dagreNode = g.node(node.id);
    if (!dagreNode) return node;
    const pos = relativePositions.get(node.id);
    if (!pos) return node;

    const baseSize = getNodeSize(node);
    const size = isSubgraph(node)
      ? (subgraphSizeMap.get(node.id) ?? baseSize)
      : baseSize;

    return {
      ...node,
      position: { x: pos.x, y: pos.y },
      width: size.width,
      height: size.height,
    };
  });

  // 自环边标记（在 edge.data 上标记 isSelfLoop，渲染器据此绘制绕圈路径）
  const newEdges = edges.map((edge) => {
    if (!selfLoopEdgeIds.has(edge.id)) return edge;
    return {
      ...edge,
      data: { ...edge.data, isSelfLoop: true },
    };
  });

  return { nodes: newNodes, edges: newEdges };
}

// ============================================================
// 辅助函数
// ============================================================

/** 将 FlowchartDirection 转换为 dagre rankdir */
function toDagreRankDir(direction: FlowchartDirection): string {
  switch (direction) {
    case 'TB':
    case 'TD':
      return 'TB';
    case 'BT':
      return 'BT';
    case 'LR':
      return 'LR';
    case 'RL':
      return 'RL';
    default:
      return 'TB';
  }
}

/**
 * 获取节点尺寸（动态尺寸）
 * 优先级: node.width/height → 根据 label/shape 计算 → subgraph 默认尺寸
 */
function getNodeSize(node: MermaidNode): { width: number; height: number } {
  // subgraph 节点需要更大尺寸以容纳子节点
  const isSubgraph = readNodeDataField<boolean>(node, 'isSubgraph') === true;
  if (isSubgraph) {
    return {
      width: node.width ?? SUBGRAPH_DEFAULT_WIDTH,
      height: node.height ?? SUBGRAPH_DEFAULT_HEIGHT,
    };
  }

  // 若节点已有显式尺寸，直接复用
  if (node.width !== undefined && node.height !== undefined) {
    return { width: node.width, height: node.height };
  }

  // 根据形状类型和标签文本计算真实渲染尺寸
  const shape = readNodeDataField<MermaidShapeType>(node, 'shape') ?? 'rect';
  const label = readNodeDataField<string>(node, 'label') ?? '';
  return computeNodeSize(shape, label);
}

/**
 * 读取边的 length 字段（minlen）
 * Mermaid 语法: A --- B（length=1）, A ---- B（length=2）, A ----- B（length=3）
 */
function readEdgeLength(edge: MermaidEdge): number {
  const length = readEdgeDataField<number>(edge, 'length');
  if (typeof length === 'number' && length > 1) {
    return length;
  }
  return 1;
}

/** 安全读取 MermaidNodeData 的扩展字段 */
function readNodeDataField<T>(node: MermaidNode, key: string): T | undefined {
  const value = (node.data as Record<string, unknown>)[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  return value as T;
}

/** 判断节点是否为 subgraph */
function isSubgraph(node: MermaidNode): boolean {
  return readNodeDataField<boolean>(node, 'isSubgraph') === true;
}

// SUBGRAPH_AUTO_RESIZE_MARKER_v20260624

/** 安全读取 MermaidEdgeData 的扩展字段 */
function readEdgeDataField<T>(edge: MermaidEdge, key: string): T | undefined {
  const value = (edge.data as Record<string, unknown>)[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  return value as T;
}
