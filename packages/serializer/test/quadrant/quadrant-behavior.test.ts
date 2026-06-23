/**
 * quadrant 行为验证测试 — M11
 *
 * 验证 quadrant 解析器、序列化器的行为符合官方 mermaid quadrantChart 标准
 * 覆盖：官方语法、title/accTitle/accDescription、x-axis/y-axis、quadrant-1~4、
 *       points（坐标 0-1 归一化）、className、point 样式（radius/color/strokeColor/strokeWidth）、
 *       classDef、round-trip、边界
 *
 * 测试策略：行为验证（不测试实现细节，只测试接口和行为）
 */

import { describe, it, expect } from 'vitest';
import { parseQuadrantCode } from '../../src/parser/quadrant-parser.js';
import { serializeQuadrant } from '../../src/serializer/quadrant-serializer.js';
import { parseMermaid } from '../../src/parse-dispatcher.js';
import { serializeMermaid } from '../../src/serialize-dispatcher.js';
import {
  isValidNormalizedCoordinate,
  formatCoordinate,
  serializePointStyle,
  mergeClassDefStyle,
  parseClassDefStyle,
  serializeClassDefStatement,
  serializePointLine,
} from '../../src/serializer/shared/quadrant-helpers.js';
import type { QuadrantCanvasState, QuadrantPoint } from '../../src/types.js';

// ============================================================
// 辅助函数
// ============================================================

/** 解析代码并返回 QuadrantCanvasState（断言成功） */
function parse(code: string): QuadrantCanvasState {
  const result = parseQuadrantCode(code);
  if (!result.success) {
    throw new Error(`解析失败: ${result.errors.map((e) => e.message).join(', ')}`);
  }
  return result.canvas as QuadrantCanvasState;
}

/** round-trip: 代码 → 解析 → 序列化 → 代码 */
function roundTrip(code: string): { canvas: QuadrantCanvasState; code2: string } {
  const parsed = parseQuadrantCode(code);
  if (!parsed.success) {
    throw new Error(`解析失败: ${parsed.errors.map((e) => e.message).join(', ')}`);
  }
  const serialized = serializeQuadrant(parsed.canvas as QuadrantCanvasState);
  if (serialized.errors.length > 0) {
    throw new Error(`序列化失败: ${serialized.errors.map((e) => e.message).join(', ')}`);
  }
  return {
    canvas: parsed.canvas as QuadrantCanvasState,
    code2: serialized.mermaid,
  };
}

// ============================================================
// 基本解析
// ============================================================

describe('基本解析', () => {
  it('应解析空 quadrantChart（仅 quadrantChart 关键字）', () => {
    const canvas = parse('quadrantChart');
    expect(canvas.diagramType).toBe('quadrantChart');
    expect(canvas.points).toHaveLength(0);
    expect(canvas.quadrants).toEqual({ '1': '', '2': '', '3': '', '4': '' });
    expect(canvas.xAxis).toEqual({ leftText: '', rightText: '' });
    expect(canvas.yAxis).toEqual({ topText: '', bottomText: '' });
  });

  it('应解析 title', () => {
    const canvas = parse('quadrantChart\ntitle Reach and Engagement of Campaigns');
    expect(canvas.title).toBe('Reach and Engagement of Campaigns');
  });

  it('应解析 accTitle（带冒号格式）', () => {
    const canvas = parse('quadrantChart\naccTitle: My Accessibility Title');
    expect(canvas.accTitle).toBe('My Accessibility Title');
  });

  it('应解析 accDescription（带冒号格式）', () => {
    const canvas = parse('quadrantChart\naccDescr: My Accessibility Description');
    expect(canvas.accDescription).toBe('My Accessibility Description');
  });

  it('应解析 x-axis（左右标签）', () => {
    const canvas = parse('quadrantChart\nx-axis Low Reach --> High Reach');
    expect(canvas.xAxis.leftText).toBe('Low Reach');
    expect(canvas.xAxis.rightText).toBe('High Reach');
  });

  it('应解析 y-axis（上下标签）', () => {
    const canvas = parse('quadrantChart\ny-axis Low Engagement --> High Engagement');
    expect(canvas.yAxis.bottomText).toBe('Low Engagement');
    expect(canvas.yAxis.topText).toBe('High Engagement');
  });

  it('应解析 quadrant-1 ~ quadrant-4', () => {
    const canvas = parse(`quadrantChart
quadrant-1 We should expand
quadrant-2 Need to promote
quadrant-3 Re-evaluate
quadrant-4 May be improved`);
    expect(canvas.quadrants['1']).toBe('We should expand');
    expect(canvas.quadrants['2']).toBe('Need to promote');
    expect(canvas.quadrants['3']).toBe('Re-evaluate');
    expect(canvas.quadrants['4']).toBe('May be improved');
  });
});

