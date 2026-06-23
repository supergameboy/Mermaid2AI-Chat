/**
 * 关系序列化器 — MermaidEdge (er-relation) → Mermaid erDiagram 关系代码
 *
 * 单一职责：将 er-relation 关系边序列化为 Mermaid erDiagram 关系语法
 *
 * 语法:
 *   CUSTOMER ||--o{ ORDER : places
 *   CUSTOMER ||--o{ ORDER : "subscribed via"
 *   A |o--o{ B : has
 *   A }o..o{ B : "relates to"
 *
 * 关系格式: `SOURCE cardFrom lineType cardTo TARGET : role`
 *   - cardFrom: cardinality.from 的符号（如 `||`）
 *   - lineType: erIdentification 的符号（`--` 实线 / `..` 虚线）
 *   - cardTo: cardinality.to 的符号（如 `o{`）
 *   - role: 角色标签（可选，含空格时用双引号包裹）
 *
 * 基数符号映射（与 parser/er/constants.ts CARDINALITY_TO_SYMBOL 对齐）:
 *   'zero-or-one'  → |o
 *   'zero-or-more' → o{
 *   'one-or-more'  → |{
 *   'only-one'     → ||
 *   'md-parent'    → u  (仅 source 端有效，jison 中 u(?=[\.\-\|]) 只匹配后跟 -/./| 的 u)
 *
 * 关系类型符号映射（与 parser/er/constants.ts IDENTIFICATION_TO_SYMBOL 对齐）:
 *   'identifying'     → --  (实线，标识关系)
 *   'non-identifying' → ..  (虚线，非标识关系)
 *
 * 数据流:
 *   MermaidEdge (type='er-relation')
 *     → serializeRelationship(edge)
 *     → 处理 cardinality/erIdentification → 关系符号
 *     → 处理 erRole/label → 角色标签
 *     → 输出 Mermaid 关系代码行 + 错误列表
 */

import type { MermaidEdge, MermaidNode, ERCardinality, ERIdentification, ParseError } from '../../types.js';
import { escapeStringLiteral } from '../shared/escape-helpers.js';

// ============================================================
// 常量
// ============================================================

/** ERCardinality → Mermaid 符号（与 parser/er/constants.ts CARDINALITY_TO_SYMBOL 对齐）
 *
 * 注意：
 *   - 序列化输出右侧形式符号（o{/|{），jison 解析时 }o/}| 也会被识别为相同基数
 *   - MD_PARENT 输出 'u'，仅在 source 端（cardinality.from）有效
 *     jison 中 u(?=[\.\-\|]) 仅在后跟 -/.//| 时解析为 MD_PARENT
 */
const CARDINALITY_SYMBOL: Readonly<Record<ERCardinality, string>> = {
  'zero-or-one': '|o',
  'zero-or-more': 'o{',
  'one-or-more': '|{',
  'only-one': '||',
  'md-parent': 'u',
};

/** ERIdentification → Mermaid 线型符号（与 parser/er/constants.ts IDENTIFICATION_TO_SYMBOL 对齐） */
const IDENTIFICATION_SYMBOL: Readonly<Record<ERIdentification, string>> = {
  identifying: '--',
  'non-identifying': '..',
};

/** 默认基数（cardinality 缺失时假设） */
const DEFAULT_CARDINALITY: ERCardinality = 'only-one';

/** 默认关系类型（erIdentification 缺失时假设） */
const DEFAULT_IDENTIFICATION: ERIdentification = 'identifying';

