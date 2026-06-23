/**
 * class 解析器
 *
 * 单一职责：将 Mermaid classDiagram 代码解析为 CanvasState (GraphCanvasState)
 *
 * 数据流:
 *   源代码字符串
 *     → 加载 jison 生成的 class-parser.cjs
 *     → 创建 ClassDB 实例，作为 yy 传入 parser
 *     → parser.parse(source) 调用 ClassDB.addClass/addRelation/... 收集数据
 *     → ClassDB.getData() 返回 ClassAST
 *     → mapAstToCanvasState(ast) 映射为 CanvasState
 *
 * 错误处理:
 *   - jison 抛出的语法错误被捕获，转换为 ParseError[]
 *   - 解析成功时 errors 为空数组
 */

import { parser as classParser } from '../jison/class-parser.js';
import { preprocessCode } from '../../detector/preprocessor.js';
import type {
  GraphCanvasState,
  MermaidNode,
  MermaidEdge,
  MermaidNodeData,
  MermaidEdgeData,
  MermaidShapeType,
  MermaidEdgeStyle,
  ClassRelationType,
  ClassLineType,
  ClassVisibility,
  NodeMember,
  ClassNamespaceInfo,
  ClassNoteInfo,
  GraphMetadata,
  ParseError,
} from '../../types.js';
import type { ClassAST } from '../../ast/class-ast.js';
import type {
  ClassNode,
  ClassRelation,
  ClassNote,
  NamespaceNode,
  Interface,
  StyleClass,
} from './types.js';
import type { ClassMember } from './class-member.js';
import { ClassDB } from './class-db.js';
import {
  RELATION_TYPE,
  LINE_TYPE,
  resolveRelationType,
  LINE_TYPE_TO_CLASS_LINE_TYPE,
} from './constants.js';

// ============================================================
// jison parser（静态 import，浏览器兼容）
// ============================================================

interface JisonParserInstance {
  parse(input: string): unknown;
  yy: unknown;
}

/** class jison 解析器实例 */
const classJisonParser: JisonParserInstance = classParser as unknown as JisonParserInstance;

// ============================================================
// 解析结果类型
// ============================================================