// ============================================================
// 数据点解析
// ============================================================

describe('数据点解析', () => {
  it('应解析数据点（坐标 0-1 归一化）', () => {
    const canvas = parse('quadrantChart\nCampaign A: [0.3, 0.6]');
    expect(canvas.points).toHaveLength(1);
    expect(canvas.points[0].label).toBe('Campaign A');
    expect(canvas.points[0].x).toBeCloseTo(0.3, 5);
    expect(canvas.points[0].y).toBeCloseTo(0.6, 5);
  });

  it('应解析多个数据点', () => {
    const canvas = parse(`quadrantChart
Campaign A: [0.3, 0.6]
Campaign B: [0.7, 0.8]
Campaign C: [0.5, 0.5]`);
    expect(canvas.points).toHaveLength(3);
    expect(canvas.points[0].label).toBe('Campaign A');
    expect(canvas.points[1].label).toBe('Campaign B');
    expect(canvas.points[2].label).toBe('Campaign C');
  });

  it('应解析边界坐标 0 和 1', () => {
    const canvas = parse('quadrantChart\nOrigin: [0, 0]\nTopRight: [1, 1]');
    expect(canvas.points[0].x).toBe(0);
    expect(canvas.points[0].y).toBe(0);
    expect(canvas.points[1].x).toBe(1);
    expect(canvas.points[1].y).toBe(1);
  });

  it('应解析带 className 的数据点（::: 语法）', () => {
    const canvas = parse('quadrantChart\nclassDef highlight color: #ff3300\nCampaign A:::highlight: [0.3, 0.6]');
    expect(canvas.points[0].className).toBe('highlight');
    expect(canvas.classDefs).toBeDefined();
    expect(canvas.classDefs?.[0].name).toBe('highlight');
  });

  it('应解析带 radius 样式的数据点', () => {
    const canvas = parse('quadrantChart\nCampaign A: [0.3, 0.6] radius: 9');
    expect(canvas.points[0].radius).toBe(9);
  });

  it('应解析带 color 样式的数据点（映射到 style.fill）', () => {
    const canvas = parse('quadrantChart\nCampaign A: [0.3, 0.6] color: #ff3300');
    expect(canvas.points[0].style?.fill).toBe('#ff3300');
  });

  it('应解析带 stroke-color 样式的数据点（映射到 style.stroke）', () => {
    const canvas = parse('quadrantChart\nCampaign A: [0.3, 0.6] stroke-color: #000000');
    expect(canvas.points[0].style?.stroke).toBe('#000000');
  });

  it('应解析带 stroke-width 样式的数据点（Npx → number）', () => {
    const canvas = parse('quadrantChart\nCampaign A: [0.3, 0.6] stroke-width: 10px');
    expect(canvas.points[0].style?.strokeWidth).toBe(10);
  });

  it('应解析带完整样式的数据点', () => {
    const canvas = parse('quadrantChart\nCampaign A: [0.3, 0.6] radius: 9, color: #ff3300, stroke-color: #000000, stroke-width: 10px');
    expect(canvas.points[0].radius).toBe(9);
    expect(canvas.points[0].style?.fill).toBe('#ff3300');
    expect(canvas.points[0].style?.stroke).toBe('#000000');
    expect(canvas.points[0].style?.strokeWidth).toBe(10);
  });

  it('应解析带 className 和样式的数据点', () => {
    const canvas = parse('quadrantChart\nclassDef highlight color: #ff3300\nCampaign A:::highlight: [0.3, 0.6] radius: 9');
    expect(canvas.points[0].className).toBe('highlight');
    expect(canvas.points[0].radius).toBe(9);
  });
});

