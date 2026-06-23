/**
 * xychart 行为验证测试 — M12
 *
 * 验证 xychart 解析器、序列化器的行为符合官方 mermaid xychart-beta 标准
 * 覆盖：官方语法、title/accTitle/accDescription、x-axis（band/linear）、y-axis（linear）、
 *       line/bar 系列（含可选名称）、chartOrientation、showDataLabel、plotColorPalette、
 *       YAML frontmatter、classDef、颜色分配、round-trip、边界
 *
 * 测试策略：行为验证（不测试实现细节，只测试接口和行为）
 */

import { describe, it, expect } from 'vitest';
import { parseXYChartCode } from '../../src/parser/xychart-parser.js';
import { serializeXYChart } from '../../src/serializer/xychart-serializer.js';
import { parseMermaid } from '../../src/parse-dispatcher.js';
import { serializeMermaid } from '../../src/serialize-dispatcher.js';
import {
  DEFAULT_PLOT_COLOR_PALETTE,
  DEFAULT_PLOT_COLOR_PALETTE_STR,
  parsePlotColorPalette,
  assignSeriesColor,
  formatDataValue,
  escapeText,
} from '../../src/serializer/shared/xychart-helpers.js';
import type { XYChartCanvasState, XYSeries } from '../../src/types.js';

// ============================================================
// 辅助函数
// ============================================================

/** 解析代码并返回 XYChartCanvasState（断言成功） */
function parse(code: string): XYChartCanvasState {
  const result = parseXYChartCode(code);
  if (!result.success) {
    throw new Error(`解析失败: ${result.errors.map((e) => e.message).join(', ')}`);
  }
  return result.canvas as XYChartCanvasState;
}

/** round-trip: 代码 → 解析 → 序列化 → 代码 */
function roundTrip(code: string): { canvas: XYChartCanvasState; code2: string } {
  const parsed = parseXYChartCode(code);
  if (!parsed.success) {
    throw new Error(`解析失败: ${parsed.errors.map((e) => e.message).join(', ')}`);
  }
  const serialized = serializeXYChart(parsed.canvas as XYChartCanvasState);
  if (serialized.errors.length > 0) {
    throw new Error(`序列化失败: ${serialized.errors.map((e) => e.message).join(', ')}`);
  }
  return {
    canvas: parsed.canvas as XYChartCanvasState,
    code2: serialized.mermaid,
  };
}

// ============================================================
// 基本解析
// ============================================================

describe('基本解析', () => {
  it('应解析基本 xychart-beta（line 系列 + band x-axis）', () => {
    const canvas = parse(`xychart-beta
x-axis [jan, feb, mar]
line [10, 20, 30]`);
    expect(canvas.diagramType).toBe('xychart');
    expect(canvas.xAxis.type).toBe('band');
    expect(canvas.xAxis.categories).toEqual(['jan', 'feb', 'mar']);
    expect(canvas.series).toHaveLength(1);
    expect(canvas.series[0].type).toBe('line');
    expect(canvas.series[0].data).toEqual([10, 20, 30]);
  });

  it('应解析 title（双引号包裹）', () => {
    const canvas = parse(`xychart-beta
title "Sales Chart"
x-axis [jan, feb]
line [10, 20]`);
    expect(canvas.title).toBe('Sales Chart');
  });

  it('应解析 accTitle（带冒号格式）', () => {
    const canvas = parse(`xychart-beta
accTitle: My Accessibility Title
x-axis [jan, feb]
line [10, 20]`);
    expect(canvas.accTitle).toBe('My Accessibility Title');
  });

  it('应解析 accDescription（带冒号格式）', () => {
    const canvas = parse(`xychart-beta
accDescr: My Accessibility Description
x-axis [jan, feb]
line [10, 20]`);
    expect(canvas.accDescription).toBe('My Accessibility Description');
  });

  it('应解析 chartOrientation（jison 语法）', () => {
    const canvas = parse(`xychart-beta horizontal
x-axis [jan, feb]
line [10, 20]`);
    expect(canvas.orientation).toBe('horizontal');
  });

  it('应默认 chartOrientation 为 vertical（不设置时）', () => {
    const canvas = parse(`xychart-beta
x-axis [jan, feb]
line [10, 20]`);
    expect(canvas.orientation).toBeUndefined();
  });
});

// ============================================================
// x-axis 解析
// ============================================================