/** class 解析结果 */
export interface ClassParseResult {
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

/** Class stereotype（从 annotation 推断） */
type ClassStereotype =
  | 'interface' | 'abstract' | 'annotation' | 'enum'
  | 'protocol' | 'exception' | 'metaclass' | 'stereotype';

/** annotation → stereotype 映射 */
const ANNOTATION_TO_STEREOTYPE: Readonly<Record<string, ClassStereotype>> = {
  interface: 'interface',
  abstract: 'abstract',
  annotation: 'annotation',
  enum: 'enum',
  protocol: 'protocol',
  exception: 'exception',
  metaclass: 'metaclass',
  stereotype: 'stereotype',
};

/**
 * 将 ClassAST 映射为 CanvasState (GraphCanvasState with diagramType='classDiagram')
 *
 * 映射规则:
 *   - namespaces → nodes（命名空间节点，type='namespace'，作为父节点）
 *   - classes → nodes（类节点，shape='class-box'，含 members/annotations/stereotype/generics）
 *   - notes → nodes（注释节点，shape='note'）+ edges（注释→类连接边）
 *   - interfaces → nodes（接口节点，lollipop 关系自动生成）
 *   - relations → edges（关系边，含 relationType/lineType/cardinality/label）
 *   - styleClasses → metadata.classStyleClasses
 *   - direction → metadata.direction
 *   - accTitle/accDescr → metadata.accTitle/accDescription
 */
function mapAstToCanvasState(ast: ClassAST): GraphCanvasState {
  const nodes: MermaidNode[] = [];
  const edges: MermaidEdge[] = [];
  const namespaces: ClassNamespaceInfo[] = [];
  const classNotes: ClassNoteInfo[] = [];

  // ============================================================
  // 1. 映射 namespaces → nodes + metadata.namespaces
  // ============================================================
  for (const namespace of ast.namespaces.values()) {
    const namespaceNode: MermaidNode = {
      id: namespace.id,
      type: 'namespace',
      position: { x: 0, y: 0 },
      data: {
        label: namespace.label,
        shape: 'rect' as MermaidShapeType,
      },
      parentId: namespace.parent,
      extent: 'parent',
    };
    nodes.push(namespaceNode);

    // 收集 namespace 信息到 metadata
    namespaces.push({
      name: namespace.id,
      classIds: [...namespace.classes.keys()],
    });
  }

  // ============================================================
  // 2. 映射 classes → nodes
  // ============================================================
  let classIndex = 0;
  for (const classNode of ast.classes.values()) {
    const stereotype = inferStereotype(classNode.annotations);
    const members = convertMembers(classNode.members, classNode.methods);

    const data: MermaidNodeData = {
      label: classNode.label,
      shape: 'class-box' as MermaidShapeType,
      members,
      ...(classNode.annotations.length > 0 ? { annotations: classNode.annotations } : {}),
      ...(stereotype ? { stereotype } : {}),
      ...(classNode.type ? { generics: classNode.type } : {}),
      ...(classNode.cssClasses && classNode.cssClasses !== 'default'
        ? { classNames: classNode.cssClasses.split(' ').filter((cn) => cn && cn !== 'default') }
        : {}),
      ...(classNode.link ? { clickUrl: classNode.link } : {}),
      ...(classNode.haveCallback ? { clickCallback: 'true' } : {}),
      ...(classNode.tooltip ? { tooltip: classNode.tooltip } : {}),
      ...(classNode.parent ? { classNamespace: classNode.parent } : {}),
      ...(classNode.styles.length > 0 ? { styles: classNode.styles } : {}),
    };

    nodes.push({
      id: classNode.id,
      type: 'class-box',
      position: { x: classIndex * 250, y: 0 },
      data,
      parentId: classNode.parent,
      ...(classNode.parent ? { extent: 'parent' as const } : {}),
    });

    classIndex++;
  }

  // ============================================================
  // 3. 映射 notes → nodes + edges（note → class 连接）
  // ============================================================
  for (const note of ast.notes.values()) {
    const noteNode: MermaidNode = {
      id: note.id,
      type: 'note',
      position: { x: 0, y: 0 },
      data: {
        label: note.text,
        shape: 'note' as MermaidShapeType,
      },
      parentId: note.parent,
      ...(note.parent ? { extent: 'parent' as const } : {}),
    };
    nodes.push(noteNode);

    // 收集 note 信息到 metadata
    if (note.class) {
      classNotes.push({
        classId: note.class,
        position: 'top', // 默认位置，classDiagram 的 note 不指定位置
        label: note.text,
      });
    }

    // 创建 note → class 的连接边
    if (note.class) {
      const noteEdge: MermaidEdge = {
        id: `edge-${note.id}-${note.class}`,
        source: note.id,
        target: note.class,
        type: 'note-edge',
        data: {
          edgeStyle: 'dotted' as MermaidEdgeStyle,
        },
      };
      edges.push(noteEdge);
    }
  }

  // ============================================================
  // 4. 映射 interfaces → nodes（lollipop 关系自动生成的接口节点）
  // ============================================================
  for (const iface of ast.interfaces) {
    const interfaceNode: MermaidNode = {
      id: iface.id,
      type: 'class-box',
      position: { x: 0, y: 0 },
      data: {
        label: iface.label,
        shape: 'class-box' as MermaidShapeType,
      },
    };
    nodes.push(interfaceNode);
  }

  // ============================================================
  // 5. 映射 relations → edges
  // ============================================================
  let relationIndex = 0;
  for (const relation of ast.relations) {
    relationIndex++;
    const edge = mapRelationToEdge(relation, relationIndex);
    edges.push(edge);
  }

  // ============================================================
  // 6. 构建 metadata
  // ============================================================
  const metadata: GraphMetadata = {
    ...(namespaces.length > 0 ? { namespaces } : {}),
    ...(classNotes.length > 0 ? { classNotes } : {}),
    ...(ast.styleClasses.size > 0
      ? { classStyleClasses: [...ast.styleClasses.values()] }
      : {}),
    ...(ast.direction ? { direction: ast.direction } : {}),
    ...(ast.accTitle ? { accTitle: ast.accTitle } : {}),
    ...(ast.accDescr ? { accDescription: ast.accDescr } : {}),
  };

  return {
    diagramType: 'classDiagram',
    nodes,
    edges,
    ...(ast.direction ? { direction: ast.direction as GraphCanvasState['direction'] } : {}),
    metadata,
  };
}

/**
 * 从 annotations 推断 stereotype
 *
 * annotations 如 `['interface']` → stereotype='interface'
 */
function inferStereotype(annotations: string[]): ClassStereotype | undefined {
  for (const annotation of annotations) {
    const lower = annotation.toLowerCase().trim();
    const stereotype = ANNOTATION_TO_STEREOTYPE[lower];
    if (stereotype) {
      return stereotype;
    }
  }
  return undefined;
}

/**
 * 将 ClassMember[] 转换为 NodeMember[]
 *
 * ClassMember.id 对于属性包含 `name: type` 格式，需要拆分
 * ClassMember.id 对于方法仅是方法名
 */
function convertMembers(
  attributes: ClassMember[],
  methods: ClassMember[],
): NodeMember[] {
  const result: NodeMember[] = [];

  // 转换属性
  for (const attr of attributes) {
    const { name, type } = parseAttributeNameAndType(attr.id);
    result.push({
      name,
      ...(type ? { type } : {}),
      visibility: attr.visibility as ClassVisibility,
      isStatic: attr.classifier === '*',
      isAbstract: attr.classifier === '$',
      isMethod: false,
    });
  }

  // 转换方法
  for (const method of methods) {
    result.push({
      name: method.id,
      visibility: method.visibility as ClassVisibility,
      isStatic: method.classifier === '*',
      isAbstract: method.classifier === '$',
      ...(method.returnType ? { returnType: method.returnType } : {}),
      ...(method.parameters ? { parameters: method.parameters } : {}),
      isMethod: true,
    });
  }

  return result;
}

/** 解析属性名和类型（`attrName: Type` → `{ name: 'attrName', type: 'Type' }`） */
function parseAttributeNameAndType(id: string): { name: string; type?: string } {
  const colonIndex = id.indexOf(':');
  if (colonIndex < 0) {
    return { name: id.trim() };
  }
  const name = id.substring(0, colonIndex).trim();
  const type = id.substring(colonIndex + 1).trim();
  return { name, ...(type ? { type } : {}) };
}

/**
 * 将 ClassRelation 映射为 MermaidEdge
 */
function mapRelationToEdge(relation: ClassRelation, index: number): MermaidEdge {
  const type1 = typeof relation.relation.type1 === 'number' ? relation.relation.type1 : undefined;
  const type2 = typeof relation.relation.type2 === 'number' ? relation.relation.type2 : undefined;
  const lineType = relation.relation.lineType;

  // 推断主关系类型
  // 特殊处理：区分 aggregation（o 在 source 端）和 lollipop（o 在 target 端）
  //   - type1=AGGREGATION, type2=undefined → aggregation（A o-- B）
  //   - type1=undefined, type2=AGGREGATION → lollipop（A --o B）
  let relationType: ClassRelationType;
  if (type1 === RELATION_TYPE.AGGREGATION && type2 === undefined) {
    relationType = 'aggregation';
  } else if (type2 === RELATION_TYPE.AGGREGATION && type1 === undefined) {
    relationType = 'lollipop';
  } else {
    const primaryType = type2 ?? type1;
    relationType = primaryType !== undefined
      ? resolveRelationType(primaryType, lineType)
      : 'association';
  }

  // 映射线型
  const classLineType: ClassLineType = LINE_TYPE_TO_CLASS_LINE_TYPE[lineType] ?? 'line';

  // 映射边样式（class 关系使用 dotted 或 line）
  const edgeStyle: MermaidEdgeStyle = classLineType === 'dotted' ? 'dotted' : 'line';

  // 构建边数据
  // 注意：class 的基数使用 classCardinality 扩展字段（通过索引签名承载），
  // 避免与 MermaidEdgeData.cardinality（ER 专用，{ from: ERCardinality; to: ERCardinality }）冲突
  const data: MermaidEdgeData = {
    edgeStyle,
    ...(relation.title ? { label: relation.title, relationLabel: relation.title } : {}),
    relationType,
    lineType: classLineType,
    ...(type1 !== undefined && type1 !== RELATION_TYPE.LOLLIPOP
      ? { startRelationType: resolveRelationType(type1, lineType) }
      : {}),
    ...(type2 !== undefined && type2 !== RELATION_TYPE.LOLLIPOP
      ? { endRelationType: resolveRelationType(type2, lineType) }
      : {}),
    ...(relation.relationTitle1 && relation.relationTitle1 !== 'none'
      ? { classCardinality: { from: relation.relationTitle1, to: relation.relationTitle2 === 'none' ? '' : relation.relationTitle2 } }
      : {}),
  };

  return {
    id: `class-edge-${index}`,
    source: relation.id1,
    target: relation.id2,
    type: 'class-relation',
    data,
  };
}

// ============================================================
// 公共 API
// ============================================================

/**
 * 解析 classDiagram 代码为 CanvasState
 *
 * 预处理（架构修复）:
 *   - 内部调用 preprocessCode 清理 frontmatter/指令/注释（保持行号一致）
 *   - jison 解析清理后的 code，错误上下文使用原始 source
 *
 * @param source - Mermaid classDiagram 源代码（可含 %% 注释、%%{directive}%%、frontmatter）
 * @returns 解析结果（包含 canvas 和 errors）
 */
export function parseClass(source: string): ClassParseResult {
  const parser = classJisonParser;
  const classDB = new ClassDB();

  // 将 ClassDB 实例作为 yy 传入 parser
  // jison 语法动作通过 yy.addClass/yy.addRelation/... 调用 ClassDB 方法
  parser.yy = classDB;

  try {
    // 预处理：清理 frontmatter/指令/注释（替换为等长换行，保持行号一致）
    // jison 无法解析 %% 注释和 %%{directive}%%，必须预处理
    const preprocessedSource = preprocessCode(source);
    // jison 语法要求 classDiagram 后必须有 NEWLINE
    const normalizedSource = preprocessedSource.endsWith('\n') ? preprocessedSource : preprocessedSource + '\n';
    parser.parse(normalizedSource);

    const ast = classDB.getData();
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
      diagramType: 'classDiagram',
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
    return err.message || 'class parse error';
  }
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return 'class parse error';
}
