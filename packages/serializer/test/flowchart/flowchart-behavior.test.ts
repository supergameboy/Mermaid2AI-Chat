/**
 * flowchart 行为验证测试 — M1-10
 *
 * 验证 flowchart 解析器、序列化器的行为符合官方 mermaid 标准
 * 覆盖：官方示例、形状覆盖、边类型覆盖、subgraph、样式系统、click 交互、边界场景
 *
 * 测试策略：行为验证（不测试实现细节，只测试接口和行为）
 */

import { describe, it, expect } from 'vitest';
import { parseFlowchartCode } from '../../src/parser/flowchart/flowchart-parser.js';
import { serializeFlowchart } from '../../src/serializer/flowchart/index.js';
import type { GraphCanvasState, MermaidShapeType, MermaidEdgeStyle } from '../../src/types.js';

// ============================================================
// 辅助函数
// ============================================================

/** 解析代码并返回 CanvasState（断言成功） */
function parse(code: string): GraphCanvasState {
  const result = parseFlowchartCode(code);
  expect(result.success).toBe(true);
  return result.canvas as GraphCanvasState;
}

/** 获取节点形状 */
function getShape(canvas: GraphCanvasState, nodeId: string): MermaidShapeType {
  const node = canvas.nodes.find((n) => n.id === nodeId);
  return node?.data.shape ?? 'rect';
}

/** 获取边样式 */
function getEdgeStyle(canvas: GraphCanvasState, index: number): MermaidEdgeStyle {
  const edge = canvas.edges[index];
  return edge?.data.edgeStyle ?? 'arrow';
}

// ============================================================
// 官方示例对照
// ============================================================

describe('官方示例对照', () => {
  it('应正确解析 Basic Flowchart 示例', () => {
    const code = `flowchart TD
    A[Christmas] --> B(Go shopping)
    B --> C{Let me think}
    C -->|One| D[Laptop]
    C -->|Two| E[iPhone]
    C -->|Three| F[fa:fa-car Car]`;

    const canvas = parse(code);

    // 6 节点
    expect(canvas.nodes).toHaveLength(6);

    // 验证形状
    expect(getShape(canvas, 'A')).toBe('rect');
    expect(getShape(canvas, 'B')).toBe('rounded');
    expect(getShape(canvas, 'C')).toBe('diamond');
    expect(getShape(canvas, 'D')).toBe('rect');
    expect(getShape(canvas, 'E')).toBe('rect');
    expect(getShape(canvas, 'F')).toBe('rect');

    // 5 边
    expect(canvas.edges).toHaveLength(5);

    // 验证边标签
    const edgeOne = canvas.edges.find((e) => e.data.label === 'One');
    const edgeTwo = canvas.edges.find((e) => e.data.label === 'Two');
    const edgeThree = canvas.edges.find((e) => e.data.label === 'Three');
    expect(edgeOne).toBeDefined();
    expect(edgeTwo).toBeDefined();
    expect(edgeThree).toBeDefined();
  });

  it('应正确解析 CI/CD Pipeline with Subgraphs 示例', () => {
    const code = `flowchart TB
    subgraph dev
      a1[a] --> a2[b]
    end
    subgraph ci
      b1[c] --> b2[d]
    end
    subgraph cd
      c1[e] --> c2[f]
    end`;

    const canvas = parse(code);

    // 3 个 subgraph 节点
    const subgraphs = canvas.nodes.filter((n) => {
      const isSubgraph = (n.data as Record<string, unknown>).isSubgraph;
      return isSubgraph === true;
    });
    expect(subgraphs).toHaveLength(3);

    // 6 个普通节点
    const normalNodes = canvas.nodes.filter((n) => {
      const isSubgraph = (n.data as Record<string, unknown>).isSubgraph;
      return isSubgraph !== true;
    });
    expect(normalNodes).toHaveLength(6);

    // 3 条边
    expect(canvas.edges).toHaveLength(3);
  });

  it('应正确解析 Expanded Node Shapes 示例', () => {
    const code = `flowchart TD
    A@{ shape: manual-input, label: 'Manual Input' }
    B@{ shape: docs, label: 'Documents' }
    C@{ shape: procs, label: 'Process' }`;

    const canvas = parse(code);

    // 3 节点
    expect(canvas.nodes).toHaveLength(3);

    // 验证 shapeData 被正确解析（对齐官方 shapes.ts 别名映射）
    expect(getShape(canvas, 'A')).toBe('sloped-rectangle');
    expect(getShape(canvas, 'B')).toBe('stacked-document');
    expect(getShape(canvas, 'C')).toBe('stacked-rectangle');
  });
});

