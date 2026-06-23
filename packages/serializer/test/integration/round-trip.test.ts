/**
 * 端到端 round-trip 测试 — M13 集成验证
 *
 * 单一职责：验证所有 12 个图表类型的 parse → serialize → parse 等价性
 *
 * 测试策略:
 *   1. 解析源代码为 CanvasState
 *   2. 序列化 CanvasState 回源代码
 *   3. 再次解析序列化后的源代码
 *   4. 验证两次解析的 CanvasState diagramType 一致
 *
 * 注意:
 *   - 不要求源代码字符串完全相同（空白、顺序可能变化）
 *   - 要求 diagramType 一致（验证分发正确性）
 *   - 各图表类型的详细 round-trip 测试由各模块的 behavior.test.ts 覆盖
 */

import { describe, it, expect } from 'vitest';
import { parseMermaid, serializeMermaid } from '../../src/index.js';
import { getAllOfficialExamples } from '../helpers/official-examples.js';
import { roundTrip, deepEqual } from '../helpers/round-trip.js';
import type { CanvasState } from '../../src/types.js';

// ============================================================
// 测试
// ============================================================

describe('M13 端到端 round-trip 测试', () => {
  const examples = getAllOfficialExamples();

  describe('所有官方示例 round-trip', () => {
    for (const example of examples) {
      it(`round-trip: ${example.title} (${example.diagramType})`, () => {
        // 1. 第一次解析
        const parse1 = parseMermaid(example.code);
        expect(parse1.success, `第一次解析失败: ${parse1.errors.map((e) => e.message).join(', ')}`).toBe(true);
        expect(parse1.canvas.diagramType).toBe(example.diagramType);

        // 2. 序列化
        const serializeResult = serializeMermaid(parse1.canvas);
        expect(serializeResult.errors, `序列化失败: ${serializeResult.errors.map((e) => e.message).join(', ')}`).toHaveLength(0);
        expect(serializeResult.mermaid.length).toBeGreaterThan(0);

        // 3. 第二次解析
        const parse2 = parseMermaid(serializeResult.mermaid);
        expect(parse2.success, `第二次解析失败: ${parse2.errors.map((e) => e.message).join(', ')}`).toBe(true);

        // 4. 验证 diagramType 一致
        expect(parse2.canvas.diagramType).toBe(example.diagramType);
        expect(parse2.canvas.diagramType).toBe(parse1.canvas.diagramType);
      });
    }
  });

  describe('round-trip 幂等性（serialize → parse → serialize 等价）', () => {
    for (const example of examples) {
      it(`幂等性: ${example.title} (${example.diagramType})`, () => {
        // 1. 解析 → 序列化
        const parse1 = parseMermaid(example.code);
        expect(parse1.success).toBe(true);
        const serialize1 = serializeMermaid(parse1.canvas);
        expect(serialize1.errors).toHaveLength(0);

        // 2. 再次解析 → 序列化
        const parse2 = parseMermaid(serialize1.mermaid);
        expect(parse2.success).toBe(true);
        const serialize2 = serializeMermaid(parse2.canvas);
        expect(serialize2.errors).toHaveLength(0);

        // 3. 验证两次序列化结果等价（忽略空白差异）
        // 标准化：去除空白行和尾部空格后比较
        const normalize = (s: string) =>
          s
            .split('\n')
            .map((l) => l.trimEnd())
            .filter((l) => l.length > 0)
            .join('\n');

        expect(normalize(serialize1.mermaid)).toBe(normalize(serialize2.mermaid));
      });
    }
  });

  describe('CanvasState 深度等价性', () => {
    for (const example of examples) {
      it(`深度等价: ${example.title} (${example.diagramType})`, () => {
        const result = roundTrip(
          example.code,
          (source) => {
            const r = parseMermaid(source);
            return { canvas: r.canvas, errors: r.errors };
          },
          serializeMermaid,
          (a: CanvasState, b: CanvasState) => deepEqual(a, b)
        );

        expect(result.passed, `round-trip 失败: ${result.reason ?? 'unknown'}`).toBe(true);
      });
    }
  });
});
