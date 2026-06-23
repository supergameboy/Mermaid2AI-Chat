/**
 * state 解析器
 *
 * 单一职责：将 Mermaid stateDiagram-v2 代码解析为 GraphCanvasState
 *
 * 数据流:
 *   源代码字符串
 *     → 加载 jison 生成的 state-parser.cjs
 *     → 创建 StateDB 实例（version: 2），作为 yy 传入 parser
 *     → parser.parse(source) 调用 StateDB.setRootDoc 收集数据
 *     → StateDB.getData() 返回 StateDBData
 *     → mapToGraphCanvasState(data, stateDB) 映射为 GraphCanvasState
 *
 * 错误处理:
 *   - jison 抛出的语法错误被捕获，转换为 ParseError[]
 *   - 解析成功时 errors 为空数组
 */

import { parser as stateParser } from '../jison/state-parser.js';
import { preprocessCode } from '../../detector/preprocessor.js';
import type {
  GraphCanvasState,
  MermaidNode,
  MermaidEdge,
  MermaidNodeData,
  MermaidEdgeData,
  MermaidShapeType,
  MermaidEdgeStyle,
  StateNodeType,
  StateNotePosition,
  FlowchartDirection,
  GraphMetadata,
  StateCompositeInfo,
  StateNoteInfo,
  StateClassDefInfo,
  ParseError,
  ParseResult,
} from '../../types.js';
import type {
  StateDBNode,
  StateDBEdge,
  StateDBData,
  StateStyleClass,
} from './state-types.js';
import { StateDB } from './state-db.js';
import {
  SHAPE_STATE,
  SHAPE_STATE_WITH_DESC,
  SHAPE_START,
  SHAPE_END,
  SHAPE_DIVIDER,
  SHAPE_GROUP,
  SHAPE_NOTE,
  SHAPE_NOTEGROUP,
  NOTE_ID,
} from './state-constants.js';

// ============================================================
// jison parser（静态 import，浏览器兼容）
// ============================================================

interface JisonParserInstance {
  parse(input: string): unknown;
  yy: unknown;
}

/** state jison 解析器实例 */
const stateJisonParser: JisonParserInstance = stateParser as unknown as JisonParserInstance;

// ============================================================
// StateDBData → GraphCanvasState 映射
// ============================================================

/**
 * 将 StateDBData 映射为 GraphCanvasState (diagramType='stateDiagram')
 *
 * 映射规则:
 *   - StateDBNode.shape === 'stateStart' → state-start / circle / stateType='start'
 *   - StateDBNode.shape === 'stateEnd' → state-end / double-circle / stateType='end'
 *   - StateDBNode.shape === 'divider' → state-divider / state-divider / stateType='divider'
 *   - StateDBNode.type === 'group' && shape === 'roundedWithTitle'
 *       → state-composite / rounded / stateType='default'
 *   - StateDBNode.shape === 'rect' → state-default / rect / stateType='default'
 *   - StateDBNode.shape === 'rectWithTitle'
 *       → state-default / rect / stateType='default' / stateDescription=description
 *   - StateDBNode.shape === 'note' → state-note / note
 *   - StateDBNode.shape === 'noteGroup' → state-note-group / state-note-group
 *   - 其他 shape（fork/join/choice）→ state-${shape} / 对应形状
 */
function mapToGraphCanvasState(data: StateDBData, stateDB: StateDB): GraphCanvasState {
  const nodes: MermaidNode[] = [];
  const edges: MermaidEdge[] = [];

  // ============================================================
  // 1. 映射 nodes
  // ============================================================
  let nodeIndex = 0;
  for (const dbNode of data.nodes) {
    const mermaidNode = mapNode(dbNode, nodeIndex);
    if (mermaidNode) {
      nodes.push(mermaidNode);
      nodeIndex++;
    }
  }

  // ============================================================
  // 2. 映射 edges
  // ============================================================
  let edgeIndex = 0;
  for (const dbEdge of data.edges) {
    const edge = mapEdge(dbEdge, edgeIndex);
    edges.push(edge);
    edgeIndex++;
  }

  // ============================================================
  // 3. 构建 metadata
  // ============================================================
  const metadata = buildMetadata(data, nodes, stateDB);

  // ============================================================
  // 4. 构建 GraphCanvasState
  // ============================================================
  const direction = resolveDirection(data.direction);

  return {
    diagramType: 'stateDiagram',
    nodes,
    edges,
    ...(direction ? { direction } : {}),
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
  };
}