// ============================================================
// 形状覆盖（16 种 jison 语法形状）
// ============================================================

describe('形状覆盖 - jison 语法', () => {
  const shapeCases: Array<[MermaidShapeType, string, string]> = [
    ['rect', 'A[Label]', 'rect'],
    ['rounded', 'A(Label)', 'rounded'],
    ['stadium', 'A([Label])', 'stadium'],
    ['ellipse', 'A(-Label-)', 'ellipse'],
    ['subroutine', 'A[[Label]]', 'subroutine'],
    ['cylinder', 'A[(Label)]', 'cylinder'],
    ['circle', 'A((Label))', 'circle'],
    ['doublecircle', 'A(((Label)))', 'doublecircle'],
    ['diamond', 'A{Label}', 'diamond'],
    ['hexagon', 'A{{Label}}', 'hexagon'],
    ['odd', 'A>Label]', 'odd'],
    ['trapezoid', 'A[/Label\\]', 'trapezoid'],
    ['trapezoid-reverse', 'A[\\Label/]', 'trapezoid-reverse'],
    ['lean-right', 'A[/Label/]', 'lean-right'],
    ['lean-left', 'A[\\Label\\]', 'lean-left'],
  ];

  for (const [expectedShape, syntax] of shapeCases) {
    it(`应正确解析 ${expectedShape} 形状 (${syntax})`, () => {
      const code = `flowchart TD\n    ${syntax}`;
      const canvas = parse(code);
      expect(getShape(canvas, 'A')).toBe(expectedShape);
    });
  }
});

// ============================================================
// 边类型覆盖（16 种边样式）
// ============================================================

describe('边类型覆盖', () => {
  const edgeCases: Array<[MermaidEdgeStyle, string]> = [
    ['line', 'A --- B'],
    ['arrow', 'A --> B'],
    ['cross', 'A --x B'],
    ['circle', 'A --o B'],
    ['thick-line', 'A === B'],
    ['thick-arrow', 'A ==> B'],
    ['thick-cross', 'A ==x B'],
    ['thick-circle', 'A ==o B'],
    ['dotted', 'A -.- B'],
    ['dotted-arrow', 'A -.-> B'],
    // dotted-cross/dotted-circle 单向语法（-.x/.o）官方 jison 不支持，仅双向支持（x-.x/o-.o）
    ['bidirectional-arrow', 'A <--> B'],
    ['bidirectional-cross', 'A x--x B'],
    ['bidirectional-circle', 'A o--o B'],
    ['invisible', 'A ~~~ B'],
  ];

  for (const [expectedStyle, syntax] of edgeCases) {
    it(`应正确解析 ${expectedStyle} 边样式 (${syntax})`, () => {
      const code = `flowchart TD\n    ${syntax}`;
      const canvas = parse(code);
      expect(canvas.edges).toHaveLength(1);
      expect(getEdgeStyle(canvas, 0)).toBe(expectedStyle);
    });
  }
});

// ============================================================
// subgraph
// ============================================================

