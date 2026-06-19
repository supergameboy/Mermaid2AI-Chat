/**
 * 节点序列化器测试 — 覆盖 14 种形状 + 标签转义
 */
import { describe, it, expect } from 'vitest';
import { serializeNode, getShapeSyntax, unescapeLabel } from './node-serializer.js';
import type { MermaidNode, MermaidShapeType } from './types.js';

function makeNode(id: string, shape: MermaidShapeType, label: string): MermaidNode {
  return {
    id,
    type: shape,
    position: { x: 0, y: 0 },
    data: { label, shape },
  };
}

describe('serializeNode — 14 种形状', () => {
  const cases: Array<{ shape: MermaidShapeType; label: string; expected: string }> = [
    { shape: 'rect', label: '矩形', expected: 'A[矩形]' },
    { shape: 'rounded', label: '圆角', expected: 'B(圆角)' },
    { shape: 'stadium', label: '胶囊', expected: 'C([胶囊])' },
    { shape: 'diamond', label: '菱形', expected: 'D{菱形}' },
    { shape: 'circle', label: '圆形', expected: 'E((圆形))' },
    { shape: 'cylinder', label: '圆柱', expected: 'F[(圆柱)]' },
    { shape: 'hexagon', label: '六边形', expected: 'G{{六边形}}' },
    { shape: 'parallelogram', label: '平行四边形', expected: 'H[/平行四边形/]' },
    { shape: 'subroutine', label: '子程序', expected: 'I[[子程序]]' },
    { shape: 'doublecircle', label: '双圆', expected: 'J(((双圆)))' },
    { shape: 'asymmetric', label: '不对称', expected: 'K>不对称]' },
    { shape: 'parallelogram-reverse', label: '反向平行四边形', expected: 'L[\\反向平行四边形\\]' },
    { shape: 'trapezoid', label: '梯形', expected: 'M[/梯形\\]' },
    { shape: 'trapezoid-reverse', label: '反向梯形', expected: 'N[\\反向梯形/]' },
  ];

  for (const { shape, label, expected } of cases) {
    it(`should serialize ${shape} shape`, () => {
      const node = makeNode(expected[0], shape, label);
      expect(serializeNode(node)).toBe(expected);
    });
  }
});

describe('serializeNode — 标签转义', () => {
  it('should escape brackets in label', () => {
    const node = makeNode('A', 'rect', '文本[内容]');
    expect(serializeNode(node)).toBe('A[文本\\[内容\\]]');
  });

  it('should escape braces in label', () => {
    const node = makeNode('A', 'rect', '文本{内容}');
    expect(serializeNode(node)).toBe('A[文本\\{内容\\}]');
  });

  it('should escape parentheses in label', () => {
    const node = makeNode('A', 'rect', '文本(内容)');
    expect(serializeNode(node)).toBe('A[文本\\(内容\\)]');
  });

  it('should escape backslash in label', () => {
    const node = makeNode('A', 'rect', '文本\\内容');
    expect(serializeNode(node)).toBe('A[文本\\\\内容]');
  });

  it('should escape quotes in label', () => {
    const node = makeNode('A', 'rect', '文本"内容"');
    expect(serializeNode(node)).toBe('A[文本\\"内容\\"]');
  });

  it('should handle empty label', () => {
    const node = makeNode('A', 'rect', '');
    expect(serializeNode(node)).toBe('A[]');
  });

  it('should handle unicode label', () => {
    const node = makeNode('A', 'rect', '中文测试🎉');
    expect(serializeNode(node)).toBe('A[中文测试🎉]');
  });

  it('should serialize newline as <br/>', () => {
    const node = makeNode('A', 'rect', '第一行\n第二行');
    expect(serializeNode(node)).toBe('A[第一行<br/>第二行]');
  });

  it('should serialize multiple newlines as multiple <br/>', () => {
    const node = makeNode('A', 'rect', '行1\n行2\n行3');
    expect(serializeNode(node)).toBe('A[行1<br/>行2<br/>行3]');
  });
});

describe('serializeNode — fallback 行为', () => {
  it('should fallback to rect syntax for unknown shape', () => {
    const node = makeNode('A', 'unknown-shape' as MermaidShapeType, '测试');
    // 未知形状应回退到 rect 语法
    expect(serializeNode(node)).toBe('A[测试]');
  });
});

describe('getShapeSyntax', () => {
  it('should return syntax for each shape', () => {
    const rectSyntax = getShapeSyntax('rect');
    expect(rectSyntax).toEqual({ open: '[', close: ']' });
  });

  it('should fallback to rect for unknown shape', () => {
    const syntax = getShapeSyntax('unknown' as MermaidShapeType);
    expect(syntax).toEqual({ open: '[', close: ']' });
  });
});

describe('unescapeLabel', () => {
  it('should unescape backslash-escaped characters', () => {
    expect(unescapeLabel('text\\[inner\\]')).toBe('text[inner]');
  });

  it('should unescape double backslash', () => {
    expect(unescapeLabel('text\\\\inner')).toBe('text\\inner');
  });

  it('should handle string without escapes', () => {
    expect(unescapeLabel('plain text')).toBe('plain text');
  });

  it('should unescape multiple escapes', () => {
    expect(unescapeLabel('\\(\\)\\[\\]\\{\\}')).toBe('()[]{}');
  });
});