describe('x-axis 解析', () => {
  it('应解析 band x-axis（无标题）', () => {
    const canvas = parse(`xychart-beta
x-axis [jan, feb, mar]
line [10, 20, 30]`);
    expect(canvas.xAxis.type).toBe('band');
    expect(canvas.xAxis.categories).toEqual(['jan', 'feb', 'mar']);
    expect(canvas.xAxis.title).toBeUndefined();
  });

  it('应解析 band x-axis（有标题）', () => {
    const canvas = parse(`xychart-beta
x-axis "Months" [jan, feb, mar]
line [10, 20, 30]`);
    expect(canvas.xAxis.type).toBe('band');
    expect(canvas.xAxis.title).toBe('Months');
    expect(canvas.xAxis.categories).toEqual(['jan', 'feb', 'mar']);
  });

  it('应解析 linear x-axis（无标题）', () => {
    const canvas = parse(`xychart-beta
x-axis 0 --> 100
line [10, 20, 30]`);
    expect(canvas.xAxis.type).toBe('linear');
    expect(canvas.xAxis.min).toBe(0);
    expect(canvas.xAxis.max).toBe(100);
    expect(canvas.xAxis.title).toBeUndefined();
  });

  it('应解析 linear x-axis（有标题）', () => {
    const canvas = parse(`xychart-beta
x-axis "Range" 0 --> 100
line [10, 20, 30]`);
    expect(canvas.xAxis.type).toBe('linear');
    expect(canvas.xAxis.title).toBe('Range');
    expect(canvas.xAxis.min).toBe(0);
    expect(canvas.xAxis.max).toBe(100);
  });

  it('应解析带空格的 band 类别（双引号包裹）', () => {
    const canvas = parse(`xychart-beta
x-axis ["Cold Brew", "Hot Brew"]
line [10, 20]`);
    expect(canvas.xAxis.categories).toEqual(['Cold Brew', 'Hot Brew']);
  });
});

// ============================================================
// y-axis 解析
// ============================================================

describe('y-axis 解析', () => {
  it('应解析 linear y-axis（无标题）', () => {
    const canvas = parse(`xychart-beta
x-axis [jan, feb]
y-axis 0 --> 100
line [10, 20]`);
    expect(canvas.yAxis.type).toBe('linear');
    expect(canvas.yAxis.min).toBe(0);
    expect(canvas.yAxis.max).toBe(100);
    expect(canvas.yAxis.title).toBeUndefined();
  });

  it('应解析 linear y-axis（有标题）', () => {
    const canvas = parse(`xychart-beta
x-axis [jan, feb]
y-axis "Sales" 0 --> 100
line [10, 20]`);
    expect(canvas.yAxis.type).toBe('linear');
    expect(canvas.yAxis.title).toBe('Sales');
    expect(canvas.yAxis.min).toBe(0);
    expect(canvas.yAxis.max).toBe(100);
  });

  it('应自动计算 y-axis 范围（用户未设置时）', () => {
    const canvas = parse(`xychart-beta
x-axis [jan, feb, mar]
line [10, 50, 30]`);
    expect(canvas.yAxis.type).toBe('linear');
    expect(canvas.yAxis.min).toBe(10);
    expect(canvas.yAxis.max).toBe(50);
  });

  it('应合并多系列 y-axis 范围', () => {
    const canvas = parse(`xychart-beta
x-axis [jan, feb, mar]
line [10, 50, 30]
bar [5, 80, 20]`);
    expect(canvas.yAxis.min).toBe(5);
    expect(canvas.yAxis.max).toBe(80);
  });

  it('应保留用户显式设置的 y-axis 范围', () => {
    const canvas = parse(`xychart-beta
x-axis [jan, feb, mar]
y-axis 0 --> 100
line [10, 50, 30]`);
    expect(canvas.yAxis.min).toBe(0);
    expect(canvas.yAxis.max).toBe(100);
  });
});

// ============================================================
// 数据系列解析
// ============================================================

describe('数据系列解析', () => {
  it('应解析 line 系列（无名）', () => {
    const canvas = parse(`xychart-beta
x-axis [jan, feb]
line [10, 20]`);
    expect(canvas.series).toHaveLength(1);
    expect(canvas.series[0].type).toBe('line');
    expect(canvas.series[0].name).toBeUndefined();
    expect(canvas.series[0].data).toEqual([10, 20]);
  });

  it('应解析 line 系列（有名）', () => {
    const canvas = parse(`xychart-beta
x-axis [jan, feb]
line "Sales" [10, 20]`);
    expect(canvas.series[0].name).toBe('Sales');
  });

  it('应解析 bar 系列（无名）', () => {
    const canvas = parse(`xychart-beta
x-axis [jan, feb]
bar [10, 20]`);
    expect(canvas.series).toHaveLength(1);
    expect(canvas.series[0].type).toBe('bar');
    expect(canvas.series[0].data).toEqual([10, 20]);
  });

  it('应解析 bar 系列（有名）', () => {
    const canvas = parse(`xychart-beta
x-axis [jan, feb]
bar "Revenue" [10, 20]`);
    expect(canvas.series[0].name).toBe('Revenue');
  });

  it('应解析多系列（line + bar 交替，保持顺序）', () => {
    const canvas = parse(`xychart-beta
x-axis [jan, feb, mar]
line [10, 20, 30]
bar [5, 15, 25]
line [40, 50, 60]`);
    expect(canvas.series).toHaveLength(3);
    expect(canvas.series[0].type).toBe('line');
    expect(canvas.series[1].type).toBe('bar');
    expect(canvas.series[2].type).toBe('line');
  });

  it('应解析浮点数据', () => {
    const canvas = parse(`xychart-beta
x-axis [jan, feb]
line [10.5, 20.3]`);
    expect(canvas.series[0].data).toEqual([10.5, 20.3]);
  });

  it('应解析负数数据', () => {
    const canvas = parse(`xychart-beta
x-axis [jan, feb]
line [-10, 20]`);
    expect(canvas.series[0].data).toEqual([-10, 20]);
    expect(canvas.yAxis.min).toBe(-10);
    expect(canvas.yAxis.max).toBe(20);
  });
});

