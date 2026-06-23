/**
 * state 序列化器 — CanvasState → Mermaid stateDiagram-v2 代码
 *
 * 单一职责：将 GraphCanvasState (diagramType='stateDiagram') 序列化为 Mermaid 代码
 *
 * 数据流:
 *   GraphCanvasState
 *     → serializeState(canvas) 入口
 *     → 分发到:
 *       1. header: "stateDiagram-v2"
 *       2. direction: "direction LR"
 *       3. classDef: "classDef myStyle fill:#f96"
 *       4. composite: 复合状态声明（递归处理嵌套）
 *       5. state label: 'state "Label" as id'（label !== id 时）
 *       6. state type: 'state choice1 <<choice>>'（choice/fork/join）
 *       7. transition: '[*] --> State1 : event[guard]/action'
 *       8. note: 'note right of State1\n  Note text\nend note'
 *       9. style: 'style State1 fill:#f9f,stroke:#333'
 *       10. click: 'click State1 href "url" "tooltip"'
 *     → 合并为 Mermaid 代码字符串
 *
 * 输出顺序对齐 mermaid 官方 stateDb 渲染顺序:
 *   stateDiagram-v2 → direction → classDef → composite → state label → state type → transition → note → style → click
 */

import type {
  CanvasState,
  GraphCanvasState,
  SerializeResult,
  ParseError,
  MermaidNode,
  MermaidEdge,
  GraphMetadata,
  StateCompositeInfo,
  StateNoteInfo,
  StateClassDefInfo,
  StateNodeType,
  NodeStyle,
} from '../types.js';
import { escapeStringLiteral } from './shared/escape-helpers.js';

// ============================================================
// 公共 API
// ============================================================

/**
 * 序列化 CanvasState 为 Mermaid stateDiagram-v2 代码
 *
 * @param canvas - CanvasState（必须为 GraphCanvasState 且 diagramType === 'stateDiagram'）
 * @returns 序列化结果（包含 mermaid 代码和错误列表）
 */