/**
 * 映射 StateDBNode 为 MermaidNode
 *
 * @returns MermaidNode，如果节点应被跳过则返回 null
 */
function mapNode(dbNode: StateDBNode, index: number): MermaidNode | null {
  const { type, shape } = resolveNodeTypeAndShape(dbNode);
  const label = resolveLabel(dbNode.label);
  const stateDescription = resolveStateDescription(dbNode.description);

  // 构建 MermaidNodeData
  const data: MermaidNodeData = {
    label,
    shape,
    ...(type ? { stateType: type } : {}),
    ...(stateDescription ? { stateDescription } : {}),
    ...(dbNode.cssStyles && dbNode.cssStyles.length > 0
      ? { styles: [...dbNode.cssStyles] }
      : {}),
    ...(dbNode.cssCompiledStyles && dbNode.cssCompiledStyles.length > 0
      ? { styles: [...(dbNode.cssCompiledStyles ?? []), ...(dbNode.cssStyles ?? [])] }
      : {}),
    ...(dbNode.cssClasses
      ? { classNames: dbNode.cssClasses.split(' ').filter((cn) => cn && cn !== 'default') }
      : {}),
  };

  // 设置位置（state 图无显式位置，使用默认值）
  const position = { x: index * 250, y: 0 };

  return {
    id: dbNode.id,
    type: resolveMermaidNodeType(dbNode),
    position,
    data,
    ...(dbNode.parentId ? { parentId: dbNode.parentId, extent: 'parent' as const } : {}),
  };
}

/**
 * 解析节点的 stateType 和 shape
 *
 * 映射规则:
 *   - 'stateStart' → stateType='start', shape='circle'
 *   - 'stateEnd' → stateType='end', shape='double-circle'
 *   - 'divider' → stateType='divider', shape='state-divider'
 *   - 'roundedWithTitle' (group) → stateType='default', shape='rounded'
 *   - 'rect' → stateType='default', shape='rect'
 *   - 'rectWithTitle' → stateType='default', shape='rect'
 *   - 'note' → stateType=undefined, shape='note'
 *   - 'noteGroup' → stateType=undefined, shape='state-note-group'
 *   - 'fork' → stateType='fork', shape='fork-join'
 *   - 'join' → stateType='join', shape='fork-join'
 *   - 'choice' → stateType='choice', shape='diamond'
 */
function resolveNodeTypeAndShape(
  dbNode: StateDBNode,
): { type: StateNodeType | undefined; shape: MermaidShapeType } {
  switch (dbNode.shape) {
    case SHAPE_START:
      return { type: 'start', shape: 'circle' };
    case SHAPE_END:
      return { type: 'end', shape: 'doublecircle' };
    case SHAPE_DIVIDER:
      return { type: 'divider', shape: 'state-divider' };
    case SHAPE_GROUP:
      // 复合状态（group）
      return { type: 'default', shape: 'rounded' };
    case SHAPE_STATE:
      // 默认状态（rect）
      return { type: resolveStateTypeFromDbNode(dbNode), shape: 'rect' };
    case SHAPE_STATE_WITH_DESC:
      // 带描述的状态（rectWithTitle）
      return { type: resolveStateTypeFromDbNode(dbNode), shape: 'rect' };
    case SHAPE_NOTE:
      // note 节点
      return { type: undefined, shape: 'note' };
    case SHAPE_NOTEGROUP:
      // noteGroup 节点
      return { type: undefined, shape: 'state-note-group' };
    case 'fork':
      return { type: 'fork', shape: 'fork-join' };
    case 'join':
      return { type: 'join', shape: 'fork-join' };
    case 'choice':
      return { type: 'choice', shape: 'diamond' };
    default:
      // 未知 shape，使用默认值
      return { type: resolveStateTypeFromDbNode(dbNode), shape: 'rect' };
  }
}

