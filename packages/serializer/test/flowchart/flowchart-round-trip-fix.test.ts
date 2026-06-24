/**
 * flowchart 往返测试 — M1-14
 *
 * 验证 parse → serialize → re-parse 往返保持语义一致
 * 重点验证保留原始代码格式（注释、空行、缩进、顺序）
 *
 * 测试策略:
 *   - 语义一致: 节点/边数量、ID、label、shape、edgeStyle 一致
 *   - 格式保留: rawCode 保留原始代码（含注释、空行、缩进）
 *   - 多形状覆盖: 16 种 jison 形状 + 扩展形状
 *   - 多边类型覆盖: 16 种边样式
 *   - subgraph 嵌套覆盖
 */
import { describe, it, expect } from 'vitest';
import { parseFlowchartCode } from '../../src/parser/flowchart/flowchart-parser.js';
import { serializeFlowchart } from '../../src/serializer/flowchart/index.js';
import type { GraphCanvasState } from '../../src/types.js';

// ============================================================
// 辅助函数
// ============================================================

/** 解析代码并返回 CanvasState（断言成功） */
function parse(code: string): GraphCanvasState {
  const result = parseFlowchartCode(code);
  expect(result.success).toBe(true);
  return result.canvas as GraphCanvasState;
}

/** 往返: parse → serialize → re-parse，返回 { first, second } 两个 CanvasState */
function roundTrip(code: string): { first: GraphCanvasState; second: GraphCanvasState; serialized: string } {
  const first = parse(code);
  const serializeResult = serializeFlowchart(first);
  expect(serializeResult.errors).toHaveLength(0);
  const second = parse(serializeResult.mermaid);
  return { first, second, serialized: serializeResult.mermaid };
}

/** 断言两个 CanvasState 语义一致（节点/边数量、ID、label、shape） */
function assertSemanticEqual(first: GraphCanvasState, second: GraphCanvasState): void {
  // 节点数量一致
  expect(second.nodes).toHaveLength(first.nodes.length);
  // 边数量一致
  expect(second.edges).toHaveLength(first.edges.length);

  // 节点 ID 集合一致
  const firstNodeIds = new Set(first.nodes.map((n) => n.id));
  const secondNodeIds = new Set(second.nodes.map((n) => n.id));
  expect(secondNodeIds.size).toBe(firstNodeIds.size);
  for (const id of firstNodeIds) {
    expect(secondNodeIds.has(id)).toBe(true);
  }

  // 边 source-target 对集合一致
  const firstEdgeKeys = new Set(first.edges.map((e) => `${e.source}→${e.target}`));
  const secondEdgeKeys = new Set(second.edges.map((e) => `${e.source}→${e.target}`));
  expect(secondEdgeKeys.size).toBe(firstEdgeKeys.size);
  for (const key of firstEdgeKeys) {
    expect(secondEdgeKeys.has(key)).toBe(true);
  }

  // 节点 label 和 shape 一致
  for (const firstNode of first.nodes) {
    const secondNode = second.nodes.find((n) => n.id === firstNode.id);
    expect(secondNode).toBeDefined();
    expect(secondNode?.data.label).toBe(firstNode.data.label);
    expect(secondNode?.data.shape).toBe(firstNode.data.shape);
  }
}

// ============================================================
// 1. 基本往返测试
// ============================================================

describe('基本往返', () => {
  it('应保持简单 flowchart 语义一致', () => {
    const code = `flowchart TD
    A[Hello] --> B[World]`;

    const { first, second } = roundTrip(code);
    assertSemanticEqual(first, second);
  });

  it('应保持空画布语义一致', () => {
    const code = `flowchart TD`;

    const { first, second } = roundTrip(code);
    expect(second.nodes).toHaveLength(0);
    expect(second.edges).toHaveLength(0);
  });

  it('应保持多节点无边语义一致', () => {
    const code = `flowchart TD
    A[Apple]
    B[Banana]
    C[Cherry]`;

    const { first, second } = roundTrip(code);
    assertSemanticEqual(first, second);
  });
});

// ============================================================
// 2. 形状覆盖往返测试
// ============================================================

