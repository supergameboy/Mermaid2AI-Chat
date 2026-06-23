/**
 * er 解析器
 *
 * 单一职责：将 Mermaid erDiagram 代码解析为 CanvasState (GraphCanvasState)
 *
 * 数据流:
 *   源代码字符串
 *     → 加载 jison 生成的 er-parser.cjs
 *     → 创建 ErDB 实例，作为 yy 传入 parser
 *     → parser.parse(source) 调用 ErDB.addEntity/addAttributes/addRelationship/... 收集数据
 *     → ErDB.getData() 返回 ERAST
 *     → mapAstToCanvasState(ast) 映射为 CanvasState
 *
 * 错误处理:
 *   - jison 抛出的语法错误被捕获，转换为 ParseError[]
 *   - 解析成功时 errors 为空数组
 */

import { parser as erParser } from '../jison/er-parser.js';
import { preprocessCode } from '../../detector/preprocessor.js';
import type {
  GraphCanvasState,
  MermaidNode,
  MermaidEdge,
  MermaidNodeData,
  MermaidEdgeData,
  MermaidShapeType,
  MermaidEdgeStyle,
  ERCardinality,
  ERIdentification,
  NodeAttribute,
  GraphMetadata,
  ErSubGraphInfo,
  ErClassInfo,
  ParseError,
} from '../../types.js';
import type { ERAST } from '../../ast/er-ast.js';
import type {
  EntityNode,
  Relationship,
  RelSpec,
  EntityClass,
  ErSubGraph,
} from './types.js';
import { ErDB } from './er-db.js';
import {
  CARDINALITY,
  IDENTIFICATION,
  resolveCardinality,
  resolveIdentification,
} from './constants.js';

// ============================================================
// jison parser（静态 import，浏览器兼容）
// ============================================================

interface JisonParserInstance {
  parse(input: string): unknown;
  yy: unknown;
}

/** er jison 解析器实例 */
const erJisonParser: JisonParserInstance = erParser as unknown as JisonParserInstance;

// ============================================================
// 解析结果类型
// ============================================================

/** er 解析结果 */
export interface ERParseResult {
  /** 是否解析成功（无语法错误） */
  success: boolean;
  /** 解析后的 CanvasState（失败时返回空状态） */
  canvas: GraphCanvasState;
  /** 解析错误列表 */
  errors: ParseError[];
}

// ============================================================
// AST → CanvasState 映射
// ============================================================

/**
 * 将 ERAST 映射为 CanvasState (GraphCanvasState with diagramType='erDiagram')
 *
 * 映射规则:
 *   - subGraphs → nodes（subgraph 节点，作为父节点）+ metadata.erSubgraphs
 *   - entities → nodes（实体节点，shape='er-box'，含 attributes/alias）
 *   - relationships → edges（关系边，含 cardinality/erIdentification/erRole）
 *   - classes → metadata.erClasses
 *   - direction → metadata.direction
 *   - accTitle/accDescr → metadata.accTitle/accDescription
 */
