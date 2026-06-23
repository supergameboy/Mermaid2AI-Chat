/**
 * flowchart 序列化器修复验证测试 — M1-14
 *
 * 验证 M1 重构修复的 4 个核心问题:
 *   1. 跨 subgraph 边在顶层序列化（不再丢失）
 *   2. title frontmatter 序列化（对齐官方 metadata.title，非 jison 语法）
 *   3. linkStyle default 语句序列化（默认边样式/插值）
 *   4. rawCode 字段保留（用于增量序列化保持格式）
 *
 * 测试策略: 行为验证（不测试实现细节，只测试接口和行为）
 */
import { describe, it, expect } from 'vitest';
import { parseFlowchartCode } from '../../src/parser/flowchart/flowchart-parser.js';
import { serializeFlowchart } from '../../src/serializer/flowchart/index.js';
import type { GraphCanvasState, MermaidNode, MermaidEdge } from '../../src/types.js';

// ============================================================
// 辅助函数
// ============================================================

/** 解析代码并返回 CanvasState（断言成功） */
function parse(code: string): GraphCanvasState {
  const result = parseFlowchartCode(code);
  expect(result.success).toBe(true);
  return result.canvas as GraphCanvasState;
}

/** 创建普通节点 */
function createNode(
  id: string,
  label: string,
  shape: MermaidNode['data']['shape'] = 'rect',
  extra?: Record<string, unknown>,
): MermaidNode {
  return {
    id,
    type: shape,
    position: { x: 0, y: 0 },
    data: { label, shape, ...extra },
  };
}

/** 创建边 */
function createEdge(
  id: string,
  source: string,
  target: string,
  edgeStyle: MermaidEdge['data']['edgeStyle'] = 'arrow',
  label?: string,
  extra?: Record<string, unknown>,
): MermaidEdge {
  return {
    id,
    source,
    target,
    data: { edgeStyle, ...(label ? { label } : {}), ...extra },
  };
}

/** 创建 subgraph 节点 */
function createSubgraph(
  id: string,
  label: string,
  childIds: string[] = [],
): MermaidNode {
  return {
    id,
    type: 'rect',
    position: { x: 0, y: 0 },
    data: { label, shape: 'rect', isSubgraph: true, subgraphNodes: childIds },
  };
}

// ============================================================
// 1. 跨 subgraph 边序列化验证
// ============================================================

describe('跨 subgraph 边序列化', () => {
  it('应将跨 subgraph 边在顶层输出（不丢失）', () => {
    // 构造画布: dev subgraph 含 A、B，ci subgraph 含 C、D，跨 subgraph 边 B --> C
    const subgraphDev = createSubgraph('dev', 'Development', ['A', 'B']);
    const subgraphCi = createSubgraph('ci', 'CI', ['C', 'D']);
    const nodeA = createNode('A', 'Code');
    nodeA.parentId = 'dev';
    const nodeB = createNode('B', 'Build');
    nodeB.parentId = 'dev';
    const nodeC = createNode('C', 'Test');
    nodeC.parentId = 'ci';
    const nodeD = createNode('D', 'Deploy');
    nodeD.parentId = 'ci';

    const canvas: GraphCanvasState = {
      diagramType: 'flowchart',
      direction: 'TB',
      nodes: [subgraphDev, subgraphCi, nodeA, nodeB, nodeC, nodeD],
      edges: [
        createEdge('e1', 'A', 'B', 'arrow'), // dev 内部边
        createEdge('e2', 'C', 'D', 'arrow'), // ci 内部边
        createEdge('e3', 'B', 'C', 'arrow'), // 跨 subgraph 边
      ],
    };

    const result = serializeFlowchart(canvas);
    expect(result.errors).toHaveLength(0);

    // 跨 subgraph 边 B --> C 必须在顶层输出
    expect(result.mermaid).toContain('B --> C');
    // 内部边应在 subgraph 块内
    expect(result.mermaid).toContain('A --> B');
    expect(result.mermaid).toContain('C --> D');
    // subgraph 结构完整
    expect(result.mermaid).toContain('subgraph dev[Development]');
    expect(result.mermaid).toContain('subgraph ci[CI]');
    expect(result.mermaid).toContain('end');
  });

  it('应将 subgraph 到顶层节点的边在顶层输出', () => {
    const subgraph = createSubgraph('grp', 'Group', ['A']);
    const nodeA = createNode('A', 'Inside');
    nodeA.parentId = 'grp';
    const nodeB = createNode('B', 'Outside'); // 顶层节点

    const canvas: GraphCanvasState = {
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [subgraph, nodeA, nodeB],
      edges: [
        createEdge('e1', 'A', 'B', 'arrow'), // subgraph 内 → 顶层
        createEdge('e2', 'B', 'A', 'arrow'), // 顶层 → subgraph 内
      ],
    };

    const result = serializeFlowchart(canvas);
    expect(result.errors).toHaveLength(0);

    // 两条跨边界边都应在顶层输出
    expect(result.mermaid).toContain('A --> B');
    expect(result.mermaid).toContain('B --> A');
  });

  it('round-trip: 解析跨 subgraph 边 → 序列化 → 应保留边', () => {
    const code = `flowchart TB
    subgraph dev
      a1[a] --> a2[b]
    end
    subgraph ci
      b1[c] --> b2[d]
    end
    a2 --> b1`;

    const canvas = parse(code);
    const result = serializeFlowchart(canvas);
    expect(result.errors).toHaveLength(0);

    // 跨 subgraph 边 a2 --> b1 必须保留
    expect(result.mermaid).toContain('a2 --> b1');
    // 内部边也保留
    expect(result.mermaid).toContain('a1 --> a2');
    expect(result.mermaid).toContain('b1 --> b2');
  });
});