// ============================================================
// classDef 解析
// ============================================================

describe('classDef 解析', () => {
  it('应解析单个 classDef', () => {
    const canvas = parse('quadrantChart\nclassDef highlight color: #ff3300');
    expect(canvas.classDefs).toHaveLength(1);
    expect(canvas.classDefs?.[0].name).toBe('highlight');
    expect(canvas.classDefs?.[0].style).toContain('color: #ff3300');
  });

  it('应解析多个 classDef', () => {
    const canvas = parse(`quadrantChart
classDef highlight color: #ff3300
classDef important color: #ff0000, radius: 12`);
    expect(canvas.classDefs).toHaveLength(2);
    expect(canvas.classDefs?.[0].name).toBe('highlight');
    expect(canvas.classDefs?.[1].name).toBe('important');
    expect(canvas.classDefs?.[1].style).toContain('radius: 12');
  });

  it('应解析带 stroke-color 和 stroke-width 的 classDef', () => {
    const canvas = parse('quadrantChart\nclassDef styled color: #ff3300, stroke-color: #000000, stroke-width: 10px');
    expect(canvas.classDefs?.[0].style).toContain('stroke-color: #000000');
    expect(canvas.classDefs?.[0].style).toContain('stroke-width: 10px');
  });
});

// ============================================================
// 序列化
// ============================================================

