/**
 * 官方示例回归测试 — M13 集成验证
 *
 * 单一职责：验证所有 12 个图表类型的官方示例能被正确解析和序列化
 *
 * 测试内容:
 *   1. 每个官方示例能被 parseMermaid 成功解析
 *   2. 解析后的 CanvasState 能被 serializeMermaid 成功序列化
 *   3. 序列化后的代码能被再次解析
 *   4. 验证示例覆盖所有 12 种 diagramType
 *
 * 注意:
 *   - 官方示例是标准形式的权威定义
 *   - 用户要求"必须按照标准形式识别和渲染"
 *   - 各图表类型的详细行为测试由各模块的 behavior.test.ts 覆盖
 */

import { describe, it, expect } from 'vitest';
import { parseMermaid, serializeMermaid } from '../../src/index.js';
import { getAllOfficialExamples, getOfficialExamples } from '../helpers/official-examples.js';
import type { DiagramType } from '../../src/types.js';

// ============================================================
// 12 种 diagramType 完整列表
// ============================================================

const ALL_DIAGRAM_TYPES: DiagramType[] = [
  'flowchart',
  'sequenceDiagram',
  'classDiagram',
  'erDiagram',
  'mindmap',
  'stateDiagram',
  'architecture',
  'gantt',
  'pie',
  'timeline',
  'quadrantChart',
  'xychart',
];

// ============================================================
// 测试
// ============================================================

describe('M13 官方示例回归测试', () => {
  describe('示例覆盖完整性', () => {
    it('应覆盖所有 12 种 diagramType', () => {
      for (const type of ALL_DIAGRAM_TYPES) {
        const examples = getOfficialExamples(type);
        expect(examples.length, `${type} 应至少有 1 个官方示例`).toBeGreaterThan(0);
      }
    });

    it('所有示例应有正确的 diagramType 标注', () => {
      const allExamples = getAllOfficialExamples();
      for (const example of allExamples) {
        expect(example.diagramType, `示例 ${example.title} 应有 diagramType`).toBeDefined();
        expect(ALL_DIAGRAM_TYPES).toContain(example.diagramType);
      }
    });
  });

  describe('解析正确性', () => {
    const allExamples = getAllOfficialExamples();

    for (const example of allExamples) {
      it(`解析: ${example.title} (${example.diagramType})`, () => {
        const result = parseMermaid(example.code);
        expect(result.success, `解析失败: ${result.errors.map((e) => e.message).join(', ')}`).toBe(true);
        expect(result.canvas.diagramType).toBe(example.diagramType);
      });
    }
  });

  describe('序列化正确性', () => {
    const allExamples = getAllOfficialExamples();

    for (const example of allExamples) {
      it(`序列化: ${example.title} (${example.diagramType})`, () => {
        const parseResult = parseMermaid(example.code);
        expect(parseResult.success).toBe(true);

        const serializeResult = serializeMermaid(parseResult.canvas);
        expect(serializeResult.errors, `序列化失败: ${serializeResult.errors.map((e) => e.message).join(', ')}`).toHaveLength(0);
        expect(serializeResult.mermaid.length).toBeGreaterThan(0);
      });
    }
  });

  describe('round-trip 正确性', () => {
    const allExamples = getAllOfficialExamples();

    for (const example of allExamples) {
      it(`round-trip: ${example.title} (${example.diagramType})`, () => {
        // 1. 解析
        const parse1 = parseMermaid(example.code);
        expect(parse1.success).toBe(true);

        // 2. 序列化
        const serializeResult = serializeMermaid(parse1.canvas);
        expect(serializeResult.errors).toHaveLength(0);

        // 3. 再次解析
        const parse2 = parseMermaid(serializeResult.mermaid);
        expect(parse2.success, `第二次解析失败: ${parse2.errors.map((e) => e.message).join(', ')}`).toBe(true);

        // 4. diagramType 一致
        expect(parse2.canvas.diagramType).toBe(parse1.canvas.diagramType);
      });
    }
  });

  describe('各图表类型示例统计', () => {
    it('flowchart 应有官方示例', () => {
      const examples = getOfficialExamples('flowchart');
      expect(examples.length).toBeGreaterThanOrEqual(1);
    });

    it('sequenceDiagram 应有官方示例', () => {
      const examples = getOfficialExamples('sequenceDiagram');
      expect(examples.length).toBeGreaterThanOrEqual(1);
    });

    it('classDiagram 应有官方示例', () => {
      const examples = getOfficialExamples('classDiagram');
      expect(examples.length).toBeGreaterThanOrEqual(1);
    });

    it('erDiagram 应有官方示例', () => {
      const examples = getOfficialExamples('erDiagram');
      expect(examples.length).toBeGreaterThanOrEqual(1);
    });

    it('mindmap 应有官方示例', () => {
      const examples = getOfficialExamples('mindmap');
      expect(examples.length).toBeGreaterThanOrEqual(1);
    });

    it('stateDiagram 应有官方示例', () => {
      const examples = getOfficialExamples('stateDiagram');
      expect(examples.length).toBeGreaterThanOrEqual(1);
    });

    it('architecture 应有官方示例', () => {
      const examples = getOfficialExamples('architecture');
      expect(examples.length).toBeGreaterThanOrEqual(1);
    });

    it('gantt 应有官方示例', () => {
      const examples = getOfficialExamples('gantt');
      expect(examples.length).toBeGreaterThanOrEqual(1);
    });

    it('pie 应有官方示例', () => {
      const examples = getOfficialExamples('pie');
      expect(examples.length).toBeGreaterThanOrEqual(1);
    });

    it('timeline 应有官方示例', () => {
      const examples = getOfficialExamples('timeline');
      expect(examples.length).toBeGreaterThanOrEqual(1);
    });

    it('quadrantChart 应有官方示例', () => {
      const examples = getOfficialExamples('quadrantChart');
      expect(examples.length).toBeGreaterThanOrEqual(1);
    });

    it('xychart 应有官方示例', () => {
      const examples = getOfficialExamples('xychart');
      expect(examples.length).toBeGreaterThanOrEqual(1);
    });
  });
});
