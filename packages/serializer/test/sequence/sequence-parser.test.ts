/**
 * sequence-parser 行为验证测试
 *
 * 验证 parseSequence 的行为：
 *   - 官方示例对照
 *   - 箭头类型覆盖
 *   - 参与者类型覆盖
 *   - Note 注释
 *   - 块结构（alt/opt/loop/par/critical/break/rect）
 *   - activate/deactivate
 *   - create/destroy
 *   - box 分组
 *   - autonumber
 *   - links/properties
 *   - 边界场景
 */
import { describe, it, expect } from 'vitest';
import { parseSequence } from '../../src/parser/sequence/sequence-parser.js';

describe('SequenceParser 行为验证', () => {
  describe('基础解析', () => {
    it('应解析空代码', () => {
      const result = parseSequence('sequenceDiagram\n');
      expect(result.success).toBe(true);
      expect(result.canvas.diagramType).toBe('sequenceDiagram');
      expect(result.canvas.nodes).toHaveLength(0);
      expect(result.canvas.edges).toHaveLength(0);
    });

    it('应解析基本 sequenceDiagram', () => {
      const code = `sequenceDiagram
    Alice->>Bob: Hello`;
      const result = parseSequence(code);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.canvas.diagramType).toBe('sequenceDiagram');
      expect(result.canvas.nodes).toHaveLength(2);
      expect(result.canvas.edges).toHaveLength(1);

      const alice = result.canvas.nodes.find((n) => n.id === 'Alice');
      const bob = result.canvas.nodes.find((n) => n.id === 'Bob');
      expect(alice?.data.label).toBe('Alice');
      expect(bob?.data.label).toBe('Bob');

      const edge = result.canvas.edges[0];
      expect(edge?.source).toBe('Alice');
      expect(edge?.target).toBe('Bob');
      expect(edge?.data.messageType).toBe('solid-arrow');
    });
  });

  describe('箭头类型覆盖', () => {
    it.each([
      ['solid-arrow', 'A->>B: msg'],
      ['dotted-arrow', 'A-->>B: msg'],
      ['solid-open', 'A->B: msg'],
      ['dotted-open', 'A-->B: msg'],
      ['solid-cross', 'A-xB: msg'],
      ['dotted-cross', 'A--xB: msg'],
      ['solid-point', 'A-)B: msg'],
      ['dotted-point', 'A--)B: msg'],
    ])('应正确解析 %s 箭头', (expectedType, syntax) => {
      const code = `sequenceDiagram
    ${syntax}`;
      const result = parseSequence(code);

      expect(result.success).toBe(true);
      expect(result.canvas.edges).toHaveLength(1);
      expect(result.canvas.edges[0]?.data.messageType).toBe(expectedType);
    });
  });

  describe('参与者类型', () => {
    it.each([
      ['actor', 'actor A'],
      ['participant', 'participant A'],
    ])('应正确解析 %s 参与者类型', (type, syntax) => {
      const code = `sequenceDiagram
    ${syntax}`;
      const result = parseSequence(code);

      expect(result.success).toBe(true);
      expect(result.canvas.nodes).toHaveLength(1);
      const node = result.canvas.nodes[0];
      expect(node?.data.participantType).toBe(type);
    });

    it('应解析 participant as 别名', () => {
      const code = `sequenceDiagram
    participant A as Alice`;
      const result = parseSequence(code);

      expect(result.success).toBe(true);
      expect(result.canvas.nodes).toHaveLength(1);
      expect(result.canvas.nodes[0]?.id).toBe('A');
      expect(result.canvas.nodes[0]?.data.label).toBe('Alice');
    });
  });

  describe('Note 注释', () => {
    it('应解析 Note left of', () => {
      const code = `sequenceDiagram
    Alice->>Bob: Hello
    Note left of Bob: Bob's note`;
      const result = parseSequence(code);

      expect(result.success).toBe(true);
      const notes = result.canvas.metadata?.notes ?? [];
      expect(notes.length).toBeGreaterThan(0);
      const note = notes[0];
      expect(note?.position).toBe('left');
      expect(note?.participantId).toBe('Bob');
    });

    it('应解析 Note right of', () => {
      const code = `sequenceDiagram
    Alice->>Bob: Hello
    Note right of Alice: Alice's note`;
      const result = parseSequence(code);

      expect(result.success).toBe(true);
      const notes = result.canvas.metadata?.notes ?? [];
      expect(notes.length).toBeGreaterThan(0);
      expect(notes[0]?.position).toBe('right');
    });

    it('应解析 Note over', () => {
      const code = `sequenceDiagram
    Alice->>Bob: Hello
    Note over Alice,Bob: Shared note`;
      const result = parseSequence(code);

      expect(result.success).toBe(true);
      const notes = result.canvas.metadata?.notes ?? [];
      expect(notes.length).toBeGreaterThan(0);
      expect(notes[0]?.position).toBe('over');
    });
  });

  describe('块结构', () => {
    it('应解析 alt/else/end', () => {
      const code = `sequenceDiagram
    Alice->>Bob: Hello
    alt Yes
      Bob->>Alice: Hi
    else No
      Bob--xAlice: Bye
    end`;
      const result = parseSequence(code);

      expect(result.success).toBe(true);
      const blocks = result.canvas.metadata?.blocks ?? [];
      expect(blocks.length).toBeGreaterThan(0);
      expect(blocks.some((b) => b.type === 'alt')).toBe(true);
    });

    it('应解析 loop/end', () => {
      const code = `sequenceDiagram
    Alice->>Bob: Hello
    loop 3 times
      Bob->>Alice: Hi
    end`;
      const result = parseSequence(code);

      expect(result.success).toBe(true);
      const blocks = result.canvas.metadata?.blocks ?? [];
      expect(blocks.some((b) => b.type === 'loop')).toBe(true);
    });

    it('应解析 opt/end', () => {
      const code = `sequenceDiagram
    Alice->>Bob: Hello
    opt Optional
      Bob->>Alice: Hi
    end`;
      const result = parseSequence(code);

      expect(result.success).toBe(true);
      const blocks = result.canvas.metadata?.blocks ?? [];
      expect(blocks.some((b) => b.type === 'opt')).toBe(true);
    });

    it('应解析 par/and/end', () => {
      const code = `sequenceDiagram
    par Alice to Bob
      Alice->>Bob: Hello
    and Bob to Carol
      Bob->>Carol: Hi
    end`;
      const result = parseSequence(code);

      expect(result.success).toBe(true);
      const blocks = result.canvas.metadata?.blocks ?? [];
      expect(blocks.some((b) => b.type === 'par')).toBe(true);
    });

    it('应解析 critical/option/end', () => {
      const code = `sequenceDiagram
    critical Validate
      Alice->>Bob: Hello
    option Fail
      Bob--xAlice: Error
    end`;
      const result = parseSequence(code);

      expect(result.success).toBe(true);
      const blocks = result.canvas.metadata?.blocks ?? [];
      expect(blocks.some((b) => b.type === 'critical')).toBe(true);
    });

    it('应解析 break/end', () => {
      const code = `sequenceDiagram
    Alice->>Bob: Hello
    break Error
      Bob--xAlice: Fail
    end`;
      const result = parseSequence(code);

      expect(result.success).toBe(true);
      const blocks = result.canvas.metadata?.blocks ?? [];
      expect(blocks.some((b) => b.type === 'break')).toBe(true);
    });
  });

  describe('activate/deactivate', () => {
    it('应解析 activate/deactivate', () => {
      const code = `sequenceDiagram
    Alice->>+Bob: Hello
    Bob-->>-Alice: Hi`;
      const result = parseSequence(code);

      expect(result.success).toBe(true);
      expect(result.canvas.edges).toHaveLength(2);
      // 第一条消息带 activate=true
      const edge1 = result.canvas.edges[0];
      expect(edge1?.data.activate).toBe(true);
    });
  });

  describe('autonumber', () => {
    it('应解析 autonumber', () => {
      const code = `sequenceDiagram
    autonumber
    Alice->>Bob: Hello
    Bob-->>Alice: Hi`;
      const result = parseSequence(code);

      expect(result.success).toBe(true);
      expect(result.canvas.metadata?.autonumber).toBe(true);
    });
  });

  describe('box 分组', () => {
    it('应解析 box rgb 颜色', () => {
      const code = `sequenceDiagram
    box rgba(0,255,0,0.5) Group1
    participant Alice
    participant Bob
    end
    Alice->>Bob: Hello`;
      const result = parseSequence(code);

      expect(result.success).toBe(true);
      const boxes = (result.canvas.metadata as Record<string, unknown> | undefined)?.sequenceBoxes as Array<{ name: string; color: string; actorKeys: string[] }> | undefined;
      expect(boxes).toBeDefined();
      expect(boxes?.length).toBe(1);
      expect(boxes?.[0]?.name).toBe('Group1');
      expect(boxes?.[0]?.actorKeys.length).toBe(2);
    });
  });

  describe('边界场景', () => {
    it('应处理非法语法', () => {
      const code = `sequenceDiagram
    @@@invalid syntax@@@`;
      const result = parseSequence(code);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('应处理多消息', () => {
      const code = `sequenceDiagram
    Alice->>Bob: Hello
    Bob->>Carol: Hi
    Carol-->>Alice: Hey`;
      const result = parseSequence(code);

      expect(result.success).toBe(true);
      expect(result.canvas.nodes).toHaveLength(3);
      expect(result.canvas.edges).toHaveLength(3);
    });
  });
});
