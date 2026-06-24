/**
 * flowchart 解析器
 *
 * 单一职责：将 Mermaid flowchart 代码解析为 CanvasState (GraphCanvasState)
 *
 * 数据流:
 *   源代码字符串
 *     → 加载 jison 生成的 flow-parser.cjs
 *     → 创建 FlowDB 实例，作为 yy 传入 parser
 *     → parser.parse(source) 调用 FlowDB.addVertex/addLink/... 收集数据
 *     → FlowDB.getData() 返回 FlowchartAST
 *     → mapAstToCanvasState(ast) 映射为 CanvasState
 *
 * 错误处理:
 *   - jison 抛出的语法错误被捕获，转换为 ParseError[]
 *   - 解析成功时 errors 为空数组
 */

import { parser as flowParser } from '../jison/flow-parser.js';
import { preprocessCode, extractFrontmatterTitle } from '../../detector/preprocessor.js';
import type {
  CanvasState,
  GraphCanvasState,
  MermaidNode,
  MermaidEdge,
  MermaidNodeData,
  MermaidEdgeData,
  MermaidShapeType,
  MermaidEdgeStyle,
  FlowchartDirection,
  GraphMetadata,
  FlowClassDefInfo,
  ParseError,
  NodeStyle,
} from '../../types.js';
import type {
  FlowchartAST,
  FlowVertex,
  FlowEdge,
  FlowSubGraph,
  FlowClass,
  FlowClickEvent,
  FlowVertexTypeParam,
} from '../../ast/flowchart-ast.js';
import { FlowDB } from './flow-db.js';

// ============================================================
// jison parser（静态 import，浏览器兼容）
// ============================================================

interface JisonParserInstance {
  parse(input: string): unknown;
  yy: unknown;
}

/** flowchart jison 解析器实例 */
const flowJisonParser: JisonParserInstance = flowParser as unknown as JisonParserInstance;

// ============================================================
// 解析结果类型
// ============================================================