export function serializeState(canvas: CanvasState): SerializeResult {
  if (canvas.diagramType !== 'stateDiagram') {
    const error: ParseError = {
      line: 0,
      column: 0,
      message: `Expected stateDiagram diagramType, got ${canvas.diagramType}`,
      severity: 'error',
    };
    return { mermaid: '', errors: [error] };
  }

  const graphCanvas = canvas as GraphCanvasState;
  const errors: ParseError[] = [];
  const lines: string[] = [];

  // 1. 图表头
  lines.push('stateDiagram-v2');
  lines.push('');

  // 2. 方向（优先使用 metadata.stateDirection，其次 graphCanvas.direction；默认 'TB' 不输出）
  const metadata = graphCanvas.metadata;
  const direction = metadata?.stateDirection ?? graphCanvas.direction;
  if (direction && direction !== 'TB') {
    lines.push(`direction ${direction}`);
    lines.push('');
  }

  // 3. classDef 语句（从 metadata.stateClassDefs 读取）
  const classDefLines = serializeClassDefs(metadata);
  lines.push(...classDefLines);
  if (classDefLines.length > 0) {
    lines.push('');
  }

  // 4. 复合状态声明（递归处理嵌套）
  const composites = metadata?.composites ?? [];
  const compositeChildIds = collectAllCompositeChildIds(composites);
  const compositeEdgeIds = collectCompositeEdgeIds(graphCanvas.edges, composites);
  // 顶层复合状态：stateId 不在任何其他复合状态的 childStateIds 内
  const topLevelComposites = composites.filter((c) => !compositeChildIds.has(c.stateId));

  for (const composite of topLevelComposites) {
    const compositeLines = serializeComposite(composite, graphCanvas, composites);
    lines.push(...compositeLines);
    lines.push('');
  }

  // 5. 状态声明（label !== id）— 遍历所有非复合状态节点
  const stateLabelLines: string[] = [];
  for (const node of graphCanvas.nodes) {
    // 跳过复合状态节点本身（复合状态通过 metadata.composites 声明）
    if (isCompositeState(node.id, composites)) {
      continue;
    }
    // 跳过 note 和 note-group 节点（内部渲染节点，通过 note 语句序列化）
    if (isNoteNode(node)) {
      continue;
    }
    const stateType = node.data.stateType ?? 'default';
    // start/end/divider/choice/fork/join 节点不需要 label 声明
    if (stateType !== 'default') {
      continue;
    }
    if (node.data.label && node.data.label !== node.id) {
      stateLabelLines.push(`state "${escapeStringLiteral(node.data.label)}" as ${node.id}`);
    }
  }
  lines.push(...stateLabelLines);
  if (stateLabelLines.length > 0) {
    lines.push('');
  }

  // 6. 状态类型声明（choice/fork/join）
  const stateTypeLines: string[] = [];
  for (const node of graphCanvas.nodes) {
    if (isCompositeState(node.id, composites)) {
      continue;
    }
    // 跳过 note 和 note-group 节点
    if (isNoteNode(node)) {
      continue;
    }
    const stateType = node.data.stateType ?? 'default';
    // start/end/divider 不需要类型声明（start/end 用 [*] 表示，divider 用 -- 表示）
    if (stateType === 'choice' || stateType === 'fork' || stateType === 'join') {
      stateTypeLines.push(`state ${node.id} <<${stateType}>>`);
    }
  }
  lines.push(...stateTypeLines);
  if (stateTypeLines.length > 0) {
    lines.push('');
  }

  // 7. 转换关系（非复合状态内的边）
  // 收集所有 note 节点 ID，用于过滤内部边（state → note）
  const noteNodeIds = new Set(
    graphCanvas.nodes.filter((n) => isNoteNode(n)).map((n) => n.id)
  );
  const transitionLines: string[] = [];
  for (const edge of graphCanvas.edges) {
    if (compositeEdgeIds.has(edge.id)) {
      continue;
    }
    // 跳过涉及 note 节点的内部边
    if (noteNodeIds.has(edge.source) || noteNodeIds.has(edge.target)) {
      continue;
    }
    transitionLines.push(serializeTransition(edge, graphCanvas.nodes));
  }
  lines.push(...transitionLines);
  if (transitionLines.length > 0) {
    lines.push('');
  }

  // 8. note
  const noteLines = serializeNotes(metadata);
  lines.push(...noteLines);
  if (noteLines.length > 0) {
    lines.push('');
  }

  // 9. style 语句（从节点的 data.style 读取内联样式）
  const styleLines = serializeNodeStyles(graphCanvas.nodes);
  lines.push(...styleLines);
  if (styleLines.length > 0) {
    lines.push('');
  }

  // 10. click 语句（从节点的 data.clickUrl/tooltip 读取）
  const clickLines = serializeClickEvents(graphCanvas.nodes);
  lines.push(...clickLines);
  if (clickLines.length > 0) {
    lines.push('');
  }

  // 合并为最终代码（去除尾部空行）
  const mermaid = lines.join('\n').replace(/\n+$/, '\n');

  return {
    mermaid,
    errors,
  };
}

// ============================================================
// 内部实现 — 复合状态序列化（递归处理嵌套）
// ============================================================

/**
 * 序列化复合状态（递归处理嵌套）
 *
 * 语法:
 *   state CompositeId {
 *     direction LR
 *     [*] --> Child1
 *     Child1 --> Child2
 *     --  // 并发区域分隔符
 *     [*] --> Child3
 *     state NestedComposite {
 *       ...
 *     }
 *   }
 *
 * 复合状态内的边：筛选 source 和 target 都在该复合状态的 childStateIds 内的边
 * 并发区域分隔符 `--`：divider 节点（stateType='divider'）在对应位置输出
 */
