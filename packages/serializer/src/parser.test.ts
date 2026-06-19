import { describe, it, expect } from 'vitest';
import { parseMermaid, serializeMermaid } from './index.js';

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
