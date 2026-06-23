/**
 * ER Diagram 专用 AST 层类型定义
 *
 * 单一职责：定义 ErDB 内部使用的 EntityNode/Attribute/Relationship/RelSpec/EntityClass/ErSubGraph 类型
 * 来源：移植自官方 mermaid packages/mermaid/src/diagrams/er/erTypes.ts
 *
 * 注意：
 * - 核心类型（ERCardinality / ERIdentification / ERAttributeKey / NodeAttribute /
 *   MermaidNodeData / MermaidEdgeData / GraphMetadata）
 *   已在 M0 `packages/serializer/src/types.ts` 中统一定义，本文件不重新定义
 * - 本文件仅定义 er 解析器内部使用的 AST 层数据结构（与官方 erTypes.ts 对齐）
 */

/** ER 实体属性键类型（对齐官方 erTypes.ts，与 M0 ERAttributeKey 一致） */
export type ErAttributeKeyType = 'PK' | 'FK' | 'UK';

/** ER 实体属性（对齐官方 erTypes.ts Attribute） */
export interface Attribute {
  type: string;
  name: string;
  /** 属性键列表（PK/FK/UK） */
  keys: ErAttributeKeyType[];
  /** 属性注释 */
  comment: string;
}

/** ER 实体节点（对齐官方 erTypes.ts EntityNode） */
export interface EntityNode {
  id: string;
  label: string;
  attributes: Attribute[];
  /** 实体别名（如 `CUSTOMER[Customer]` 中的 `Customer`） */
  alias: string;
  /** 形状固定为 erBox */
  shape: 'erBox';
  /** 渲染外观（由渲染层使用，解析层不设置） */
  look?: string;
  /** CSS 类名字符串（空格分隔） */
  cssClasses?: string;
  /** 内联样式列表 */
  cssStyles?: string[];
  /** 编译后的样式列表（由 getCompiledStyles 生成） */
  cssCompiledStyles?: string[];
  /** 标签类型（markdown/string/text） */
  labelType?: string;
  /** 颜色索引（由 getData 生成，用于渲染层着色） */
  colorIndex?: number;
}

/** ER 关系细节（对齐官方 erTypes.ts RelSpec） */
export interface RelSpec {
  /** A 端基数（CARDINALITY 常量值） */
  cardA: string;
  /** B 端基数（CARDINALITY 常量值） */
  cardB: string;
  /** 关系类型（IDENTIFICATION 常量值） */
  relType: string;
}

/** ER 关系（对齐官方 erTypes.ts Relationship） */
export interface Relationship {
  /** A 端实体 ID（或 subgraph ID） */
  entityA: string;
  /** A 端角色（关系标签） */
  roleA: string;
  /** B 端实体 ID（或 subgraph ID） */
  entityB: string;
  /** 关系细节 */
  relSpec: RelSpec;
}

/** ER 样式类（classDef 定义的样式类，对齐官方 erTypes.ts EntityClass） */
export interface EntityClass {
  id: string;
  styles: string[];
  textStyles: string[];
}

/** ER 子图（对齐官方 erTypes.ts ErSubGraph） */
export interface ErSubGraph {
  /** 子图 ID */
  id: string;
  /** 子图标题 */
  title: string;
  /** 子图包含的节点 ID 列表 */
  nodes: string[];
  /** 应用的 CSS 类名列表 */
  classes: string[];
  /** 内联样式列表 */
  cssStyles?: string[];
  /** 子图方向（可选） */
  dir?: string;
  /** 标签类型 */
  labelType: string;
}

/** ER 实体映射类型 */
export type EntityMap = Map<string, EntityNode>;

/** ER 样式类映射类型 */
export type EntityClassMap = Map<string, EntityClass>;

/** jison parser 调用的 yy 对象接口（用于类型约束） */
export interface ErDBYY {
  addEntity: (name: string, alias?: string) => EntityNode;
  addAttributes: (entityName: string, attribs: Attribute[]) => void;
  addRelationship: (entA: string, rolA: string, entB: string, rSpec: RelSpec) => void;
  setDirection: (dir: string) => void;
  addCssStyles: (ids: string[], styles: string[]) => void;
  addClass: (ids: string[], style: string[]) => void;
  setClass: (ids: string[], classNames: string[]) => void;
  addSubGraph: (
    _id: { text: string },
    list: string[],
    _title: { text: string; type?: string },
  ) => string;
  setAccTitle: (title: string) => void;
  setAccDescription: (desc: string) => void;
  Cardinality: typeof import('./constants.js').CARDINALITY;
  Identification: typeof import('./constants.js').IDENTIFICATION;
  /** jison 语法中读写 subgraphDepth 用于跟踪嵌套深度 */
  subgraphDepth: number;
}