/**
 * 从 StateDBNode.type 解析 StateNodeType
 *
 * StateDBNode.type 可能是 'group'、undefined 或 StateNodeType 之一
 * - 'group' → 'default'（复合状态的 stateType 是 'default'）
 * - undefined → 'default'
 * - StateNodeType → 直接返回
 */
function resolveStateTypeFromDbNode(dbNode: StateDBNode): StateNodeType {
  const type = dbNode.type;
  if (
    type === 'default' ||
    type === 'fork' ||
    type === 'join' ||
    type === 'choice' ||
    type === 'divider' ||
    type === 'start' ||
    type === 'end'
  ) {
    return type;
  }
  return 'default';
}

/**
 * 解析 MermaidNode 的 type 字段（React Flow 节点类型）
 *
 * 映射规则:
 *   - 'stateStart' → 'state-start'
 *   - 'stateEnd' → 'state-end'
 *   - 'divider' → 'state-divider'
 *   - 'roundedWithTitle' (group) → 'state-composite'
 *   - 'rect' → 'state-default'
 *   - 'rectWithTitle' → 'state-default'
 *   - 'note' → 'state-note'
 *   - 'noteGroup' → 'state-note-group'
 *   - 'fork' → 'state-fork'
 *   - 'join' → 'state-join'
 *   - 'choice' → 'state-choice'
 */
function resolveMermaidNodeType(dbNode: StateDBNode): string {
  switch (dbNode.shape) {
    case SHAPE_START:
      return 'state-start';
    case SHAPE_END:
      return 'state-end';
    case SHAPE_DIVIDER:
      return 'state-divider';
    case SHAPE_GROUP:
      return 'state-composite';
    case SHAPE_STATE:
      return 'state-default';
    case SHAPE_STATE_WITH_DESC:
      return 'state-default';
    case SHAPE_NOTE:
      return 'state-note';
    case SHAPE_NOTEGROUP:
      return 'state-note-group';
    case 'fork':
      return 'state-fork';
    case 'join':
      return 'state-join';
    case 'choice':
      return 'state-choice';
    default:
      return 'state-default';
  }
}

/**
 * 解析节点 label
 *
 * 如果 label 是数组，取第一个元素；如果是字符串，直接返回；否则返回空字符串
 */
function resolveLabel(label: string | string[] | undefined): string {
  if (label === undefined) {
    return '';
  }
  if (Array.isArray(label)) {
    return label[0] ?? '';
  }
  return label;
}

/**
 * 解析节点 description（stateDescription）
 *
 * 如果 description 是数组，join 为字符串；如果是字符串，直接返回；否则返回 undefined
 */
function resolveStateDescription(
  description: string | string[] | undefined,
): string | undefined {
  if (description === undefined) {
    return undefined;
  }
  if (Array.isArray(description)) {
    if (description.length === 0) {
      return undefined;
    }
    return description.join('\n');
  }
  if (description === '') {
    return undefined;
  }
  return description;
}

/**
 * 映射 StateDBEdge 为 MermaidEdge
 */
function mapEdge(dbEdge: StateDBEdge, index: number): MermaidEdge {
  const edgeStyle = resolveEdgeStyle(dbEdge);
  const label = dbEdge.label ?? '';

  const data: MermaidEdgeData = {
    edgeStyle,
    ...(label ? { label, transitionLabel: label } : {}),
  };

  return {
    id: dbEdge.id || `state-edge-${index}`,
    source: dbEdge.start,
    target: dbEdge.end,
    type: 'state-edge',
    data,
  };
}

