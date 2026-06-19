import { describe, it, expect } from 'vitest';
import { parseMermaid, serializeMermaid } from './index.js';
import { ErrorCollector as ErrorCollectorImpl } from './error-collector.js';

describe('parser — AST 原始 ID 保留', () => {
  it('should preserve original node IDs from mermaid code', () => {
    const code = 'flowchart TD\n  A[开始] --> B[结束]';
    const result = parseMermaid(code);

    expect(result.success).toBe(true);
    expect(result.canvas.nodes).toHaveLength(2);
    expect(result.canvas.nodes[0].id).toBe('A');
    expect(result.canvas.nodes[1].id).toBe('B');
  });

  it('should preserve original edge source/target IDs', () => {
    const code = 'flowchart TD\n  A[开始] --> B[结束]';
    const result = parseMermaid(code);

    expect(result.success).toBe(true);
    expect(result.canvas.edges).toHaveLength(1);
    expect(result.canvas.edges[0].source).toBe('A');
    expect(result.canvas.edges[0].target).toBe('B');
  });

  it('should preserve multi-character node IDs', () => {
    const code = 'flowchart TD\n  Start[开始] --> Process[处理] --> End[结束]';
    const result = parseMermaid(code);

    expect(result.success).toBe(true);
    expect(result.canvas.nodes.map((n) => n.id)).toEqual(['Start', 'Process', 'End']);
  });

  it('should ensure code→canvas→code is idempotent (IDs unchanged)', () => {
    const originalCode = 'flowchart TD\n  A[开始] --> B{判断}\n  B -->|是| C[成功]\n  B -->|否| D[失败]';
    const parsed = parseMermaid(originalCode);
    expect(parsed.success).toBe(true);

    // 序列化回 mermaid 代码
    const serialized = serializeMermaid(parsed.canvas);
    expect(serialized.mermaid).toBeDefined();

    // 再次解析，验证 ID 不变
    const reparsed = parseMermaid(serialized.mermaid);
    expect(reparsed.success).toBe(true);

    const originalIds = parsed.canvas.nodes.map((n) => n.id).sort();
    const reparsedIds = reparsed.canvas.nodes.map((n) => n.id).sort();
    expect(reparsedIds).toEqual(originalIds);
  });

  it('should preserve IDs for all 14 node shapes', () => {
    const code = `flowchart TD
      A[矩形]
      B(圆角)
      C([胶囊])
      D{菱形}
      E((圆形))
      F[(圆柱)]
      G{{六边形}}
      H[/平行四边形/]
      I[[子程序]]
      J(((双圆)))
      K>不对称]
      L[\\反向平行四边形\\]
      M[/梯形\\]
      N[\\反向梯形/]`;
    const result = parseMermaid(code);

    expect(result.success).toBe(true);
    expect(result.canvas.nodes).toHaveLength(14);
    const ids = result.canvas.nodes.map((n) => n.id);
    expect(ids).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N']);
  });

  it('should preserve IDs for edges with all 8 styles', () => {
    const code = `flowchart TD
      A --> B
      C --- D
      E -.- F
      G -.-> H
      I ==> J
      K ---o L
      M ---x N
      O <---> P`;
    const result = parseMermaid(code);

    expect(result.success).toBe(true);
    // 验证所有边的 source/target 都是原始 ID
    for (const edge of result.canvas.edges) {
      expect(edge.source).toMatch(/^[A-Z]+$/);
      expect(edge.target).toMatch(/^[A-Z]+$/);
    }
  });
});