// ============================================================
// 2. title frontmatter 序列化验证
// ============================================================

describe('title frontmatter 序列化', () => {
  it('应序列化 title 为 frontmatter（对齐官方 metadata.title）', () => {
    const canvas: GraphCanvasState = {
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [createNode('A', 'Hello')],
      edges: [],
      metadata: {
        title: 'My Flowchart Title',
      },
    };

    const result = serializeFlowchart(canvas);
    expect(result.errors).toHaveLength(0);

    // title 应以 frontmatter 格式输出（---\ntitle: xxx\n---）
    expect(result.mermaid).toContain('---\ntitle: My Flowchart Title\n---');
    const frontmatterIdx = result.mermaid.indexOf('---\ntitle: My Flowchart Title\n---');
    const nodeIdx = result.mermaid.indexOf('A[Hello]');
    expect(frontmatterIdx).toBeLessThan(nodeIdx);
    // frontmatter 应在 flowchart TD 之前
    const flowchartIdx = result.mermaid.indexOf('flowchart TD');
    expect(frontmatterIdx).toBeLessThan(flowchartIdx);
  });

  it('round-trip: 解析 frontmatter title → 序列化 → 应保留 title', () => {
    const code = `---
title: My Diagram
---
flowchart TD
    A[Hello] --> B[World]`;

    const canvas = parse(code);
    expect(canvas.metadata?.title).toBe('My Diagram');

    const result = serializeFlowchart(canvas);
    expect(result.errors).toHaveLength(0);
    expect(result.mermaid).toContain('---\ntitle: My Diagram\n---');
  });

  it('无 title 时不输出 frontmatter', () => {
    const canvas: GraphCanvasState = {
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [createNode('A', 'Hello')],
      edges: [],
    };

    const result = serializeFlowchart(canvas);
    expect(result.errors).toHaveLength(0);
    expect(result.mermaid).not.toContain('---\ntitle:');
  });
});

// ============================================================
// 3. linkStyle default 语句序列化验证
// ============================================================