describe('subgraph', () => {
  it('应解析嵌套 subgraph', () => {
    const code = `flowchart TD
    subgraph Outer
      subgraph Inner
        A[Node A]
      end
      B[Node B]
    end`;

    const canvas = parse(code);

    // 2 个 subgraph + 2 个普通节点
    const subgraphs = canvas.nodes.filter((n) => (n.data as Record<string, unknown>).isSubgraph === true);
    expect(subgraphs).toHaveLength(2);

    // Inner subgraph 的 parentId 应为 Outer
    const inner = subgraphs.find((s) => s.id === 'Inner');
    expect(inner?.parentId).toBe('Outer');

    // Node A 的 parentId 应为 Inner
    const nodeA = canvas.nodes.find((n) => n.id === 'A');
    expect(nodeA?.parentId).toBe('Inner');

    // Node B 的 parentId 应为 Outer
    const nodeB = canvas.nodes.find((n) => n.id === 'B');
    expect(nodeB?.parentId).toBe('Outer');
  });

  it('应解析 subgraph direction', () => {
    const code = `flowchart TD
    subgraph A
      direction LR
      B[Node B] --> C[Node C]
    end`;

    const canvas = parse(code);
    const subgraph = canvas.nodes.find((n) => n.id === 'A');
    expect(subgraph).toBeDefined();

    const dir = (subgraph!.data as Record<string, unknown>).dir;
    expect(dir).toBe('LR');
  });

  it('应解析 subgraph 节点列表', () => {
    const code = `flowchart TD
    subgraph Group1
      A[Node A]
      B[Node B]
      C[Node C]
    end`;

    const canvas = parse(code);
    const subgraph = canvas.nodes.find((n) => n.id === 'Group1');
    expect(subgraph).toBeDefined();

    const subgraphNodes = (subgraph!.data as Record<string, unknown>).subgraphNodes as string[];
    expect(subgraphNodes).toContain('A');
    expect(subgraphNodes).toContain('B');
    expect(subgraphNodes).toContain('C');
  });
});

// ============================================================
// 样式系统
// ============================================================

describe('样式系统', () => {
  it('应解析 classDef', () => {
    const code = `flowchart TD
    A[Node A]
    classDef red fill:#f00,stroke:#333`;

    const canvas = parse(code);
    const classes = canvas.metadata?.flowClassDefs;
    expect(classes).toBeDefined();
    expect(classes).toHaveLength(1);
    expect(classes![0].id).toBe('red');
    expect(classes![0].styles).toContain('fill:#f00');
    expect(classes![0].styles).toContain('stroke:#333');
  });

  it('应解析 class 应用', () => {
    const code = `flowchart TD
    A[Node A]
    classDef red fill:#f00
    class A red`;

    const canvas = parse(code);
    const nodeA = canvas.nodes.find((n) => n.id === 'A');
    expect(nodeA?.data.classNames).toContain('red');
  });

  it('应解析 style 语句', () => {
    const code = `flowchart TD
    A[Node A]
    style A fill:#f00,stroke:#0f0`;

    const canvas = parse(code);
    const nodeA = canvas.nodes.find((n) => n.id === 'A');
    // style 语句存储在节点的 styles 扩展字段
    const styles = (nodeA?.data as Record<string, unknown>).styles as string[] | undefined;
    expect(styles).toBeDefined();
    expect(styles).toContain('fill:#f00');
    expect(styles).toContain('stroke:#0f0');
  });
});

// ============================================================
// click 交互
// ============================================================

describe('click 交互', () => {
  it('应解析 click href', () => {
    const code = `flowchart TD
    A[Node A]
    click A href "https://example.com" _blank`;

    const canvas = parse(code);
    const nodeA = canvas.nodes.find((n) => n.id === 'A');
    expect(nodeA?.data.clickUrl).toBe('https://example.com');
  });

  it('应解析 click tooltip', () => {
    const code = `flowchart TD
    A[Node A]
    click A callback "tooltip text"`;

    const canvas = parse(code);
    const nodeA = canvas.nodes.find((n) => n.id === 'A');
    expect(nodeA?.data.tooltip).toBeDefined();
    expect(nodeA?.data.tooltip).toBe('tooltip text');
  });
});