describe('parser — 方向解析', () => {
  it('should parse TD direction', () => {
    const result = parseMermaid('flowchart TD\n  A --> B');
    expect(result.success).toBe(true);
    expect(result.canvas.direction).toBe('TD');
  });

  it('should parse TB direction (alias of TD)', () => {
    const result = parseMermaid('flowchart TB\n  A --> B');
    expect(result.success).toBe(true);
    expect(result.canvas.direction).toBe('TB');
  });

  it('should parse BT direction', () => {
    const result = parseMermaid('flowchart BT\n  A --> B');
    expect(result.success).toBe(true);
    expect(result.canvas.direction).toBe('BT');
  });

  it('should parse RL direction', () => {
    const result = parseMermaid('flowchart RL\n  A --> B');
    expect(result.success).toBe(true);
    expect(result.canvas.direction).toBe('RL');
  });

  it('should parse LR direction', () => {
    const result = parseMermaid('flowchart LR\n  A --> B');
    expect(result.success).toBe(true);
    expect(result.canvas.direction).toBe('LR');
  });
});

describe('parser — 14种节点形状解析', () => {
  it('should parse rect shape', () => {
    const result = parseMermaid('flowchart TD\n  A[文本]');
    expect(result.canvas.nodes[0].data.shape).toBe('rect');
  });

  it('should parse rounded shape', () => {
    const result = parseMermaid('flowchart TD\n  A(文本)');
    expect(result.canvas.nodes[0].data.shape).toBe('rounded');
  });

  it('should parse stadium shape', () => {
    const result = parseMermaid('flowchart TD\n  A([文本])');
    expect(result.canvas.nodes[0].data.shape).toBe('stadium');
  });

  it('should parse diamond shape', () => {
    const result = parseMermaid('flowchart TD\n  A{文本}');
    expect(result.canvas.nodes[0].data.shape).toBe('diamond');
  });

  it('should parse circle shape', () => {
    const result = parseMermaid('flowchart TD\n  A((文本))');
    expect(result.canvas.nodes[0].data.shape).toBe('circle');
  });

  it('should parse cylinder shape', () => {
    const result = parseMermaid('flowchart TD\n  A[(文本)]');
    expect(result.canvas.nodes[0].data.shape).toBe('cylinder');
  });

  it('should parse hexagon shape', () => {
    const result = parseMermaid('flowchart TD\n  A{{文本}}');
    expect(result.canvas.nodes[0].data.shape).toBe('hexagon');
  });

  it('should parse subroutine shape', () => {
    const result = parseMermaid('flowchart TD\n  A[[文本]]');
    expect(result.canvas.nodes[0].data.shape).toBe('subroutine');
  });

  it('should parse doublecircle shape', () => {
    const result = parseMermaid('flowchart TD\n  A(((文本)))');
    expect(result.canvas.nodes[0].data.shape).toBe('doublecircle');
  });

  it('should parse asymmetric shape', () => {
    const result = parseMermaid('flowchart TD\n  A>文本]');
    expect(result.canvas.nodes[0].data.shape).toBe('asymmetric');
  });

  it('should parse parallelogram shape (fixUnsupportedNodeShapes)', () => {
    const result = parseMermaid('flowchart TD\n  A[/文本/]');
    expect(result.canvas.nodes[0].data.shape).toBe('parallelogram');
  });

  it('should parse parallelogram-reverse shape (fixUnsupportedNodeShapes)', () => {
    const result = parseMermaid('flowchart TD\n  A[\\文本\\]');
    expect(result.canvas.nodes[0].data.shape).toBe('parallelogram-reverse');
  });

  it('should parse trapezoid shape', () => {
    const result = parseMermaid('flowchart TD\n  A[/文本\\]');
    expect(result.canvas.nodes[0].data.shape).toBe('trapezoid');
  });

  it('should parse trapezoid-reverse shape', () => {
    const result = parseMermaid('flowchart TD\n  A[\\文本/]');
    expect(result.canvas.nodes[0].data.shape).toBe('trapezoid-reverse');
  });
});