/** 角色标签中需要用双引号包裹的字符（空格、双引号、花括号、方括号、竖线、冒号） */
const ROLE_SPECIAL_CHARS = /[\s"{}\[\]|:]/;

// ============================================================
// 公共 API
// ============================================================

/** serializeRelationship 返回类型 */
export interface SerializeRelationshipResult {
  /** Mermaid 关系代码行（如 `CUSTOMER ||--o{ ORDER : places`）；出错时为 null */
  line: string | null;
  /** 错误列表（如 md-parent 出现在 target 端） */
  errors: ParseError[];
}

/**
 * 序列化关系边为 Mermaid erDiagram 关系代码
 *
 * @param edge - 关系边 (type='er-relation')
 * @param nodes - 节点列表（用于查找 source/target 的实体名，可选）
 * @returns 序列化结果（含代码行和错误列表）
 *
 * 注意：edge.source/edge.target 是节点 ID（如 `entity-CUSTOMER-0`），
 *      需要从 nodes 中查找对应的 data.label 作为实体名输出。
 *      如果 nodes 未提供或找不到对应节点，回退使用 edge.source/edge.target。
 *
 * 校验：md-parent 仅在 source 端（cardinality.from）有效，出现在 target 端时报错。
 */
export function serializeRelationship(edge: MermaidEdge, nodes?: MermaidNode[]): SerializeRelationshipResult {
  const { source, target, data } = edge;
  const errors: ParseError[] = [];

  // 解析基数（缺失时使用默认值）
  const cardinality = data.cardinality ?? { from: DEFAULT_CARDINALITY, to: DEFAULT_CARDINALITY };

  // 校验：md-parent 仅在 source 端有效
  if (cardinality.to === 'md-parent') {
    errors.push({
      line: 0,
      column: 0,
      message: `md-parent 基数仅允许在 source 端（cardinality.from），但 edge ${edge.id} 的 cardinality.to 为 'md-parent'。jison 语法 u(?=[.\\-|]) 在 target 端不匹配。`,
      severity: 'error',
    });
    return { line: null, errors };
  }

  const cardFromSymbol = cardinalityToSymbol(cardinality.from);
  const cardToSymbol = cardinalityToSymbol(cardinality.to);

  // 解析关系类型（缺失时使用默认值）
  const identification = data.erIdentification ?? DEFAULT_IDENTIFICATION;
  const lineSymbol = identificationToSymbol(identification);

  // 构建关系符号: `cardFrom + lineType + cardTo`（如 `||--o{`）
  const relationSymbol = `${cardFromSymbol}${lineSymbol}${cardToSymbol}`;

  // 角色标签（优先 erRole，回退 label；er-parser 同时设置两者，值相同）
  const role = data.erRole ?? data.label;
  const rolePart = role ? ` : ${formatRole(role)}` : '';

  // 查找 source/target 的实体名（data.label）
  const sourceName = resolveEntityName(source, nodes);
  const targetName = resolveEntityName(target, nodes);

  const line = `${sourceName} ${relationSymbol} ${targetName}${rolePart}`;
  return { line, errors };
}

/**
 * 从节点列表中查找实体名（data.label）
 *
 * @param nodeId - 节点 ID（如 `entity-CUSTOMER-0`）
 * @param nodes - 节点列表
 * @returns 实体名（如 `CUSTOMER`），找不到时返回 nodeId 本身
 */
function resolveEntityName(nodeId: string, nodes?: MermaidNode[]): string {
  if (!nodes) {
    return nodeId;
  }
  const node = nodes.find((n) => n.id === nodeId);
  return node?.data.label ?? nodeId;
}

/**
 * 将 ERCardinality 转换为 Mermaid 符号
 *
 * @param card - ER 基数类型
 * @returns Mermaid 基数符号（如 `||`、`o{`）
 */
export function cardinalityToSymbol(card: ERCardinality): string {
  return CARDINALITY_SYMBOL[card];
}

/**
 * 将 ERIdentification 转换为 Mermaid 线型符号
 *
 * @param id - ER 关系类型
 * @returns Mermaid 线型符号（`--` 实线 / `..` 虚线）
 */
export function identificationToSymbol(id: ERIdentification): string {
  return IDENTIFICATION_SYMBOL[id];
}

// ============================================================
// 内部实现
// ============================================================

/**
 * 格式化角色标签
 *
 * 规则:
 *   - 包含空格或特殊字符时，用双引号包裹（如 `"subscribed via"`）
 *   - 内部双引号转义为 `\"`
 *   - 简单标识符直接输出（如 `places`）
 */
function formatRole(role: string): string {
  if (ROLE_SPECIAL_CHARS.test(role)) {
    return `"${escapeStringLiteral(role)}"`;
  }
  return role;
}