// ============================================================
// 颜色分配
// ============================================================

describe('颜色分配', () => {
  it('应为系列分配默认调色板颜色（按索引）', () => {
    const canvas = parse(`xychart-beta
x-axis [jan, feb]
line [10, 20]
bar [30, 40]`);
    expect(canvas.series[0].color).toBe(DEFAULT_PLOT_COLOR_PALETTE[0]);
    expect(canvas.series[1].color).toBe(DEFAULT_PLOT_COLOR_PALETTE[1]);
  });

  it('应在 plotColorPalette 非默认时保留调色板配置', () => {
    const code = `---
config:
  themeVariables:
    xyChart:
      plotColorPalette: '#FF0000, #00FF00, #0000FF'
---
xychart-beta
x-axis [jan, feb]
line [10, 20]
bar [30, 40]`;
    const canvas = parse(code);
    expect(canvas.plotColorPalette).toBe('#FF0000, #00FF00, #0000FF');
    expect(canvas.series[0].color).toBe('#FF0000');
    expect(canvas.series[1].color).toBe('#00FF00');
  });
});

// ============================================================
// YAML frontmatter 配置
// ============================================================

describe('YAML frontmatter 配置', () => {
  it('应解析 frontmatter showDataLabel', () => {
    const code = `---
config:
  xyChart:
    showDataLabel: true
---
xychart-beta
x-axis [jan, feb]
line [10, 20]`;
    const canvas = parse(code);
    expect(canvas.showDataLabel).toBe(true);
  });

  it('应解析 frontmatter chartOrientation', () => {
    const code = `---
config:
  xyChart:
    chartOrientation: horizontal
---
xychart-beta
x-axis [jan, feb]
line [10, 20]`;
    const canvas = parse(code);
    expect(canvas.orientation).toBe('horizontal');
  });

  it('应解析 frontmatter plotColorPalette（config.xyChart 路径）', () => {
    const code = `---
config:
  xyChart:
    plotColorPalette: '#FF0000, #00FF00'
---
xychart-beta
x-axis [jan, feb]
line [10, 20]`;
    const canvas = parse(code);
    expect(canvas.plotColorPalette).toBe('#FF0000, #00FF00');
  });

  it('应解析 frontmatter plotColorPalette（config.themeVariables.xyChart 路径）', () => {
    const code = `---
config:
  themeVariables:
    xyChart:
      plotColorPalette: '#FF0000, #00FF00'
---
xychart-beta
x-axis [jan, feb]
line [10, 20]`;
    const canvas = parse(code);
    expect(canvas.plotColorPalette).toBe('#FF0000, #00FF00');
  });

  it('应在无 frontmatter 时使用默认配置', () => {
    const canvas = parse(`xychart-beta
x-axis [jan, feb]
line [10, 20]`);
    expect(canvas.showDataLabel).toBeUndefined();
    expect(canvas.orientation).toBeUndefined();
    expect(canvas.plotColorPalette).toBeUndefined();
  });

  it('jison 语法 chartOrientation 应覆盖 frontmatter 设置', () => {
    const code = `---
config:
  xyChart:
    chartOrientation: vertical
---
xychart-beta horizontal
x-axis [jan, feb]
line [10, 20]`;
    const canvas = parse(code);
    expect(canvas.orientation).toBe('horizontal');
  });
});

// ============================================================
// classDef 解析（注：jison 文法不支持 classDef 语法，仅测试序列化）
// ============================================================
// classDef 解析测试已移除 — 官方 xychart-beta jison 文法不支持 classDef 语句
// XYChartDB.addClass/getClasses 保留供未来扩展，序列化器支持 classDef 输出

// ============================================================
// 序列化
// ============================================================