function serializeComposite(
  composite: StateCompositeInfo,
  graphCanvas: GraphCanvasState,
  allComposites: StateCompositeInfo[],
): string[] {
  const lines: string[] = [];
  const childSet = new Set(composite.childStateIds);

  lines.push(`state ${composite.stateId} {`);

  // direction（块内方向，如果有）
  if (composite.direction) {
    lines.push(`  direction ${composite.direction}`);
  }

  // 遍历子状态，按 childStateIds 顺序输出边和 divider
  for (const childId of composite.childStateIds) {
    const childNode = graphCanvas.nodes.find((n) => n.id === childId);
    if (!childNode) {
      continue;
    }

    const stateType = childNode.data.stateType ?? 'default';

    // divider 节点输出 `--`（并发区域分隔符）
    if (stateType === 'divider') {
      lines.push('  --');
      continue;
    }

    // 嵌套复合状态递归处理
    const nestedComposite = allComposites.find((c) => c.stateId === childId);
    if (nestedComposite) {
      const nestedLines = serializeComposite(nestedComposite, graphCanvas, allComposites);
      for (const line of nestedLines) {
        lines.push(`  ${line}`);
      }
      // 输出以嵌套复合状态为 source 的边（target 在外层 childSet 内，但不在嵌套 childSet 内）
      // 避免与嵌套块内的边重复
      const nestedChildSet = new Set(nestedComposite.childStateIds);
      for (const edge of graphCanvas.edges) {
        if (
          edge.source === childId &&
          childSet.has(edge.target) &&
          !nestedChildSet.has(edge.target)
        ) {
          lines.push(`  ${serializeTransition(edge, graphCanvas.nodes)}`);
        }
      }
      continue;
    }

    // 输出以该子状态为 source 的边（target 也在 childSet 内）
    // 每条边只在遍历到 source 节点时输出一次
    for (const edge of graphCanvas.edges) {
      if (edge.source === childId && childSet.has(edge.target)) {
        lines.push(`  ${serializeTransition(edge, graphCanvas.nodes)}`);
      }
    }
  }

  lines.push('}');
  return lines;
}

// ============================================================
// 内部实现 — classDef / note / style / click 序列化
// ============================================================

/**
 * 序列化 classDef 语句
 *
 * 语法: `classDef name style`
 * 从 metadata.stateClassDefs 读取 StateClassDefInfo[]
 */
function serializeClassDefs(metadata: GraphMetadata | undefined): string[] {
  const classDefs = metadata?.stateClassDefs;
  if (!classDefs || classDefs.length === 0) {
    return [];
  }
  return classDefs.map((cd) => `classDef ${cd.name} ${cd.style}`);
}

/**
 * 序列化 note 语句
 *
 * 语法:
 *   note right of State1
 *     Note text
 *   end note
 * 或 `note left of State1`
 *
 * 从 metadata.stateNotes 读取 StateNoteInfo[]
 */
function serializeNotes(metadata: GraphMetadata | undefined): string[] {
  const notes = metadata?.stateNotes;
  if (!notes || notes.length === 0) {
    return [];
  }

  const lines: string[] = [];
  for (const note of notes) {
    if (!note.label) {
      continue;
    }
    lines.push(`note ${note.position} ${note.stateId}`);
    lines.push(`  ${note.label}`);
    lines.push('end note');
  }
  return lines;
}

/**
 * 序列化 style 语句（内联样式）
 *
 * 语法: `style nodeId fill:#f9f,stroke:#333,stroke-width:2px,color:#333`
 * 从节点的 data.style 读取 NodeStyle
 */
function serializeNodeStyles(nodes: MermaidNode[]): string[] {
  const lines: string[] = [];
  for (const node of nodes) {
    const style = node.data.style;
    if (!style) {
      continue;
    }
    const styleStr = formatNodeStyle(style);
    if (styleStr) {
      lines.push(`style ${node.id} ${styleStr}`);
    }
  }
  return lines;
}

/**
 * 序列化 click 语句
 *
 * 语法: `click nodeId href "url" "tooltip"`
 * 从节点的 data.clickUrl 和 data.tooltip 读取
 */
function serializeClickEvents(nodes: MermaidNode[]): string[] {
  const lines: string[] = [];
  for (const node of nodes) {
    const clickUrl = node.data.clickUrl;
    if (!clickUrl) {
      continue;
    }
    const tooltip = node.data.tooltip;
    if (tooltip) {
      lines.push(`click ${node.id} href "${clickUrl}" "${tooltip}"`);
    } else {
      lines.push(`click ${node.id} href "${clickUrl}"`);
    }
  }
  return lines;
}

