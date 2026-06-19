/**
 * 布局算法 — 使用 dagre 为无位置信息的画布节点生成初始坐标
 * Mermaid 是声明式语言，AST 不含位置信息，必须通过布局算法生成 React Flow 所需的 position
 */
import dagre from 'dagre';
import type { FlowchartDirection, MermaidEdge, MermaidNode } from './types.js';

/** 布局默认配置 */
const LAYOUT_CONFIG = {
  rankdir: 'TB', // 默认从上到下，由 direction 覆盖
  nodesep: 60, // 同层节点间距
  ranksep: 80, // 层间距
  marginx: 40, // 水平边距
  marginy: 40, // 垂直边距
} as const;

/** 节点默认尺寸（dagre 需要知道节点尺寸来计算布局） */
const NODE_SIZE = {
  width: 140,
  height: 50,
} as const;

/** 方向映射：Mermaid 方向 → dagre rankdir */
const DIRECTION_MAP: Record<FlowchartDirection, string> = {
  TB: 'TB',
  TD: 'TB', // TD 等同于 TB
  BT: 'BT',
  LR: 'LR',
  RL: 'RL',
};

/**
 * 为画布节点生成布局位置
 * @param nodes 节点列表（position 会被原地修改）
 * @param edges 边列表（只读，用于计算布局）
 * @param direction 流程图方向
 */
export function layoutCanvas(
  nodes: MermaidNode[],
  edges: MermaidEdge[],
  direction: FlowchartDirection,
): void {
  // 空画布无需布局
  if (nodes.length === 0) {
    return;
  }

  const graph = new dagre.graphlib.Graph();
  graph.setGraph({
    ...LAYOUT_CONFIG,
    rankdir: DIRECTION_MAP[direction] ?? 'TB',
  });
  graph.setDefaultEdgeLabel(() => ({}));

  // 添加节点（使用节点尺寸，优先用 measured/declared 尺寸）
  for (const node of nodes) {
    graph.setNode(node.id, {
      width: node.width ?? NODE_SIZE.width,
      height: node.height ?? NODE_SIZE.height,
    });
  }

  // 添加边
  for (const edge of edges) {
    graph.setEdge(edge.source, edge.target);
  }

  // 执行布局
  dagre.layout(graph);

  // 将 dagre 计算的位置写回节点（dagre 返回中心点，React Flow 需要左上角）
  for (const node of nodes) {
    const dagreNode = graph.node(node.id);
    if (dagreNode) {
      const width = node.width ?? NODE_SIZE.width;
      const height = node.height ?? NODE_SIZE.height;
      node.position = {
        x: dagreNode.x - width / 2,
        y: dagreNode.y - height / 2,
      };
    }
  }
}