function mapAstToCanvasState(ast: ERAST): GraphCanvasState {
  const nodes: MermaidNode[] = [];
  const edges: MermaidEdge[] = [];

  // ============================================================
  // 1. 构建 subgraph 父子关系
  // ============================================================
  const parentDB = new Map<string, string>();
  for (let i = ast.subGraphs.length - 1; i >= 0; i--) {
    const subGraph = ast.subGraphs[i];
    for (const id of subGraph.nodes) {
      parentDB.set(id, subGraph.id);
    }
  }

  // ============================================================
  // 2. 映射 subGraphs → nodes（作为父节点）+ metadata.erSubgraphs
  // ============================================================
  const erSubgraphs: ErSubGraphInfo[] = [];
  for (let i = ast.subGraphs.length - 1; i >= 0; i--) {
    const subGraph = ast.subGraphs[i];
    const subgraphParentId = parentDB.get(subGraph.id);
    const subgraphNode: MermaidNode = {
      id: subGraph.id,
      type: 'er-subgraph',
      position: { x: 0, y: 0 },
      data: {
        label: subGraph.title,
        shape: 'rect' as MermaidShapeType,
        ...(subGraph.dir ? { direction: subGraph.dir } : {}),
      },
      parentId: subgraphParentId,
      ...(subgraphParentId ? { extent: 'parent' as const } : {}),
    };
    nodes.push(subgraphNode);

    erSubgraphs.push({
      id: subGraph.id,
      title: subGraph.title,
      nodes: [...subGraph.nodes],
      classes: [...subGraph.classes],
      ...(subGraph.dir ? { dir: subGraph.dir } : {}),
    });
  }

  // ============================================================
  // 3. 映射 entities → nodes（排除 subgraph 节点）
  // ============================================================
  const subGraphIds = new Set(ast.subGraphs.map((sg) => sg.id));
  let colorIndex = 0;
  let entityIndex = 0;
  for (const entityKey of ast.entities.keys()) {
    if (subGraphIds.has(entityKey)) {
      continue;
    }
    const entityNode = ast.entities.get(entityKey);
    if (!entityNode) {
      continue;
    }

    const attributes = convertAttributes(entityNode.attributes);
    const cssCompiledStyles = getCompiledStyles(entityNode.cssClasses, ast.classes);
    // 合并 classDef 编译样式 + 内联样式（style 语句）
    const allStyles = [...cssCompiledStyles, ...(entityNode.cssStyles ?? [])];

    const data: MermaidNodeData = {
      label: entityNode.label,
      shape: 'er-box' as MermaidShapeType,
      attributes,
      ...(entityNode.alias ? { alias: entityNode.alias } : {}),
      ...(entityNode.cssClasses && entityNode.cssClasses !== 'default'
        ? { classNames: entityNode.cssClasses.split(' ').filter((cn) => cn && cn !== 'default') }
        : {}),
      ...(allStyles.length > 0 ? { styles: allStyles } : {}),
      colorIndex: colorIndex++,
    };

    nodes.push({
      id: entityNode.id,
      type: 'er-box',
      position: { x: entityIndex * 250, y: 0 },
      data,
      parentId: parentDB.get(entityKey),
      ...(parentDB.has(entityKey) ? { extent: 'parent' as const } : {}),
    });

    entityIndex++;
  }

  // ============================================================
  // 4. 映射 relationships → edges
  // ============================================================
  let relationIndex = 0;
  for (const relationship of ast.relationships) {
    relationIndex++;
    const edge = mapRelationshipToEdge(relationship, relationIndex);
    edges.push(edge);
  }

  // ============================================================
  // 5. 构建 metadata
  // ============================================================
  const erClasses = convertClasses(ast.classes);
  const metadata: GraphMetadata = {
    ...(erSubgraphs.length > 0 ? { erSubgraphs } : {}),
    ...(erClasses.length > 0 ? { erClasses } : {}),
    ...(ast.direction ? { direction: ast.direction } : {}),
    ...(ast.accTitle ? { accTitle: ast.accTitle } : {}),
    ...(ast.accDescr ? { accDescription: ast.accDescr } : {}),
  };

  return {
    diagramType: 'erDiagram',
    nodes,
    edges,
    ...(ast.direction ? { direction: ast.direction as GraphCanvasState['direction'] } : {}),
    metadata,
  };
}

/**
 * 将 ErDB 的 Attribute[] 转换为 NodeAttribute[]
 *
 * 注意：comment 为空字符串时转为 undefined（避免序列化输出空注释）
 */
function convertAttributes(attrs: { type: string; name: string; keys: string[]; comment: string }[]): NodeAttribute[] {
  return attrs.map((attr) => ({
    name: attr.name,
    type: attr.type,
    keys: attr.keys as NodeAttribute['keys'],
    ...(attr.comment ? { comment: attr.comment } : {}),
  }));
}

/**
 * 将 EntityClass Map 转换为 ErClassInfo[]
 */
function convertClasses(classes: Map<string, EntityClass>): ErClassInfo[] {
  return [...classes.values()].map((cls) => ({
    id: cls.id,
    styles: [...cls.styles],
    textStyles: [...cls.textStyles],
  }));
}