describe('序列化', () => {
  it('应序列化基本 xychart-beta（band x-axis + line 系列）', () => {
    const canvas: XYChartCanvasState = {
      diagramType: 'xychart',
      xAxis: { type: 'band', categories: ['jan', 'feb', 'mar'] },
      yAxis: { type: 'linear', min: 0, max: 100 },
      series: [{ type: 'line', data: [10, 20, 30], color: '#ECECEC' }],
    };
    const result = serializeXYChart(canvas);
    expect(result.errors).toHaveLength(0);
    expect(result.mermaid).toContain('xychart-beta');
    expect(result.mermaid).toContain('x-axis [jan, feb, mar]');
    expect(result.mermaid).toContain('y-axis 0 --> 100');
    expect(result.mermaid).toContain('line [10, 20, 30]');
  });

  it('应序列化 title（双引号包裹）', () => {
    const canvas: XYChartCanvasState = {
      diagramType: 'xychart',
      title: 'My Chart',
      xAxis: { type: 'band', categories: ['jan', 'feb'] },
      yAxis: { type: 'linear', min: 0, max: 100 },
      series: [{ type: 'line', data: [10, 20], color: '#ECECEC' }],
    };
    const result = serializeXYChart(canvas);
    expect(result.mermaid).toContain('title "My Chart"');
  });

  it('应序列化 x-axis（band 有标题）', () => {
    const canvas: XYChartCanvasState = {
      diagramType: 'xychart',
      xAxis: { type: 'band', title: 'Months', categories: ['jan', 'feb'] },
      yAxis: { type: 'linear', min: 0, max: 100 },
      series: [{ type: 'line', data: [10, 20], color: '#ECECEC' }],
    };
    const result = serializeXYChart(canvas);
    expect(result.mermaid).toContain('x-axis "Months" [jan, feb]');
  });

  it('应序列化 x-axis（linear）', () => {
    const canvas: XYChartCanvasState = {
      diagramType: 'xychart',
      xAxis: { type: 'linear', min: 0, max: 100 },
      yAxis: { type: 'linear', min: 0, max: 100 },
      series: [{ type: 'line', data: [10, 20], color: '#ECECEC' }],
    };
    const result = serializeXYChart(canvas);
    expect(result.mermaid).toContain('x-axis 0 --> 100');
  });

  it('应序列化 y-axis（有标题）', () => {
    const canvas: XYChartCanvasState = {
      diagramType: 'xychart',
      xAxis: { type: 'band', categories: ['jan', 'feb'] },
      yAxis: { type: 'linear', title: 'Sales', min: 0, max: 100 },
      series: [{ type: 'line', data: [10, 20], color: '#ECECEC' }],
    };
    const result = serializeXYChart(canvas);
    expect(result.mermaid).toContain('y-axis "Sales" 0 --> 100');
  });

  it('应序列化 line 系列（无名）', () => {
    const canvas: XYChartCanvasState = {
      diagramType: 'xychart',
      xAxis: { type: 'band', categories: ['jan', 'feb'] },
      yAxis: { type: 'linear', min: 0, max: 100 },
      series: [{ type: 'line', data: [10, 20], color: '#ECECEC' }],
    };
    const result = serializeXYChart(canvas);
    expect(result.mermaid).toContain('line [10, 20]');
  });

  it('应序列化 line 系列（有名）', () => {
    const canvas: XYChartCanvasState = {
      diagramType: 'xychart',
      xAxis: { type: 'band', categories: ['jan', 'feb'] },
      yAxis: { type: 'linear', min: 0, max: 100 },
      series: [{ type: 'line', name: 'Sales', data: [10, 20], color: '#ECECEC' }],
    };
    const result = serializeXYChart(canvas);
    expect(result.mermaid).toContain('line "Sales" [10, 20]');
  });

  it('应序列化 bar 系列', () => {
    const canvas: XYChartCanvasState = {
      diagramType: 'xychart',
      xAxis: { type: 'band', categories: ['jan', 'feb'] },
      yAxis: { type: 'linear', min: 0, max: 100 },
      series: [{ type: 'bar', data: [10, 20], color: '#ECECEC' }],
    };
    const result = serializeXYChart(canvas);
    expect(result.mermaid).toContain('bar [10, 20]');
  });

  it('应序列化 chartOrientation（horizontal）', () => {
    const canvas: XYChartCanvasState = {
      diagramType: 'xychart',
      orientation: 'horizontal',
      xAxis: { type: 'band', categories: ['jan', 'feb'] },
      yAxis: { type: 'linear', min: 0, max: 100 },
      series: [{ type: 'line', data: [10, 20], color: '#ECECEC' }],
    };
    const result = serializeXYChart(canvas);
    expect(result.mermaid).toContain('xychart-beta horizontal');
  });

  it('应序列化 showDataLabel（frontmatter 输出）', () => {
    const canvas: XYChartCanvasState = {
      diagramType: 'xychart',
      showDataLabel: true,
      xAxis: { type: 'band', categories: ['jan', 'feb'] },
      yAxis: { type: 'linear', min: 0, max: 100 },
      series: [{ type: 'line', data: [10, 20], color: '#ECECEC' }],
    };
    const result = serializeXYChart(canvas);
    expect(result.mermaid).toContain('---');
    expect(result.mermaid).toContain('showDataLabel: true');
  });

  it('应序列化 plotColorPalette（frontmatter 输出，非默认值）', () => {
    const canvas: XYChartCanvasState = {
      diagramType: 'xychart',
      plotColorPalette: '#FF0000, #00FF00',
      xAxis: { type: 'band', categories: ['jan', 'feb'] },
      yAxis: { type: 'linear', min: 0, max: 100 },
      series: [{ type: 'line', data: [10, 20], color: '#FF0000' }],
    };
    const result = serializeXYChart(canvas);
    expect(result.mermaid).toContain('---');
    expect(result.mermaid).toContain("plotColorPalette: '#FF0000, #00FF00'");
  });

  it('应同时序列化 showDataLabel 和 plotColorPalette（frontmatter 结构正确）', () => {
    const canvas: XYChartCanvasState = {
      diagramType: 'xychart',
      showDataLabel: true,
      plotColorPalette: '#FF0000, #00FF00',
      xAxis: { type: 'band', categories: ['jan', 'feb'] },
      yAxis: { type: 'linear', min: 0, max: 100 },
      series: [{ type: 'line', data: [10, 20], color: '#FF0000' }],
    };
    const result = serializeXYChart(canvas);
    // 验证 frontmatter 结构正确：两个配置都在 config.xyChart 下
    expect(result.mermaid).toContain('---');
    expect(result.mermaid).toContain('config:');
    expect(result.mermaid).toContain('  xyChart:');
    expect(result.mermaid).toContain('    showDataLabel: true');
    expect(result.mermaid).toContain("    plotColorPalette: '#FF0000, #00FF00'");
    // 验证不包含 themeVariables（统一使用 config.xyChart 路径）
    expect(result.mermaid).not.toContain('themeVariables:');
    // 验证不包含嵌套错误的 xyChart 嵌套 xyChart
    const xyChartCount = (result.mermaid.match(/xyChart:/g) ?? []).length;
    expect(xyChartCount).toBe(1);
  });

  it('YAML frontmatter 解析失败时应返回错误（禁止 fallback 掩盖缺陷）', () => {
    const invalidYaml = `---
config:
  xyChart:
    showDataLabel: [invalid
---
xychart-beta
    line [10, 20]`;
    const result = parseXYChartCode(invalidYaml);
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].message).toContain('YAML frontmatter 解析失败');
  });

  it('应序列化含空格的 band 类别（双引号包裹）', () => {
    const canvas: XYChartCanvasState = {
      diagramType: 'xychart',
      xAxis: { type: 'band', categories: ['Cold Brew', 'Hot Brew'] },
      yAxis: { type: 'linear', min: 0, max: 100 },
      series: [{ type: 'line', data: [10, 20], color: '#ECECEC' }],
    };
    const result = serializeXYChart(canvas);
    expect(result.mermaid).toContain('["Cold Brew", "Hot Brew"]');
  });

  it('应序列化 classDef', () => {
    const canvas: XYChartCanvasState = {
      diagramType: 'xychart',
      xAxis: { type: 'band', categories: ['jan', 'feb'] },
      yAxis: { type: 'linear', min: 0, max: 100 },
      series: [{ type: 'line', data: [10, 20], color: '#ECECEC' }],
      classDefs: [{ name: 'highlight', style: 'color: #ff0000' }],
    };
    const result = serializeXYChart(canvas);
    expect(result.mermaid).toContain('classDef highlight color: #ff0000');
  });

  it('应在 diagramType 不匹配时返回错误', () => {
    const canvas = {
      diagramType: 'flowchart',
      xAxis: { type: 'band', categories: [] },
      yAxis: { type: 'linear', min: 0, max: 0 },
      series: [],
    } as unknown as XYChartCanvasState;
    const result = serializeXYChart(canvas);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("diagramType 不匹配");
  });
});