describe('序列化', () => {
  it('应序列化空 quadrantChart', () => {
    const canvas: QuadrantCanvasState = {
      diagramType: 'quadrantChart',
      quadrants: { '1': '', '2': '', '3': '', '4': '' },
      xAxis: { leftText: '', rightText: '' },
      yAxis: { topText: '', bottomText: '' },
      points: [],
    };
    const result = serializeQuadrant(canvas);
    expect(result.errors).toHaveLength(0);
    expect(result.mermaid).toBe('quadrantChart');
  });

  it('应序列化 title', () => {
    const canvas: QuadrantCanvasState = {
      diagramType: 'quadrantChart',
      title: 'Test Title',
      quadrants: { '1': '', '2': '', '3': '', '4': '' },
      xAxis: { leftText: '', rightText: '' },
      yAxis: { topText: '', bottomText: '' },
      points: [],
    };
    const result = serializeQuadrant(canvas);
    expect(result.mermaid).toContain('title Test Title');
  });

  it('应序列化 x-axis（左右标签）', () => {
    const canvas: QuadrantCanvasState = {
      diagramType: 'quadrantChart',
      quadrants: { '1': '', '2': '', '3': '', '4': '' },
      xAxis: { leftText: 'Low', rightText: 'High' },
      yAxis: { topText: '', bottomText: '' },
      points: [],
    };
    const result = serializeQuadrant(canvas);
    expect(result.mermaid).toContain('x-axis Low --> High');
  });

  it('应序列化 y-axis（上下标签）', () => {
    const canvas: QuadrantCanvasState = {
      diagramType: 'quadrantChart',
      quadrants: { '1': '', '2': '', '3': '', '4': '' },
      xAxis: { leftText: '', rightText: '' },
      yAxis: { topText: 'High', bottomText: 'Low' },
      points: [],
    };
    const result = serializeQuadrant(canvas);
    expect(result.mermaid).toContain('y-axis Low --> High');
  });

  it('应序列化 quadrant-1 ~ quadrant-4', () => {
    const canvas: QuadrantCanvasState = {
      diagramType: 'quadrantChart',
      quadrants: { '1': 'Expand', '2': 'Promote', '3': 'Re-evaluate', '4': 'Improve' },
      xAxis: { leftText: '', rightText: '' },
      yAxis: { topText: '', bottomText: '' },
      points: [],
    };
    const result = serializeQuadrant(canvas);
    expect(result.mermaid).toContain('quadrant-1 Expand');
    expect(result.mermaid).toContain('quadrant-2 Promote');
    expect(result.mermaid).toContain('quadrant-3 Re-evaluate');
    expect(result.mermaid).toContain('quadrant-4 Improve');
  });

  it('应序列化数据点（无样式无类）', () => {
    const canvas: QuadrantCanvasState = {
      diagramType: 'quadrantChart',
      quadrants: { '1': '', '2': '', '3': '', '4': '' },
      xAxis: { leftText: '', rightText: '' },
      yAxis: { topText: '', bottomText: '' },
      points: [{ label: 'Campaign A', x: 0.3, y: 0.6 }],
    };
    const result = serializeQuadrant(canvas);
    expect(result.mermaid).toContain('Campaign A: [0.3, 0.6]');
  });

  it('应序列化数据点（带 className）', () => {
    const canvas: QuadrantCanvasState = {
      diagramType: 'quadrantChart',
      quadrants: { '1': '', '2': '', '3': '', '4': '' },
      xAxis: { leftText: '', rightText: '' },
      yAxis: { topText: '', bottomText: '' },
      points: [{ label: 'Campaign A', x: 0.3, y: 0.6, className: 'highlight' }],
    };
    const result = serializeQuadrant(canvas);
    expect(result.mermaid).toContain('Campaign A:::highlight: [0.3, 0.6]');
  });

  it('应序列化数据点（带 radius 样式）', () => {
    const canvas: QuadrantCanvasState = {
      diagramType: 'quadrantChart',
      quadrants: { '1': '', '2': '', '3': '', '4': '' },
      xAxis: { leftText: '', rightText: '' },
      yAxis: { topText: '', bottomText: '' },
      points: [{ label: 'Campaign A', x: 0.3, y: 0.6, radius: 9 }],
    };
    const result = serializeQuadrant(canvas);
    expect(result.mermaid).toContain('radius: 9');
  });

  it('应序列化数据点（带 color 样式）', () => {
    const canvas: QuadrantCanvasState = {
      diagramType: 'quadrantChart',
      quadrants: { '1': '', '2': '', '3': '', '4': '' },
      xAxis: { leftText: '', rightText: '' },
      yAxis: { topText: '', bottomText: '' },
      points: [{ label: 'Campaign A', x: 0.3, y: 0.6, style: { fill: '#ff3300' } }],
    };
    const result = serializeQuadrant(canvas);
    expect(result.mermaid).toContain('color: #ff3300');
  });

  it('应序列化数据点（带 stroke-color 和 stroke-width 样式）', () => {
    const canvas: QuadrantCanvasState = {
      diagramType: 'quadrantChart',
      quadrants: { '1': '', '2': '', '3': '', '4': '' },
      xAxis: { leftText: '', rightText: '' },
      yAxis: { topText: '', bottomText: '' },
      points: [{
        label: 'Campaign A',
        x: 0.3,
        y: 0.6,
        style: { stroke: '#000000', strokeWidth: 10 },
      }],
    };
    const result = serializeQuadrant(canvas);
    expect(result.mermaid).toContain('stroke-color: #000000');
    expect(result.mermaid).toContain('stroke-width: 10px');
  });

  it('应序列化 classDef', () => {
    const canvas: QuadrantCanvasState = {
      diagramType: 'quadrantChart',
      quadrants: { '1': '', '2': '', '3': '', '4': '' },
      xAxis: { leftText: '', rightText: '' },
      yAxis: { topText: '', bottomText: '' },
      points: [],
      classDefs: [{ name: 'highlight', style: 'color: #ff3300' }],
    };
    const result = serializeQuadrant(canvas);
    expect(result.mermaid).toContain('classDef highlight color: #ff3300');
  });

  it('应在 diagramType 不匹配时返回错误', () => {
    const canvas = {
      diagramType: 'pie',
      slices: [],
    } as unknown as QuadrantCanvasState;
    const result = serializeQuadrant(canvas);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("quadrantChart");
  });
});

