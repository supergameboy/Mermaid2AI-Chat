/**
 * sequence round-trip 等价测试
 *
 * 验证 代码 → 解析 → CanvasState → 序列化 → 代码 的语义等价
 * 重点验证 P0 缺陷修复：
 *   - blocks 不丢失
 *   - notes 不丢失
 *   - activate 不丢失
 *   - autonumber 不丢失
 *   - box 不丢失
 */
import { describe, it, expect } from 'vitest';
import { parseSequence } from '../../src/parser/sequence/sequence-parser.js';
import { serializeSequence } from '../../src/serializer/sequence/sequence-serializer.js';

describe('Sequence Round-trip 等价', () => {
  describe('基础 round-trip', () => {
    it('应 round-trip 基本消息', () => {
      const original = `sequenceDiagram
    Alice->>Bob: Hello`;

      const parsed = parseSequence(original);
      expect(parsed.success).toBe(true);

      const serialized = serializeSequence(parsed.canvas);
      expect(serialized.errors).toHaveLength(0);

      // 重新解析序列化后的代码，验证语义等价
      const reparsed = parseSequence(serialized.mermaid);
      expect(reparsed.success).toBe(true);
      expect(reparsed.canvas.nodes.length).toBe(parsed.canvas.nodes.length);
      expect(reparsed.canvas.edges.length).toBe(parsed.canvas.edges.length);
    });

    it('应 round-trip 多消息', () => {
      const original = `sequenceDiagram
    Alice->>Bob: Hello
    Bob->>Carol: Hi
    Carol-->>Alice: Hey`;

      const parsed = parseSequence(original);
      expect(parsed.success).toBe(true);

      const serialized = serializeSequence(parsed.canvas);
      const reparsed = parseSequence(serialized.mermaid);
      expect(reparsed.success).toBe(true);
      expect(reparsed.canvas.edges).toHaveLength(3);
    });
  });

  describe('P0 缺陷修复验证', () => {
    it('blocks 应正确 round-trip（alt）', () => {
      const original = `sequenceDiagram
    Alice->>Bob: Hello
    alt Yes
      Bob->>Alice: Hi
    else No
      Bob--xAlice: Bye
    end`;

      const parsed = parseSequence(original);
      expect(parsed.success).toBe(true);

      const blocksBefore = parsed.canvas.metadata?.blocks ?? [];
      expect(blocksBefore.length).toBeGreaterThan(0);
      expect(blocksBefore.some((b) => b.type === 'alt')).toBe(true);

      const serialized = serializeSequence(parsed.canvas);
      expect(serialized.errors).toHaveLength(0);
      expect(serialized.mermaid).toContain('alt');
      expect(serialized.mermaid).toContain('end');

      // 重新解析，验证 blocks 不丢失
      const reparsed = parseSequence(serialized.mermaid);
      expect(reparsed.success).toBe(true);
      const blocksAfter = reparsed.canvas.metadata?.blocks ?? [];
      expect(blocksAfter.length).toBeGreaterThan(0);
      expect(blocksAfter.some((b) => b.type === 'alt')).toBe(true);
    });

    it('blocks 应正确 round-trip（loop）', () => {
      const original = `sequenceDiagram
    Alice->>Bob: Hello
    loop 3 times
      Bob->>Alice: Hi
    end`;

      const parsed = parseSequence(original);
      const serialized = serializeSequence(parsed.canvas);
      const reparsed = parseSequence(serialized.mermaid);

      expect(reparsed.success).toBe(true);
      const blocksAfter = reparsed.canvas.metadata?.blocks ?? [];
      expect(blocksAfter.some((b) => b.type === 'loop')).toBe(true);
    });

    it('notes 应正确 round-trip', () => {
      const original = `sequenceDiagram
    Alice->>Bob: Hello
    Note left of Bob: Bob's note`;

      const parsed = parseSequence(original);
      expect(parsed.success).toBe(true);

      const notesBefore = parsed.canvas.metadata?.notes ?? [];
      expect(notesBefore.length).toBeGreaterThan(0);

      const serialized = serializeSequence(parsed.canvas);
      expect(serialized.mermaid).toContain('Note left of Bob');

      const reparsed = parseSequence(serialized.mermaid);
      const notesAfter = reparsed.canvas.metadata?.notes ?? [];
      expect(notesAfter.length).toBeGreaterThan(0);
      expect(notesAfter[0]?.position).toBe('left');
      expect(notesAfter[0]?.participantId).toBe('Bob');
    });

    it('activate 应正确 round-trip', () => {
      const original = `sequenceDiagram
    Alice->>+Bob: Hello
    Bob-->>-Alice: Hi`;

      const parsed = parseSequence(original);
      expect(parsed.success).toBe(true);

      const serialized = serializeSequence(parsed.canvas);
      expect(serialized.mermaid).toContain('->>+');
      expect(serialized.mermaid).toContain('-->>-');

      const reparsed = parseSequence(serialized.mermaid);
      expect(reparsed.success).toBe(true);
      // 验证 activate 状态保留
      const hasActivate = reparsed.canvas.edges.some((e) => e.data.activate === true);
      expect(hasActivate).toBe(true);
    });

    it('autonumber 应正确 round-trip', () => {
      const original = `sequenceDiagram
    autonumber
    Alice->>Bob: Hello
    Bob-->>Alice: Hi`;

      const parsed = parseSequence(original);
      expect(parsed.canvas.metadata?.autonumber).toBe(true);

      const serialized = serializeSequence(parsed.canvas);
      expect(serialized.mermaid).toContain('autonumber');

      const reparsed = parseSequence(serialized.mermaid);
      expect(reparsed.canvas.metadata?.autonumber).toBe(true);
    });

    it('box 应正确 round-trip', () => {
      const original = `sequenceDiagram
    box rgba(0,255,0,0.5) Group1
    participant Alice
    participant Bob
    end
    Alice->>Bob: Hello`;

      const parsed = parseSequence(original);
      expect(parsed.success).toBe(true);

      const boxesBefore = (parsed.canvas.metadata as Record<string, unknown> | undefined)?.sequenceBoxes as Array<{ name: string }> | undefined;
      expect(boxesBefore).toBeDefined();
      expect(boxesBefore?.length).toBe(1);

      const serialized = serializeSequence(parsed.canvas);
      expect(serialized.mermaid).toContain('box');
      expect(serialized.mermaid).toContain('Group1');

      const reparsed = parseSequence(serialized.mermaid);
      const boxesAfter = (reparsed.canvas.metadata as Record<string, unknown> | undefined)?.sequenceBoxes as Array<{ name: string }> | undefined;
      expect(boxesAfter).toBeDefined();
      expect(boxesAfter?.length).toBe(1);
    });
  });

  describe('箭头类型 round-trip', () => {
    it.each([
      ['solid-arrow', 'A->>B: msg'],
      ['dotted-arrow', 'A-->>B: msg'],
      ['solid-open', 'A->B: msg'],
      ['dotted-open', 'A-->B: msg'],
      ['solid-cross', 'A-xB: msg'],
      ['dotted-cross', 'A--xB: msg'],
      ['solid-point', 'A-)B: msg'],
      ['dotted-point', 'A--)B: msg'],
    ])('应 round-trip %s 箭头', (expectedType, syntax) => {
      const original = `sequenceDiagram
    ${syntax}`;

      const parsed = parseSequence(original);
      expect(parsed.success).toBe(true);
      expect(parsed.canvas.edges[0]?.data.messageType).toBe(expectedType);

      const serialized = serializeSequence(parsed.canvas);
      const reparsed = parseSequence(serialized.mermaid);
      expect(reparsed.success).toBe(true);
      expect(reparsed.canvas.edges[0]?.data.messageType).toBe(expectedType);
    });
  });
});