describe('linkStyle default 语句序列化', () => {
  it('应序列化 linkStyle default stroke 语句', () => {
    const canvas: GraphCanvasState = {
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [createNode('A', 'A'), createNode('B', 'B')],
      edges: [createEdge('e1', 'A', 'B')],
      metadata: {
        flowDefaultStyle: ['stroke:#f00', 'stroke-width:2px'],
      } as never,
    };

    const result = serializeFlowchart(canvas);
    expect(result.errors).toHaveLength(0);
    expect(result.mermaid).toContain('linkStyle default stroke:#f00,stroke-width:2px');
  });

  it('应序列化 linkStyle default interpolate 语句', () => {
    const canvas: GraphCanvasState = {
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [createNode('A', 'A'), createNode('B', 'B')],
      edges: [createEdge('e1', 'A', 'B')],
      metadata: {
        flowDefaultInterpolate: 'basis',
      } as never,
    };

    const result = serializeFlowchart(canvas);
    expect(result.errors).toHaveLength(0);
    expect(result.mermaid).toContain('linkStyle default interpolate basis');
  });

  it('应序列化 linkStyle default interpolate + stroke 组合语句', () => {
    const canvas: GraphCanvasState = {
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [createNode('A', 'A'), createNode('B', 'B')],
      edges: [createEdge('e1', 'A', 'B')],
      metadata: {
        flowDefaultInterpolate: 'cardinal',
        flowDefaultStyle: ['stroke:#00f'],
      } as never,
    };

    const result = serializeFlowchart(canvas);
    expect(result.errors).toHaveLength(0);
    expect(result.mermaid).toContain('linkStyle default interpolate cardinal stroke:#00f');
  });

  it('应序列化边的 linkStyle N 语句（含 interpolate 和 animate）', () => {
    const canvas: GraphCanvasState = {
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [createNode('A', 'A'), createNode('B', 'B')],
      edges: [
        createEdge('e1', 'A', 'B', 'arrow', undefined, {
          interpolate: 'stepAfter',
          animate: true,
          styles: ['stroke:#f00'],
        }),
      ],
    };

    const result = serializeFlowchart(canvas);
    expect(result.errors).toHaveLength(0);
    expect(result.mermaid).toContain('linkStyle 0 interpolate stepAfter stroke:#f00 animate true');
  });

  it('round-trip: 解析 linkStyle default → 序列化 → 应保留', () => {
    const code = `flowchart TD
    A[Hello] --> B[World]
    linkStyle default interpolate basis`;

    const canvas = parse(code);
    const result = serializeFlowchart(canvas);
    expect(result.errors).toHaveLength(0);
    expect(result.mermaid).toContain('linkStyle default interpolate basis');
  });
});

// ============================================================
// 4. rawCode 字段保留验证
// ============================================================

describe('rawCode 字段保留', () => {
  it('解析后 canvas.rawCode 应保留原始代码', () => {
    const code = `flowchart TD
    A[Hello] --> B[World]`;

    const canvas = parse(code);
    expect(canvas.rawCode).toBe(code);
  });

  it('解析后 rawCode 应保留注释和空行', () => {
    const code = `flowchart TD
%% 这是注释
    A[Hello] --> B[World]

    B --> C[Test]`;

    const canvas = parse(code);
    expect(canvas.rawCode).toBe(code);
  });

  it('解析后 rawCode 应保留原始缩进', () => {
    const code = `flowchart TD
      A[Hello] --> B[World]`;

    const canvas = parse(code);
    expect(canvas.rawCode).toBe(code);
  });

  it('全量序列化不应依赖 rawCode（无 rawCode 时正常工作）', () => {
    const canvas: GraphCanvasState = {
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [createNode('A', 'Hello'), createNode('B', 'World')],
      edges: [createEdge('e1', 'A', 'B')],
      // 无 rawCode 字段
    };

    const result = serializeFlowchart(canvas);
    expect(result.errors).toHaveLength(0);
    expect(result.mermaid).toContain('flowchart TD');
    expect(result.mermaid).toContain('A[Hello]');
    expect(result.mermaid).toContain('B[World]');
    expect(result.mermaid).toContain('A --> B');
  });
});

// ============================================================
// 5. 边扩展字段序列化验证（length、animate、interpolate）
// ============================================================

