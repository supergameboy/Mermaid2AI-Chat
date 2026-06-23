/**
 * Mindmap Diagram AST 类型定义
 *
 * 单一职责：定义 MindmapDB 内部数据结构（AST 层）
 *
 * 注意：这些类型是 MindmapDB 内部使用的 AST 层类型，
 * 与 M0 types.ts 中的 MindmapNodeType 等公共类型不同。
 * 公共类型由 M0 统一定义，本文件仅定义 DB 内部数据结构。
 *
 * edges 不再由 DB 生成存储，改为渲染时从 parentId 关系派生（单一数据源）。
 */

// ============================================================
// AST 层 — jison 产物
// ============================================================

/**
 * 节点类型常量（AST 层，与 MindmapNodeType 字符串映射）
 *
 * 对齐官方 mindmapDb.ts 的 nodeType 常量
 */
export const MindmapNodeTypeConst = {
  DEFAULT: 0, // no-border → 'default'
  NO_BORDER: 0,
  ROUNDED_RECT: 1, // → 'rounded'
  RECT: 2, // → 'rect'
  CIRCLE: 3, // → 'circle'
  CLOUD: 4, // → 'cloud'
  BANG: 5, // → 'bang'
  HEXAGON: 6, // → 'hexagon'
} as const;

/** MindmapNodeTypeConst 的值类型 */
export type MindmapNodeTypeValue =
  (typeof MindmapNodeTypeConst)[keyof typeof MindmapNodeTypeConst];

/** MindmapDB 内部节点（AST 层，树形结构） */
export interface MindmapDBNode {
  id: number;
  nodeId: string;
  level: number;
  descr: string;
  type: MindmapNodeTypeValue;
  children: MindmapDBNode[];
  width: number;
  padding: number;
  section?: number;
  height?: number;
  class?: string;
  icon?: string;
  x?: number;
  y?: number;
  isRoot?: boolean;
  labelType?: string;
}

// ============================================================
// DB 层 — getData() 返回类型
// ============================================================

/**
 * 布局节点（flattenNodes 输出，AST 层）
 *
 * edges 不再由 DB 生成，改为渲染时从 parentId 派生
 */
export interface MindmapLayoutNode {
  id: string;
  domId: string;
  label: string;
  labelType: string;
  isGroup: boolean;
  shape: string;
  width: number;
  height: number;
  padding: number;
  cssClasses: string;
  cssStyles: string[];
  icon?: string;
  x?: number;
  y?: number;
  /** mindmap 专用: 层级（root=0） */
  level: number;
  /** mindmap 专用: 用户定义的 nodeId */
  nodeId: string;
  /** mindmap 专用: 节点类型（MindmapNodeTypeConst 值） */
  type: MindmapNodeTypeValue;
  /** mindmap 专用: section 编号（用于着色） */
  section?: number;
  /** mindmap 专用: 父节点 id（用于派生 edges） */
  parentId?: string;
  /** mindmap 专用: 是否为 root */
  isRoot?: boolean;
  /** mindmap 专用: CSS class 装饰 */
  class?: string;
}

/** MindmapDB getData() 返回类型 */
export interface MindmapDBData {
  nodes: MindmapLayoutNode[];
  config: unknown;
}
