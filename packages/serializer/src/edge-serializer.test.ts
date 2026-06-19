/**
 * 边序列化器测试 — 覆盖 8 种样式 + 标签
 */
import { describe, it, expect } from 'vitest';
import { serializeEdge, getEdgeSyntax } from './edge-serializer.js';
import type { MermaidEdge, MermaidEdgeStyle } from './types.js';

function makeEdge(
  source: string,
  target: string,
  style: MermaidEdgeStyle,
  label?: string
): MermaidEdge {
  return {
    id: 'edge1',
    source,
    target,
    data: { edgeStyle: style, ...(label !== undefined ? { label } : {}) },
  };
}

describe('serializeEdge — 8 种样式', () => {
  const cases: Array<{ style: MermaidEdgeStyle; expected: string }> = [
    { style: 'arrow', expected: 'A --> B' },
    { style: 'line', expected: 'A --- B' },
    { style: 'dotted', expected: 'A -.- B' },
    { style: 'dotted-arrow', expected: 'A -.-> B' },
    { style: 'thick', expected: 'A ==> B' },
    { style: 'circle', expected: 'A ---o B' },
    { style: 'cross', expected: 'A ---x B' },
    { style: 'bidirectional', expected: 'A <---> B' },
  ];

  for (const { style, expected } of cases) {
    it(`should serialize ${style} style`, () => {
      const edge = makeEdge('A', 'B', style);
      expect(serializeEdge(edge)).toBe(expected);
    });
  }
});

describe('serializeEdge — 标签处理', () => {
  it('should add label with pipes for arrow', () => {
    const edge = makeEdge('A', 'B', 'arrow', '是');
    expect(serializeEdge(edge)).toBe('A -->|是| B');
  });

  it('should add label for line', () => {
    const edge = makeEdge('A', 'B', 'line', '连接');
    expect(serializeEdge(edge)).toBe('A ---|连接| B');
  });

  it('should add label for bidirectional', () => {
    const edge = makeEdge('A', 'B', 'bidirectional', '双向');
    expect(serializeEdge(edge)).toBe('A <--->|双向| B');
  });

  it('should skip empty label', () => {
    const edge = makeEdge('A', 'B', 'arrow', '');
    expect(serializeEdge(edge)).toBe('A --> B');
  });

  it('should skip whitespace-only label', () => {
    const edge = makeEdge('A', 'B', 'arrow', '   ');
    expect(serializeEdge(edge)).toBe('A --> B');
  });

  it('should escape pipe character in label', () => {
    const edge = makeEdge('A', 'B', 'arrow', 'a|b');
    expect(serializeEdge(edge)).toBe('A -->|a\\|b| B');
  });

  it('should escape backslash in label', () => {
    const edge = makeEdge('A', 'B', 'arrow', 'a\\b');
    expect(serializeEdge(edge)).toBe('A -->|a\\\\b| B');
  });

  it('should handle label without explicit label field', () => {
    const edge: MermaidEdge = {
      id: 'e1',
      source: 'A',
      target: 'B',
      data: { edgeStyle: 'arrow' },
    };
    expect(serializeEdge(edge)).toBe('A --> B');
  });
});

describe('serializeEdge — fallback 行为', () => {
  it('should fallback to arrow for unknown style', () => {
    const edge = makeEdge('A', 'B', 'unknown-style' as MermaidEdgeStyle);
    expect(serializeEdge(edge)).toBe('A --> B');
  });
});

describe('getEdgeSyntax', () => {
  it('should return syntax for arrow', () => {
    const syntax = getEdgeSyntax('arrow');
    expect(syntax).toEqual({ line: '--', startMarker: '', endMarker: '>' });
  });

  it('should return syntax for bidirectional with both markers', () => {
    const syntax = getEdgeSyntax('bidirectional');
    expect(syntax.startMarker).toBe('<');
    expect(syntax.endMarker).toBe('>');
  });

  it('should fallback to arrow for unknown style', () => {
    const syntax = getEdgeSyntax('unknown' as MermaidEdgeStyle);
    expect(syntax).toEqual({ line: '--', startMarker: '', endMarker: '>' });
  });
});