// ============================================================
// 内部实现 — 转换关系序列化
// ============================================================

/**
 * 序列化转换关系
 *
 * 语法: `source --> target : label`
 * - start 节点（stateType='start'）用 `[*]` 替代 id
 * - end 节点（stateType='end'）用 `[*]` 替代 id
 * - label 为空时省略 ` : label`
 * - label 从 edge.data.label 或 edge.data.transitionLabel 读取
 */
function serializeTransition(edge: MermaidEdge, nodes: MermaidNode[]): string {
  const sourceNode = nodes.find((n) => n.id === edge.source);
  const targetNode = nodes.find((n) => n.id === edge.target);

  const sourceId = formatStateId(edge.source, sourceNode);
  const targetId = formatStateId(edge.target, targetNode);

  const label = edge.data.label ?? edge.data.transitionLabel;

  if (label) {
    return `${sourceId} --> ${targetId} : ${label}`;
  }
  return `${sourceId} --> ${targetId}`;
}

/**
 * 格式化状态 ID
 * - start/end 节点用 `[*]` 替代（mermaid stateDiagram-v2 语法）
 */
function formatStateId(id: string, node: MermaidNode | undefined): string {
  if (!node) {
    return id;
  }
  const stateType = node.data.stateType;
  if (stateType === 'start' || stateType === 'end') {
    return '[*]';
  }
  return id;
}

/**
 * 格式化节点样式为 mermaid 样式字符串
 * 将 NodeStyle 对象转换为 `fill:xxx,stroke:xxx,stroke-width:xxxpx,color:xxx` 格式
 */
function formatNodeStyle(style: NodeStyle): string {
  const parts: string[] = [];
  if (style.fill) {
    parts.push(`fill:${style.fill}`);
  }
  if (style.stroke) {
    parts.push(`stroke:${style.stroke}`);
  }
  if (style.strokeWidth !== undefined) {
    parts.push(`stroke-width:${style.strokeWidth}px`);
  }
  if (style.color) {
    parts.push(`color:${style.color}`);
  }
  return parts.join(',');
}

// ============================================================
// 辅助函数
// ============================================================

/**
 * 收集所有复合状态的子状态 ID
 * 用于判断节点是否为复合状态的子状态
 */
function collectAllCompositeChildIds(composites: StateCompositeInfo[]): Set<string> {
  const ids = new Set<string>();
  for (const composite of composites) {
    for (const childId of composite.childStateIds) {
      ids.add(childId);
    }
  }
  return ids;
}

/**
 * 收集所有复合状态内的边 ID
 * 用于在顶层输出时跳过这些边（避免与复合状态内的输出重复）
 *
 * 判定规则：source 和 target 都在同一个复合状态的 childStateIds 内
 */
function collectCompositeEdgeIds(
  edges: MermaidEdge[],
  composites: StateCompositeInfo[],
): Set<string> {
  const ids = new Set<string>();
  for (const composite of composites) {
    const childSet = new Set(composite.childStateIds);
    for (const edge of edges) {
      if (childSet.has(edge.source) && childSet.has(edge.target)) {
        ids.add(edge.id);
      }
    }
  }
  return ids;
}

/**
 * 判断节点是否为复合状态（即作为某个 StateCompositeInfo 的 stateId）
 */
function isCompositeState(nodeId: string, composites: StateCompositeInfo[]): boolean {
  return composites.some((c) => c.stateId === nodeId);
}

/**
 * 判断节点是否为 note 或 note-group（内部渲染节点）
 *
 * 这些节点由解析器创建用于 React Flow 渲染，但不应序列化为 mermaid 代码。
 * note 信息通过 metadata.stateNotes 序列化为 `note right of ...` 语句。
 */
function isNoteNode(node: MermaidNode): boolean {
  return node.data.shape === 'note' || node.data.shape === 'state-note-group';
}
