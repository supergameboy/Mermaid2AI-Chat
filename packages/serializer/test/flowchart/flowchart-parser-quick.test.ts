/**
 * flowchart-parser 快速验证测试
 * 临时测试文件，验证解析器基本功能
 */
import { describe, it, expect } from 'vitest';
import { parseFlowchartCode } from '../../src/parser/flowchart/flowchart-parser.js';

describe('FlowchartParser 快速验证', () => {
  it('应解析基本 flowchart', () => {
    const code = `flowchart TD
    A[Hello] --> B[World]`;

    const result = parseFlowchartCode(code);

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.canvas.diagramType).toBe('flowchart');
    expect(result.canvas.nodes).toHaveLength(2);
    expect(result.canvas.edges).toHaveLength(1);

    const nodeA = result.canvas.nodes.find((n) => n.id === 'A');
    const nodeB = result.canvas.nodes.find((n) => n.id === 'B');
    expect(nodeA?.data.label).toBe('Hello');
    expect(nodeA?.data.shape).toBe('rect');
    expect(nodeB?.data.label).toBe('World');
    expect(nodeB?.data.shape).toBe('rect');

    const edge = result.canvas.edges[0];
    expect(edge?.source).toBe('A');
    expect(edge?.target).toBe('B');
    expect(edge?.data.edgeStyle).toBe('arrow');
  });

  it('应解析多种形状', () => {
    const code = `flowchart TD
    A[Rect]
    B(Rounded)
    C{Diamond}
    D((Circle))
    E([Stadium])
    F[[Subroutine]]`;

    const result = parseFlowchartCode(code);

    expect(result.success).toBe(true);
    expect(result.canvas.nodes).toHaveLength(6);

    const shapes = result.canvas.nodes.map((n) => n.data.shape);
    expect(shapes).toContain('rect');
    expect(shapes).toContain('rounded');
    expect(shapes).toContain('diamond');
    expect(shapes).toContain('circle');
    expect(shapes).toContain('stadium');
    expect(shapes).toContain('subroutine');
  });

  it('应解析多种边类型', () => {
    const code = `flowchart LR
    A --> B
    C --o D
    E --x F
    G --- H
    I ==> J
    K -.-> L
    M <--> N
    O o--o P
    Q x--x R
    S ~~~ T`;

    const result = parseFlowchartCode(code);

    expect(result.success).toBe(true);
    expect(result.canvas.edges).toHaveLength(10);

    const styles = result.canvas.edges.map((e) => e.data.edgeStyle);
    expect(styles).toContain('arrow');
    expect(styles).toContain('circle');
    expect(styles).toContain('cross');
    expect(styles).toContain('line');
    expect(styles).toContain('thick-arrow');
    expect(styles).toContain('dotted-arrow');
    expect(styles).toContain('bidirectional-arrow');
    expect(styles).toContain('bidirectional-circle');
    expect(styles).toContain('bidirectional-cross');
    expect(styles).toContain('invisible');
  });

  it('应解析 subgraph', () => {
    const code = `flowchart TB
    subgraph dev[Development]
      A[Code] --> B[Build]
    end
    subgraph ci[CI]
      C[Test]
    end
    B --> C`;

    const result = parseFlowchartCode(code);

    expect(result.success).toBe(true);
    // 2 subgraph + 3 vertex = 5 nodes
    expect(result.canvas.nodes).toHaveLength(5);

    const subgraphDev = result.canvas.nodes.find((n) => n.id === 'dev');
    expect(subgraphDev?.data.label).toBe('Development');

    const nodeA = result.canvas.nodes.find((n) => n.id === 'A');
    expect(nodeA?.parentId).toBe('dev');
  });

  it('应解析 classDef 和 class', () => {
    const code = `flowchart TD
    A[Hello] --> B[World]
    classDef red fill:#f00,stroke:#900
    class A red`;

    const result = parseFlowchartCode(code);

    expect(result.success).toBe(true);
    expect(result.canvas.metadata?.flowClassDefs).toBeDefined();
    const classes = result.canvas.metadata?.flowClassDefs as Array<{ id: string }>;
    expect(classes).toHaveLength(1);
    expect(classes[0]?.id).toBe('red');

    const nodeA = result.canvas.nodes.find((n) => n.id === 'A');
    expect(nodeA?.data.classNames).toContain('red');
  });

  it('应解析 style 语句', () => {
    const code = `flowchart TD
    A[Hello]
    style A fill:#f00,stroke:#900`;

    const result = parseFlowchartCode(code);

    expect(result.success).toBe(true);
    const nodeA = result.canvas.nodes.find((n) => n.id === 'A');
    expect(nodeA?.data.styles).toBeDefined();
    expect(nodeA?.data.styles).toHaveLength(2);
  });

  it('应解析 linkStyle 语句', () => {
    const code = `flowchart TD
    A --> B
    linkStyle 0 stroke:#f00`;

    const result = parseFlowchartCode(code);

    expect(result.success).toBe(true);
    const edge = result.canvas.edges[0];
    expect(edge?.data.styles).toBeDefined();
  });

  it('应解析 click href', () => {
    const code = `flowchart TD
    A[Click me]
    click A "https://example.com" _blank`;

    const result = parseFlowchartCode(code);

    expect(result.success).toBe(true);
    const nodeA = result.canvas.nodes.find((n) => n.id === 'A');
    expect(nodeA?.data.clickUrl).toBe('https://example.com');
    expect(nodeA?.data.linkTarget).toBe('_blank');
  });

  it('应解析 accTitle 和 accDescription', () => {
    const code = `flowchart TD
    accTitle: My Flowchart
    accDescr: This is a description
    A[Hello]`;

    const result = parseFlowchartCode(code);

    expect(result.success).toBe(true);
    expect(result.canvas.metadata?.accTitle).toBe('My Flowchart');
    expect(result.canvas.metadata?.accDescription).toBe('This is a description');
  });

  it('应解析 shapeData 扩展形状', () => {
    const code = `flowchart TD
    A@{ shape: manual-input, label: 'Manual Input' }
    B@{ shape: docs, label: 'Documents' }`;

    const result = parseFlowchartCode(code);

    expect(result.success).toBe(true);
    const nodeA = result.canvas.nodes.find((n) => n.id === 'A');
    expect(nodeA?.data.shape).toBe('sloped-rectangle');
    expect(nodeA?.data.label).toBe('Manual Input');
  });

  it('应处理边标签', () => {
    const code = `flowchart TD
    A -->|Yes| B
    A -->|No| C`;

    const result = parseFlowchartCode(code);

    expect(result.success).toBe(true);
    expect(result.canvas.edges).toHaveLength(2);
    const labels = result.canvas.edges.map((e) => e.data.label);
    expect(labels).toContain('Yes');
    expect(labels).toContain('No');
  });

  it('应处理空代码', () => {
    const code = `flowchart TD`;

    const result = parseFlowchartCode(code);

    expect(result.success).toBe(true);
    expect(result.canvas.nodes).toHaveLength(0);
    expect(result.canvas.edges).toHaveLength(0);
  });
});