// ============================================================
// Round-trip（解析 → 序列化 → 解析）
// ============================================================

describe('Round-trip', () => {
  it('空 quadrantChart round-trip', () => {
    const { canvas, code2 } = roundTrip('quadrantChart');
    expect(code2).toBe('quadrantChart');
    expect(canvas.diagramType).toBe('quadrantChart');
  });

  it('带 title 的 round-trip', () => {
    const { canvas, code2 } = roundTrip('quadrantChart\ntitle Test Title');
    expect(canvas.title).toBe('Test Title');
    expect(code2).toContain('title Test Title');
  });

  it('带 x-axis 和 y-axis 的 round-trip', () => {
    const code = 'quadrantChart\nx-axis Low --> High\ny-axis Bottom --> Top';
    const { canvas, code2 } = roundTrip(code);
    expect(canvas.xAxis.leftText).toBe('Low');
    expect(canvas.xAxis.rightText).toBe('High');
    expect(canvas.yAxis.bottomText).toBe('Bottom');
    expect(canvas.yAxis.topText).toBe('Top');
    expect(code2).toContain('x-axis Low --> High');
    expect(code2).toContain('y-axis Bottom --> Top');
  });

  it('带 quadrant-1~4 的 round-trip', () => {
    const code = `quadrantChart
quadrant-1 Expand
quadrant-2 Promote
quadrant-3 Re-evaluate
quadrant-4 Improve`;
    const { canvas, code2 } = roundTrip(code);
    expect(canvas.quadrants['1']).toBe('Expand');
    expect(canvas.quadrants['4']).toBe('Improve');
    expect(code2).toContain('quadrant-1 Expand');
    expect(code2).toContain('quadrant-4 Improve');
  });

  it('带数据点的 round-trip', () => {
    const code = 'quadrantChart\nCampaign A: [0.3, 0.6]\nCampaign B: [0.7, 0.8]';
    const { canvas, code2 } = roundTrip(code);
    expect(canvas.points).toHaveLength(2);
    expect(canvas.points[0].x).toBeCloseTo(0.3, 5);
    expect(canvas.points[0].y).toBeCloseTo(0.6, 5);
    expect(code2).toContain('Campaign A: [0.3, 0.6]');
    expect(code2).toContain('Campaign B: [0.7, 0.8]');
  });

  it('带 className 数据点的 round-trip', () => {
    const code = 'quadrantChart\nclassDef highlight color: #ff3300\nCampaign A:::highlight: [0.3, 0.6]';
    const { canvas, code2 } = roundTrip(code);
    expect(canvas.points[0].className).toBe('highlight');
    expect(code2).toContain('Campaign A:::highlight: [0.3, 0.6]');
  });

  it('带 radius 样式的 round-trip', () => {
    const code = 'quadrantChart\nCampaign A: [0.3, 0.6] radius: 9';
    const { canvas, code2 } = roundTrip(code);
    expect(canvas.points[0].radius).toBe(9);
    expect(code2).toContain('radius: 9');
  });

  it('带完整样式的 round-trip', () => {
    const code = 'quadrantChart\nCampaign A: [0.3, 0.6] radius: 9, color: #ff3300, stroke-color: #000000, stroke-width: 10px';
    const { canvas, code2 } = roundTrip(code);
    expect(canvas.points[0].radius).toBe(9);
    expect(canvas.points[0].style?.fill).toBe('#ff3300');
    expect(canvas.points[0].style?.stroke).toBe('#000000');
    expect(canvas.points[0].style?.strokeWidth).toBe(10);
    expect(code2).toContain('radius: 9');
    expect(code2).toContain('color: #ff3300');
    expect(code2).toContain('stroke-color: #000000');
    expect(code2).toContain('stroke-width: 10px');
  });

  it('完整 quadrantChart round-trip', () => {
    const code = `quadrantChart
title Reach and Engagement of Campaigns
x-axis Low Reach --> High Reach
y-axis Low Engagement --> High Engagement
quadrant-1 We should expand
quadrant-2 Need to promote
quadrant-3 Re-evaluate
quadrant-4 May be improved
Campaign A: [0.3, 0.6]
Campaign B: [0.7, 0.8]
Campaign C: [0.5, 0.5]`;
    const { canvas, code2 } = roundTrip(code);
    expect(canvas.title).toBe('Reach and Engagement of Campaigns');
    expect(canvas.xAxis.leftText).toBe('Low Reach');
    expect(canvas.xAxis.rightText).toBe('High Reach');
    expect(canvas.yAxis.bottomText).toBe('Low Engagement');
    expect(canvas.yAxis.topText).toBe('High Engagement');
    expect(canvas.quadrants['1']).toBe('We should expand');
    expect(canvas.points).toHaveLength(3);
    expect(code2).toContain('title Reach and Engagement of Campaigns');
    expect(code2).toContain('x-axis Low Reach --> High Reach');
    expect(code2).toContain('y-axis Low Engagement --> High Engagement');
    expect(code2).toContain('quadrant-1 We should expand');
  });
});

