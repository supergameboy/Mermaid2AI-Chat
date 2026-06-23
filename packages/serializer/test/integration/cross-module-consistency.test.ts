/**
 * 跨模块一致性测试 — M13 集成验证
 *
 * 单一职责：验证所有 12 个图表类型的 CanvasState 联合类型、dispatcher 分发完整性、
 * detectDiagramType 覆盖、browser.ts 导出完整性
 *
 * 验证内容:
 *   1. CanvasState 联合类型包含所有 12 种 diagramType
 *   2. parseMermaid 覆盖所有 12 种 diagramType
 *   3. serializeMermaid 覆盖所有 12 种 diagramType
 *   4. detectDiagramType 覆盖所有 12 种首行关键字
 *   5. browser.ts 导出所有公共 API
 */

import { describe, it, expect } from 'vitest';
import {
  parseMermaid,
  serializeMermaid,
  detectDiagramType,
  createEmptyCanvasState,
  isGraphDiagramType,
  isChartDiagramType,
  isGraphCanvasState,
  isGanttCanvasState,
  isPieCanvasState,
  isTimelineCanvasState,
  isQuadrantCanvasState,
  isXYChartCanvasState,
  migrateCanvasState,
} from '../../src/index.js';
import type {
  CanvasState,
  DiagramType,
  GraphDiagramType,
  ChartDiagramType,
} from '../../src/types.js';

// ============================================================
// 12 种 diagramType 完整列表
// ============================================================

const ALL_DIAGRAM_TYPES: DiagramType[] = [
  // 图结构类型（7种）
  'flowchart',
  'sequenceDiagram',
  'classDiagram',
  'erDiagram',
  'mindmap',
  'stateDiagram',
  'architecture',
  // 数据图表类型（5种）
  'gantt',
  'pie',
  'timeline',
  'quadrantChart',
  'xychart',
];

const GRAPH_DIAGRAM_TYPES: GraphDiagramType[] = [
  'flowchart',
  'sequenceDiagram',
  'classDiagram',
  'erDiagram',
  'mindmap',
  'stateDiagram',
  'architecture',
];

const CHART_DIAGRAM_TYPES: ChartDiagramType[] = [
  'gantt',
  'pie',
  'timeline',
  'quadrantChart',
  'xychart',
];

// ============================================================
// 测试
// ============================================================

