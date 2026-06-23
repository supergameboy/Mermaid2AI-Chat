/**
 * mindmap 解析器
 *
 * 单一职责：将 Mermaid mindmap 代码解析为 GraphCanvasState
 *
 * 数据流:
 *   源代码字符串
 *     → 静态 import jison 生成的 mindmap-parser.js（ESM）
 *     → 创建 MindmapDB 实例，作为 yy 传入 parser
 *     → parser.parse(source) 调用 MindmapDB.addNode/decorateNode 收集数据
 *     → MindmapDB.getData() 返回 MindmapDBData
 *     → mapToGraphCanvasState(data) 映射为 GraphCanvasState
 *
 * 错误处理:
 *   - jison 抛出的语法错误被捕获，转换为 ParseError[]
 *   - 解析成功时 errors 为空数组
 *
 * 注意:
 *   - mindmap 的 edges 不存储在 CanvasState.edges 中，而是从 nodes 的 parentId 派生
 *     （在渲染时动态计算）。nodes 是唯一数据源，edges 是派生数据。
 */

import { parser as mindmapJisonParser } from '../jison/mindmap-parser.js';
import { preprocessCode } from '../../detector/preprocessor.js';
import type {
  GraphCanvasState,
  MermaidNode,
  MermaidNodeData,
  MermaidShapeType,
  MindmapNodeType,
  MindmapDecorationInfo,
  GraphMetadata,
  ParseError,
  ParseResult,
} from '../../types.js';
import type { MindmapDBData, MindmapLayoutNode } from './mindmap-types.js';
import { MindmapNodeTypeConst } from './mindmap-types.js';
import { MindmapDB } from './mindmap-db.js';

// ============================================================
// jison parser（静态 import，浏览器兼容）
// ============================================================

interface JisonParserInstance {
  parse(input: string): unknown;
  yy: unknown;
}

/** mindmap jison 解析器实例 */
const mindmapJison: JisonParserInstance = mindmapJisonParser as unknown as JisonParserInstance;

// ============================================================
// MindmapDBData → GraphCanvasState 映射
// ============================================================

/**
 * 将 MindmapDBData 映射为 GraphCanvasState (diagramType='mindmap')
 *
 * 映射规则:
 *   - LayoutNode.type=CIRCLE → mindmapType='circle', shape='mindmap-circle'
 *   - LayoutNode.type=RECT → mindmapType='rect', shape='mindmap-rect'
 *   - LayoutNode.type=ROUNDED_RECT → mindmapType='rounded', shape='mindmap-rounded'
 *   - LayoutNode.type=CLOUD → mindmapType='cloud', shape='mindmap-cloud'
 *   - LayoutNode.type=BANG → mindmapType='bang', shape='mindmap-bang'
 *   - LayoutNode.type=HEXAGON → mindmapType='hexagon', shape='mindmap-hexagon'
 *   - LayoutNode.type=DEFAULT → mindmapType='default', shape='mindmap-default'
 *   - LayoutNode.isRoot=true → MermaidNode.data.isRoot=true
 *   - parentId 通过 LayoutNode.parentId 传递（用于派生 edges）
 *
 * 注意: edges 不持久化在 CanvasState.edges 中，由渲染层从 parentId 派生
 */
function mapToGraphCanvasState(data: MindmapDBData): GraphCanvasState {
  const nodes: MermaidNode[] = [];
  const decorations: MindmapDecorationInfo[] = [];

  // ============================================================
  // 1. 映射 nodes
  // ============================================================
  let nodeIndex = 0;
  for (const layoutNode of data.nodes) {
    const mermaidNode = mapNode(layoutNode, nodeIndex);
    nodes.push(mermaidNode);
    nodeIndex++;

    // 收集装饰信息
    if (layoutNode.icon || layoutNode.class) {
      decorations.push({
        nodeId: layoutNode.id,
        ...(layoutNode.icon ? { icon: layoutNode.icon } : {}),
        ...(layoutNode.class ? { className: layoutNode.class } : {}),
      });
    }
  }

  // ============================================================
  // 2. 构建 metadata
  // ============================================================
  const metadata = buildMetadata(decorations);

  // ============================================================
  // 3. 构建 GraphCanvasState
  //   - mindmap 不存储 edges（从 parentId 派生）
  //   - mindmap 无 direction
  // ============================================================
  return {
    diagramType: 'mindmap',
    nodes,
    edges: [],
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
  };
}