/**
 * 解析边样式
 *
 * 映射规则:
 *   - arrowhead === 'none' → 'line'（无箭头）
 *   - arrowhead === 'normal' → 'arrow'（带箭头）
 *   - 其他 → 'arrow'
 */
function resolveEdgeStyle(dbEdge: StateDBEdge): MermaidEdgeStyle {
  if (dbEdge.arrowhead === 'none') {
    return 'line';
  }
  return 'arrow';
}

// ============================================================
// metadata 构建
// ============================================================

/**
 * 构建 GraphMetadata
 *
 * 包含:
 *   - composites: 复合状态信息（isGroup=true 且 shape='roundedWithTitle'）
 *   - stateNotes: Note 信息（shape='note'）
 *   - stateClassDefs: classDef 信息（从 StateDB.getClasses()）
 *   - stateDirection: 方向（从 StateDBData.direction）
 *   - accTitle/accDescription: Accessibility 信息
 */
function buildMetadata(
  data: StateDBData,
  nodes: MermaidNode[],
  stateDB: StateDB,
): GraphMetadata {
  const composites = buildComposites(data.nodes);
  const stateNotes = buildStateNotes(data.nodes);
  const stateClassDefs = buildStateClassDefs(stateDB.getClasses());
  const stateDirection = resolveDirection(data.direction);
  const accTitle = stateDB.getAccTitle();
  const accDescription = stateDB.getAccDescription();

  const metadata: GraphMetadata = {};
  if (composites.length > 0) {
    metadata.composites = composites;
  }
  if (stateNotes.length > 0) {
    metadata.stateNotes = stateNotes;
  }
  if (stateClassDefs.length > 0) {
    metadata.stateClassDefs = stateClassDefs;
  }
  if (stateDirection) {
    metadata.stateDirection = stateDirection;
  }
  if (accTitle) {
    metadata.accTitle = accTitle;
  }
  if (accDescription) {
    metadata.accDescription = accDescription;
  }

  // 引用 nodes 以避免未使用参数警告（nodes 已通过 mapToGraphCanvasState 间接使用）
  void nodes;

  return metadata;
}

/**
 * 构建复合状态信息
 *
 * 从 nodes 中提取 isGroup=true 且 shape='roundedWithTitle' 的节点
 * 递归收集所有后代状态 ID（跳过 divider 和 note-group）
 */
function buildComposites(dbNodes: StateDBNode[]): StateCompositeInfo[] {
  const composites: StateCompositeInfo[] = [];
  for (const dbNode of dbNodes) {
    if (!dbNode.isGroup || dbNode.shape !== SHAPE_GROUP) {
      continue;
    }
    const childStateIds = collectDescendantStateIds(dbNode.id, dbNodes);
    const direction = resolveDirection(dbNode.dir);
    composites.push({
      stateId: dbNode.id,
      childStateIds,
      ...(direction ? { direction } : {}),
    });
  }
  return composites;
}

/**
 * 递归收集指定父节点的所有后代状态 ID
 *
 * 跳过 divider（SHAPE_DIVIDER）和 note-group（SHAPE_NOTEGROUP），
 * 但递归进入它们的子节点以收集实际状态
 */
function collectDescendantStateIds(parentId: string, dbNodes: StateDBNode[]): string[] {
  const result: string[] = [];
  for (const node of dbNodes) {
    if (node.parentId !== parentId) {
      continue;
    }
    // 跳过 divider 和 note-group 本身，但递归收集它们的子节点
    if (node.shape === SHAPE_DIVIDER || node.shape === SHAPE_NOTEGROUP) {
      result.push(...collectDescendantStateIds(node.id, dbNodes));
      continue;
    }
    // 跳过 note 节点
    if (node.shape === SHAPE_NOTE) {
      continue;
    }
    result.push(node.id);
    // 递归收集嵌套复合状态的子节点
    result.push(...collectDescendantStateIds(node.id, dbNodes));
  }
  return result;
}

