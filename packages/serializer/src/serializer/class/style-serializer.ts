/**
 * 样式序列化器 — classDef/class/style → Mermaid 样式代码
 *
 * 单一职责：将画布元数据中的样式信息序列化为 Mermaid classDiagram 样式语句
 *
 * 语法:
 *   classDef id style1,style2,...
 *   class nodeId className
 *   style nodeId fill:#f00,stroke:#900
 *
 * 数据流:
 *   GraphMetadata.classStyleClasses → classDef 语句
 *   MermaidNode.data.classNames → class 应用语句
 *   MermaidNode.data.styles → style 语句（内联样式）
 */

import type { MermaidNode, GraphMetadata, MermaidNodeData } from '../../types.js';

// ============================================================
// 类型
// ============================================================

/**
 * Class 样式类（classDef 定义的样式类）
 *
 * 注意: M0 types.ts 未定义此类型，class 专用，
 * 通过 GraphMetadata 的索引签名 `[key: string]: unknown` 承载
 */
interface StyleClass {
  id: string;
  styles: string[];
  textStyles: string[];
}

// ============================================================
// 公共 API
// ============================================================

/**
 * 序列化 classDef 语句
 *
 * 从 metadata.classStyleClasses 读取样式类定义
 *
 * @param metadata - 画布元数据
 * @returns classDef 代码行数组（如 `classDef red fill:#f00`）
 */
export function serializeClassDefs(metadata: GraphMetadata | undefined): string[] {
  const classes = readField<StyleClass[]>(metadata, 'classStyleClasses');
  if (!classes || classes.length === 0) {
    return [];
  }

  return classes.map((cls) => {
    // 合并 styles 和 textStyles（对齐官方 classDb.ts 的 defineClass 逻辑）
    const allStyles = [...cls.styles, ...cls.textStyles];
    return `classDef ${cls.id} ${allStyles.join(',')}`;
  });
}

/**
 * 序列化 class 应用语句（`class nodeId ::: className`）
 *
 * 从节点的 data.classNames 读取应用的 CSS 类名列表
 * 仅处理 class-box 类型节点（classDiagram 的类节点）
 *
 * 注意: mermaid classDiagram 语法要求使用 `:::` 分隔符应用 CSS 类，
 * 且每条语句只能应用一个 CSS 类。多个 classNames 拆分为多条语句。
 *
 * @param nodes - 画布所有节点
 * @returns class 代码行数组（如 `class A ::: red`）
 */
export function serializeClassApplications(nodes: MermaidNode[]): string[] {
  const lines: string[] = [];

  for (const node of nodes) {
    // 仅处理 class-box 类型节点
    if (node.type !== 'class-box') {
      continue;
    }

    const classNames = node.data.classNames;
    if (!classNames || classNames.length === 0) {
      continue;
    }

    // 每条语句只能应用一个 CSS 类，多个 classNames 拆分为多条语句
    for (const className of classNames) {
      lines.push(`class ${node.id} ::: ${className}`);
    }
  }

  return lines;
}

/**
 * 序列化 style 语句（`style nodeId fill:#f00,stroke:#900`）
 *
 * 从节点的 data.styles 扩展字段读取内联样式列表
 * 仅处理 class-box 类型节点
 *
 * @param nodes - 画布所有节点
 * @returns style 代码行数组（如 `style A fill:#f00`）
 */
export function serializeNodeStyles(nodes: MermaidNode[]): string[] {
  const lines: string[] = [];

  for (const node of nodes) {
    // 仅处理 class-box 类型节点
    if (node.type !== 'class-box') {
      continue;
    }

    const styles = readField<string[]>(node.data, 'styles');
    if (!styles || styles.length === 0) {
      continue;
    }

    lines.push(`style ${node.id} ${styles.join(',')}`);
  }

  return lines;
}

// ============================================================
// 辅助函数
// ============================================================

/** 安全读取扩展字段（支持 GraphMetadata 和 MermaidNodeData） */
function readField<T>(
  data: Record<string, unknown> | undefined,
  key: string,
): T | undefined {
  if (!data) {
    return undefined;
  }
  const value = data[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  return value as T;
}