describe('parser — 8种边样式解析', () => {
  it('should parse arrow edge style', () => {
    const result = parseMermaid('flowchart TD\n  A --> B');
    expect(result.canvas.edges[0].data.edgeStyle).toBe('arrow');
  });

  it('should parse line edge style', () => {
    const result = parseMermaid('flowchart TD\n  A --- B');
    expect(result.canvas.edges[0].data.edgeStyle).toBe('line');
  });

  it('should parse dotted edge style', () => {
    const result = parseMermaid('flowchart TD\n  A -.- B');
    expect(result.canvas.edges[0].data.edgeStyle).toBe('dotted');
  });

  it('should parse dotted-arrow edge style', () => {
    const result = parseMermaid('flowchart TD\n  A -.-> B');
    expect(result.canvas.edges[0].data.edgeStyle).toBe('dotted-arrow');
  });

  it('should parse thick edge style', () => {
    const result = parseMermaid('flowchart TD\n  A ==> B');
    expect(result.canvas.edges[0].data.edgeStyle).toBe('thick');
  });

  it('should parse circle edge style (fixUnsupportedEdgeStyles)', () => {
    const result = parseMermaid('flowchart TD\n  A ---o B');
    expect(result.success).toBe(true);
    expect(result.canvas.edges[0].data.edgeStyle).toBe('circle');
    expect(result.canvas.edges[0].source).toBe('A');
    expect(result.canvas.edges[0].target).toBe('B');
  });

  it('should parse cross edge style (fixUnsupportedEdgeStyles)', () => {
    const result = parseMermaid('flowchart TD\n  A ---x B');
    expect(result.success).toBe(true);
    expect(result.canvas.edges[0].data.edgeStyle).toBe('cross');
    expect(result.canvas.edges[0].source).toBe('A');
    expect(result.canvas.edges[0].target).toBe('B');
  });

  it('should parse bidirectional edge style', () => {
    const result = parseMermaid('flowchart TD\n  A <---> B');
    expect(result.canvas.edges[0].data.edgeStyle).toBe('bidirectional');
  });
});

describe('parser — 错误场景', () => {
  it('should return failure for empty input', () => {
    const result = parseMermaid('');
    expect(result.success).toBe(false);
    expect(result.canvas.nodes).toHaveLength(0);
  });

  it('should return failure for invalid syntax', () => {
    const result = parseMermaid('this is not mermaid code at all');
    expect(result.success).toBe(false);
  });

  it('should return empty canvas for non-flowchart type', () => {
    const result = parseMermaid('sequenceDiagram\n  A->>B: message');
    // 非 flowchart 类型解析后画布为空（无节点和边）
    expect(result.canvas.nodes).toHaveLength(0);
    expect(result.canvas.edges).toHaveLength(0);
  });

  it('should parse edges with labels', () => {
    const result = parseMermaid('flowchart TD\n  A -->|是| B');
    expect(result.success).toBe(true);
    expect(result.canvas.edges[0].data.label).toBe('是');
  });
});

describe('parser — ErrorCollector 集成', () => {
  it('should use default ErrorCollector when none provided', () => {
    const result = parseMermaid('flowchart TD\n  A --> B');
    expect(result.success).toBe(true);
    expect(result.errors).toBeDefined();
  });

  it('should accept custom ErrorCollector', () => {
    const collector = new ErrorCollectorImpl();
    const result = parseMermaid('flowchart TD\n  A --> B', collector);
    expect(result.success).toBe(true);
    // 验证使用了传入的 collector（errors 内容一致）
    expect(result.errors).toEqual(collector.getErrors());
  });

  it('should collect errors from invalid syntax', () => {
    const collector = new ErrorCollectorImpl();
    parseMermaid('invalid syntax here', collector);
    expect(collector.hasErrors()).toBe(true);
  });

  it('should not affect success when only warnings', () => {
    const collector = new ErrorCollectorImpl();
    const result = parseMermaid('flowchart TD\n  A --> B', collector);
    expect(result.success).toBe(true);
    expect(collector.hasErrors()).toBe(false);
  });
});
