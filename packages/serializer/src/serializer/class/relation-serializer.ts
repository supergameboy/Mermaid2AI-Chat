/**
 * 关系序列化器 — MermaidEdge (class-relation) → Mermaid 关系代码
 *
 * 单一职责：将关系边序列化为 Mermaid classDiagram 关系语法
 *
 * 语法:
 *   A <|-- B
 *   A "1" <|-- "0..*" B : label
 *   A --> B
 *   A <.. B : depends
 *   A <|.. B : implements
 *   A --o B
 *
 * 关系类型 → 箭头语法映射:
 *   extension     → <|--   (实线空心三角，继承)
 *   realization   → <|..   (虚线空心三角，实现)
 *   composition   → *--    (实线实心菱形，组合)
 *   aggregation   → o--    (实线空心菱形，聚合)
 *   association   → -->    (实线箭头，关联)
 *   dependency    → <..    (虚线箭头，依赖)
 *   lollipop      → --o    (实线圆圈，接口实现)
 *
 * 数据流:
 *   MermaidEdge (type='class-relation')
 *     → serializeRelation(edge)
 *     → 处理 relationType + lineType → 箭头语法
 *     → 处理 classCardinality → 基数 ("from" ARROW "to")
 *     → 处理 label → 关系标签 (: label)
 *     → 输出 Mermaid 关系代码行
 */

import type {
  MermaidEdge,
  MermaidEdgeData,
  ClassRelationType,
  ClassLineType,
} from '../../types.js';

// ============================================================
// 常量
// ============================================================

/**
 * 关系类型 → source 端符号（左侧）
 *
 * 注意：source 端符号出现在箭头左侧，表示 source 端的关系标记
 *   - extension/realization: `<|` 空心三角指向 source（source 是父类/接口）
 *   - composition: `*` 实心菱形在 source 端（source 包含 target）
 *   - aggregation: `o` 空心菱形在 source 端（source 聚合 target）
 *   - dependency: `<` 箭头指向 source（source 依赖 target）
 *   - association/lollipop: 无 source 端符号
 */
const RELATION_SOURCE_SYMBOL: Readonly<Record<ClassRelationType, string>> = {
  extension: '<|',
  realization: '<|',
  composition: '*',
  aggregation: 'o',
  association: '',
  dependency: '<',
  lollipop: '',
};

/**
 * 关系类型 → target 端符号（右侧）
 *
 * 注意：target 端符号出现在箭头右侧，表示 target 端的关系标记
 *   - association: `>` 箭头指向 target（source 关联 target）
 *   - lollipop: `o` 圆圈在 target 端（target 是接口）
 *   - 其他关系类型: 无 target 端符号
 */
const RELATION_TARGET_SYMBOL: Readonly<Record<ClassRelationType, string>> = {
  extension: '',
  realization: '',
  composition: '',
  aggregation: '',
  association: '>',
  dependency: '',
  lollipop: 'o',
};

/** 线型 → 线符号 */
const LINE_SYMBOL: Readonly<Record<ClassLineType, string>> = {
  line: '--',
  dotted: '..',
};

// ============================================================
// 公共 API
// ============================================================

/**
 * 序列化单条关系为 Mermaid 代码
 *
 * @param edge - 关系边 (type='class-relation')
 * @returns Mermaid 关系代码行（如 `A "1" <|-- "0..*" B : label`）
 */
export function serializeRelation(edge: MermaidEdge): string {
  const { source, target, data } = edge;
  const relationType = data.relationType ?? 'association';
  const lineType = data.lineType ?? 'line';
  const startType = data.startRelationType;
  const endType = data.endRelationType;

  // 生成箭头语法
  const arrow = buildArrowSyntax(relationType, lineType, startType, endType);

  // 基数（classCardinality 通过索引签名承载，避免与 ER 的 cardinality 冲突）
  const cardinality = readClassCardinality(data);
  const fromPart = cardinality && cardinality.from ? `"${cardinality.from}" ` : '';
  const toPart = cardinality && cardinality.to ? ` "${cardinality.to}"` : '';

  // 关系标签
  const label = data.label ? ` : ${data.label}` : '';

  return `${source} ${fromPart}${arrow}${toPart} ${target}${label}`;
}

// ============================================================
// 内部实现
// ============================================================

/**
 * 构建箭头语法
 *
 * 策略:
 *   1. 双端关系（startRelationType 和 endRelationType 都存在且不同）:
 *      组合 source 端符号（基于 startRelationType）+ lineSymbol + target 端符号（基于 endRelationType）
 *   2. 单端关系: 使用 relationType 的预定义 source/target 符号
 */
function buildArrowSyntax(
  relationType: ClassRelationType,
  lineType: ClassLineType,
  startType: ClassRelationType | undefined,
  endType: ClassRelationType | undefined,
): string {
  const lineSymbol = LINE_SYMBOL[lineType];

  // 双端关系：两端都有不同的关系类型
  if (startType && endType && startType !== endType) {
    const sourceSymbol = RELATION_SOURCE_SYMBOL[startType];
    const targetSymbol = RELATION_TARGET_SYMBOL[endType];
    return `${sourceSymbol}${lineSymbol}${targetSymbol}`;
  }

  // 单端关系：使用 relationType 的预定义符号
  const sourceSymbol = RELATION_SOURCE_SYMBOL[relationType];
  const targetSymbol = RELATION_TARGET_SYMBOL[relationType];
  return `${sourceSymbol}${lineSymbol}${targetSymbol}`;
}

/**
 * 读取 classCardinality 扩展字段
 *
 * class 关系的基数通过 MermaidEdgeData 的索引签名承载，
 * 避免与 ER 的 cardinality（{ from: ERCardinality; to: ERCardinality }）冲突
 */
function readClassCardinality(
  data: MermaidEdgeData,
): { from: string; to: string } | undefined {
  const value = (data as Record<string, unknown>)['classCardinality'];
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const { from, to } = value as { from: unknown; to: unknown };
  if (typeof from !== 'string' && typeof to !== 'string') {
    return undefined;
  }
  return {
    from: typeof from === 'string' ? from : '',
    to: typeof to === 'string' ? to : '',
  };
}
