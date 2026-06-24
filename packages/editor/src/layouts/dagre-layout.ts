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
export const SUBGRAPH_MIN_WIDTH = 200;
export const SUBGRAPH_MIN_HEIGHT = 100;
/** 标题栏高度，需与 subgraph-node.tsx 保持一致 */
export const SUBGRAPH_TITLE_HEIGHT = 28;
/** 子图内容区水平内边距，与 dagre 布局后左右间距一致（实测约 NODE_SEP * 0.75） */
export const SUBGRAPH_HORIZONTAL_PADDING = 45;
/** 子图内容区垂直内边距，与 dagre 布局后上下间距一致（实测约 RANK_SEP/2） */
const SUBGRAPH_VERTICAL_PADDING = 60;

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

  // 1. 收集 dagre 输出的绝对位置（节点中心 → 左上角）和尺寸
  // Bug2 修复：对 subgraph 节点使用 dagre 输出尺寸（dagre compound 模式会自动扩展父节点尺寸以包含所有子节点），
  // 而非输入尺寸（默认 300x200），确保一次布局即得到正确的子节点相对位置和 subgraph 包围盒
  const absolutePositions = new Map<string, { x: number; y: number; width: number; height: number }>();
  for (const node of nodes) {
    const dagreNode = g.node(node.id);
    if (!dagreNode) continue;
    // subgraph 节点使用 dagre 计算的真实尺寸，普通节点使用输入尺寸
    const nodeIsSubgraph = isSubgraph(node);
    const width = nodeIsSubgraph ? dagreNode.width : getNodeSize(node).width;
    const height = nodeIsSubgraph ? dagreNode.height : getNodeSize(node).height;
    absolutePositions.set(node.id, {
      x: dagreNode.x - width / 2,
      y: dagreNode.y - height / 2,
      width,
      height,
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

  // 3. 计算子图真实尺寸：递归包含所有后代节点
  // 构建 parentId → 直接子节点 映射
  const childrenMap = new Map<string, MermaidNode[]>();
  for (const node of nodes) {
    if (!node.parentId) continue;
    const siblings = childrenMap.get(node.parentId) ?? [];
    siblings.push(node);
    childrenMap.set(node.parentId, siblings);
  }

  // 计算子图嵌套深度，用于自底向上处理
  function getNestingDepth(nodeId: string): number {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node?.parentId) return 0;
    return 1 + getNestingDepth(node.parentId);
  }

  // 收集所有子图节点，按嵌套深度降序排列（最深优先，保证内层先计算）
  const subgraphNodes = nodes.filter(isSubgraph);
  subgraphNodes.sort((a, b) => getNestingDepth(b.id) - getNestingDepth(a.id));

  const subgraphSizeMap = new Map<string, { width: number; height: number }>();

  for (const node of subgraphNodes) {
    const dagreNode = g.node(node.id);
    if (!dagreNode) continue;

    // 只遍历直接子节点（relativePositions 是相对于直接父节点的坐标）
    // 嵌套子图的 subgraphSizeMap 已包含其自身所有后代的尺寸，无需重复遍历
    const directChildren = childrenMap.get(node.id) ?? [];
    if (directChildren.length === 0) {
      // 空子图使用默认尺寸
      subgraphSizeMap.set(node.id, {
        width: node.width ?? SUBGRAPH_DEFAULT_WIDTH,
        height: node.height ?? SUBGRAPH_DEFAULT_HEIGHT,
      });
      continue;
    }

    // 基于直接子节点包围盒计算内容区尺寸
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const child of directChildren) {
      const childPos = relativePositions.get(child.id);
      if (!childPos) continue;

      // 如果子节点是子图且已有计算尺寸，使用计算尺寸；否则用 getNodeSize
      const computedSize = subgraphSizeMap.get(child.id);
      const childSize = computedSize ?? getNodeSize(child);

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
      contentHeight + SUBGRAPH_VERTICAL_PADDING * 2 + SUBGRAPH_TITLE_HEIGHT,
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

  // 自环边标记 + 回路边标记
  const newEdges = edges.map((edge) => {
    const dataUpdates: Record<string, unknown> = {};

    // 自环边标记（在 edge.data 上标记 isSelfLoop，渲染器据此绘制绕圈路径）
    if (selfLoopEdgeIds.has(edge.id)) {
      dataUpdates.isSelfLoop = true;
    }

    // 回路边标记：source 节点在 dagre rank 中低于 target 节点
    // dagre 布局后通过绝对坐标判断：
    //   TD/TB: rank 从上到下，source.y > target.y → 回路边
    //   BT: rank 从下到上，source.y < target.y → 回路边
    //   LR: rank 从左到右，source.x > target.x → 回路边
    //   RL: rank 从右到左，source.x < target.x → 回路边
    const sourceAbs = absolutePositions.get(edge.source);
    const targetAbs = absolutePositions.get(edge.target);
    if (sourceAbs && targetAbs && edge.source !== edge.target) {
      let isBackEdge = false;
      switch (direction) {
        case 'TD':
        case 'TB':
          isBackEdge = sourceAbs.y > targetAbs.y;
          break;
        case 'BT':
          isBackEdge = sourceAbs.y < targetAbs.y;
          break;
        case 'LR':
          isBackEdge = sourceAbs.x > targetAbs.x;
          break;
        case 'RL':
          isBackEdge = sourceAbs.x < targetAbs.x;
          break;
      }
      if (isBackEdge) {
        dataUpdates.isBackEdge = true;
        // 为回路边计算几何正确的连接点方向：
        // 根据 source/target 中心点相对位置选择连接方向，优先让边绕到节点外侧
        const sourceCenter = {
          x: sourceAbs.x + sourceAbs.width / 2,
          y: sourceAbs.y + sourceAbs.height / 2,
        };
        const targetCenter = {
          x: targetAbs.x + targetAbs.width / 2,
          y: targetAbs.y + targetAbs.height / 2,
        };
        const { sourcePosition, targetPosition } = calculateBackEdgePositions(
          sourceCenter,
          targetCenter,
          direction,
        );
        dataUpdates.sourcePosition = sourcePosition;
        dataUpdates.targetPosition = targetPosition;
      }
    }

    if (Object.keys(dataUpdates).length === 0) return edge;
    return { ...edge, data: { ...edge.data, ...dataUpdates } };
  });

  return { nodes: newNodes, edges: newEdges };
}

// ============================================================
// 辅助函数
// ============================================================

/**
 * 为回路边计算几何正确的 source/target 连接方向
 *
 * 基于 source/target 节点中心点相对位置判断，策略：
 * - TD/BT（垂直布局）：回路边走水平方向（Left/Right），从节点侧面绕行
 * - LR/RL（水平布局）：回路边走垂直方向（Top/Bottom），从节点侧面绕行
 */
function calculateBackEdgePositions(
  sourceCenter: { x: number; y: number },
  targetCenter: { x: number; y: number },
  direction: FlowchartDirection,
): { sourcePosition: string; targetPosition: string } {
  switch (direction) {
    case 'TD':
    case 'TB':
    case 'BT': {
      // 垂直布局：回路边统一从右侧水平绕行，避免与正向边在中心垂直通道交叉
      // 即使 source/target x 坐标相同也强制 right/right，禁止 fallback 到 top/bottom
      return { sourcePosition: 'right', targetPosition: 'right' };
    }
    case 'LR':
    case 'RL': {
      // 水平布局：回路边统一从底部垂直绕行，避免与正向边在中心水平通道交叉
      // 即使 source/target y 坐标相同也强制 bottom/bottom，禁止 fallback 到 left/right
      return { sourcePosition: 'bottom', targetPosition: 'bottom' };
    }
    default:
      return { sourcePosition: 'right', targetPosition: 'right' };
  }
}

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

// ============================================================
// 实时子图尺寸重计算（用户拖拽节点时调用）
// ============================================================

/**
 * 根据子节点当前位置实时重算所有 subgraph 的位置和尺寸
 *
 * 数据流:
 *   nodes（含子节点相对位置）→ 按 parentId 分组 → 计算包围盒 → 更新 subgraph position/width/height
 *
 * 设计:
 *   - 按嵌套深度自底向上计算（最深子图先算，外层子图包含内层子图尺寸）
 *   - 只遍历直接子节点，嵌套子图的尺寸已计算完毕
 *   - 子节点位置是相对于父 subgraph 的坐标（React Flow Parent Node 机制）
 *   - 同步调整 subgraph position 和子节点相对坐标，保持子节点视觉绝对位置不变
 *
 * @param nodes - 当前画布所有节点
 * @returns 更新了 position/width/height 的节点数组
 */
export function recalculateSubgraphSizes(nodes: MermaidNode[]): MermaidNode[] {
  if (nodes.length === 0) return nodes;

  // 创建可变节点映射，用于就地更新
  const nodeMap = new Map<string, MermaidNode>();
  for (const node of nodes) {
    nodeMap.set(node.id, { ...node });
  }

  // 构建 parentId → 直接子节点 ID 映射
  const childrenMap = new Map<string, string[]>();
  for (const node of nodes) {
    if (!node.parentId) continue;
    const siblings = childrenMap.get(node.parentId) ?? [];
    siblings.push(node.id);
    childrenMap.set(node.parentId, siblings);
  }

  // 计算子图嵌套深度
  function getNestingDepth(nodeId: string): number {
    const node = nodeMap.get(nodeId);
    if (!node?.parentId) return 0;
    return 1 + getNestingDepth(node.parentId);
  }

  // 收集所有子图节点，按嵌套深度降序排列（最深优先）
  const subgraphNodes = nodes.filter(isSubgraph);
  subgraphNodes.sort((a, b) => getNestingDepth(b.id) - getNestingDepth(a.id));

  for (const subgraphNode of subgraphNodes) {
    const subgraph = nodeMap.get(subgraphNode.id);
    if (!subgraph) continue;

    const childIds = childrenMap.get(subgraphNode.id) ?? [];
    if (childIds.length === 0) {
      // 空子图保持原尺寸和位置
      continue;
    }

    // 基于直接子节点包围盒计算内容区尺寸
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const childId of childIds) {
      const child = nodeMap.get(childId);
      if (!child) continue;

      // 如果子节点是子图，使用已计算的尺寸；否则使用 node.width/height 或 getNodeSize
      const childSize = isSubgraph(child)
        ? { width: child.width ?? SUBGRAPH_DEFAULT_WIDTH, height: child.height ?? SUBGRAPH_DEFAULT_HEIGHT }
        : getNodeSize(child);

      minX = Math.min(minX, child.position.x);
      minY = Math.min(minY, child.position.y);
      maxX = Math.max(maxX, child.position.x + childSize.width);
      maxY = Math.max(maxY, child.position.y + childSize.height);
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
      continue;
    }

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    // 计算子图原点应如何移动，使子节点包围盒紧贴内容区内边界
    // 四周留出与 dagre 布局一致的安全距离
    const offsetX = minX - SUBGRAPH_HORIZONTAL_PADDING;
    const offsetY = minY - SUBGRAPH_TITLE_HEIGHT - SUBGRAPH_VERTICAL_PADDING;

    // 更新子图位置（视觉绝对位置不变，子节点相对坐标同步反向调整）
    subgraph.position = {
      x: subgraph.position.x + offsetX,
      y: subgraph.position.y + offsetY,
    };

    // 同步调整所有直接子节点的相对坐标
    for (const childId of childIds) {
      const child = nodeMap.get(childId);
      if (!child) continue;
      child.position = {
        x: child.position.x - offsetX,
        y: child.position.y - offsetY,
      };
    }

    // 基于原始内容区尺寸重新计算子图尺寸
    const width = Math.max(
      SUBGRAPH_MIN_WIDTH,
      contentWidth + SUBGRAPH_HORIZONTAL_PADDING * 2,
    );
    const height = Math.max(
      SUBGRAPH_MIN_HEIGHT,
      contentHeight + SUBGRAPH_VERTICAL_PADDING * 2 + SUBGRAPH_TITLE_HEIGHT,
    );

    subgraph.width = width;
    subgraph.height = height;
  }

  // 返回更新后的节点数组
  return nodes.map((node) => nodeMap.get(node.id) ?? node);
}
