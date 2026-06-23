/**
 * 实体序列化器 — MermaidNode (er-box) → Mermaid erDiagram 实体定义代码
 *
 * 单一职责：将 er-box 实体节点序列化为 Mermaid erDiagram 实体定义语法
 *
 * 语法:
 *   CUSTOMER {
 *     string id PK
 *     string name
 *     string address
 *   }
 *
 * 带注释:
 *   ORDER {
 *     string order_id PK "订单ID"
 *     string customer_id FK "客户ID"
 *   }
 *
 * 带别名:
 *   CUSTOMER[Customer] {
 *     string id PK
 *   }
 *
 * 无属性:
 *   CUSTOMER
 *
 * 数据流:
 *   MermaidNode (type='er-box')
 *     → serializeEntity(node)
 *     → 处理 label/alias/attributes
 *     → 输出 Mermaid 实体定义代码块
 */

import type { MermaidNode, NodeAttribute, MermaidNodeData } from '../../types.js';
import { escapeStringLiteral } from '../shared/escape-helpers.js';

// ============================================================
// 公共 API
// ============================================================

/**
 * 序列化实体节点为 Mermaid erDiagram 实体定义
 *
 * @param node - 实体节点 (type='er-box')
 * @returns Mermaid 实体定义代码（含 `{ ... }` 块或单行 `ENTITY_NAME`）
 */
export function serializeEntity(node: MermaidNode): string {
  const { data } = node;
  const label = data.label;
  const alias = readField<string>(data, 'alias');
  const attributes = data.attributes ?? [];

  // 实体名（含别名: `LABEL[alias]`）
  const entityHeader = alias ? `${label}[${alias}]` : label;

  // 无属性时输出单行声明
  if (attributes.length === 0) {
    return entityHeader;
  }

  // 有属性时输出多行块
  const lines: string[] = [];
  lines.push(`${entityHeader} {`);

  for (const attr of attributes) {
    lines.push(`  ${serializeAttribute(attr)}`);
  }

  lines.push('}');

  return lines.join('\n');
}

/**
 * 序列化单个属性为 Mermaid 属性行
 *
 * 格式: `type name keys comment`
 *   - keys: PK/FK/UK，多个用逗号分隔
 *   - comment: 用双引号包裹（如 `"订单ID"`），内部双引号转义
 *
 * @param attr - 实体属性
 * @returns Mermaid 属性行（如 `string order_id PK "订单ID"`）
 */
export function serializeAttribute(attr: NodeAttribute): string {
  const parts: string[] = [attr.type, attr.name];

  // 属性键（PK/FK/UK，多个用逗号分隔）
  if (attr.keys && attr.keys.length > 0) {
    parts.push(attr.keys.join(','));
  }

  // 注释（用双引号包裹，转义内部双引号）
  if (attr.comment) {
    parts.push(`"${escapeStringLiteral(attr.comment)}"`);
  }

  return parts.join(' ');
}

// ============================================================
// 辅助函数
// ============================================================

/** 安全读取 MermaidNodeData 的扩展字段 */
function readField<T>(data: MermaidNodeData, key: string): T | undefined {
  const value = (data as Record<string, unknown>)[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  return value as T;
}
