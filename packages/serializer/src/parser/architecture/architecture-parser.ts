/**
 * Architecture 解析器入口
 *
 * 单一职责：将 Mermaid architecture-beta 代码解析为 GraphCanvasState
 *
 * 数据流:
 *   源代码字符串
 *     → parseArchitecture(source)（M0 handwritten 基础）
 *     → ArchitectureAST
 *     → mapToGraphCanvasState(ast)
 *     → GraphCanvasState
 *
 * 错误处理:
 *   - 词法/语法错误被收集为 ParseError[]
 *   - 解析成功时 errors 为空数组
 */

import { parseArchitecture } from '../../parser/handwritten/architecture-parser-impl.js';
import { preprocessCode } from '../../detector/preprocessor.js';
import type {
  GraphCanvasState,
  MermaidNode,
  MermaidEdge,
  MermaidNodeData,
  MermaidEdgeData,
  GraphMetadata,
  ArchitectureDirection,
  ArchitectureGroupInfo,
  ArchitectureEdgeInfo,
  ArchitectureLayoutHint,
  ParseError,
  ParseResult,
} from '../../types.js';
import type {
  ArchitectureAST,
  ArchitectureServiceAST,
  ArchitectureJunctionAST,
  ArchitectureGroupAST,
  ArchitectureEdgeAST,
} from '../../ast/index.js';

// ============================================================
// 主入口
// ============================================================

/**
 * 解析 architecture-beta 代码
 *
 * 预处理（架构修复）:
 *   - 内部调用 preprocessCode 清理 frontmatter/指令/注释（保持行号一致）
 *   - 手写 parser 解析清理后的 code
 *
 * @param source - architecture-beta 源代码（可含 %% 注释、%%{directive}%%、frontmatter）
 * @returns ParseResult，成功时 canvas 为 GraphCanvasState
 */
export function parseArchitectureCode(source: string): ParseResult {
  // 预处理：清理 frontmatter/指令/注释（替换为等长换行，保持行号一致）
  // 手写 parser 的 tokenizer 不支持 %% 注释和 %%{directive}%%，必须预处理
  const preprocessedSource = preprocessCode(source);
  const { ast, errors } = parseArchitecture(preprocessedSource);

  if (errors.length > 0) {
    return {
      success: false,
      canvas: createEmptyCanvas(),
      errors,
    };
  }

  const canvas = mapToGraphCanvasState(ast);
  return {
    success: true,
    canvas,
    errors: [],
  };
}

// ============================================================
// AST → GraphCanvasState 映射
// ============================================================

/**
 * 将 ArchitectureAST 映射为 GraphCanvasState
 *
 * 映射规则（v4 根因修复）:
 *   - ArchitectureServiceAST → MermaidNode (type='arch-service', data.archIcon/archIconText)
 *   - ArchitectureJunctionAST → MermaidNode (type='arch-junction', data.archIsJunction=true)
 *   - ArchitectureGroupAST → MermaidNode (type='arch-group') + GraphMetadata.groups[] (仅 id+icon)
 *     - group.title → node.data.label（单一数据源）
 *     - group.in → node.parentId（单一数据源）
 *   - ArchitectureEdgeAST → MermaidEdge (data.archEdge: ArchitectureEdgeInfo)
 */
function mapToGraphCanvasState(ast: ArchitectureAST): GraphCanvasState {
  const nodes: MermaidNode[] = [];
  const edges: MermaidEdge[] = [];

  // ============================================================
  // 1. 映射 groups → MermaidNode (arch-group) + GraphMetadata.groups
  // v4 根因修复：group 也作为节点存在于 nodes[]，title/in/icon 全部通过 node 属性表达
  // ============================================================
  const groups: ArchitectureGroupInfo[] = [];
  for (const group of ast.groups) {
    // 创建 group 节点（与其他节点类型统一）
    const groupNode = mapGroupToNode(group, nodes.length);
    nodes.push(groupNode);
    // metadata.groups 仅保留 id（作为 group 索引）
    // v4 根因修复：icon 通过 node.data.archIcon 表达（与 service 统一）
    groups.push({ id: group.id });
  }

  // ============================================================
  // 2. 映射 services → MermaidNode
  // ============================================================
  for (const service of ast.services) {
    const node = mapServiceToNode(service, nodes.length);
    nodes.push(node);
  }

  // ============================================================
  // 3. 映射 junctions → MermaidNode
  // ============================================================
  for (const junction of ast.junctions) {
    const node = mapJunctionToNode(junction, nodes.length);
    nodes.push(node);
  }

  // ============================================================
  // 4. 映射 edges → MermaidEdge
  // ============================================================
  let edgeIndex = 0;
  for (const edge of ast.edges) {
    const mermaidEdge = mapEdge(edge, edgeIndex);
    edges.push(mermaidEdge);
    edgeIndex++;
  }

  // ============================================================
  // 5. 构建 metadata
  // v4 新增：映射 layoutHints → GraphMetadata.layoutHints
  // ============================================================
  const metadata: GraphMetadata = {};
  if (groups.length > 0) {
    metadata.groups = groups;
  }
  if (ast.layoutHints.length > 0) {
    metadata.layoutHints = ast.layoutHints.map((hint) => ({
      direction: hint.direction,
      members: [...hint.members],
    })) satisfies ArchitectureLayoutHint[];
  }
  if (ast.accTitle) {
    metadata.accTitle = ast.accTitle;
  }
  if (ast.accDescription) {
    metadata.accDescription = ast.accDescription;
  }

  // ============================================================
  // 6. 构建 GraphCanvasState
  // ============================================================
  return {
    diagramType: 'architecture',
    nodes,
    edges,
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
  };
}