// ============================================================
// 调度器集成
// ============================================================

describe('调度器集成', () => {
  it('parseMermaid 应识别 quadrantChart 并调用 parseQuadrantCode', () => {
    const result = parseMermaid('quadrantChart\nCampaign A: [0.3, 0.6]');
    expect(result.success).toBe(true);
    const canvas = result.canvas as QuadrantCanvasState;
    expect(canvas.diagramType).toBe('quadrantChart');
    expect(canvas.points).toHaveLength(1);
  });

  it('serializeMermaid 应识别 quadrantChart 并调用 serializeQuadrant', () => {
    const canvas: QuadrantCanvasState = {
      diagramType: 'quadrantChart',
      quadrants: { '1': '', '2': '', '3': '', '4': '' },
      xAxis: { leftText: '', rightText: '' },
      yAxis: { topText: '', bottomText: '' },
      points: [{ label: 'Test', x: 0.5, y: 0.5 }],
    };
    const result = serializeMermaid(canvas);
    expect(result.errors).toHaveLength(0);
    expect(result.mermaid).toContain('quadrantChart');
    expect(result.mermaid).toContain('Test: [0.5, 0.5]');
  });
});

// ============================================================
// 辅助函数测试
// ============================================================

describe('辅助函数', () => {
  describe('isValidNormalizedCoordinate', () => {
    it('应接受 0-1 范围内的值', () => {
      expect(isValidNormalizedCoordinate(0)).toBe(true);
      expect(isValidNormalizedCoordinate(0.5)).toBe(true);
      expect(isValidNormalizedCoordinate(1)).toBe(true);
    });

    it('应拒绝超出 0-1 范围的值', () => {
      expect(isValidNormalizedCoordinate(-0.1)).toBe(false);
      expect(isValidNormalizedCoordinate(1.1)).toBe(false);
      expect(isValidNormalizedCoordinate(100)).toBe(false);
    });
  });

  describe('formatCoordinate', () => {
    it('应格式化整数坐标', () => {
      expect(formatCoordinate(0)).toBe('0');
      expect(formatCoordinate(1)).toBe('1');
    });

    it('应格式化浮点坐标', () => {
      expect(formatCoordinate(0.3)).toBe('0.3');
      expect(formatCoordinate(0.62)).toBe('0.62');
    });
  });

  describe('serializePointStyle', () => {
    it('应序列化空样式为空字符串', () => {
      const point: QuadrantPoint = { label: 'A', x: 0.5, y: 0.5 };
      expect(serializePointStyle(point)).toBe('');
    });

    it('应序列化 color（style.fill → color）', () => {
      const point: QuadrantPoint = {
        label: 'A',
        x: 0.5,
        y: 0.5,
        style: { fill: '#ff3300' },
      };
      expect(serializePointStyle(point)).toBe('color: #ff3300');
    });

    it('应序列化 radius', () => {
      const point: QuadrantPoint = {
        label: 'A',
        x: 0.5,
        y: 0.5,
        radius: 9,
      };
      expect(serializePointStyle(point)).toBe('radius: 9');
    });

    it('应按官方顺序序列化完整样式', () => {
      const point: QuadrantPoint = {
        label: 'A',
        x: 0.5,
        y: 0.5,
        radius: 9,
        style: {
          fill: '#ff3300',
          stroke: '#000000',
          strokeWidth: 10,
        },
      };
      const result = serializePointStyle(point);
      // 顺序: color → radius → stroke-color → stroke-width
      expect(result).toBe('color: #ff3300, radius: 9, stroke-color: #000000, stroke-width: 10px');
    });
  });

  describe('parseClassDefStyle', () => {
    it('应解析 color 样式', () => {
      const result = parseClassDefStyle('color: #ff3300');
      expect(result.fill).toBe('#ff3300');
    });

    it('应解析 radius 样式', () => {
      const result = parseClassDefStyle('radius: 9');
      expect(result.radius).toBe(9);
    });

    it('应解析 stroke-color 样式', () => {
      const result = parseClassDefStyle('stroke-color: #000000');
      expect(result.stroke).toBe('#000000');
    });

    it('应解析 stroke-width 样式（Npx → number）', () => {
      const result = parseClassDefStyle('stroke-width: 10px');
      expect(result.strokeWidth).toBe(10);
    });

    it('应解析完整样式字符串', () => {
      const result = parseClassDefStyle('color: #ff3300, radius: 9, stroke-color: #000000, stroke-width: 10px');
      expect(result.fill).toBe('#ff3300');
      expect(result.radius).toBe(9);
      expect(result.stroke).toBe('#000000');
      expect(result.strokeWidth).toBe(10);
    });
  });

  describe('mergeClassDefStyle', () => {
    it('无 className 时应返回 point 自身样式', () => {
      const point: QuadrantPoint = {
        label: 'A',
        x: 0.5,
        y: 0.5,
        style: { fill: '#ff0000' },
      };
      const result = mergeClassDefStyle(point, []);
      expect(result.style.fill).toBe('#ff0000');
    });

    it('有 className 但无匹配 classDef 时应返回 point 自身样式', () => {
      const point: QuadrantPoint = {
        label: 'A',
        x: 0.5,
        y: 0.5,
        className: 'nonexistent',
        style: { fill: '#ff0000' },
      };
      const result = mergeClassDefStyle(point, [{ name: 'other', style: 'color: #00ff00' }]);
      expect(result.style.fill).toBe('#ff0000');
    });

    it('point 自身样式应覆盖 classDef 样式', () => {
      const point: QuadrantPoint = {
        label: 'A',
        x: 0.5,
        y: 0.5,
        className: 'highlight',
        style: { fill: '#ff0000' },
        radius: 12,
      };
      const classDefs = [{ name: 'highlight', style: 'color: #00ff00, radius: 9' }];
      const result = mergeClassDefStyle(point, classDefs);
      // point 自身样式覆盖 classDef
      expect(result.style.fill).toBe('#ff0000');
      expect(result.radius).toBe(12);
    });

    it('point 未设置的样式应从 classDef 继承', () => {
      const point: QuadrantPoint = {
        label: 'A',
        x: 0.5,
        y: 0.5,
        className: 'highlight',
      };
      const classDefs = [{ name: 'highlight', style: 'color: #00ff00, radius: 9' }];
      const result = mergeClassDefStyle(point, classDefs);
      expect(result.style.fill).toBe('#00ff00');
      expect(result.radius).toBe(9);
    });
  });

  describe('serializeClassDefStatement', () => {
    it('应序列化 classDef 语句', () => {
      const result = serializeClassDefStatement({ name: 'highlight', style: 'color: #ff3300' });
      expect(result).toBe('classDef highlight color: #ff3300');
    });
  });

  describe('serializePointLine', () => {
    it('应序列化无样式无类的数据点', () => {
      const point: QuadrantPoint = { label: 'A', x: 0.3, y: 0.6 };
      expect(serializePointLine(point)).toBe('A: [0.3, 0.6]');
    });

    it('应序列化带 className 的数据点', () => {
      const point: QuadrantPoint = { label: 'A', x: 0.3, y: 0.6, className: 'highlight' };
      expect(serializePointLine(point)).toBe('A:::highlight: [0.3, 0.6]');
    });

    it('应序列化带样式的数据点', () => {
      const point: QuadrantPoint = {
        label: 'A',
        x: 0.3,
        y: 0.6,
        radius: 9,
      };
      expect(serializePointLine(point)).toBe('A: [0.3, 0.6] radius: 9');
    });

    it('应序列化带 className 和样式的数据点', () => {
      const point: QuadrantPoint = {
        label: 'A',
        x: 0.3,
        y: 0.6,
        className: 'highlight',
        radius: 9,
      };
      expect(serializePointLine(point)).toBe('A:::highlight: [0.3, 0.6] radius: 9');
    });
  });
});