/** flowchart 解析结果 */
export interface FlowchartParseResult {
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
 * shape 别名映射表
 * 对齐官方 shapes.ts 的 generateShapeMap 逻辑
 * 将所有外部名称（shortName/aliases/internalAliases）映射到 MermaidShapeType
 */
const SHAPE_ALIAS_MAP: Record<string, MermaidShapeType> = {
  // === rect (squareRect) ===
  'rect': 'rect', 'proc': 'rect', 'process': 'rect', 'rectangle': 'rect', 'squarerect': 'rect',
  // === rounded (roundedRect) ===
  'rounded': 'rounded', 'event': 'rounded', 'roundedrect': 'rounded',
  // === stadium ===
  'stadium': 'stadium', 'terminal': 'stadium', 'pill': 'stadium',
  // === subroutine (fr-rect) ===
  'subroutine': 'subroutine', 'subprocess': 'subroutine', 'subproc': 'subroutine',
  'framed-rectangle': 'subroutine', 'fr-rect': 'subroutine',
  // === cylinder ===
  'cylinder': 'cylinder', 'cyl': 'cylinder', 'db': 'cylinder', 'database': 'cylinder',
  // === datastore ===
  'datastore': 'datastore', 'data-store': 'datastore',
  // === circle ===
  'circle': 'circle', 'circ': 'circle',
  // === doublecircle ===
  'doublecircle': 'doublecircle', 'double-circle': 'doublecircle', 'dbl-circ': 'doublecircle',
  // === diamond (question) ===
  'diamond': 'diamond', 'diam': 'diamond', 'decision': 'diamond', 'question': 'diamond',
  // === hexagon ===
  'hexagon': 'hexagon', 'hex': 'hexagon', 'prepare': 'hexagon',
  // === lean-right (lean_right) ===
  'lean-right': 'lean-right', 'lean-r': 'lean-right', 'in-out': 'lean-right', 'lean_right': 'lean-right',
  // === lean-left (lean_left) ===
  'lean-left': 'lean-left', 'lean-l': 'lean-left', 'out-in': 'lean-left', 'lean_left': 'lean-left',
  // === trapezoid ===
  'trapezoid': 'trapezoid', 'trap-b': 'trapezoid', 'priority': 'trapezoid', 'trapezoid-bottom': 'trapezoid',
  // === trapezoid-reverse (inv_trapezoid) ===
  'trapezoid-reverse': 'trapezoid-reverse', 'trap-t': 'trapezoid-reverse', 'manual': 'trapezoid-reverse',
  'trapezoid-top': 'trapezoid-reverse', 'inv-trapezoid': 'trapezoid-reverse', 'inv_trapezoid': 'trapezoid-reverse',
  // === odd (rect_left_inv_arrow) ===
  'odd': 'odd', 'rect_left_inv_arrow': 'odd',
  // === text ===
  'text': 'text',
  // === card (notched-rectangle) ===
  'card': 'card', 'notched-rectangle': 'card', 'notch-rect': 'card',
  // === lined-rectangle (shaded-process) ===
  'lined-rectangle': 'lined-rectangle', 'lin-rect': 'lined-rectangle', 'lined-process': 'lined-rectangle',
  'lin-proc': 'lined-rectangle', 'shaded-process': 'lined-rectangle',
  // === small-circle (stateStart) ===
  'small-circle': 'small-circle', 'sm-circ': 'small-circle', 'start': 'small-circle', 'statestart': 'small-circle',
  // === framed-circle (stateEnd) ===
  'framed-circle': 'framed-circle', 'fr-circ': 'framed-circle', 'stop': 'framed-circle', 'stateend': 'framed-circle',
  // === fork-join (forkJoin) ===
  'fork-join': 'fork-join', 'fork': 'fork-join', 'join': 'fork-join', 'forkjoin': 'fork-join',
  // === hourglass ===
  'hourglass': 'hourglass', 'collate': 'hourglass',
  // === brace-left (curlyBraceLeft) ===
  'brace-left': 'brace-left', 'brace': 'brace-left', 'brace-l': 'brace-left', 'comment': 'brace-left',
  // === brace-right (curlyBraceRight) ===
  'brace-right': 'brace-right', 'brace-r': 'brace-right',
  // === braces (curlyBraces) ===
  'braces': 'braces',
  // === lightning-bolt ===
  'lightning-bolt': 'lightning-bolt', 'bolt': 'lightning-bolt', 'com-link': 'lightning-bolt',
  // === document (waveEdgedRectangle) ===
  'document': 'document', 'doc': 'document',
  // === delay (halfRoundedRectangle) ===
  'delay': 'delay', 'half-rounded-rectangle': 'delay',
  // === horizontal-cylinder (tiltedCylinder) ===
  'horizontal-cylinder': 'horizontal-cylinder', 'h-cyl': 'horizontal-cylinder', 'das': 'horizontal-cylinder',
  // === lined-cylinder ===
  'lined-cylinder': 'lined-cylinder', 'lin-cyl': 'lined-cylinder', 'disk': 'lined-cylinder',
  // === curved-trapezoid ===
  'curved-trapezoid': 'curved-trapezoid', 'curv-trap': 'curved-trapezoid', 'display': 'curved-trapezoid',
  // === divided-rectangle ===
  'divided-rectangle': 'divided-rectangle', 'div-rect': 'divided-rectangle',
  'div-proc': 'divided-rectangle', 'divided-process': 'divided-rectangle',
  // === triangle ===
  'triangle': 'triangle', 'tri': 'triangle', 'extract': 'triangle',
  // === window-pane ===
  'window-pane': 'window-pane', 'win-pane': 'window-pane', 'internal-storage': 'window-pane',
  // === filled-circle ===
  'filled-circle': 'filled-circle', 'f-circ': 'filled-circle', 'junction': 'filled-circle',
  // === notched-pentagon (trapezoidalPentagon) ===
  'notched-pentagon': 'notched-pentagon', 'notch-pent': 'notched-pentagon',
  'loop-limit': 'notched-pentagon',
  // === flipped-triangle ===
  'flipped-triangle': 'flipped-triangle', 'flip-tri': 'flipped-triangle', 'manual-file': 'flipped-triangle',
  // === sloped-rectangle (slopedRect) ===
  'sloped-rectangle': 'sloped-rectangle', 'sl-rect': 'sloped-rectangle',
  'manual-input': 'sloped-rectangle',
  // === stacked-document (multiWaveEdgedRectangle) ===
  'stacked-document': 'stacked-document', 'docs': 'stacked-document',
  'documents': 'stacked-document', 'st-doc': 'stacked-document',
  // === stacked-rectangle (multiRect) ===
  'stacked-rectangle': 'stacked-rectangle', 'st-rect': 'stacked-rectangle',
  'procs': 'stacked-rectangle', 'processes': 'stacked-rectangle',
  // === bow-tie-rectangle (bowTieRect) ===
  'bow-tie-rectangle': 'bow-tie-rectangle', 'bow-rect': 'bow-tie-rectangle', 'stored-data': 'bow-tie-rectangle',
  // === crossed-circle ===
  'crossed-circle': 'crossed-circle', 'cross-circ': 'crossed-circle', 'summary': 'crossed-circle',
  // === tagged-document (taggedWaveEdgedRectangle) ===
  'tagged-document': 'tagged-document', 'tag-doc': 'tagged-document',
  // === tagged-rectangle (taggedRect) ===
  'tagged-rectangle': 'tagged-rectangle', 'tag-rect': 'tagged-rectangle',
  'tag-proc': 'tagged-rectangle', 'tagged-process': 'tagged-rectangle',
  // === flag (waveRectangle) ===
  'flag': 'flag', 'paper-tape': 'flag',
  // === lined-document (linedWaveEdgedRect) ===
  'lined-document': 'lined-document', 'lin-doc': 'lined-document',
  // === note ===
  'note': 'note',
  // === cloud ===
  'cloud': 'cloud',
  // === bang ===
  'bang': 'bang',
};

/**
 * jison 语法层顶点类型 → MermaidShapeType 映射
 * 对齐官方 shapes.ts 的 getTypeFromVertex 逻辑
 */
function mapVertexType(type: FlowVertex['type']): MermaidShapeType {
  if (type === undefined) {
    return 'rect';
  }

  // jison 语法层 16 种标准形状（直接映射）
  switch (type) {
    case 'square':
      return 'rect';
    case 'round':
      return 'rounded';
    case 'ellipse':
      return 'ellipse';
    case 'stadium':
      return 'stadium';
    case 'subroutine':
      return 'subroutine';
    case 'cylinder':
      return 'cylinder';
    case 'circle':
      return 'circle';
    case 'doublecircle':
      return 'doublecircle';
    case 'diamond':
      return 'diamond';
    case 'hexagon':
      return 'hexagon';
    case 'odd':
      return 'odd';
    case 'trapezoid':
      return 'trapezoid';
    case 'inv_trapezoid':
      return 'trapezoid-reverse';
    case 'lean_right':
      return 'lean-right';
    case 'lean_left':
      return 'lean-left';
    case 'rect':
      return 'rect';
    default:
      // shapeData 扩展形状：通过别名映射表查找
      // 对齐官方 shapes.ts 的 generateShapeMap 逻辑
      const normalized = type.toLowerCase();
      const mapped = SHAPE_ALIAS_MAP[normalized];
      if (mapped !== undefined) {
        return mapped;
      }
      // 未知形状回退到 rect（不应发生，但防御性处理）
      return type as MermaidShapeType;
  }
}

/**
 * 边类型 + 线型 → MermaidEdgeStyle 映射
 * 对齐官方 destructLink 的 type + stroke 组合
 *
 * type: arrow_point/arrow_circle/arrow_cross/arrow_open/double_arrow_point/double_arrow_circle/double_arrow_cross/INVALID
 * stroke: normal/thick/dotted/invisible
 */
function mapEdgeStyle(type: FlowEdge['type'], stroke: FlowEdge['stroke']): MermaidEdgeStyle {
  // 不可见线
  if (stroke === 'invisible') {
    return 'invisible';
  }

  // 双端箭头
  if (type === 'double_arrow_point') {
    return stroke === 'thick'
      ? 'thick-arrow' // 官方无 thick 双端，归一化为 thick-arrow（实际不会出现）
      : stroke === 'dotted'
        ? 'dotted-arrow'
        : 'bidirectional-arrow';
  }
  if (type === 'double_arrow_circle') {
    return stroke === 'dotted' ? 'dotted-circle' : 'bidirectional-circle';
  }
  if (type === 'double_arrow_cross') {
    return stroke === 'dotted' ? 'dotted-cross' : 'bidirectional-cross';
  }

  // 单端箭头
  const arrowPart = type === 'arrow_point' ? 'arrow'
    : type === 'arrow_circle' ? 'circle'
    : type === 'arrow_cross' ? 'cross'
    : 'line'; // arrow_open

  switch (stroke) {
    case 'thick':
      return arrowPart === 'arrow' ? 'thick-arrow'
        : arrowPart === 'circle' ? 'thick-circle'
        : arrowPart === 'cross' ? 'thick-cross'
        : 'thick-line';
    case 'dotted':
      return arrowPart === 'arrow' ? 'dotted-arrow'
        : arrowPart === 'circle' ? 'dotted-circle'
        : arrowPart === 'cross' ? 'dotted-cross'
        : 'dotted';
    case 'normal':
    default:
      return arrowPart as MermaidEdgeStyle;
  }
}

/**
 * 获取边的 markerStart/markerEnd
 * 对齐官方 destructEdgeType 逻辑
 */
function getEdgeMarkers(
  type: FlowEdge['type'],
  stroke: FlowEdge['stroke'],
): { markerStart?: string; markerEnd?: string } {
  if (stroke === 'invisible' || type === 'arrow_open') {
    return { markerStart: undefined, markerEnd: undefined };
  }

  let markerStart: string | undefined;
  let markerEnd: string | undefined;

  switch (type) {
    case 'arrow_point':
    case 'arrow_circle':
    case 'arrow_cross':
      markerEnd = type;
      break;
    case 'double_arrow_point':
    case 'double_arrow_circle':
    case 'double_arrow_cross':
      markerStart = type.replace('double_', '');
      markerEnd = markerStart;
      break;
  }

  return { markerStart, markerEnd };
}

/**
 * 将 style 语句的字符串数组解析为结构化 NodeStyle 对象
 * style 语句格式: "fill:#e1f5fe", "stroke:#333", "stroke-width:2", "color:#fff"
 */
function parseStylesToNodeStyle(styles: string[]): NodeStyle | undefined {
  if (styles.length === 0) return undefined;
  const result: NodeStyle = {};
  for (const s of styles) {
    const colonIndex = s.indexOf(':');
    if (colonIndex === -1) continue;
    const key = s.substring(0, colonIndex).trim();
    const value = s.substring(colonIndex + 1).trim();
    switch (key) {
      case 'fill':
        result.fill = value;
        break;
      case 'stroke':
        result.stroke = value;
        break;
      case 'stroke-width':
      case 'strokeWidth': {
        const w = Number(value);
        if (Number.isFinite(w)) result.strokeWidth = w;
        break;
      }
      case 'color':
        result.color = value;
        break;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * 将 FlowVertex 映射为 MermaidNode
 * @param vertex - FlowVertex AST 节点
 * @param parentDB - 节点 ID → parentId 映射
 * @param subGraphDB - 节点 ID → 是否为 subgraph 映射
 * @param tooltips - 节点 ID → tooltip 映射（来自 FlowDB.setTooltip）
 * @param flowClassDefs - classDef 定义列表（用于将 classDef 样式编译到节点的 data.style）
 */
function mapVertexToNode(
  vertex: FlowVertex,
  parentDB: Map<string, string>,
  subGraphDB: Map<string, boolean>,
  tooltips: Map<string, string>,
  flowClassDefs: FlowClassDefInfo[],
): MermaidNode {
  const parentId = parentDB.get(vertex.id);
  const isGroup = subGraphDB.get(vertex.id) ?? false;
  const tooltip = tooltips.get(vertex.id);

  // Bug5 修复：合并 classDef 样式和直接 style 到节点的 data.style
  // classDef 样式优先级低于直接 style（直接 style 覆盖 classDef）
  const mergedStyle: NodeStyle = {};

  // 1. 先合并 classDef 样式（按 class 声明顺序，后声明的覆盖先声明的）
  if (vertex.classes.length > 0 && flowClassDefs.length > 0) {
    for (const className of vertex.classes) {
      const classDef = flowClassDefs.find(cd => cd.id === className);
      if (classDef?.styles && classDef.styles.length > 0) {
        const classStyle = parseStylesToNodeStyle(classDef.styles);
        if (classStyle) {
          Object.assign(mergedStyle, classStyle);
        }
      }
    }
  }

  // 2. 再合并直接 style（直接 style 优先级高于 classDef）
  if (vertex.styles.length > 0) {
    const directStyle = parseStylesToNodeStyle(vertex.styles);
    if (directStyle) {
      Object.assign(mergedStyle, directStyle);
    }
  }

  const hasMergedStyle = Object.keys(mergedStyle).length > 0;

  const data: MermaidNodeData = {
    label: vertex.text ?? vertex.id,
    shape: isGroup ? 'rect' : mapVertexType(vertex.type),
    classNames: vertex.classes.length > 0 ? vertex.classes : undefined,
    tooltip,
    // flowchart 专用扩展字段（通过索引签名承载）
    ...(hasMergedStyle ? { style: mergedStyle, styles: vertex.styles } : {}),
    ...(vertex.styles.length > 0 && !hasMergedStyle ? { styles: vertex.styles } : {}),
    ...(vertex.labelType !== 'text' ? { labelType: vertex.labelType } : {}),
    ...(vertex.dir ? { dir: vertex.dir } : {}),
    ...(vertex.props ? { props: vertex.props } : {}),
    ...(vertex.link ? { clickUrl: vertex.link } : {}),
    ...(vertex.linkTarget ? { linkTarget: vertex.linkTarget } : {}),
    ...(vertex.icon ? { icon: vertex.icon } : {}),
    ...(vertex.form ? { form: vertex.form } : {}),
    ...(vertex.pos ? { pos: vertex.pos } : {}),
    ...(vertex.img ? { img: vertex.img } : {}),
    ...(vertex.assetWidth !== undefined ? { assetWidth: vertex.assetWidth } : {}),
    ...(vertex.assetHeight !== undefined ? { assetHeight: vertex.assetHeight } : {}),
    ...(vertex.constraint ? { constraint: vertex.constraint } : {}),
    ...(vertex.haveCallback ? { haveCallback: true } : {}),
  };

  return {
    id: vertex.id,
    type: data.shape,
    position: { x: 0, y: 0 }, // 位置由布局算法计算
    data,
    ...(parentId ? { parentId } : {}),
  };
}

/**
 * 将 FlowEdge 映射为 MermaidEdge
 */
function mapEdgeToMermaidEdge(edge: FlowEdge, index: number): MermaidEdge {
  const edgeStyle = mapEdgeStyle(edge.type, edge.stroke);
  const markers = getEdgeMarkers(edge.type, edge.stroke);

  const data: MermaidEdgeData = {
    edgeStyle,
    label: edge.text || undefined,
    ...(edge.length !== undefined ? { length: edge.length } : {}),
    ...(edge.interpolate ? { interpolate: edge.interpolate } : {}),
    ...(edge.classes.length > 0 ? { classNames: edge.classes } : {}),
    ...(edge.style && edge.style.length > 0 ? { styles: edge.style } : {}),
    ...(edge.animate ? { animate: edge.animate } : {}),
    ...(edge.animation ? { animation: edge.animation } : {}),
    ...(edge.labelType !== 'text' ? { labelType: edge.labelType } : {}),
    ...(edge.isUserDefinedId ? { isUserDefinedId: true } : {}),
  };

  return {
    id: edge.id ?? `e${index}`,
    source: edge.start,
    target: edge.end,
    data,
    ...(markers.markerStart ? { markerStart: { type: 'arrow', ...({ marker: markers.markerStart } as object) } } : {}),
    ...(markers.markerEnd ? { markerEnd: { type: 'arrow', ...({ marker: markers.markerEnd } as object) } } : {}),
  };
}

/**
 * 将 FlowSubGraph 映射为 MermaidNode（作为 parent node）
 */
function mapSubGraphToNode(
  subGraph: FlowSubGraph,
  parentDB: Map<string, string>,
): MermaidNode {
  const parentId = parentDB.get(subGraph.id);
  const dir = subGraph.dir === 'TD' ? 'TB' : subGraph.dir;

  const data: MermaidNodeData = {
    label: subGraph.title,
    shape: 'rect',
    classNames: subGraph.classes.length > 0 ? subGraph.classes : undefined,
    // subgraph 专用扩展字段
    isSubgraph: true,
    ...(dir ? { dir } : {}),
    ...(subGraph.hasExplicitDir ? { hasExplicitDir: true } : {}),
    ...(subGraph.labelType !== 'text' ? { labelType: subGraph.labelType } : {}),
    subgraphNodes: subGraph.nodes,
  };

  return {
    id: subGraph.id,
    type: 'rect',
    position: { x: 0, y: 0 },
    data,
    ...(parentId ? { parentId } : {}),
  };
}

/**
 * 将 FlowchartAST 映射为 GraphCanvasState
 */
function mapAstToCanvasState(ast: FlowchartAST): GraphCanvasState {
  const nodes: MermaidNode[] = [];
  const edges: MermaidEdge[] = [];

  // 构建 parentId 映射和 subgraph 标记
  const parentDB = new Map<string, string>();
  const subGraphDB = new Map<string, boolean>();

  // 从后向前遍历 subgraph，确保嵌套 subgraph 的 parentId 正确
  for (let i = ast.subGraphs.length - 1; i >= 0; i--) {
    const subGraph = ast.subGraphs[i];
    if (!subGraph) {
      continue;
    }
    if (subGraph.nodes.length > 0) {
      subGraphDB.set(subGraph.id, true);
    }
    for (const id of subGraph.nodes) {
      // 只设置第一次遇到的 parent（最内层的 subgraph）
      if (!parentDB.has(id)) {
        parentDB.set(id, subGraph.id);
      }
    }
  }

  // 添加 subgraph 节点（从后向前，确保嵌套顺序）
  for (let i = ast.subGraphs.length - 1; i >= 0; i--) {
    const subGraph = ast.subGraphs[i];
    if (subGraph) {
      nodes.push(mapSubGraphToNode(subGraph, parentDB));
    }
  }

  // 构建 subgraph ID 集合（用于顶点去重：当顶点 ID 与 subgraph ID 重复时跳过顶点）
  const subgraphIds = new Set<string>();
  for (const sg of ast.subGraphs) {
    if (sg) {
      subgraphIds.add(sg.id);
    }
  }

  // Bug5: 将 FlowClass 转换为 FlowClassDefInfo，需要在 mapVertexToNode 之前声明
  // 以便将 classDef 样式编译到节点的 data.style
  const flowClassDefs: FlowClassDefInfo[] = ast.classes.map((c) => ({
    id: c.id,
    styles: c.styles,
    textStyles: c.textStyles,
  }));

  // 添加顶点节点（传入 tooltips 映射和 flowClassDefs）
  // 跳过与 subgraph ID 重复的顶点（Mermaid 语法中 subgraph ID 和顶点 ID 共享命名空间，
  // 当 `subgraph Start[开始]` 和 `Start[Start]` 同时存在时，顶点应被 subgraph 吸收）
  for (const vertex of ast.vertices) {
    if (subgraphIds.has(vertex.id)) {
      continue;
    }
    nodes.push(mapVertexToNode(vertex, parentDB, subGraphDB, ast.tooltips, flowClassDefs));
  }

  // 添加边
  ast.edges.forEach((edge, index) => {
    edges.push(mapEdgeToMermaidEdge(edge, index));
  });

  // 构建元数据
  const metadata: GraphMetadata = {
    ...(flowClassDefs.length > 0 ? { flowClassDefs } : {}),
    ...(ast.subGraphs.length > 0 ? { flowSubgraphs: ast.subGraphs } : {}),
    ...(ast.clickEvents.length > 0 ? { flowClickEvents: ast.clickEvents } : {}),
    ...(ast.tooltips.size > 0 ? { flowTooltips: Object.fromEntries(ast.tooltips) } : {}),
    ...(ast.accTitle ? { accTitle: ast.accTitle } : {}),
    ...(ast.accDescription ? { accDescription: ast.accDescription } : {}),
    ...(ast.title ? { title: ast.title } : {}),
    ...(ast.defaultInterpolate ? { flowDefaultInterpolate: ast.defaultInterpolate } : {}),
    ...(ast.defaultStyle ? { flowDefaultStyle: ast.defaultStyle } : {}),
  };

  return {
    diagramType: 'flowchart',
    nodes,
    edges,
    ...(ast.direction ? { direction: ast.direction as FlowchartDirection } : { direction: 'TB' }),
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
  };
}

// ============================================================
// 公共 API
// ============================================================

/**
 * 解析 flowchart 代码为 CanvasState
 *
 * 预处理（架构修复）:
 *   - 内部调用 preprocessCode 清理 frontmatter/指令/注释（保持行号一致）
 *   - jison 解析清理后的 code，但 rawCode 和 inferSourceLines 使用原始 source
 *   - 行号一致性保证 _sourceLine 能定位到原始 rawCode 的对应行
 *
 * @param source - Mermaid flowchart 源代码（可含 %% 注释、%%{directive}%%、frontmatter）
 * @returns 解析结果（包含 canvas 和 errors，canvas.rawCode 保留原始代码）
 */
export function parseFlowchartCode(source: string): FlowchartParseResult {
  const parser = flowJisonParser;
  const flowDB = new FlowDB();

  // 将 FlowDB 实例作为 yy 传入 parser
  // jison 语法动作通过 yy.addVertex/yy.addLink/... 调用 FlowDB 方法
  parser.yy = flowDB;

  try {
    // 预处理：清理 frontmatter/指令/注释（替换为等长换行，保持行号一致）
    // jison 无法解析 %% 注释和 %%{directive}%%，必须预处理
    const preprocessedSource = preprocessCode(source);
    // 对齐官方 flowParser.ts：去除右花括号后的尾随空格
    const processedSource = preprocessedSource.replace(/}\s*\n/g, '}\n');
    // jison 语法要求 GRAPH DIR 后必须有 FirstStmtSeparator（NEWLINE/SEMI/SPACE），
    // 若 source 不以换行结尾，补充一个换行符避免 EOF 解析错误
    const normalizedSource = processedSource.endsWith('\n')
      ? processedSource
      : processedSource + '\n';
    parser.parse(normalizedSource);

    const ast = flowDB.getData();
    const canvas = mapAstToCanvasState(ast);
    // 从 frontmatter 提取 title（对齐官方 Diagram.ts 的 metadata.title → setDiagramTitle 逻辑）
    // jison 不支持 title 语句，title 必须通过 frontmatter 设置
    const frontmatterTitle = extractFrontmatterTitle(source);
    if (frontmatterTitle) {
      if (!canvas.metadata) {
        canvas.metadata = {};
      }
      (canvas.metadata as GraphMetadata).title = frontmatterTitle;
    }
    // 推断 _sourceLine（用于增量序列化定位原始代码行）
    // 使用原始 source（含注释/指令/frontmatter），因为 rawCode 保留原始代码
    // 行号一致性由 preprocessCode 保证（替换为等长换行）
    inferSourceLines(source, canvas);
    // 保留原始代码（用于增量序列化保留格式）
    canvas.rawCode = source;

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
      diagramType: 'flowchart',
      nodes: [],
      edges: [],
      direction: 'TB',
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
    // jison 错误可能在 hash.line
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
    return err.message || 'flowchart parse error';
  }
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return 'flowchart parse error';
}

// ============================================================
// _sourceLine 推断（用于增量序列化）
// ============================================================

/**
 * 推断每个节点/边在原始代码中的行号（0-based）
 *
 * 通过扫描原始代码行，用正则匹配节点定义、边定义、subgraph 定义
 * 将行号记录到 node.data._sourceLine / edge.data._sourceLine
 *
 * 匹配规则:
 *   - subgraph 定义行: `subgraph id[Title]` 或 `subgraph id`
 *   - 普通节点定义行: `id[label]` / `id(label)` / `id@{...}` 等（id 后跟形状起始符）
 *   - 边定义行: `source --> target` / `source --- target` 等（id 后跟边符号）
 *
 * 跳过: 空行、注释行（%%）、指令行（%%{）、classDef/class/style/linkStyle/click 语句行
 *
 * @param source - 原始 Mermaid 代码
 * @param canvas - 解析后的 CanvasState（会被修改）
 */
function inferSourceLines(source: string, canvas: GraphCanvasState): void {
  const lines = source.split('\n');

  // 构建 id → node 映射（用于快速查找）
  const nodeMap = new Map<string, MermaidNode>();
  for (const node of canvas.nodes) {
    nodeMap.set(node.id, node);
  }

  // 构建 (source, target) → edge 映射（用于快速查找）
  // 注意：同一 source-target 对可能有多条边，用数组存储
  const edgeMap = new Map<string, MermaidEdge[]>();
  for (const edge of canvas.edges) {
    const key = `${edge.source}→${edge.target}`;
    const list = edgeMap.get(key) ?? [];
    list.push(edge);
    edgeMap.set(key, list);
  }

  // 已匹配的边（避免重复匹配）
  const matchedEdges = new Set<MermaidEdge>();

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    if (!line) continue;

    const trimmed = line.trim();
    if (trimmed === '') continue;
    if (trimmed.startsWith('%%')) continue;
    if (trimmed.startsWith('flowchart') || trimmed.startsWith('graph')) continue;
    if (trimmed.startsWith('classDef')) continue;
    if (trimmed.startsWith('class ')) continue;
    if (trimmed.startsWith('style ')) continue;
    if (trimmed.startsWith('linkStyle')) continue;
    if (trimmed.startsWith('click ')) continue;
    if (trimmed.startsWith('accTitle')) continue;
    if (trimmed.startsWith('accDescr')) continue;
    if (trimmed.startsWith('title ')) continue;
    if (trimmed.startsWith('direction ')) continue;
    if (trimmed.startsWith('end')) continue;

    // subgraph 定义行: `subgraph id[Title]` 或 `subgraph id` 或 `subgraph "Title"`
    const subgraphMatch = trimmed.match(/^subgraph\s+(\S+)/);
    if (subgraphMatch) {
      const id = subgraphMatch[1];
      if (!id) continue;
      // 去除可能的 [Title] 后缀
      const pureId = id.replace(/[\[\(].*$/, '');
      const node = nodeMap.get(pureId);
      if (node) {
        (node.data as Record<string, unknown>)._sourceLine = lineIdx;
      }
      continue;
    }

    // 边定义行或顶点+边定义行:
    //   - `source --> target` (纯边)
    //   - `A[Hello] --> B[World]` (顶点 + 边)
    //   - `A[Hello]` (纯顶点)
    // 边符号: --> --- --x --o ==> === ==x ==o -.- -.-> -.x -.o <--> x--x o--o ~~~
    //
    // 策略: 提取 source ID → 跳过可选顶点定义 → 查找边符号 → 提取 target
    const sourceMatch = trimmed.match(/^([A-Za-z0-9_]+)/);
    if (sourceMatch) {
      const sourceId = sourceMatch[1]!;
      const sourceEnd = sourceMatch.index! + sourceId.length;

      // 跳过空格
      let pos = sourceEnd;
      while (pos < trimmed.length && /\s/.test(trimmed[pos])) pos++;

      // 跳过可选的顶点定义（[...] / (...) / {...} / <...] / @{...}）
      let hasVertexDef = false;
      if (pos < trimmed.length) {
        const skipped = skipVertexDefinition(trimmed, pos);
        if (skipped > pos) {
          pos = skipped + 1;
          hasVertexDef = true;
          // 跳过空格
          while (pos < trimmed.length && /\s/.test(trimmed[pos])) pos++;
        }
      }

      // 查找边符号
      let edgeMatched = false;
      if (pos < trimmed.length) {
        const remaining = trimmed.substring(pos);
        const edgeSymbolMatch = remaining.match(/^([-=~<>~o.x]+)/);
        if (edgeSymbolMatch) {
          const edgeSymbol = edgeSymbolMatch[1]!;
          if (isEdgeSymbol(edgeSymbol)) {
            // 提取 target id（跳过可选的边标签 |label|）
            const afterSymbol = remaining.substring(edgeSymbol.length).trim();
            const labelMatch = afterSymbol.match(/^\|[^|]*\|\s*/);
            const afterLabel = labelMatch ? afterSymbol.substring(labelMatch[0].length) : afterSymbol;
            const targetMatch = afterLabel.match(/^([A-Za-z0-9_]+)/);
            if (targetMatch) {
              const targetId = targetMatch[1]!;
              const key = `${sourceId}→${targetId}`;
              const candidates = edgeMap.get(key);
              if (candidates) {
                const edge = candidates.find((e) => !matchedEdges.has(e));
                if (edge) {
                  (edge.data as Record<string, unknown>)._sourceLine = lineIdx;
                  matchedEdges.add(edge);
                  edgeMatched = true;
                  // 同时设置 source 节点的 _sourceLine（行包含顶点定义时）
                  if (hasVertexDef) {
                    const sourceNode = nodeMap.get(sourceId);
                    if (sourceNode) {
                      const isSubgraph = (sourceNode.data as Record<string, unknown>).isSubgraph === true;
                      if (!isSubgraph) {
                        (sourceNode.data as Record<string, unknown>)._sourceLine = lineIdx;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      // 未匹配到边，但行有顶点定义 → 设置顶点 _sourceLine
      if (!edgeMatched && hasVertexDef) {
        const sourceNode = nodeMap.get(sourceId);
        if (sourceNode) {
          const isSubgraph = (sourceNode.data as Record<string, unknown>).isSubgraph === true;
          if (!isSubgraph) {
            (sourceNode.data as Record<string, unknown>)._sourceLine = lineIdx;
          }
        }
      }

      continue;
    }
  }
}

/** 判断是否为边符号（包含 - = ~ 或双向箭头） */
function isEdgeSymbol(symbol: string): boolean {
  // 边符号必须包含 - = ~ 之一，或为双向箭头 <--> x--x o--o
  if (symbol.includes('-')) return true;
  if (symbol.includes('=')) return true;
  if (symbol.includes('~')) return true;
  if (symbol.includes('<')) return true; // <--> 双向
  return false;
}

/**
 * 跳过顶点定义，返回闭合括号的位置
 *
 * 支持的顶点定义语法:
 *   - [label] / [[label]] / [(label)] / [({label})] 等方括号变体
 *   - (label) / ((label)) 等圆括号变体
 *   - {label} / {{label}} 等花括号变体
 *   - >label] odd 形状
 *   - @{ shape: xxx, label: "..." } 扩展形状
 *   - [|field:value|label] 带属性的矩形
 *
 * @param line - 行内容
 * @param startPos - 顶点定义起始位置（指向起始括号或 @）
 * @returns 闭合括号位置，若无法匹配返回 -1
 */
function skipVertexDefinition(line: string, startPos: number): number {
  if (startPos >= line.length) return -1;
  const startChar = line[startPos];

  // @{...} 扩展形状
  if (startChar === '@') {
    const braceStart = line.indexOf('{', startPos);
    if (braceStart === -1) return -1;
    return findMatchingBracket(line, braceStart, '{', '}');
  }

  // 根据起始字符确定闭合字符
  let openChar: string;
  let closeChar: string;
  switch (startChar) {
    case '[':
      openChar = '[';
      closeChar = ']';
      break;
    case '(':
      openChar = '(';
      closeChar = ')';
      break;
    case '{':
      openChar = '{';
      closeChar = '}';
      break;
    case '<':
      // odd 形状: >label]
      openChar = '<';
      closeChar = ']';
      break;
    default:
      return -1;
  }

  return findMatchingBracket(line, startPos, openChar, closeChar);
}

/** 查找匹配的闭合括号（考虑嵌套） */
function findMatchingBracket(line: string, startPos: number, open: string, close: string): number {
  let depth = 0;
  for (let i = startPos; i < line.length; i++) {
    if (line[i] === open) depth++;
    else if (line[i] === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}