// ============================================================
// accTitle / accDescription
// ============================================================

describe('无障碍信息', () => {
  it('应解析 accTitle 和 accDescription', () => {
    const code = `flowchart TD
    accTitle: My Flowchart
    accDescr: This is a description
    A[Node A]`;

    const canvas = parse(code);
    expect(canvas.metadata?.accTitle).toBe('My Flowchart');
    expect(canvas.metadata?.accDescription).toBe('This is a description');
  });
});

// ============================================================
// 边界场景
// ============================================================

describe('边界场景', () => {
  it('应处理空代码（仅声明）', () => {
    const code = 'flowchart TD';
    const canvas = parse(code);
    expect(canvas.nodes).toHaveLength(0);
    expect(canvas.edges).toHaveLength(0);
  });

  it('应处理多行标签', () => {
    const code = `flowchart TD
    A[Line 1<br/>Line 2]`;
    const canvas = parse(code);
    expect(canvas.nodes).toHaveLength(1);
    const nodeA = canvas.nodes[0];
    expect(nodeA?.data.label).toContain('<br/>');
  });

  it('应处理边标签', () => {
    const code = `flowchart TD
    A -->|Yes| B`;
    const canvas = parse(code);
    expect(canvas.edges).toHaveLength(1);
    expect(canvas.edges[0]?.data.label).toBe('Yes');
  });
});

// ============================================================
// Round-trip 等价
// ============================================================

describe('Round-trip 等价', () => {
  const examples: Array<[string, string]> = [
    ['基本 flowchart', `flowchart TD
    A[Hello] --> B[World]`],
    ['多形状', `flowchart TD
    A[Rect] --> B(Rounded)
    B --> C{Diamond}
    C --> D((Circle))`],
    ['多边类型', `flowchart TD
    A --> B
    A --o C
    A --x D
    A ==> E`],
    ['带 subgraph', `flowchart TD
    subgraph Group
      A[Node A] --> B[Node B]
    end`],
    ['带 classDef', `flowchart TD
    A[Node A]
    classDef red fill:#f00
    class A red`],
  ];

  for (const [title, code] of examples) {
    it(`应 round-trip 等价：${title}`, () => {
      // 解析 → 序列化 → 重新解析
      const canvas1 = parse(code);
      const serialized = serializeFlowchart(canvas1);
      expect(serialized.errors).toHaveLength(0);
      expect(serialized.mermaid.length).toBeGreaterThan(0);

      const canvas2 = parse(serialized.mermaid);

      // 验证语义等价
      expect(canvas2.nodes.filter((n) => !(n.data as Record<string, unknown>).isSubgraph)).toHaveLength(
        canvas1.nodes.filter((n) => !(n.data as Record<string, unknown>).isSubgraph).length
      );
      expect(canvas2.edges).toHaveLength(canvas1.edges.length);
    });
  }
});

// ============================================================
// 序列化验证
// ============================================================

describe('序列化验证', () => {
  it('应正确序列化方向', () => {
    const canvas: GraphCanvasState = {
      diagramType: 'flowchart',
      nodes: [{ id: 'A', position: { x: 0, y: 0 }, data: { label: 'A', shape: 'rect' } }],
      edges: [],
      direction: 'LR',
    };
    const result = serializeFlowchart(canvas);
    expect(result.mermaid).toContain('flowchart LR');
  });

  it('应正确序列化空画布', () => {
    const canvas: GraphCanvasState = {
      diagramType: 'flowchart',
      nodes: [],
      edges: [],
      direction: 'TD',
    };
    const result = serializeFlowchart(canvas);
    expect(result.mermaid).toContain('flowchart TD');
    expect(result.errors).toHaveLength(0);
  });

  it('应拒绝非 flowchart 类型', () => {
    const canvas = {
      diagramType: 'sequenceDiagram',
      nodes: [],
      edges: [],
    } as unknown as GraphCanvasState;
    const result = serializeFlowchart(canvas);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