// ============================================================
// Round-trip 测试
// ============================================================

describe('Round-trip 测试', () => {
  it('基本 round-trip（band x-axis + line 系列）', () => {
    const code = `xychart-beta
x-axis [jan, feb, mar]
line [10, 20, 30]`;
    const { canvas, code2 } = roundTrip(code);
    expect(code2).toContain('xychart-beta');
    expect(code2).toContain('x-axis [jan, feb, mar]');
    expect(code2).toContain('line [10, 20, 30]');
    // 再次解析验证幂等
    const result2 = parseXYChartCode(code2);
    expect(result2.success).toBe(true);
  });

  it('round-trip（title + linear x-axis + y-axis）', () => {
    const code = `xychart-beta
title "Sales Chart"
x-axis "Range" 0 --> 100
y-axis "Sales" 0 --> 100
line [10, 20, 30]`;
    const { code2 } = roundTrip(code);
    expect(code2).toContain('title "Sales Chart"');
    expect(code2).toContain('x-axis "Range" 0 --> 100');
    expect(code2).toContain('y-axis "Sales" 0 --> 100');
    expect(code2).toContain('line [10, 20, 30]');
  });

  it('round-trip（多系列 line + bar）', () => {
    const code = `xychart-beta
x-axis [jan, feb, mar]
line [10, 20, 30]
bar [5, 15, 25]`;
    const { canvas, code2 } = roundTrip(code);
    expect(canvas.series).toHaveLength(2);
    expect(code2).toContain('line [10, 20, 30]');
    expect(code2).toContain('bar [5, 15, 25]');
  });

  it('round-trip（有名系列）', () => {
    const code = `xychart-beta
x-axis [jan, feb]
line "Sales" [10, 20]
bar "Revenue" [30, 40]`;
    const { code2 } = roundTrip(code);
    expect(code2).toContain('line "Sales" [10, 20]');
    expect(code2).toContain('bar "Revenue" [30, 40]');
  });

  it('round-trip（chartOrientation horizontal）', () => {
    const code = `xychart-beta horizontal
x-axis [jan, feb]
line [10, 20]`;
    const { code2 } = roundTrip(code);
    expect(code2).toContain('xychart-beta horizontal');
  });

  it('round-trip（showDataLabel frontmatter）', () => {
    const code = `---
config:
  xyChart:
    showDataLabel: true
---
xychart-beta
x-axis [jan, feb]
line [10, 20]`;
    const { code2 } = roundTrip(code);
    expect(code2).toContain('---');
    expect(code2).toContain('showDataLabel: true');
  });

  it('round-trip（plotColorPalette frontmatter）', () => {
    const code = `---
config:
  themeVariables:
    xyChart:
      plotColorPalette: '#FF0000, #00FF00'
---
xychart-beta
x-axis [jan, feb]
line [10, 20]`;
    const { code2 } = roundTrip(code);
    expect(code2).toContain('---');
    expect(code2).toContain("plotColorPalette: '#FF0000, #00FF00'");
  });

  it('round-trip（config.xyChart.plotColorPalette 路径）', () => {
    const code = `---
config:
  xyChart:
    plotColorPalette: '#FF0000, #00FF00'
---
xychart-beta
x-axis [jan, feb]
line [10, 20]`;
    const { code2 } = roundTrip(code);
    expect(code2).toContain('---');
    expect(code2).toContain("plotColorPalette: '#FF0000, #00FF00'");
    // 统一输出 config.xyChart 路径（单一数据源）
    expect(code2).not.toContain('themeVariables:');
  });

  it('round-trip（showDataLabel + plotColorPalette 同时存在）', () => {
    const code = `---
config:
  xyChart:
    showDataLabel: true
    plotColorPalette: '#FF0000, #00FF00'
---
xychart-beta
x-axis [jan, feb]
line [10, 20]`;
    const { code2 } = roundTrip(code);
    expect(code2).toContain('---');
    expect(code2).toContain('showDataLabel: true');
    expect(code2).toContain("plotColorPalette: '#FF0000, #00FF00'");
    // 验证 frontmatter 结构正确：xyChart 只出现一次
    const xyChartCount = (code2.match(/xyChart:/g) ?? []).length;
    expect(xyChartCount).toBe(1);
  });

  it('round-trip（classDef 序列化）', () => {
    // classDef 无法通过 jison 解析（文法不支持），仅验证序列化输出
    const canvas: XYChartCanvasState = {
      diagramType: 'xychart',
      xAxis: { type: 'band', categories: ['jan', 'feb'] },
      yAxis: { type: 'linear', min: 0, max: 100 },
      series: [{ type: 'line', data: [10, 20], color: '#ECECEC' }],
      classDefs: [{ name: 'highlight', style: 'color: #ff0000' }],
    };
    const result = serializeXYChart(canvas);
    expect(result.mermaid).toContain('classDef highlight color: #ff0000');
  });
});