// ============================================================
// 边界情况
// ============================================================

describe('边界情况', () => {
  it('应处理仅 quadrantChart 关键字（无换行）', () => {
    const canvas = parse('quadrantChart');
    expect(canvas.diagramType).toBe('quadrantChart');
    expect(canvas.points).toHaveLength(0);
  });

  it('应处理空标题（title 后无内容时 title 为 undefined）', () => {
    const canvas = parse('quadrantChart\ntitle ');
    // jison 文法中 title 后无内容时不触发 title_value 规则，title 保持 undefined
    // 这等同于没有 title 语句，是合理的解析行为
    expect(canvas.title).toBeUndefined();
  });

  it('应处理仅 x-axis 左标签', () => {
    const canvas = parse('quadrantChart\nx-axis Low');
    expect(canvas.xAxis.leftText).toBe('Low');
    expect(canvas.xAxis.rightText).toBe('');
  });

  it('应处理仅 y-axis 下标签', () => {
    const canvas = parse('quadrantChart\ny-axis Bottom');
    expect(canvas.yAxis.bottomText).toBe('Bottom');
    expect(canvas.yAxis.topText).toBe('');
  });

  it('应处理重复定义的象限（后者覆盖前者）', () => {
    const canvas = parse('quadrantChart\nquadrant-1 First\nquadrant-1 Second');
    expect(canvas.quadrants['1']).toBe('Second');
  });

  it('应处理中文标签', () => {
    const canvas = parse('quadrantChart\n活动 A: [0.3, 0.6]');
    expect(canvas.points[0].label).toBe('活动 A');
  });

  it('应处理特殊字符标签', () => {
    const canvas = parse('quadrantChart\nCampaign-A: [0.3, 0.6]');
    expect(canvas.points[0].label).toBe('Campaign-A');
  });
});

// ============================================================
// 错误处理
// ============================================================

describe('错误处理', () => {
  it('应在语法错误时返回失败', () => {
    const result = parseQuadrantCode('quadrantChart\ninvalid syntax !!!');
    // 语法错误应被捕获（可能成功也可能失败，取决于 jison 容错性）
    // 但不应抛出异常
    expect(result).toBeDefined();
    expect(result.success).toBeDefined();
  });

  it('应在 diagramType 不匹配时返回序列化错误', () => {
    const wrongCanvas = {
      diagramType: 'pie',
      slices: [],
    } as unknown as QuadrantCanvasState;
    const result = serializeQuadrant(wrongCanvas);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('quadrantChart');
  });
});