describe('边扩展字段序列化', () => {
  it('应序列化边的 length 字段（多段边）', () => {
    // length 字段影响 dagre minlen，不直接序列化到代码
    // 但应保留在 edge.data 中供布局使用
    const canvas: GraphCanvasState = {
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [createNode('A', 'A'), createNode('B', 'B')],
      edges: [
        createEdge('e1', 'A', 'B', 'arrow', undefined, { length: 2 }),
      ],
    };

    const result = serializeFlowchart(canvas);
    expect(result.errors).toHaveLength(0);
    // length 不直接序列化到代码（是布局参数），但边本身应正常序列化
    expect(result.mermaid).toContain('A --> B');
  });

  it('应序列化边的 animate 字段（linkStyle N animate true）', () => {
    const canvas: GraphCanvasState = {
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [createNode('A', 'A'), createNode('B', 'B')],
      edges: [
        createEdge('e1', 'A', 'B', 'arrow', undefined, { animate: true }),
      ],
    };

    const result = serializeFlowchart(canvas);
    expect(result.errors).toHaveLength(0);
    expect(result.mermaid).toContain('linkStyle 0 animate true');
  });

  it('应序列化边的 interpolate 字段（linkStyle N interpolate xxx）', () => {
    const canvas: GraphCanvasState = {
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [createNode('A', 'A'), createNode('B', 'B')],
      edges: [
        createEdge('e1', 'A', 'B', 'arrow', undefined, { interpolate: 'natural' }),
      ],
    };

    const result = serializeFlowchart(canvas);
    expect(result.errors).toHaveLength(0);
    expect(result.mermaid).toContain('linkStyle 0 interpolate natural');
  });
});

// ============================================================
// 6. 顶点扩展字段序列化验证（labelType、shapeData）
// ============================================================

describe('顶点扩展字段序列化', () => {
  it('应序列化 labelType=string 的节点（双引号包裹）', () => {
    const canvas: GraphCanvasState = {
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [
        createNode('A', 'Hello "World"', 'rect', { labelType: 'string' }),
      ],
      edges: [],
    };

    const result = serializeFlowchart(canvas);
    expect(result.errors).toHaveLength(0);
    expect(result.mermaid).toContain('A["Hello \\"World\\""]');
  });

  it('应序列化 labelType=markdown 的节点（~ 包裹）', () => {
    const canvas: GraphCanvasState = {
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [
        createNode('A', '**Bold**', 'rect', { labelType: 'markdown' }),
      ],
      edges: [],
    };

    const result = serializeFlowchart(canvas);
    expect(result.errors).toHaveLength(0);
    expect(result.mermaid).toContain('A[~**Bold**~]');
  });

  it('应序列化扩展形状（shapeData 语法）', () => {
    const canvas: GraphCanvasState = {
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [
        createNode('A', 'Document', 'document' as MermaidNode['data']['shape']),
      ],
      edges: [],
    };

    const result = serializeFlowchart(canvas);
    expect(result.errors).toHaveLength(0);
    expect(result.mermaid).toContain('A@{ shape: document, label: "Document" }');
  });

  it('应序列化 rect-with-prop 形状（带属性）', () => {
    const canvas: GraphCanvasState = {
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [
        createNode('A', 'Label', 'rect-with-prop', { props: { key: 'value' } }),
      ],
      edges: [],
    };

    const result = serializeFlowchart(canvas);
    expect(result.errors).toHaveLength(0);
    expect(result.mermaid).toContain('A[|key:value|Label]');
  });
});

// ============================================================
// 7. 输出格式验证（避免拼接解析错误）
// ============================================================

describe('序列化输出格式', () => {
  it('输出应以单个换行符结尾，避免与后续代码拼接产生解析错误', () => {
    const canvas: GraphCanvasState = {
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [
        createNode('A', 'Hello'),
        createNode('F', 'End'),
      ],
      edges: [createEdge('e1', 'A', 'F', 'arrow', 'Three')],
    };

    const result = serializeFlowchart(canvas);
    expect(result.errors).toHaveLength(0);
    // 必须以单个换行符结尾（不能无换行，也不能有多个空行）
    expect(result.mermaid.endsWith('\n')).toBe(true);
    expect(result.mermaid.endsWith('\n\n')).toBe(false);
  });
});