describe('形状覆盖往返', () => {
  it('应保持 16 种 jison 标准形状语义一致', () => {
    const code = `flowchart TD
    A[Rect]
    B(Rounded)
    C([Stadium])
    D(-Ellipse-)
    E[[Subroutine]]
    F[(Cylinder)]
    G((Circle))
    H(((DoubleCircle)))
    I{Diamond}
    J{{Hexagon}}
    K>Odd]
    L[/Trapezoid\\]
    M[\\TrapezoidAlt/]
    N[/LeanRight/]
    O[\\LeanLeft\\]`;

    const { first, second } = roundTrip(code);
    assertSemanticEqual(first, second);

    // 验证所有形状都被正确解析和序列化
    const shapes = second.nodes.map((n) => n.data.shape);
    expect(shapes).toContain('rect');
    expect(shapes).toContain('rounded');
    expect(shapes).toContain('stadium');
    expect(shapes).toContain('ellipse');
    expect(shapes).toContain('subroutine');
    expect(shapes).toContain('cylinder');
    expect(shapes).toContain('circle');
    expect(shapes).toContain('doublecircle');
    expect(shapes).toContain('diamond');
    expect(shapes).toContain('hexagon');
    expect(shapes).toContain('odd');
    expect(shapes).toContain('trapezoid');
    expect(shapes).toContain('trapezoid-reverse');
    expect(shapes).toContain('lean-right');
    expect(shapes).toContain('lean-left');
  });

  it('应保持扩展形状（shapeData 语法）语义一致', () => {
    const code = `flowchart TD
    A@{ shape: document, label: "Document" }
    B@{ shape: note, label: "Note" }
    C@{ shape: card, label: "Card" }`;

    const { first, second } = roundTrip(code);
    assertSemanticEqual(first, second);

    // 扩展形状应保留 shapeData 语法
    for (const node of second.nodes) {
      expect(node.data.shape).not.toBe('rect');
    }
  });
});

// ============================================================
// 3. 边类型覆盖往返测试
// ============================================================

describe('边类型覆盖往返', () => {
  it('应保持 16 种边样式语义一致', () => {
    const code = `flowchart TD
    A[Start] --> B[Arrow]
    A --x C[Cross]
    A --o D[Circle]
    A --- E[Line]
    A ==> F[ThickArrow]
    A ==x G[ThickCross]
    A ==o H[ThickCircle]
    A === I[ThickLine]
    A -.-> J[DottedArrow]
    A -.-x K[DottedCross]
    A -.-o L[DottedCircle]
    A -.- M[Dotted]
    A <--> N[BiArrow]
    A x--x O[BiCross]
    A o--o P[BiCircle]
    A ~~~ Q[Invisible]`;

    const { first, second } = roundTrip(code);
    assertSemanticEqual(first, second);

    // 验证边样式集合一致
    const firstStyles = new Set(first.edges.map((e) => e.data.edgeStyle));
    const secondStyles = new Set(second.edges.map((e) => e.data.edgeStyle));
    expect(secondStyles.size).toBe(firstStyles.size);
    for (const style of firstStyles) {
      expect(secondStyles.has(style)).toBe(true);
    }
  });

  it('应保持边标签语义一致', () => {
    const code = `flowchart TD
    A[Start] -->|Yes| B[Process]
    A -->|No| C[End]`;

    const { first, second } = roundTrip(code);
    assertSemanticEqual(first, second);

    // 验证边标签保留
    const yesEdge = second.edges.find((e) => e.data.label === 'Yes');
    const noEdge = second.edges.find((e) => e.data.label === 'No');
    expect(yesEdge).toBeDefined();
    expect(noEdge).toBeDefined();
  });
});

// ============================================================
// 4. subgraph 往返测试
// ============================================================

describe('subgraph 往返', () => {
  it('应保持单层 subgraph 语义一致', () => {
    const code = `flowchart TB
    subgraph dev
      a1[a] --> a2[b]
    end
    subgraph ci
      b1[c] --> b2[d]
    end`;

    const { first, second } = roundTrip(code);
    assertSemanticEqual(first, second);

    // subgraph 数量一致
    const firstSubgraphs = first.nodes.filter((n) => (n.data as Record<string, unknown>).isSubgraph === true);
    const secondSubgraphs = second.nodes.filter((n) => (n.data as Record<string, unknown>).isSubgraph === true);
    expect(secondSubgraphs).toHaveLength(firstSubgraphs.length);
  });

  it('应保持嵌套 subgraph 语义一致', () => {
    const code = `flowchart TB
    subgraph outer
      subgraph inner
        a1[a] --> a2[b]
      end
    end`;

    const { first, second } = roundTrip(code);
    assertSemanticEqual(first, second);

    // 验证嵌套关系: inner 的 parentId 应为 outer
    const innerNode = second.nodes.find((n) => n.id === 'inner');
    expect(innerNode).toBeDefined();
    expect(innerNode?.parentId).toBe('outer');
  });

  it('应保持跨 subgraph 边语义一致', () => {
    const code = `flowchart TB
    subgraph dev
      a1[a] --> a2[b]
    end
    subgraph ci
      b1[c] --> b2[d]
    end
    a2 --> b1`;

    const { first, second } = roundTrip(code);
    assertSemanticEqual(first, second);

    // 跨 subgraph 边 a2 → b1 应保留
    const crossEdge = second.edges.find((e) => e.source === 'a2' && e.target === 'b1');
    expect(crossEdge).toBeDefined();
  });

  it('应保持 subgraph 显式方向语义一致', () => {
    const code = `flowchart TB
    subgraph dev
      direction LR
      a1[a] --> a2[b]
    end`;

    const { first, second } = roundTrip(code);
    assertSemanticEqual(first, second);

    // subgraph dev 应有显式方向 LR
    const devNode = second.nodes.find((n) => n.id === 'dev');
    expect(devNode).toBeDefined();
    const devDir = (devNode?.data as Record<string, unknown>).dir;
    const devHasExplicitDir = (devNode?.data as Record<string, unknown>).hasExplicitDir;
    expect(devDir).toBe('LR');
    expect(devHasExplicitDir).toBe(true);
  });
});