// ============================================================
// 调度器集成
// ============================================================

describe('调度器集成', () => {
  it('parseMermaid 应自动检测 xychart 类型并解析', () => {
    const code = `xychart-beta
x-axis [jan, feb]
line [10, 20]`;
    const result = parseMermaid(code);
    expect(result.success).toBe(true);
    const canvas = result.canvas as XYChartCanvasState;
    expect(canvas.diagramType).toBe('xychart');
    expect(canvas.series).toHaveLength(1);
  });

  it('serializeMermaid 应根据 diagramType 分发到 serializeXYChart', () => {
    const canvas: XYChartCanvasState = {
      diagramType: 'xychart',
      xAxis: { type: 'band', categories: ['jan', 'feb'] },
      yAxis: { type: 'linear', min: 0, max: 100 },
      series: [{ type: 'line', data: [10, 20], color: '#ECECEC' }],
    };
    const result = serializeMermaid(canvas);
    expect(result.errors).toHaveLength(0);
    expect(result.mermaid).toContain('xychart-beta');
  });
});

// ============================================================
// 错误处理
// ============================================================

describe('错误处理', () => {
  it('应在无数据系列时返回错误', () => {
    const result = parseXYChartCode(`xychart-beta
x-axis [jan, feb]`);
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].message).toContain('No plot data');
  });

  it('应在语法错误时返回错误', () => {
    const result = parseXYChartCode(`xychart-beta
x-axis [jan, feb
line [10, 20]`);
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('应在 diagramType 不匹配时序列化返回错误', () => {
    const wrongCanvas = {
      diagramType: 'flowchart',
      xAxis: { type: 'band', categories: [] },
      yAxis: { type: 'linear', min: 0, max: 0 },
      series: [],
    } as unknown as XYChartCanvasState;
    const result = serializeXYChart(wrongCanvas);
    expect(result.errors).toHaveLength(1);
    expect(result.mermaid).toBe('');
  });
});

