/**
 * 布局算法测试 — dagre 布局位置生成
 */
import { describe, it, expect } from 'vitest';
import { layoutCanvas } from './layout.js';
import type { FlowchartDirection, MermaidEdge, MermaidNode } from './types.js';

/** 创建测试用节点 */
function createNode(id: string): MermaidNode {
  return {
    id,
    type: 'rect',
    position: { x: 0, y: 0 },
    data: { label: id, shape: 'rect' },
  };
}

/** 创建测试用边 */
function createEdge(id: string, source: string, target: string): MermaidEdge {
  return {
    id,
    source,
    target,
    type: 'smoothstep',
    data: { edgeStyle: 'arrow' },
  };
}

describe('layoutCanvas', () => {
  describe('空画布', () => {
    it('should handle empty nodes array', () => {
      const nodes: MermaidNode[] = [];
      const edges: MermaidEdge[] = [];
      layoutCanvas(nodes, edges, 'TB');
      expect(nodes.length).toBe(0);
    });

    it('should handle single node', () => {
      const nodes = [createNode('A')];
      const edges: MermaidEdge[] = [];
      layoutCanvas(nodes, edges, 'TB');
      expect(nodes[0].position).toBeDefined();
      expect(nodes[0].position.x).toBeTypeOf('number');
      expect(nodes[0].position.y).toBeTypeOf('number');
    });
  });

  describe('位置生成', () => {
    it('should assign non-zero positions to nodes', () => {
      const nodes = [createNode('A'), createNode('B'), createNode('C')];
      const edges = [
        createEdge('e1', 'A', 'B'),
        createEdge('e2', 'B', 'C'),
      ];
      layoutCanvas(nodes, edges, 'TB');

      // 所有节点都应有有效位置
      for (const node of nodes) {
        expect(node.position.x).toBeTypeOf('number');
        expect(node.position.y).toBeTypeOf('number');
        expect(Number.isFinite(node.position.x)).toBe(true);
        expect(Number.isFinite(node.position.y)).toBe(true);
      }
    });

    it('should layout nodes in top-to-bottom order for TB direction', () => {
      const nodes = [createNode('A'), createNode('B'), createNode('C')];
      const edges = [
        createEdge('e1', 'A', 'B'),
        createEdge('e2', 'B', 'C'),
      ];
      layoutCanvas(nodes, edges, 'TB');

      // A 应在 B 上方，B 应在 C 上方（y 坐标递增）
      const nodeA = nodes.find((n) => n.id === 'A');
      const nodeB = nodes.find((n) => n.id === 'B');
      const nodeC = nodes.find((n) => n.id === 'C');
      expect(nodeA && nodeB && nodeC).toBeTruthy();
      expect(nodeA!.position.y).toBeLessThan(nodeB!.position.y);
      expect(nodeB!.position.y).toBeLessThan(nodeC!.position.y);
    });

    it('should layout nodes in left-to-right order for LR direction', () => {
      const nodes = [createNode('A'), createNode('B'), createNode('C')];
      const edges = [
        createEdge('e1', 'A', 'B'),
        createEdge('e2', 'B', 'C'),
      ];
      layoutCanvas(nodes, edges, 'LR');

      // A 应在 B 左侧，B 应在 C 左侧（x 坐标递增）
      const nodeA = nodes.find((n) => n.id === 'A');
      const nodeB = nodes.find((n) => n.id === 'B');
      const nodeC = nodes.find((n) => n.id === 'C');
      expect(nodeA && nodeB && nodeC).toBeTruthy();
      expect(nodeA!.position.x).toBeLessThan(nodeB!.position.x);
      expect(nodeB!.position.x).toBeLessThan(nodeC!.position.x);
    });
  });

  describe('方向映射', () => {
    it('should handle TD direction (alias of TB)', () => {
      const nodes = [createNode('A'), createNode('B')];
      const edges = [createEdge('e1', 'A', 'B')];
      expect(() => layoutCanvas(nodes, edges, 'TD')).not.toThrow();
    });

    it('should handle BT direction', () => {
      const nodes = [createNode('A'), createNode('B')];
      const edges = [createEdge('e1', 'A', 'B')];
      expect(() => layoutCanvas(nodes, edges, 'BT')).not.toThrow();
    });

    it('should handle RL direction', () => {
      const nodes = [createNode('A'), createNode('B')];
      const edges = [createEdge('e1', 'A', 'B')];
      expect(() => layoutCanvas(nodes, edges, 'RL')).not.toThrow();
    });
  });

  describe('复杂图布局', () => {
    it('should handle diamond shape (branching and merging)', () => {
      // A → B, A → C, B → D, C → D
      const nodes = [createNode('A'), createNode('B'), createNode('C'), createNode('D')];
      const edges = [
        createEdge('e1', 'A', 'B'),
        createEdge('e2', 'A', 'C'),
        createEdge('e3', 'B', 'D'),
        createEdge('e4', 'C', 'D'),
      ];
      layoutCanvas(nodes, edges, 'TB');

      // A 应在最上方，D 应在最下方
      const nodeA = nodes.find((n) => n.id === 'A');
      const nodeD = nodes.find((n) => n.id === 'D');
      expect(nodeA!.position.y).toBeLessThan(nodeD!.position.y);

      // B 和 C 应在同一层（y 坐标接近）
      const nodeB = nodes.find((n) => n.id === 'B');
      const nodeC = nodes.find((n) => n.id === 'C');
      expect(Math.abs(nodeB!.position.y - nodeC!.position.y)).toBeLessThan(5);
    });

    it('should handle disconnected components', () => {
      // A → B 和 C → D 两个独立组件
      const nodes = [createNode('A'), createNode('B'), createNode('C'), createNode('D')];
      const edges = [
        createEdge('e1', 'A', 'B'),
        createEdge('e2', 'C', 'D'),
      ];
      expect(() => layoutCanvas(nodes, edges, 'TB')).not.toThrow();

      // 所有节点都应有有效位置
      for (const node of nodes) {
        expect(Number.isFinite(node.position.x)).toBe(true);
        expect(Number.isFinite(node.position.y)).toBe(true);
      }
    });

    it('should handle node with custom width/height', () => {
      const nodes: MermaidNode[] = [
        {
          id: 'A',
          type: 'rect',
          position: { x: 0, y: 0 },
          data: { label: 'A', shape: 'rect' },
          width: 200,
          height: 80,
        },
        createNode('B'),
      ];
      const edges = [createEdge('e1', 'A', 'B')];
      expect(() => layoutCanvas(nodes, edges, 'TB')).not.toThrow();
    });
  });

  describe('幂等性', () => {
    it('should produce consistent layout for same input', () => {
      const nodes1 = [createNode('A'), createNode('B'), createNode('C')];
      const edges1 = [
        createEdge('e1', 'A', 'B'),
        createEdge('e2', 'B', 'C'),
      ];
      layoutCanvas(nodes1, edges1, 'TB');

      const nodes2 = [createNode('A'), createNode('B'), createNode('C')];
      const edges2 = [
        createEdge('e1', 'A', 'B'),
        createEdge('e2', 'B', 'C'),
      ];
      layoutCanvas(nodes2, edges2, 'TB');

      // 相同输入应产生相同布局
      for (let i = 0; i < nodes1.length; i++) {
        expect(nodes1[i].position.x).toBe(nodes2[i].position.x);
        expect(nodes1[i].position.y).toBe(nodes2[i].position.y);
      }
    });
  });
});