// ============================================================
// 5. 样式系统往返测试
// ============================================================

describe('样式系统往返', () => {
  it('应保持 classDef + class 语义一致', () => {
    const code = `flowchart TD
    A[Hello]:::red
    B[World]
    classDef red fill:#f00,stroke:#900`;

    const { first, second } = roundTrip(code);
    assertSemanticEqual(first, second);

    // classDef 应保留
    expect(second.metadata?.flowClassDefs).toBeDefined();
    expect(second.metadata?.flowClassDefs?.length).toBeGreaterThan(0);
    const redClass = second.metadata?.flowClassDefs?.find((c) => c.id === 'red');
    expect(redClass).toBeDefined();
    expect(redClass?.styles).toContain('fill:#f00');
  });

  it('应保持 style 语句语义一致', () => {
    const code = `flowchart TD
    A[Hello]
    style A fill:#f00,stroke:#900`;

    const { first, second } = roundTrip(code);
    assertSemanticEqual(first, second);

    // 节点 A 的 styles 应保留
    const nodeA = second.nodes.find((n) => n.id === 'A');
    const styles = (nodeA?.data as Record<string, unknown>).styles as string[] | undefined;
    expect(styles).toBeDefined();
    expect(styles).toContain('fill:#f00');
    expect(styles).toContain('stroke:#900');
  });

  it('应保持 linkStyle 语句语义一致', () => {
    const code = `flowchart TD
    A[Hello] --> B[World]
    linkStyle 0 stroke:#f00,stroke-width:2px`;

    const { first, second } = roundTrip(code);
    assertSemanticEqual(first, second);

    // 边的 styles 应保留
    const edge = second.edges[0];
    const styles = (edge.data as Record<string, unknown>).styles as string[] | undefined;
    expect(styles).toBeDefined();
    expect(styles).toContain('stroke:#f00');
  });

  it('应保持 linkStyle default 语义一致', () => {
    const code = `flowchart TD
    A[Hello] --> B[World]
    linkStyle default interpolate basis`;

    const { first, second } = roundTrip(code);
    assertSemanticEqual(first, second);

    // defaultInterpolate 应保留
    const defaultInterpolate = (second.metadata as Record<string, unknown> | undefined)?.flowDefaultInterpolate;
    expect(defaultInterpolate).toBe('basis');
  });

  it('应保持 style 中任意 CSS 属性（如 font-size、font-family）', () => {
    const code = `flowchart TD
    A[Hello]
    style A fill:#f00,stroke:#900,font-size:12px,font-family:Arial`;

    const { first, second } = roundTrip(code);
    assertSemanticEqual(first, second);

    const nodeA = second.nodes.find((n) => n.id === 'A');
    const styles = (nodeA?.data as Record<string, unknown>).styles as string[] | undefined;
    expect(styles).toBeDefined();
    expect(styles).toContain('font-size:12px');
    expect(styles).toContain('font-family:Arial');

    const style = (nodeA?.data as Record<string, unknown>).style as Record<string, unknown> | undefined;
    expect(style).toBeDefined();
    expect(style?.['font-size']).toBe('12px');
    expect(style?.['font-family']).toBe('Arial');
  });

  it('应保持 classDef 中任意 CSS 属性（如 font-size、font-family）', () => {
    const code = `flowchart TD
    A[Hello]:::red
    classDef red fill:#f00,font-size:14px,font-family:Arial`;

    const { first, second } = roundTrip(code);
    assertSemanticEqual(first, second);

    const redClass = second.metadata?.flowClassDefs?.find((c) => c.id === 'red');
    expect(redClass).toBeDefined();
    expect(redClass?.styles).toContain('font-size:14px');
    expect(redClass?.styles).toContain('font-family:Arial');

    const nodeA = second.nodes.find((n) => n.id === 'A');
    const style = (nodeA?.data as Record<string, unknown>).style as Record<string, unknown> | undefined;
    expect(style).toBeDefined();
    expect(style?.['font-size']).toBe('14px');
    expect(style?.['font-family']).toBe('Arial');
  });
});

