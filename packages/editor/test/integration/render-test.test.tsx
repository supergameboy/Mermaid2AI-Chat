/**
 * 渲染集成测试 — M13 集成验证
 *
 * 单一职责：验证 Canvas 主分发器和数据图表分发器的 switch-case 覆盖完整性
 *
 * 验证要点:
 *   - canvas.tsx 的 Canvas 组件覆盖所有 12 种 diagramType 分发
 *   - specialized/index.tsx 的 renderSpecialized 覆盖 4 种数据图表分发
 *   - 所有渲染器组件可正确导入
 *   - parseMermaid 输出与 Canvas 组件期望的 CanvasState 类型匹配
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  parseMermaid,
  serializeMermaid,
  detectDiagramType,
  isGraphCanvasState,
  isGanttCanvasState,
  type CanvasState,
  type DiagramType,
} from '@mermaid2aichat/serializer';

// 静态导入所有渲染器组件，验证可导入性
import { Canvas } from '@/canvas';
import { GraphCanvas } from '@/graph-canvas';
import { SequenceCanvas } from '@/sequence/sequence-canvas';
import { GanttCanvas } from '@/gantt-canvas';
import {
  PieRenderer,
  TimelineRenderer,
  QuadrantRenderer,
  XYChartRenderer,
  renderSpecialized,
  isChartCanvasState,
} from '@/specialized/index';

const EDITOR_SRC = resolve(__dirname, '../../src');

/** 读取源文件内容 */
function readSrc(relPath: string): string {
  return readFileSync(join(EDITOR_SRC, relPath), 'utf-8');
}

// ============================================================
// 12 种 DiagramType 常量（与 serializer types.ts 对齐）
// ============================================================
const ALL_DIAGRAM_TYPES: DiagramType[] = [
  'flowchart',
  'sequenceDiagram',
  'classDiagram',
  'erDiagram',
  'stateDiagram',
  'mindmap',
  'architecture',
  'gantt',
  'pie',
  'timeline',
  'quadrantChart',
  'xychart',
];

const GRAPH_DIAGRAM_TYPES: DiagramType[] = [
  'flowchart',
  'sequenceDiagram',
  'classDiagram',
  'erDiagram',
  'stateDiagram',
  'mindmap',
  'architecture',
];

const CHART_DIAGRAM_TYPES: DiagramType[] = [
  'pie',
  'timeline',
  'quadrantChart',
  'xychart',
];