/**
 * 编译样式（从 classDefs 收集 styles/textStyles）
 *
 * 对齐官方 erDb.ts 的 getCompiledStyles 逻辑
 */
function getCompiledStyles(cssClasses: string | undefined, classes: Map<string, EntityClass>): string[] {
  if (!cssClasses) {
    return [];
  }
  let compiledStyles: string[] = [];
  const classList = cssClasses.split(' ').filter((cn) => cn && cn !== 'default');
  for (const customClass of classList) {
    const cssClass = classes.get(customClass);
    if (cssClass?.styles) {
      compiledStyles = [...compiledStyles, ...cssClass.styles].map((s) => s.trim());
    }
    if (cssClass?.textStyles) {
      compiledStyles = [...compiledStyles, ...cssClass.textStyles].map((s) => s.trim());
    }
  }
  return compiledStyles;
}

/**
 * 将 Relationship 映射为 MermaidEdge
 *
 * 注意：cardinality.from = relSpec.cardB（A 端基数，对应 source 端）
 *       cardinality.to = relSpec.cardA（B 端基数，对应 target 端）
 * 这与官方 erDb.ts 的 arrowTypeStart/arrowTypeEnd 对应
 */
function mapRelationshipToEdge(relationship: Relationship, index: number): MermaidEdge {
  const relSpec = relationship.relSpec;

  // 解析基数（jison 大写形式 → M0 小写连字符形式）
  const cardinalityFrom = resolveCardinality(relSpec.cardB) as ERCardinality;
  const cardinalityTo = resolveCardinality(relSpec.cardA) as ERCardinality;

  // 解析关系类型（jison 大写形式 → M0 小写连字符形式）
  const erIdentification = resolveIdentification(relSpec.relType) as ERIdentification;

  // 映射边样式：IDENTIFYING (-- 实线) → 'line'，NON_IDENTIFYING (.. 虚线) → 'dotted'
  const edgeStyle: MermaidEdgeStyle =
    relSpec.relType === IDENTIFICATION.IDENTIFYING ? 'line' : 'dotted';

  // 构建边数据
  const data: MermaidEdgeData = {
    edgeStyle,
    ...(relationship.roleA ? { label: relationship.roleA, erRole: relationship.roleA } : {}),
    cardinality: { from: cardinalityFrom, to: cardinalityTo },
    erIdentification,
  };

  return {
    id: `er-edge-${index}`,
    source: relationship.entityA,
    target: relationship.entityB,
    type: 'er-relation',
    data,
  };
}

// ============================================================
// 公共 API
// ============================================================

/**
 * 解析 erDiagram 代码为 CanvasState
 *
 * 预处理（架构修复）:
 *   - 内部调用 preprocessCode 清理 frontmatter/指令/注释（保持行号一致）
 *   - jison 解析清理后的 code，错误上下文使用原始 source
 *
 * @param source - Mermaid erDiagram 源代码（可含 %% 注释、%%{directive}%%、frontmatter）
 * @returns 解析结果（包含 canvas 和 errors）
 */
export function parseER(source: string): ERParseResult {
  const parser = erJisonParser;
  const erDB = new ErDB();

  // 将 ErDB 实例作为 yy 传入 parser
  // jison 语法动作通过 yy.addEntity/yy.addRelationship/... 调用 ErDB 方法
  parser.yy = erDB;

  try {
    // 预处理：清理 frontmatter/指令/注释（替换为等长换行，保持行号一致）
    // jison 无法解析 %% 注释和 %%{directive}%%，必须预处理
    const preprocessedSource = preprocessCode(source);
    // jison 语法要求 erDiagram 后必须有 NEWLINE
    const normalizedSource = preprocessedSource.endsWith('\n') ? preprocessedSource : preprocessedSource + '\n';
    parser.parse(normalizedSource);

    const ast = erDB.getData();
    const canvas = mapAstToCanvasState(ast);

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
      diagramType: 'erDiagram',
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
    return err.message || 'er parse error';
  }
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return 'er parse error';
}
