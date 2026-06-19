import type { MermaidEdge, MermaidEdgeStyle } from './types.js';

/**
 * 边样式 → Mermaid 语法映射表
 * 每种样式定义: 基础连接线、起始箭头、结束箭头
 * 最终语法 = startMarker + line + endMarker
 *
 * Mermaid 官方语法参考:
 *   -->    实线箭头
 *   ---    实线
 *   -.-    虚线
 *   -.->   虚线箭头
 *   ==>    粗线箭头
 *   ---o   圆形端点
 *   ---x   交叉端点
 *   <--->  双向箭头
 */
const EDGE_SYNTAX_MAP: Record<MermaidEdgeStyle, {
  line: string;
  startMarker: string;
  endMarker: string;
}> = {
  arrow:         { line: '--',  startMarker: '',    endMarker: '>'    },  // -->
  line:          { line: '---', startMarker: '',    endMarker: ''     },  // ---
  dotted:        { line: '-.-', startMarker: '',    endMarker: ''     },  // -.-
  'dotted-arrow':{ line: '-.-', startMarker: '',    endMarker: '>'    },  // -.->
  thick:         { line: '==',  startMarker: '',    endMarker: '>'    },  // ==>
  circle:        { line: '---', startMarker: '',    endMarker: 'o'    },  // ---o
  cross:         { line: '---', startMarker: '',    endMarker: 'x'    },  // ---x
  bidirectional: { line: '---', startMarker: '<',   endMarker: '>'    },  // <--->
};

/**
 * 边序列化器 — 画布边 → mermaid 边语法
 *
 * 示例:
 *   arrow:         A --> B
 *   line:          A --- B
 *   dotted:        A -.- B
 *   dotted-arrow:  A -.-> B
 *   thick:         A ==> B
 *   circle:        A ---o B
 *   cross:         A ---x B
 *   bidirectional: A <---> B
 *   带标签:        A -->|标签| B
 */
export function serializeEdge(edge: MermaidEdge): string {
  const syntax = EDGE_SYNTAX_MAP[edge.data.edgeStyle] ?? EDGE_SYNTAX_MAP.arrow;
  const label = edge.data.label;

  // 构建连接线
  let connection = syntax.line;

  // 添加起始箭头（双向边）
  if (syntax.startMarker) {
    connection = syntax.startMarker + connection;
  }

  // 添加结束箭头
  if (syntax.endMarker) {
    connection = connection + syntax.endMarker;
  }

  // 添加标签
  if (label && label.trim()) {
    // mermaid 边标签格式: -->|标签| 或 ---|标签|---
    connection = `${connection}|${escapeLabel(label)}|`;
  }

  return `${edge.source} ${connection} ${edge.target}`;
}

/**
 * 获取边样式的语法配置
 */
export function getEdgeSyntax(style: MermaidEdgeStyle) {
  return EDGE_SYNTAX_MAP[style] ?? EDGE_SYNTAX_MAP.arrow;
}

/**
 * 转义标签
 */
function escapeLabel(label: string): string {
  return label
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|');
}