/**
 * 映射 MindmapLayoutNode 为 MermaidNode
 */
function mapNode(layoutNode: MindmapLayoutNode, index: number): MermaidNode {
  const { mindmapType, shape } = resolveMindmapTypeAndShape(layoutNode.type);

  // 构建 MermaidNodeData
  // nodeId 保存用户定义的 ID（用于序列化时还原）
  const data: MermaidNodeData = {
    label: layoutNode.label,
    shape,
    mindmapType,
    ...(layoutNode.icon ? { mindmapIcon: layoutNode.icon } : {}),
    ...(layoutNode.class ? { mindmapClass: layoutNode.class } : {}),
  };
  // 保存 nodeId（用户定义的 ID，用于序列化还原）
  (data as MermaidNodeData & { nodeId: string }).nodeId = layoutNode.nodeId;

  // 设置位置（mindmap 使用 cose-bilkent 布局，初始位置由布局算法计算）
  // 这里使用 index-based 默认位置，渲染层会重新布局
  const position = { x: index * 200, y: 0 };

  // 构建 MermaidNode
  // - id 使用数字 ID（保证唯一性）
  // - nodeId 保存在 data 中（用于序列化时还原用户定义的 ID）
  const node: MermaidNode = {
    id: layoutNode.id,
    type: `mindmap-${mindmapType}`,
    position,
    data,
    ...(layoutNode.parentId ? { parentId: layoutNode.parentId, extent: 'parent' as const } : {}),
  };

  // root 节点标记
  if (layoutNode.isRoot) {
    (node.data as MermaidNodeData & { isRoot?: boolean }).isRoot = true;
  }

  return node;
}

/**
 * 解析节点的 mindmapType 和 shape
 *
 * 映射规则:
 *   - MindmapNodeTypeConst.DEFAULT → mindmapType='default', shape='mindmap-default'
 *   - MindmapNodeTypeConst.ROUNDED_RECT → mindmapType='rounded', shape='mindmap-rounded'
 *   - MindmapNodeTypeConst.RECT → mindmapType='rect', shape='mindmap-rect'
 *   - MindmapNodeTypeConst.CIRCLE → mindmapType='circle', shape='mindmap-circle'
 *   - MindmapNodeTypeConst.CLOUD → mindmapType='cloud', shape='mindmap-cloud'
 *   - MindmapNodeTypeConst.BANG → mindmapType='bang', shape='mindmap-bang'
 *   - MindmapNodeTypeConst.HEXAGON → mindmapType='hexagon', shape='mindmap-hexagon'
 */
function resolveMindmapTypeAndShape(
  type: MindmapLayoutNode['type'],
): { mindmapType: MindmapNodeType; shape: MermaidShapeType } {
  switch (type) {
    case MindmapNodeTypeConst.DEFAULT:
    case MindmapNodeTypeConst.NO_BORDER:
      return { mindmapType: 'default', shape: 'mindmap-default' };
    case MindmapNodeTypeConst.ROUNDED_RECT:
      return { mindmapType: 'rounded', shape: 'mindmap-rounded' };
    case MindmapNodeTypeConst.RECT:
      return { mindmapType: 'rect', shape: 'mindmap-rect' };
    case MindmapNodeTypeConst.CIRCLE:
      return { mindmapType: 'circle', shape: 'mindmap-circle' };
    case MindmapNodeTypeConst.CLOUD:
      return { mindmapType: 'cloud', shape: 'mindmap-cloud' };
    case MindmapNodeTypeConst.BANG:
      return { mindmapType: 'bang', shape: 'mindmap-bang' };
    case MindmapNodeTypeConst.HEXAGON:
      return { mindmapType: 'hexagon', shape: 'mindmap-hexagon' };
    default:
      return { mindmapType: 'default', shape: 'mindmap-default' };
  }
}

