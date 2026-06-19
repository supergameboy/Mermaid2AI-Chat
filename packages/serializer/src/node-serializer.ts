import type { MermaidNode, MermaidShapeType } from './types.js';

/**
 * 节点形状 → Mermaid 语法映射表
 * 格式: [前缀, 后缀]
 * 例如 rect: ['[', ']'] → A[标签]
 */
const SHAPE_SYNTAX_MAP: Record<MermaidShapeType, { open: string; close: string }> = {
  rect:                   { open: '[',    close: ']'    },
  rounded:                { open: '(',    close: ')'    },
  stadium:                { open: '([',   close: '])'   },
  diamond:                { open: '{',    close: '}'    },
  circle:                 { open: '((',   close: '))'   },
  cylinder:               { open: '[(',   close: ')]'   },
  hexagon:                { open: '{{',   close: '}}'   },
  parallelogram:          { open: '[/',   close: '/]'   },
  subroutine:             { open: '[[',   close: ']]'   },
  doublecircle:           { open: '(((',  close: ')))'  },
  // 扩展形状
  asymmetric:             { open: '>',    close: ']'    },
  'parallelogram-reverse':{ open: '[\\',  close: '\\]'  },
  trapezoid:              { open: '[/',   close: '\\]'  },
  'trapezoid-reverse':    { open: '[\\',  close: '/]'   },
};

/**
 * 节点序列化器 — 画布节点 → mermaid 节点语法
 */
export function serializeNode(node: MermaidNode): string {
  const syntax = SHAPE_SYNTAX_MAP[node.data.shape] ?? SHAPE_SYNTAX_MAP.rect;
  const label = escapeLabel(node.data.label);
  return `${node.id}${syntax.open}${label}${syntax.close}`;
}

/**
 * 获取节点形状的语法配置
 */
export function getShapeSyntax(shape: MermaidShapeType): { open: string; close: string } {
  return SHAPE_SYNTAX_MAP[shape] ?? SHAPE_SYNTAX_MAP.rect;
}

/**
 * 转义标签中的特殊字符
 */
function escapeLabel(label: string): string {
  // mermaid 标签中需要转义的字符
  return label
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

/**
 * 反转义标签
 */
export function unescapeLabel(label: string): string {
  return label
    .replace(/\\(.)/g, '$1');
}