/**
 * 将 ArchitectureGroupAST 映射为 MermaidNode
 *
 * v4 根因修复：group 作为节点存在于 nodes[]
 *   - title → node.data.label（单一数据源）
 *   - in → node.parentId（单一数据源）
 *   - icon → 仅存在于 node.data.archIcon（v4 根因修复：不再存入 metadata.groups[i].icon）
 */
function mapGroupToNode(group: ArchitectureGroupAST, index: number): MermaidNode {
  const data: MermaidNodeData = {
    label: group.title ?? group.id,
    shape: 'arch-group',
    ...(group.icon ? { archIcon: group.icon } : {}),
  };

  const position = { x: (index % 5) * 200, y: Math.floor(index / 5) * 150 };

  return {
    id: group.id,
    type: 'arch-group',
    position,
    data,
    ...(group.in ? { parentId: group.in, extent: 'parent' as const } : {}),
  };
}

/**
 * 将 ArchitectureServiceAST 映射为 MermaidNode
 *
 * 节点位置由布局算法计算，这里使用默认位置（按索引排列）
 * 如果 service.in 存在，设置 parentId 和 extent='parent'（React Flow Parent Node 机制）
 */
function mapServiceToNode(service: ArchitectureServiceAST, index: number): MermaidNode {
  const data: MermaidNodeData = {
    label: service.title ?? service.id,
    shape: 'arch-service',
    ...(service.icon ? { archIcon: service.icon } : {}),
    ...(service.iconText ? { archIconText: service.iconText } : {}),
  };

  // 设置位置（按索引排列，布局算法会重新计算）
  const position = { x: (index % 5) * 200, y: Math.floor(index / 5) * 150 };

  return {
    id: service.id,
    type: 'arch-service',
    position,
    data,
    ...(service.in ? { parentId: service.in, extent: 'parent' as const } : {}),
  };
}

/**
 * 将 ArchitectureJunctionAST 映射为 MermaidNode
 *
 * 如果 junction.in 存在，设置 parentId 和 extent='parent'
 */
function mapJunctionToNode(junction: ArchitectureJunctionAST, index: number): MermaidNode {
  const data: MermaidNodeData = {
    label: junction.id,
    shape: 'arch-junction',
    archIsJunction: true,
  };

  const position = { x: (index % 5) * 200, y: Math.floor(index / 5) * 150 };

  return {
    id: junction.id,
    type: 'arch-junction',
    position,
    data,
    ...(junction.in ? { parentId: junction.in, extent: 'parent' as const } : {}),
  };
}

/**
 * 将 ArchitectureEdgeAST 映射为 MermaidEdge
 *
 * 边的 sourceHandle/targetHandle 由 archEdge.lhsDir/rhsDir 决定
 */
function mapEdge(edge: ArchitectureEdgeAST, index: number): MermaidEdge {
  const archEdge: ArchitectureEdgeInfo = {
    lhsId: edge.lhsId,
    lhsDir: edge.lhsDir,
    lhsInto: edge.lhsInto,
    ...(edge.lhsGroup ? { lhsGroup: edge.lhsGroup } : {}),
    rhsId: edge.rhsId,
    rhsDir: edge.rhsDir,
    rhsInto: edge.rhsInto,
    ...(edge.rhsGroup ? { rhsGroup: edge.rhsGroup } : {}),
    ...(edge.title ? { title: edge.title } : {}),
  };

  const data: MermaidEdgeData = {
    edgeStyle: edge.rhsInto || edge.lhsInto ? 'arrow' : 'line',
    archEdge,
  };

  return {
    id: `arch-edge-${index}`,
    source: edge.lhsId,
    target: edge.rhsId,
    type: 'smoothstep',
    data,
    // sourceHandle/targetHandle 由 archEdge.lhsDir/rhsDir 决定
    sourceHandle: directionToHandleId(edge.lhsDir),
    targetHandle: directionToHandleId(edge.rhsDir),
  };
}

/**
 * 将方向（L/R/T/B）映射为 React Flow Handle ID
 */
function directionToHandleId(dir: ArchitectureDirection): string {
  switch (dir) {
    case 'L': return 'left';
    case 'R': return 'right';
    case 'T': return 'top';
    case 'B': return 'bottom';
    default: return 'left';
  }
}

/** 创建空 architecture GraphCanvasState */
function createEmptyCanvas(): GraphCanvasState {
  return {
    diagramType: 'architecture',
    nodes: [],
    edges: [],
  };
}