// ============================================================
// metadata 构建
// ============================================================

/**
 * 构建 GraphMetadata
 *
 * 包含:
 *   - mindmapDecorations: 节点装饰信息（icon/class）
 */
function buildMetadata(decorations: MindmapDecorationInfo[]): GraphMetadata {
  const metadata: GraphMetadata = {};
  if (decorations.length > 0) {
    metadata.mindmapDecorations = decorations;
  }
  return metadata;
}

// ============================================================
// 公共 API
// ============================================================

/**
 * 解析 mindmap 代码为 GraphCanvasState
 *
 * 预处理（架构修复）:
 *   - 内部调用 preprocessCode 清理 frontmatter/指令/注释（保持行号一致）
 *   - jison 解析清理后的 code，错误上下文使用原始 source
 *
 * @param source - Mermaid mindmap 源代码（可含 %% 注释、%%{directive}%%、frontmatter）
 * @returns 解析结果（包含 canvas 和 errors）
 */
export function parseMindmapCode(source: string): ParseResult {
  // 预处理：清理 frontmatter/指令/注释（替换为等长换行，保持行号一致）
  // jison 无法解析 %% 注释和 %%{directive}%%，必须预处理
  const preprocessedSource = preprocessCode(source);

  // 处理空 mindmap（仅 'mindmap' 关键字，无节点）
  // jison 文法要求 mindmap 后必须有 document，空 mindmap 会报错
  // 此处提前返回空 canvas，避免 jison 解析错误
  // 基于预处理后的 source 判断（注释/指令已被清理，避免误判）
  const trimmedSource = preprocessedSource.trim();
  const lines = trimmedSource.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length <= 1) {
    // 只有 'mindmap' 关键字（或空），返回空 canvas
    const emptyCanvas: GraphCanvasState = {
      diagramType: 'mindmap',
      nodes: [],
      edges: [],
    };
    return {
      success: true,
      canvas: emptyCanvas,
      errors: [],
    };
  }

  const mindmapDB = new MindmapDB();

  // 将 MindmapDB 实例作为 yy 传入 parser
  // jison 语法动作通过 yy.addNode/yy.decorateNode/yy.getType/yy.getParent/yy.getMindmap/yy.nodeType 调用 MindmapDB 方法
  mindmapJison.yy = mindmapDB;

  try {
    // jison 语法要求 mindmap 关键字后必须有 NEWLINE
    const normalizedSource = preprocessedSource.endsWith('\n') ? preprocessedSource : preprocessedSource + '\n';
    mindmapJison.parse(normalizedSource);

    const data = mindmapDB.getData();
    const canvas = mapToGraphCanvasState(data);

    return {
      success: true,
      canvas,
      errors: [],
    };
  } catch (err) {
    const error: ParseError = {
      line: extractLine(err),
      column: extractColumn(err),
      message: extractMessage(err),
      severity: 'error',
      context: source.split('\n')[extractLine(err) - 1] ?? undefined,
    };

    // 返回空 canvas + 错误列表
    const emptyCanvas: GraphCanvasState = {
      diagramType: 'mindmap',
      nodes: [],
      edges: [],
    };

    return {
      success: false,
      canvas: emptyCanvas,
      errors: [error],
    };
  } finally {
    // 重置 parser.yy，避免泄漏
    mindmapJison.yy = {};
  }
}

// ============================================================
// 错误信息提取
// ============================================================

function extractLine(err: unknown): number {
  if (err && typeof err === 'object') {
    const line = (err as { line?: unknown }).line;
    if (typeof line === 'number') return line;
    const hash = (err as { hash?: { line?: unknown } }).hash;
    if (hash && typeof hash.line === 'number') return hash.line;
  }
  return 1;
}

function extractColumn(err: unknown): number {
  if (err && typeof err === 'object') {
    const column = (err as { column?: unknown }).column;
    if (typeof column === 'number') return column;
    const hash = (err as { hash?: { column?: unknown } }).hash;
    if (hash && typeof hash.column === 'number') return hash.column;
  }
  return 1;
}

function extractMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message || 'mindmap parse error';
  }
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return 'mindmap parse error';
}
