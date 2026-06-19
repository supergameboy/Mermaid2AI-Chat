/**
 * 序列化器测试 — CanvasState → Mermaid 代码
 *
 * 覆盖：空画布、纯节点、纯边、节点+边、方向、双向幂等
 */
import { describe, it, expect } from 'vitest';
import { serializeMermaid } from './serializer.js';
import type { CanvasState, MermaidNode, MermaidEdge } from './types.js';

function makeNode(id: string, label: string, shape: MermaidNode['data']['shape'] = 'rect'): MermaidNode {
  return {
    id,
    type: shape,
    position: { x: 0, y: 0 },
    data: { label, shape },
  };
}

function makeEdge(
  source: string,
  target: string,
  style: MermaidEdge['data']['edgeStyle'] = 'arrow',
  label?: string
): MermaidEdge {
  return {
    id: `edge-${source}-${target}`,
    source,
    target,
    data: { edgeStyle: style, ...(label !== undefined ? { label } : {}) },
  };
}

describe('serializeMermaid — 基本场景', () => {
  it('should serialize empty canvas', () => {
    const canvas: CanvasState = { nodes: [], edges: [], direction: 'TD' };
    const result = serializeMermaid(canvas);
    expect(result.mermaid).toBe('flowchart TD');
    expect(result.errors).toEqual([]);
  });

  it('should serialize empty canvas with LR direction', () => {
    const canvas: CanvasState = { nodes: [], edges: [], direction: 'LR' };
    const result = serializeMermaid(canvas);
    expect(result.mermaid).toBe('flowchart LR');
  });

  it('should serialize all 5 directions', () => {
    const directions: Array<CanvasState['direction']> = ['TB', 'TD', 'BT', 'RL', 'LR'];
    for (const dir of directions) {
      const result = serializeMermaid({ nodes: [], edges: [], direction: dir });
      expect(result.mermaid).toBe(`flowchart ${dir}`);
    }
  });
});

describe('serializeMermaid — 纯节点', () => {
  it('should serialize single node', () => {
    const canvas: CanvasState = {
      nodes: [makeNode('A', '开始')],
      edges: [],
      direction: 'TD',
    };
    const result = serializeMermaid(canvas);
    expect(result.mermaid).toBe('flowchart TD\n  A[开始]');
  });

  it('should serialize multiple nodes', () => {
    const canvas: CanvasState = {
      nodes: [makeNode('A', '开始'), makeNode('B', '结束')],
      edges: [],
      direction: 'TD',
    };
    const result = serializeMermaid(canvas);
    expect(result.mermaid).toBe('flowchart TD\n  A[开始]\n  B[结束]');
  });

  it('should serialize nodes with different shapes', () => {
    const canvas: CanvasState = {
      nodes: [
        makeNode('A', '矩形', 'rect'),
        makeNode('B', '菱形', 'diamond'),
        makeNode('C', '圆角', 'rounded'),
      ],
      edges: [],
      direction: 'TD',
    };
    const result = serializeMermaid(canvas);
    expect(result.mermaid).toContain('A[矩形]');
    expect(result.mermaid).toContain('B{菱形}');
    expect(result.mermaid).toContain('C(圆角)');
  });
});

describe('serializeMermaid — 纯边', () => {
  it('should serialize single edge', () => {
    const canvas: CanvasState = {
      nodes: [],
      edges: [makeEdge('A', 'B')],
      direction: 'TD',
    };
    const result = serializeMermaid(canvas);
    expect(result.mermaid).toBe('flowchart TD\n  A --> B');
  });

  it('should serialize multiple edges', () => {
    const canvas: CanvasState = {
      nodes: [],
      edges: [makeEdge('A', 'B'), makeEdge('B', 'C')],
      direction: 'TD',
    };
    const result = serializeMermaid(canvas);
    expect(result.mermaid).toContain('A --> B');
    expect(result.mermaid).toContain('B --> C');
  });

  it('should serialize edge with label', () => {
    const canvas: CanvasState = {
      nodes: [],
      edges: [makeEdge('A', 'B', 'arrow', '是')],
      direction: 'TD',
    };
    const result = serializeMermaid(canvas);
    expect(result.mermaid).toContain('A -->|是| B');
  });
});

describe('serializeMermaid — 节点 + 边', () => {
  it('should serialize nodes first then edges', () => {
    const canvas: CanvasState = {
      nodes: [makeNode('A', '开始'), makeNode('B', '结束')],
      edges: [makeEdge('A', 'B')],
      direction: 'TD',
    };
    const result = serializeMermaid(canvas);
    const lines = result.mermaid.split('\n');
    expect(lines[0]).toBe('flowchart TD');
    expect(lines[1]).toBe('  A[开始]');
    expect(lines[2]).toBe('  B[结束]');
    expect(lines[3]).toBe('  A --> B');
  });
});

describe('serializeMermaid — 双向幂等', () => {
  it('should produce stable output for same input', () => {
    const canvas: CanvasState = {
      nodes: [makeNode('A', '开始'), makeNode('B', '结束')],
      edges: [makeEdge('A', 'B')],
      direction: 'TD',
    };
    const result1 = serializeMermaid(canvas);
    const result2 = serializeMermaid(canvas);
    expect(result1.mermaid).toBe(result2.mermaid);
  });

  it('should preserve node IDs through serialize', () => {
    const canvas: CanvasState = {
      nodes: [makeNode('Start', '开始'), makeNode('End', '结束')],
      edges: [makeEdge('Start', 'End')],
      direction: 'TD',
    };
    const result = serializeMermaid(canvas);
    expect(result.mermaid).toContain('Start[开始]');
    expect(result.mermaid).toContain('End[结束]');
    expect(result.mermaid).toContain('Start --> End');
  });
});

describe('serializeMermaid — 返回值结构', () => {
  it('should return SerializeResult with mermaid and errors fields', () => {
    const result = serializeMermaid({ nodes: [], edges: [], direction: 'TD' });
    expect(result).toHaveProperty('mermaid');
    expect(result).toHaveProperty('errors');
    expect(typeof result.mermaid).toBe('string');
    expect(Array.isArray(result.errors)).toBe(true);
  });

  it('should always return empty errors array (serializer does not generate errors)', () => {
    const canvas: CanvasState = {
      nodes: [makeNode('A', '测试')],
      edges: [makeEdge('A', 'B')],
      direction: 'TD',
    };
    const result = serializeMermaid(canvas);
    expect(result.errors).toEqual([]);
  });
});
