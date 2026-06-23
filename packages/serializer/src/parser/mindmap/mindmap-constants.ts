/**
 * Mindmap 常量定义
 *
 * 移植自官方 mermaid mindmapDb.ts / svgDraw.ts
 * 单一职责：提供 mindmap 解析/序列化所需的常量
 */

/** 最大 section 数量（用于 section 着色，对齐官方 svgDraw.ts MAX_SECTIONS=12） */
export const MAX_SECTIONS = 12;

/** 默认节点宽度 */
export const DEFAULT_NODE_WIDTH = 200;

/** 默认节点高度 */
export const DEFAULT_NODE_HEIGHT = 50;

/** 默认节点 padding */
export const DEFAULT_NODE_PADDING = 10;

/** 默认最大节点宽度 */
export const DEFAULT_MAX_NODE_WIDTH = 200;

/** 默认 look（对齐官方 defaultConfig） */
export const DEFAULT_LOOK = 'classic' as const;

/** 默认 labelType */
export const DEFAULT_LABEL_TYPE = 'markdown' as const;

/** CSS 类名前缀 */
export const CSS_MINDMAP_NODE = 'mindmap-node';
export const CSS_SECTION_ROOT = 'section-root';
export const CSS_SECTION_PREFIX = 'section-';
export const CSS_SECTION_ROOT_LEGACY = 'section--1';
