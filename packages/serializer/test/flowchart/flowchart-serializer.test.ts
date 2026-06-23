/**
 * flowchart-serializer 序列化器测试
 *
 * 验证 CanvasState → Mermaid 代码的序列化功能
 */
import { describe, it, expect } from 'vitest';
import { serializeFlowchart } from '../../src/serializer/flowchart/flowchart-serializer.js';
import { parseFlowchartCode } from '../../src/parser/flowchart/flowchart-parser.js';
import type { GraphCanvasState, MermaidNode, MermaidEdge } from '../../src/types.js';

describe('FlowchartSerializer', () => {
  it('应序列化基本 flowchart', () => {
    const canvas: GraphCanvasState = {
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [
        createNode('A', 'Hello', 'rect'),
        createNode('B', 'World', 'rect'),
      ],
      edges: [
        createEdge('e1', 'A', 'B', 'arrow'),
      ],
    };

    const result = serializeFlowchart(canvas);

    expect(result.errors).toHaveLength(0);
    expect(result.mermaid).toContain('flowchart TD');
    expect(result.mermaid).toContain('A[Hello]');
    expect(result.mermaid).toContain('B[World]');
    expect(result.mermaid).toContain('A --> B');
  });

  it('应序列化多种形状', () => {
    const canvas: GraphCanvasState = {
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [
        createNode('A', 'Rect', 'rect'),
        createNode('B', 'Rounded', 'rounded'),
        createNode('C', 'Diamond', 'diamond'),
        createNode('D', 'Circle', 'circle'),
        createNode('E', 'Stadium', 'stadium'),
        createNode('F', 'Subroutine', 'subroutine'),
      ],
      edges: [],
    };

    const result = serializeFlowchart(canvas);

    expect(result.mermaid).toContain('A[Rect]');
    expect(result.mermaid).toContain('B(Rounded)');
    expect(result.mermaid).toContain('C{Diamond}');
    expect(result.mermaid).toContain('D((Circle))');
    expect(result.mermaid).toContain('E([Stadium])');
    expect(result.mermaid).toContain('F[[Subroutine]]');
  });

  it('应序列化多种边类型', () => {
    const canvas: GraphCanvasState = {
      diagramType: 'flowchart',
      direction: 'LR',
      nodes: [
        createNode('A', 'A', 'rect'),
        createNode('B', 'B', 'rect'),
        createNode('C', 'C', 'rect'),
        createNode('D', 'D', 'rect'),
      ],
      edges: [
        createEdge('e1', 'A', 'B', 'arrow'),
        createEdge('e2', 'C', 'D', 'circle'),
        createEdge('e3', 'A', 'D', 'thick-arrow'),
        createEdge('e4', 'B', 'C', 'dotted-arrow'),
        createEdge('e5', 'A', 'C', 'bidirectional-arrow'),
        createEdge('e6', 'B', 'D', 'invisible'),
      ],
    };

    const result = serializeFlowchart(canvas);

    expect(result.mermaid).toContain('A --> B');
    expect(result.mermaid).toContain('C --o D');
    expect(result.mermaid).toContain('A ==> D');
    expect(result.mermaid).toContain('B -.-> C');
    expect(result.mermaid).toContain('A <--> C');
    expect(result.mermaid).toContain('B ~~~ D');
  });

  it('应序列化边标签', () => {
    const canvas: GraphCanvasState = {
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [
        createNode('A', 'A', 'rect'),
        createNode('B', 'B', 'rect'),
        createNode('C', 'C', 'rect'),
      ],
      edges: [
        createEdge('e1', 'A', 'B', 'arrow', 'Yes'),
        createEdge('e2', 'A', 'C', 'arrow', 'No'),
      ],
    };

    const result = serializeFlowchart(canvas);

    expect(result.mermaid).toContain('A -->|Yes| B');
    expect(result.mermaid).toContain('A -->|No| C');
  });

  it('应序列化 shapeData 扩展形状', () => {
    const canvas: GraphCanvasState = {
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [
        createNode('A', 'Document', 'document'),
        createNode('B', 'Note', 'note'),
      ],
      edges: [],
    };

    const result = serializeFlowchart(canvas);

    expect(result.mermaid).toContain('A@{ shape: document, label: "Document" }');
    expect(result.mermaid).toContain('B@{ shape: note, label: "Note" }');
  });

  it('应序列化 accTitle 和 accDescription', () => {
    const canvas: GraphCanvasState = {
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [createNode('A', 'Hello', 'rect')],
      edges: [],
      metadata: {
        accTitle: 'My Flowchart',
        accDescription: 'This is a description',
      },
    };

    const result = serializeFlowchart(canvas);

    expect(result.mermaid).toContain('accTitle: My Flowchart');
    expect(result.mermaid).toContain('accDescr: This is a description');
  });

  it('应序列化 classDef 和 class', () => {
    const canvas: GraphCanvasState = {
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [
        createNode('A', 'Hello', 'rect', { classNames: ['red'] }),
        createNode('B', 'World', 'rect'),
      ],
      edges: [],
      metadata: {
        flowClassDefs: [
          { id: 'red', styles: ['fill:#f00', 'stroke:#900'], textStyles: [] },
        ],
      } as never,
    };

    const result = serializeFlowchart(canvas);

    expect(result.mermaid).toContain('classDef red fill:#f00,stroke:#900');
    expect(result.mermaid).toContain('class A red');
  });

  it('应序列化 style 语句', () => {
    const canvas: GraphCanvasState = {
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [
        createNode('A', 'Hello', 'rect', { styles: ['fill:#f00', 'stroke:#900'] }),
      ],
      edges: [],
    };

    const result = serializeFlowchart(canvas);

    expect(result.mermaid).toContain('style A fill:#f00,stroke:#900');
  });

  it('应序列化 linkStyle 语句', () => {
    const canvas: GraphCanvasState = {
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [
        createNode('A', 'A', 'rect'),
        createNode('B', 'B', 'rect'),
      ],
      edges: [
        createEdge('e1', 'A', 'B', 'arrow', undefined, { styles: ['stroke:#f00'] }),
      ],
    };

    const result = serializeFlowchart(canvas);

    expect(result.mermaid).toContain('linkStyle 0 stroke:#f00');
  });

  it('应序列化 click href', () => {
    const canvas: GraphCanvasState = {
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [
        createNode('A', 'Click me', 'rect', { clickUrl: 'https://example.com', linkTarget: '_blank' }),
      ],
      edges: [],
    };

    const result = serializeFlowchart(canvas);

    expect(result.mermaid).toContain('click A "https://example.com" _blank');
  });

  it('应序列化 subgraph', () => {
    const subgraphNode: MermaidNode = {
      id: 'dev',
      type: 'rect',
      position: { x: 0, y: 0 },
      data: {
        label: 'Development',
        shape: 'rect',
        isSubgraph: true,
        subgraphNodes: ['A', 'B'],
      },
    };

    const nodeA = createNode('A', 'Code', 'rect');
    nodeA.parentId = 'dev';
    const nodeB = createNode('B', 'Build', 'rect');
    nodeB.parentId = 'dev';

    const canvas: GraphCanvasState = {
      diagramType: 'flowchart',
      direction: 'TB',
      nodes: [subgraphNode, nodeA, nodeB],
      edges: [createEdge('e1', 'A', 'B', 'arrow')],
    };

    const result = serializeFlowchart(canvas);

    expect(result.mermaid).toContain('subgraph dev[Development]');
    expect(result.mermaid).toContain('A[Code]');
    expect(result.mermaid).toContain('B[Build]');
    expect(result.mermaid).toContain('A --> B');
    expect(result.mermaid).toContain('end');
  });

  it('应处理空画布', () => {
    const canvas: GraphCanvasState = {
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [],
      edges: [],
    };

    const result = serializeFlowchart(canvas);

    expect(result.errors).toHaveLength(0);
    expect(result.mermaid).toContain('flowchart TD');
  });

  it('round-trip: 解析 → 序列化 → 应保持语义一致', () => {
    const code = `flowchart TD
    A[Hello] --> B[World]`;

    const parseResult = parseFlowchartCode(code);
    expect(parseResult.success).toBe(true);

    const serializeResult = serializeFlowchart(parseResult.canvas);
    expect(serializeResult.errors).toHaveLength(0);

    // 重新解析序列化后的代码，验证语义一致
    const reParseResult = parseFlowchartCode(serializeResult.mermaid);
    expect(reParseResult.success).toBe(true);
    expect(reParseResult.canvas.nodes).toHaveLength(2);
    expect(reParseResult.canvas.edges).toHaveLength(1);

    const nodeA = reParseResult.canvas.nodes.find((n) => n.id === 'A');
    const nodeB = reParseResult.canvas.nodes.find((n) => n.id === 'B');
    expect(nodeA?.data.label).toBe('Hello');
    expect(nodeB?.data.label).toBe('World');
    expect(nodeA?.data.shape).toBe('rect');
    expect(nodeB?.data.shape).toBe('rect');
  });

  it('round-trip: 多形状解析 → 序列化 → 语义一致', () => {
    const code = `flowchart TD
    A[Rect]
    B(Rounded)
    C{Diamond}
    D((Circle))
    E([Stadium])
    F[[Subroutine]]`;

    const parseResult = parseFlowchartCode(code);
    expect(parseResult.success).toBe(true);

    const serializeResult = serializeFlowchart(parseResult.canvas);
    expect(serializeResult.errors).toHaveLength(0);

    const reParseResult = parseFlowchartCode(serializeResult.mermaid);
    expect(reParseResult.success).toBe(true);
    expect(reParseResult.canvas.nodes).toHaveLength(6);

    const shapes = reParseResult.canvas.nodes.map((n) => n.data.shape);
    expect(shapes).toContain('rect');
    expect(shapes).toContain('rounded');
    expect(shapes).toContain('diamond');
    expect(shapes).toContain('circle');
    expect(shapes).toContain('stadium');
    expect(shapes).toContain('subroutine');
  });
});

// ============================================================
// 测试辅助函数
// ============================================================

function createNode(
  id: string,
  label: string,
  shape: MermaidNode['data']['shape'],
  extra?: Record<string, unknown>,
): MermaidNode {
  return {
    id,
    type: shape,
    position: { x: 0, y: 0 },
    data: {
      label,
      shape,
      ...extra,
    },
  };
}

function createEdge(
  id: string,
  source: string,
  target: string,
  edgeStyle: MermaidEdge['data']['edgeStyle'],
  label?: string,
  extra?: Record<string, unknown>,
): MermaidEdge {
  return {
    id,
    source,
    target,
    data: {
      edgeStyle,
      ...(label ? { label } : {}),
      ...extra,
    },
  };
}