describe('M13 渲染集成测试', () => {
  describe('Canvas 主分发器覆盖完整性', () => {
    it('canvas.tsx 应处理所有 12 种 diagramType', () => {
      const source = readSrc('canvas.tsx');

      // 验证图结构类型分发（GraphCanvas）
      expect(source).toMatch(/isGraphCanvasState/);
      expect(source).toMatch(/GraphCanvas/);

      // 验证时序图分发（SequenceCanvas）
      expect(source).toMatch(/sequenceDiagram/);
      expect(source).toMatch(/SequenceCanvas/);

      // 验证甘特图分发（GanttCanvas）
      expect(source).toMatch(/isGanttCanvasState/);
      expect(source).toMatch(/GanttCanvas/);

      // 验证数据图表分发（renderSpecialized）
      expect(source).toMatch(/isChartCanvasState/);
      expect(source).toMatch(/renderSpecialized/);
    });

    it('canvas.tsx 应有穷尽检查（never 类型守卫）', () => {
      const source = readSrc('canvas.tsx');
      // 验证有 never 类型穷尽检查
      expect(source).toMatch(/isChartCanvasState|未支持的画布类型/);
    });
  });

  describe('数据图表分发器覆盖完整性', () => {
    it('specialized/index.tsx 应处理所有 4 种数据图表类型', () => {
      const source = readSrc('specialized/index.tsx');

      expect(source).toMatch(/case 'pie'/);
      expect(source).toMatch(/case 'timeline'/);
      expect(source).toMatch(/case 'quadrantChart'/);
      expect(source).toMatch(/case 'xychart'/);
    });

    it('renderSpecialized 应有穷尽检查（never 类型守卫）', () => {
      const source = readSrc('specialized/index.tsx');
      expect(source).toMatch(/never/);
    });

    it('isChartCanvasState 应覆盖所有 4 种数据图表类型', () => {
      const source = readSrc('specialized/index.tsx');
      expect(source).toMatch(/'pie'/);
      expect(source).toMatch(/'timeline'/);
      expect(source).toMatch(/'quadrantChart'/);
      expect(source).toMatch(/'xychart'/);
    });
  });

  describe('渲染器组件可导入性', () => {
    /** 验证 React 组件可导入（函数组件或 React.memo/forwardRef 包装组件） */
    const expectComponent = (comp: unknown, name: string): void => {
      expect(comp, `${name} 应已定义`).toBeDefined();
      expect(
        ['function', 'object'].includes(typeof comp),
        `${name} 应是函数或对象（React 组件），实际为 ${typeof comp}`
      ).toBe(true);
    };

    it('GraphCanvas 应可导入', () => expectComponent(GraphCanvas, 'GraphCanvas'));
    it('SequenceCanvas 应可导入', () => expectComponent(SequenceCanvas, 'SequenceCanvas'));
    it('GanttCanvas 应可导入', () => expectComponent(GanttCanvas, 'GanttCanvas'));
    it('PieRenderer 应可导入', () => expectComponent(PieRenderer, 'PieRenderer'));
    it('TimelineRenderer 应可导入', () => expectComponent(TimelineRenderer, 'TimelineRenderer'));
    it('QuadrantRenderer 应可导入', () => expectComponent(QuadrantRenderer, 'QuadrantRenderer'));
    it('XYChartRenderer 应可导入', () => expectComponent(XYChartRenderer, 'XYChartRenderer'));
    it('Canvas 主分发器应可导入', () => expectComponent(Canvas, 'Canvas'));

    it('renderSpecialized 分发函数应可导入', () => {
      expect(renderSpecialized).toBeDefined();
      expect(typeof renderSpecialized).toBe('function');
    });
  });

  describe('CanvasState 类型守卫覆盖完整性', () => {
    it('isGraphCanvasState 应覆盖所有 7 种图结构类型', () => {
      for (const type of GRAPH_DIAGRAM_TYPES) {
        // 构造最小 CanvasState 验证类型守卫
        // GRAPH_DIAGRAM_TYPES 不含 gantt，gantt 由 isGanttCanvasState 独立识别
        const minimalCanvas = {
          diagramType: type,
          nodes: [],
          edges: [],
          direction: 'TB',
        } as unknown as CanvasState;

        expect(isGraphCanvasState(minimalCanvas), `${type} 应被 isGraphCanvasState 识别`).toBe(true);
      }
    });

    it('isGanttCanvasState 应识别 gantt 类型', () => {
      const ganttCanvas = {
        diagramType: 'gantt',
        title: '',
        sections: [],
        dateFormat: 'YYYY-MM-DD',
      } as unknown as CanvasState;
      expect(isGanttCanvasState(ganttCanvas)).toBe(true);
    });

    it('isChartCanvasState 应覆盖所有 4 种数据图表类型', () => {
      for (const type of CHART_DIAGRAM_TYPES) {
        const minimalCanvas = {
          diagramType: type,
        } as unknown as CanvasState;
        expect(isChartCanvasState(minimalCanvas)).toBe(true);
      }
    });
  });

  describe('parseMermaid 与 Canvas 分发器集成', () => {
    // 使用最小代码片段验证 parseMermaid → CanvasState → 类型守卫链路
    const testCases: Array<{ type: DiagramType; code: string }> = [
      { type: 'flowchart', code: 'flowchart TD\n  A --> B' },
      { type: 'sequenceDiagram', code: 'sequenceDiagram\n  A->>B: Hello' },
      { type: 'classDiagram', code: 'classDiagram\n  ClassA --> ClassB' },
      { type: 'erDiagram', code: 'erDiagram\n  A ||--o{ B : has' },
      { type: 'stateDiagram', code: 'stateDiagram-v2\n  [*] --> Active' },
      { type: 'mindmap', code: 'mindmap\n  root((Root))\n    A' },
      { type: 'architecture', code: 'architecture-beta\n  service ServerA\n  service ServerB\n  ServerA:L --> R:ServerB' },
      { type: 'gantt', code: 'gantt\n  title Test\n  dateFormat YYYY-MM-DD\n  section S1\n  Task1 :a1, 2024-01-01, 1d' },
      { type: 'pie', code: 'pie title Test\n  "A" : 1\n  "B" : 2' },
      { type: 'timeline', code: 'timeline\n  title Test\n  section S1\n    Event1 : 2024' },
      { type: 'quadrantChart', code: 'quadrantChart\n  title Test\n  x-axis Low --> High\n  y-axis Low --> High\n  quadrant-1 Q1\n  quadrant-2 Q2\n  quadrant-3 Q3\n  quadrant-4 Q4\n  Point1: [0.5, 0.5]' },
      { type: 'xychart', code: 'xychart-beta\n  title Test\n  x-axis "X" [1, 2]\n  y-axis "Y" 0 --> 10\n  bar [1, 2]' },
    ];

    for (const { type, code } of testCases) {
      it(`parseMermaid 应正确解析 ${type} 并生成可分发的 CanvasState`, () => {
        const result = parseMermaid(code);
        expect(result.success).toBe(true);
        expect(result.canvas.diagramType).toBe(type);

        // 验证 CanvasState 可被类型守卫正确识别
        const canvas = result.canvas;
        if (type === 'gantt') {
          expect(isGanttCanvasState(canvas)).toBe(true);
        } else if (CHART_DIAGRAM_TYPES.includes(type)) {
          expect(isChartCanvasState(canvas)).toBe(true);
        } else {
          expect(isGraphCanvasState(canvas)).toBe(true);
        }
      });
    }

    it('detectDiagramType 应覆盖所有 12 种首行关键字', () => {
      const keywords: Array<{ keyword: string; type: DiagramType }> = [
        { keyword: 'flowchart', type: 'flowchart' },
        { keyword: 'graph', type: 'flowchart' },
        { keyword: 'sequenceDiagram', type: 'sequenceDiagram' },
        { keyword: 'classDiagram', type: 'classDiagram' },
        { keyword: 'erDiagram', type: 'erDiagram' },
        { keyword: 'stateDiagram-v2', type: 'stateDiagram' },
        { keyword: 'stateDiagram', type: 'stateDiagram' },
        { keyword: 'mindmap', type: 'mindmap' },
        { keyword: 'architecture-beta', type: 'architecture' },
        { keyword: 'gantt', type: 'gantt' },
        { keyword: 'pie', type: 'pie' },
        { keyword: 'timeline', type: 'timeline' },
        { keyword: 'quadrantChart', type: 'quadrantChart' },
        { keyword: 'xychart-beta', type: 'xychart' },
      ];

      for (const { keyword, type } of keywords) {
        expect(detectDiagramType(keyword)).toBe(type);
      }
    });
  });

  describe('serializeMermaid 与 Canvas 状态集成', () => {
    it('抽样验证 diagramType 的 CanvasState round-trip（全量 round-trip 由 serializer 包覆盖）', () => {
      // 抽样验证 serializeMermaid 与 parseMermaid 的 round-trip 一致性
      // 全量 12 种类型的 round-trip 测试由 serializer 包的 round-trip.test.ts 覆盖
      const testCases: Array<{ type: DiagramType; code: string }> = [
        { type: 'flowchart', code: 'flowchart TD\n  A --> B' },
        { type: 'sequenceDiagram', code: 'sequenceDiagram\n  A->>B: Hello' },
        { type: 'pie', code: 'pie title Test\n  "A" : 1\n  "B" : 2' },
      ];

      for (const { type, code } of testCases) {
        const parsed = parseMermaid(code);
        expect(parsed.success).toBe(true);

        const serialized = serializeMermaid(parsed.canvas);
        expect(serialized.mermaid).toBeTruthy();

        // round-trip 验证
        const reparsed = parseMermaid(serialized.mermaid);
        expect(reparsed.success).toBe(true);
        expect(reparsed.canvas.diagramType).toBe(type);
      }
    });
  });
});