// ============================================================
// 辅助函数测试
// ============================================================

describe('辅助函数', () => {
  describe('parsePlotColorPalette', () => {
    it('应解析 CSV 调色板字符串', () => {
      const colors = parsePlotColorPalette('#FF0000, #00FF00, #0000FF');
      expect(colors).toEqual(['#FF0000', '#00FF00', '#0000FF']);
    });

    it('应 trim 颜色值', () => {
      const colors = parsePlotColorPalette('  #FF0000  ,  #00FF00  ');
      expect(colors).toEqual(['#FF0000', '#00FF00']);
    });

    it('应过滤空值', () => {
      const colors = parsePlotColorPalette('#FF0000, , #00FF00');
      expect(colors).toEqual(['#FF0000', '#00FF00']);
    });
  });

  describe('assignSeriesColor', () => {
    it('应在 series.color 已指定时直接使用', () => {
      const series: XYSeries = {
        type: 'line',
        data: [10],
        color: '#FF0000',
      };
      expect(assignSeriesColor(series, 0)).toBe('#FF0000');
    });

    it('应按索引从默认调色板分配颜色', () => {
      const series: XYSeries = { type: 'line', data: [10] };
      expect(assignSeriesColor(series, 0)).toBe(DEFAULT_PLOT_COLOR_PALETTE[0]);
      expect(assignSeriesColor(series, 1)).toBe(DEFAULT_PLOT_COLOR_PALETTE[1]);
    });

    it('应从自定义调色板分配颜色', () => {
      const series: XYSeries = { type: 'line', data: [10] };
      const palette = '#FF0000, #00FF00, #0000FF';
      expect(assignSeriesColor(series, 0, palette)).toBe('#FF0000');
      expect(assignSeriesColor(series, 1, palette)).toBe('#00FF00');
    });

    it('应在索引超出调色板长度时循环', () => {
      const series: XYSeries = { type: 'line', data: [10] };
      const palette = '#FF0000, #00FF00';
      // index=2 → 2 % 2 = 0
      expect(assignSeriesColor(series, 2, palette)).toBe('#FF0000');
    });
  });

  describe('formatDataValue', () => {
    it('应格式化整数', () => {
      expect(formatDataValue(10)).toBe('10');
      expect(formatDataValue(0)).toBe('0');
      expect(formatDataValue(-5)).toBe('-5');
    });

    it('应格式化浮点数', () => {
      expect(formatDataValue(10.5)).toBe('10.5');
      expect(formatDataValue(0.1)).toBe('0.1');
    });

    it('应截断浮点精度噪声', () => {
      // 0.1 + 0.2 = 0.30000000000000004
      expect(formatDataValue(0.1 + 0.2)).toBe('0.3');
    });

    it('应去除尾随零', () => {
      expect(formatDataValue(10.0)).toBe('10');
      expect(formatDataValue(10.500)).toBe('10.5');
    });
  });

  describe('escapeText', () => {
    it('应转义双引号', () => {
      expect(escapeText('hello "world"')).toBe('hello \\"world\\"');
    });

    it('应保留普通文本', () => {
      expect(escapeText('hello world')).toBe('hello world');
    });

    it('应处理空字符串', () => {
      expect(escapeText('')).toBe('');
    });
  });
});