/**
 * 构建 Note 信息
 *
 * 从 nodes 中提取 shape='note' 的节点
 * stateId 从 note 节点的 id 中解析（格式: `${itemId}${NOTE_ID}-${graphItemCount}`）
 */
function buildStateNotes(dbNodes: StateDBNode[]): StateNoteInfo[] {
  const notes: StateNoteInfo[] = [];
  for (const dbNode of dbNodes) {
    if (dbNode.shape !== SHAPE_NOTE) {
      continue;
    }
    const stateId = extractStateIdFromNoteId(dbNode.id);
    if (!stateId) {
      continue;
    }
    const position = resolveNotePosition(dbNode.position);
    if (!position) {
      continue;
    }
    const label = resolveLabel(dbNode.label);
    notes.push({
      stateId,
      position,
      label,
    });
  }
  return notes;
}

/**
 * 从 note 节点的 id 中提取 stateId
 *
 * note 节点 id 格式: `${itemId}${NOTE_ID}-${graphItemCount}`
 * NOTE_ID = '----note'
 *
 * 例如: 'StateA----note-0' → 'StateA'
 */
function extractStateIdFromNoteId(noteId: string): string | undefined {
  const match = noteId.match(/^(.+?)----note-\d+$/);
  return match?.[1];
}

/**
 * 解析 Note 位置
 */
function resolveNotePosition(position: string | undefined): StateNotePosition | undefined {
  if (position === 'left of' || position === 'right of') {
    return position;
  }
  return undefined;
}

/**
 * 构建样式类定义信息
 */
function buildStateClassDefs(
  classes: Map<string, StateStyleClass>,
): StateClassDefInfo[] {
  const result: StateClassDefInfo[] = [];
  for (const cls of classes.values()) {
    const style = [...cls.styles, ...cls.textStyles].join(';');
    result.push({
      name: cls.id,
      style,
    });
  }
  return result;
}

/**
 * 解析方向字符串为 FlowchartDirection
 */
function resolveDirection(dir: string | undefined): FlowchartDirection | undefined {
  if (!dir) {
    return undefined;
  }
  if (dir === 'TB' || dir === 'TD' || dir === 'BT' || dir === 'RL' || dir === 'LR') {
    return dir;
  }
  return undefined;
}

// ============================================================
// 公共 API
// ============================================================

/**
 * 解析 stateDiagram-v2 代码为 GraphCanvasState
 *
 * 预处理（架构修复）:
 *   - 内部调用 preprocessCode 清理 frontmatter/指令/注释（保持行号一致）
 *   - jison 解析清理后的 code，错误上下文使用原始 source
 *
 * @param source - Mermaid stateDiagram-v2 源代码（可含 %% 注释、%%{directive}%%、frontmatter）
 * @returns 解析结果（包含 canvas 和 errors）
 */
export function parseState(source: string): ParseResult {
  const parser = stateJisonParser;
  const stateDB = new StateDB(2);

  // 将 StateDB 实例作为 yy 传入 parser
  // jison 语法动作通过 yy.setRootDoc/yy.trimColon/yy.getDividerId/... 调用 StateDB 方法
  parser.yy = stateDB;

  try {
    // 预处理：清理 frontmatter/指令/注释（替换为等长换行，保持行号一致）
    // jison 无法解析 %% 注释和 %%{directive}%%，必须预处理
    const preprocessedSource = preprocessCode(source);
    // jison 语法要求 stateDiagram-v2 后必须有 NEWLINE
    const normalizedSource = preprocessedSource.endsWith('\n') ? preprocessedSource : preprocessedSource + '\n';
    parser.parse(normalizedSource);

    const data = stateDB.getData();
    const canvas = mapToGraphCanvasState(data, stateDB);

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
      diagramType: 'stateDiagram',
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
    parser.yy = {};
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
    return err.message || 'state parse error';
  }
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return 'state parse error';
}