// ============================================================
// 6. 无障碍信息往返测试
// ============================================================

describe('无障碍信息往返', () => {
  it('应保持 accTitle 和 accDescription 语义一致', () => {
    const code = `flowchart TD
    accTitle: My Flowchart
    accDescr: This is a description
    A[Hello] --> B[World]`;

    const { first, second } = roundTrip(code);
    assertSemanticEqual(first, second);

    expect(second.metadata?.accTitle).toBe('My Flowchart');
    expect(second.metadata?.accDescription).toBe('This is a description');
  });

  it('应保持 title 语句语义一致', () => {
    const code = `---
title: My Diagram Title
---
flowchart TD
    A[Hello] --> B[World]`;

    const { first, second } = roundTrip(code);
    assertSemanticEqual(first, second);

    expect(second.metadata?.title).toBe('My Diagram Title');
  });
});

// ============================================================
// 7. click 交互往返测试
// ============================================================

describe('click 交互往返', () => {
  it('应保持 click href 语义一致', () => {
    const code = `flowchart TD
    A[Click me]
    click A "https://example.com" _blank`;

    const { first, second } = roundTrip(code);
    assertSemanticEqual(first, second);

    // 节点 A 的 clickUrl 应保留
    const nodeA = second.nodes.find((n) => n.id === 'A');
    const clickUrl = (nodeA?.data as Record<string, unknown>).clickUrl;
    expect(clickUrl).toBe('https://example.com');
  });
});

// ============================================================
// 8. 原始代码格式保留验证
// ============================================================

describe('原始代码格式保留', () => {
  it('解析后 rawCode 应完整保留原始代码（含注释）', () => {
    const code = `flowchart TD
%% 这是注释
    A[Hello] --> B[World]
    B --> C[Test]`;

    const canvas = parse(code);
    expect(canvas.rawCode).toBe(code);
  });

  it('解析后 rawCode 应保留空行', () => {
    const code = `flowchart TD

    A[Hello]

    B[World]`;

    const canvas = parse(code);
    expect(canvas.rawCode).toBe(code);
  });

  it('解析后 rawCode 应保留原始缩进', () => {
    const code = `flowchart TD
      A[Hello] --> B[World]`;

    const canvas = parse(code);
    expect(canvas.rawCode).toBe(code);
  });

  it('解析后 rawCode 应保留 subgraph 嵌套缩进', () => {
    const code = `flowchart TB
    subgraph dev
      a1[a] --> a2[b]
    end`;

    const canvas = parse(code);
    expect(canvas.rawCode).toBe(code);
  });
});

// ============================================================
// 9. 官方示例往返测试
// ============================================================

describe('官方示例往返', () => {
  it('应保持 Basic Flowchart 示例语义一致', () => {
    const code = `flowchart TD
    A[Christmas] --> B(Go shopping)
    B --> C{Let me think}
    C -->|One| D[Laptop]
    C -->|Two| E[iPhone]
    C -->|Three| F[fa:fa-car Car]`;

    const { first, second } = roundTrip(code);
    assertSemanticEqual(first, second);
  });

  it('应保持 CI/CD Pipeline with Subgraphs 示例语义一致', () => {
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

    const { first, second } = roundTrip(code);
    assertSemanticEqual(first, second);

    // 3 个 subgraph
    const subgraphs = second.nodes.filter((n) => (n.data as Record<string, unknown>).isSubgraph === true);
    expect(subgraphs).toHaveLength(3);
  });

  it('应保持 Decision Tree with Styling 示例语义一致', () => {
    const code = `flowchart TD
    A[Start] --> B{Is it?}
    B -- Yes --> C[OK]
    C --> D[Rethink]
    D --> B
    B -- No --> E[End]
    style C fill:#90EE90
    style E fill:#FFB6C1`;

    const { first, second } = roundTrip(code);
    assertSemanticEqual(first, second);

    // 样式应保留
    const nodeC = second.nodes.find((n) => n.id === 'C');
    const stylesC = (nodeC?.data as Record<string, unknown>).styles as string[] | undefined;
    expect(stylesC).toContain('fill:#90EE90');
  });
});