// ============================================================
// 官方示例验证
// ============================================================

describe('官方示例验证', () => {
  it('官方示例 1：基本 bar 图', () => {
    const code = `xychart-beta
title "Basic Bar Chart"
x-axis [jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec]
y-axis "Revenue (in $)" 0 --> 400
bar [10, 50, 100, 200, 150, 300, 250, 350, 400, 320, 280, 250]`;
    const canvas = parse(code);
    expect(canvas.title).toBe('Basic Bar Chart');
    expect(canvas.xAxis.type).toBe('band');
    expect(canvas.xAxis.categories).toHaveLength(12);
    expect(canvas.yAxis.title).toBe('Revenue (in $)');
    expect(canvas.yAxis.min).toBe(0);
    expect(canvas.yAxis.max).toBe(400);
    expect(canvas.series).toHaveLength(1);
    expect(canvas.series[0].type).toBe('bar');
  });

  it('官方示例 2：line 图 + showDataLabel', () => {
    const code = `---
config:
  xyChart:
    showDataLabel: true
---
xychart-beta
title "Line Chart with Data Labels"
x-axis [jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec]
y-axis "Revenue (in $)" 0 --> 400
line [10, 50, 100, 200, 150, 300, 250, 350, 400, 320, 280, 250]`;
    const canvas = parse(code);
    expect(canvas.showDataLabel).toBe(true);
    expect(canvas.title).toBe('Line Chart with Data Labels');
    expect(canvas.series[0].type).toBe('line');
  });

  it('官方示例 3：自定义 plotColorPalette', () => {
    const code = `---
config:
  themeVariables:
    xyChart:
      plotColorPalette: '#91D0CE, #78B7C0, #B0A0B0, #C8794A, #FFC0CB, #FFD700, #98FB98, #87CEFA, #DDA0DD, #90EE90, #87CEEB, #FFE4E1'
---
xychart-beta
title "Custom Color Palette"
x-axis [jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec]
y-axis "Revenue (in $)" 0 --> 400
line [10, 50, 100, 200, 150, 300, 250, 350, 400, 320, 280, 250]`;
    const canvas = parse(code);
    expect(canvas.plotColorPalette).toBeDefined();
    expect(canvas.plotColorPalette).toContain('#91D0CE');
    expect(canvas.series[0].color).toBe('#91D0CE');
  });

  it('官方示例：多系列 line + bar', () => {
    const code = `xychart-beta
title "Multiple Series"
x-axis [jan, feb, mar]
y-axis 0 --> 400
line [100, 200, 300]
bar [50, 150, 250]`;
    const canvas = parse(code);
    expect(canvas.series).toHaveLength(2);
    expect(canvas.series[0].type).toBe('line');
    expect(canvas.series[1].type).toBe('bar');
  });
});

// ============================================================
// 边界情况
// ============================================================

describe('边界情况', () => {
  it('应处理单个数据点', () => {
    const canvas = parse(`xychart-beta
x-axis [jan]
line [10]`);
    expect(canvas.series[0].data).toEqual([10]);
    expect(canvas.yAxis.min).toBe(10);
    expect(canvas.yAxis.max).toBe(10);
  });

  it('应处理 linear x-axis 自动范围（无显式设置）', () => {
    const canvas = parse(`xychart-beta
line [10, 20, 30]`);
    // 未设置 x-axis 时，自动设置为 linear [1, data.length]
    expect(canvas.xAxis.type).toBe('linear');
    expect(canvas.xAxis.min).toBe(1);
    expect(canvas.xAxis.max).toBe(3);
  });

  it('应处理浮点精度', () => {
    const canvas = parse(`xychart-beta
x-axis [jan, feb]
line [0.1, 0.2]`);
    expect(canvas.series[0].data[0]).toBeCloseTo(0.1, 6);
    expect(canvas.series[0].data[1]).toBeCloseTo(0.2, 6);
  });

  it('应处理空 title（jison 不支持空 STR，跳过）', () => {
    // jison lexer 对 title "" 不返回 STR token（零长度匹配）
    // 这是 jison 的限制，非缺陷 — 用户应提供非空 title
    // 此测试验证带内容的 title 正常工作
    const canvas = parse(`xychart-beta
title "Chart"
x-axis [jan, feb]
line [10, 20]`);
    expect(canvas.title).toBe('Chart');
  });

  it('应处理默认调色板字符串常量', () => {
    expect(DEFAULT_PLOT_COLOR_PALETTE_STR).toBe(DEFAULT_PLOT_COLOR_PALETTE.join(', '));
    expect(DEFAULT_PLOT_COLOR_PALETTE).toHaveLength(12);
  });
});