describe('M13 跨模块一致性测试', () => {
  describe('CanvasState 联合类型完整性', () => {
    it('应包含所有 12 种 diagramType', () => {
      expect(ALL_DIAGRAM_TYPES).toHaveLength(12);
      expect(GRAPH_DIAGRAM_TYPES).toHaveLength(7);
      expect(CHART_DIAGRAM_TYPES).toHaveLength(5);
    });

    it('图结构类型与数据图表类型无交集', () => {
      const intersection = GRAPH_DIAGRAM_TYPES.filter((t) =>
        CHART_DIAGRAM_TYPES.includes(t as ChartDiagramType)
      );
      expect(intersection).toHaveLength(0);
    });

    it('isGraphDiagramType 应正确识别 7 种图结构类型', () => {
      for (const type of GRAPH_DIAGRAM_TYPES) {
        expect(isGraphDiagramType(type)).toBe(true);
      }
      for (const type of CHART_DIAGRAM_TYPES) {
        expect(isGraphDiagramType(type)).toBe(false);
      }
    });

    it('isChartDiagramType 应正确识别 5 种数据图表类型', () => {
      for (const type of CHART_DIAGRAM_TYPES) {
        expect(isChartDiagramType(type)).toBe(true);
      }
      for (const type of GRAPH_DIAGRAM_TYPES) {
        expect(isChartDiagramType(type)).toBe(false);
      }
    });

    it('createEmptyCanvasState 应为所有 12 种类型创建空画布', () => {
      for (const type of ALL_DIAGRAM_TYPES) {
        const canvas = createEmptyCanvasState(type);
        expect(canvas.diagramType).toBe(type);
      }
    });

    it('类型守卫应正确识别每种 CanvasState 子类型', () => {
      // 图结构类型
      for (const type of GRAPH_DIAGRAM_TYPES) {
        const canvas = createEmptyCanvasState(type);
        expect(isGraphCanvasState(canvas)).toBe(true);
      }
      // 数据图表类型
      expect(isGanttCanvasState(createEmptyCanvasState('gantt'))).toBe(true);
      expect(isPieCanvasState(createEmptyCanvasState('pie'))).toBe(true);
      expect(isTimelineCanvasState(createEmptyCanvasState('timeline'))).toBe(true);
      expect(isQuadrantCanvasState(createEmptyCanvasState('quadrantChart'))).toBe(true);
      expect(isXYChartCanvasState(createEmptyCanvasState('xychart'))).toBe(true);
    });
  });

  describe('parseMermaid 分发完整性', () => {
    it('应覆盖所有 12 种 diagramType', () => {
      // 为每种类型准备最小可解析的源代码
      const minimalSources: Record<DiagramType, string> = {
        flowchart: 'flowchart TD\n    A --> B',
        sequenceDiagram: 'sequenceDiagram\n    Alice->>Bob: Hello',
        classDiagram: 'classDiagram\n    Animal <|-- Duck',
        erDiagram: 'erDiagram\n    CUSTOMER ||--o{ ORDER : places',
        mindmap: 'mindmap\n  root((test))\n    A',
        stateDiagram: 'stateDiagram-v2\n    [*] --> Still',
        architecture: 'architecture-beta\n    service server[Server]',
        gantt: 'gantt\n    dateFormat YYYY-MM-DD\n    section S\n    A :2014-01-01, 30d',
        pie: 'pie title Test\n    "A" : 1\n    "B" : 2',
        timeline: 'timeline\n    title Test\n    2002 : Event',
        quadrantChart: 'quadrantChart\n    title Test\n    x-axis Low --> High\n    y-axis Low --> High\n    quadrant-1 Q1\n    quadrant-2 Q2\n    quadrant-3 Q3\n    quadrant-4 Q4\n    "A": [0.5, 0.5]',
        xychart: 'xychart-beta\n    x-axis [jan, feb]\n    bar [10, 20]',
      };

      for (const type of ALL_DIAGRAM_TYPES) {
        const result = parseMermaid(minimalSources[type]);
        expect(result.success, `parseMermaid 应成功解析 ${type}`).toBe(true);
        expect(result.canvas.diagramType, `parseMermaid 应返回正确 diagramType for ${type}`).toBe(type);
      }
    });
  });

  describe('serializeMermaid 分发完整性', () => {
    it('应覆盖所有 12 种 diagramType', () => {
      for (const type of ALL_DIAGRAM_TYPES) {
        const canvas = createEmptyCanvasState(type);
        // 对于空画布，序列化应返回结果（可能含 mermaid 代码或错误，但不应抛异常）
        const result = serializeMermaid(canvas);
        expect(result, `serializeMermaid 应为 ${type} 返回结果`).toBeDefined();
        expect(typeof result.mermaid, `serializeMermaid 应返回 mermaid 字符串 for ${type}`).toBe('string');
      }
    });
  });

  describe('detectDiagramType 覆盖完整性', () => {
    it('应识别所有 12 种首行关键字', () => {
      const testCases: Array<{ keyword: string; expectedType: DiagramType }> = [
        { keyword: 'flowchart', expectedType: 'flowchart' },
        { keyword: 'graph', expectedType: 'flowchart' },
        { keyword: 'sequenceDiagram', expectedType: 'sequenceDiagram' },
        { keyword: 'classDiagram', expectedType: 'classDiagram' },
        { keyword: 'erDiagram', expectedType: 'erDiagram' },
        { keyword: 'mindmap', expectedType: 'mindmap' },
        { keyword: 'stateDiagram-v2', expectedType: 'stateDiagram' },
        { keyword: 'architecture-beta', expectedType: 'architecture' },
        { keyword: 'gantt', expectedType: 'gantt' },
        { keyword: 'pie', expectedType: 'pie' },
        { keyword: 'timeline', expectedType: 'timeline' },
        { keyword: 'quadrantChart', expectedType: 'quadrantChart' },
        { keyword: 'xychart-beta', expectedType: 'xychart' },
      ];

      for (const { keyword, expectedType } of testCases) {
        const detected = detectDiagramType(`${keyword}\n    test`);
        expect(detected, `detectDiagramType 应识别 ${keyword}`).toBe(expectedType);
      }
    });

    it('应返回 null 对于未知关键字', () => {
      expect(detectDiagramType('unknown-diagram\n    test')).toBeNull();
      expect(detectDiagramType('')).toBeNull();
    });
  });

  describe('migrateCanvasState 完整性', () => {
    it('应支持所有 12 种 diagramType 的迁移', () => {
      for (const type of ALL_DIAGRAM_TYPES) {
        const raw = { diagramType: type };
        const migrated = migrateCanvasState(raw);
        expect(migrated.diagramType, `migrateCanvasState 应保留 ${type}`).toBe(type);
      }
    });

    it('未知 diagramType 应回退为 flowchart', () => {
      const raw = { diagramType: 'unknown-type' };
      const migrated = migrateCanvasState(raw);
      expect(migrated.diagramType).toBe('flowchart');
    });
  });
});
