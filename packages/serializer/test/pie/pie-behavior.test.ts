/**
 * pie 行为验证测试 — M9
 *
 * 验证 pie 解析器、序列化器的行为符合官方 mermaid pie 标准
 * 覆盖：官方语法、showData/title/accTitle/accDescription、slices、负值校验、重复 label、label 转义、round-trip、边界
 *
 * 测试策略：行为验证（不测试实现细节，只测试接口和行为）
 */

import { describe, it, expect } from 'vitest';
import { parsePieCode } from '../../src/parser/handwritten/pie-parser-impl.js';
import { serializePie } from '../../src/serializer/pie-serializer.js';
import { parseMermaid } from '../../src/parse-dispatcher.js';
import { serializeMermaid } from '../../src/serialize-dispatcher.js';
import { escapePieLabel, unescapePieLabel, calculatePercentage } from '../../src/serializer/shared/pie-helpers.js';
import type { PieCanvasState } from '../../src/types.js';

// ============================================================
// 辅助函数
// ============================================================

/** 解析代码并返回 PieCanvasState（断言成功） */
function parse(code: string): PieCanvasState {
  const result = parsePieCode(code);
  if (!result.success) {
    throw new Error(`解析失败: ${result.errors.map((e) => e.message).join(', ')}`);
  }
  return result.canvas as PieCanvasState;
}

/** round-trip: 代码 → 解析 → 序列化 → 代码 */
function roundTrip(code: string): { canvas: PieCanvasState; code2: string } {
  const parsed = parsePieCode(code);
  if (!parsed.success) {
    throw new Error(`解析失败: ${parsed.errors.map((e) => e.message).join(', ')}`);
  }
  const serialized = serializePie(parsed.canvas as PieCanvasState);
  if (serialized.errors.length > 0) {
    throw new Error(`序列化失败: ${serialized.errors.map((e) => e.message).join(', ')}`);
  }
  return {
    canvas: parsed.canvas as PieCanvasState,
    code2: serialized.mermaid,
  };
}

// ============================================================
// 基本解析
// ============================================================

describe('基本解析', () => {
  it('应解析空 pie（仅 pie 关键字）', () => {
    const canvas = parse('pie');
    expect(canvas.diagramType).toBe('pie');
    expect(canvas.slices).toHaveLength(0);
  });

  it('应解析 showData', () => {
    const canvas = parse('pie showData');
    expect(canvas.showData).toBe(true);
  });

  it('应解析 title', () => {
    const canvas = parse('pie\ntitle My Pie Chart');
    expect(canvas.title).toBe('My Pie Chart');
  });

  it('应解析 accTitle', () => {
    const canvas = parse('pie\naccTitle My Accessibility Title');
    expect(canvas.accTitle).toBe('My Accessibility Title');
  });

  it('应解析 accDescription', () => {
    const canvas = parse('pie\naccDescription This is a pie chart');
    expect(canvas.accDescription).toBe('This is a pie chart');
  });

  it('应解析完整配置（showData + title + accTitle + accDescription）', () => {
    const canvas = parse('pie showData\ntitle Test\naccTitle Acc\naccDescription Desc');
    expect(canvas.showData).toBe(true);
    expect(canvas.title).toBe('Test');
    expect(canvas.accTitle).toBe('Acc');
    expect(canvas.accDescription).toBe('Desc');
  });
});

// ============================================================
// 切片解析
// ============================================================

describe('切片解析', () => {
  it('应解析单个切片', () => {
    const canvas = parse('pie\n"Apple" : 30');
    expect(canvas.slices).toHaveLength(1);
    expect(canvas.slices[0].label).toBe('Apple');
    expect(canvas.slices[0].value).toBe(30);
  });

  it('应解析多个切片', () => {
    const canvas = parse('pie\n"Apple" : 30\n"Banana" : 20\n"Cherry" : 50');
    expect(canvas.slices).toHaveLength(3);
    expect(canvas.slices[0]).toEqual({ label: 'Apple', value: 30 });
    expect(canvas.slices[1]).toEqual({ label: 'Banana', value: 20 });
    expect(canvas.slices[2]).toEqual({ label: 'Cherry', value: 50 });
  });

  it('应解析浮点数值', () => {
    const canvas = parse('pie\n"Slice" : 12.5');
    expect(canvas.slices[0].value).toBe(12.5);
  });

  it('应解析零值切片', () => {
    const canvas = parse('pie\n"Zero" : 0');
    expect(canvas.slices[0].value).toBe(0);
  });

  it('应解析带空格的 label', () => {
    const canvas = parse('pie\n"Apple Pie" : 30');
    expect(canvas.slices[0].label).toBe('Apple Pie');
  });
});

// ============================================================
// 错误处理
// ============================================================

describe('错误处理', () => {
  it('负值应记录错误并跳过切片', () => {
    const result = parsePieCode('pie\n"Negative" : -5\n"Positive" : 10');
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.message.includes('Negative value'))).toBe(true);
    const canvas = result.canvas as PieCanvasState;
    expect(canvas.slices).toHaveLength(1);
    expect(canvas.slices[0].label).toBe('Positive');
  });

  it('重复 label 应记录警告并静默忽略', () => {
    const result = parsePieCode('pie\n"Apple" : 30\n"Apple" : 20');
    // 重复 label 是 warning，不是 error，所以 success 应为 true
    expect(result.success).toBe(true);
    expect(result.errors.some((e) => e.severity === 'warning' && e.message.includes('Duplicate'))).toBe(true);
    const canvas = result.canvas as PieCanvasState;
    expect(canvas.slices).toHaveLength(1);
    expect(canvas.slices[0].value).toBe(30);
  });

  it('缺少 pie 关键字应报错', () => {
    const result = parsePieCode('"Apple" : 30');
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.message.includes('Expected "pie"'))).toBe(true);
  });

  it('缺少冒号应报错', () => {
    const result = parsePieCode('pie\n"Apple" 30');
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.message.includes('Expected ":"'))).toBe(true);
  });
});

// ============================================================
// 序列化
// ============================================================

describe('序列化', () => {
  it('应序列化空 pie', () => {
    const canvas: PieCanvasState = { diagramType: 'pie', slices: [] };
    const result = serializePie(canvas);
    expect(result.mermaid).toBe('pie');
    expect(result.errors).toHaveLength(0);
  });

  it('应序列化 showData', () => {
    const canvas: PieCanvasState = { diagramType: 'pie', slices: [], showData: true };
    const result = serializePie(canvas);
    expect(result.mermaid).toBe('pie showData');
  });

  it('应序列化 title', () => {
    const canvas: PieCanvasState = {
      diagramType: 'pie',
      slices: [],
      title: 'My Chart',
    };
    const result = serializePie(canvas);
    expect(result.mermaid).toBe('pie\ntitle My Chart');
  });

  it('应序列化 accTitle 和 accDescription', () => {
    const canvas: PieCanvasState = {
      diagramType: 'pie',
      slices: [],
      accTitle: 'Acc Title',
      accDescription: 'Acc Desc',
    };
    const result = serializePie(canvas);
    expect(result.mermaid).toBe('pie\naccTitle Acc Title\naccDescription Acc Desc');
  });

  it('应序列化切片', () => {
    const canvas: PieCanvasState = {
      diagramType: 'pie',
      slices: [
        { label: 'Apple', value: 30 },
        { label: 'Banana', value: 20 },
      ],
    };
    const result = serializePie(canvas);
    expect(result.mermaid).toBe('pie\n"Apple" : 30\n"Banana" : 20');
  });

  it('应序列化完整配置', () => {
    const canvas: PieCanvasState = {
      diagramType: 'pie',
      showData: true,
      title: 'Test',
      accTitle: 'AccT',
      accDescription: 'AccD',
      slices: [{ label: 'X', value: 10 }],
    };
    const result = serializePie(canvas);
    expect(result.mermaid).toBe('pie showData\ntitle Test\naccTitle AccT\naccDescription AccD\n"X" : 10');
  });

  it('应序列化浮点数值', () => {
    const canvas: PieCanvasState = {
      diagramType: 'pie',
      slices: [{ label: 'X', value: 12.5 }],
    };
    const result = serializePie(canvas);
    expect(result.mermaid).toBe('pie\n"X" : 12.5');
  });

  it('类型不匹配应报错', () => {
    const canvas = { diagramType: 'gantt', slices: [] } as unknown as PieCanvasState;
    const result = serializePie(canvas);
    expect(result.mermaid).toBe('');
    expect(result.errors.some((e) => e.message.includes("diagramType 不匹配"))).toBe(true);
  });
});

// ============================================================
// Round-trip
// ============================================================

describe('Round-trip', () => {
  it('空 pie round-trip', () => {
    const { code2 } = roundTrip('pie');
    expect(code2).toBe('pie');
  });

  it('showData round-trip', () => {
    const { code2 } = roundTrip('pie showData');
    expect(code2).toBe('pie showData');
  });

  it('完整配置 round-trip', () => {
    const code = 'pie showData\ntitle Test\naccTitle AccT\naccDescription AccD\n"Apple" : 30\n"Banana" : 20';
    const { code2 } = roundTrip(code);
    // 序列化器输出分行格式（pie showData\ntitle...），与输入一致
    expect(code2).toBe(code);
  });

  it('多切片 round-trip', () => {
    const code = 'pie\n"Apple" : 30\n"Banana" : 20\n"Cherry" : 50';
    const { code2 } = roundTrip(code);
    expect(code2).toBe(code);
  });

  it('浮点值 round-trip', () => {
    const code = 'pie\n"Slice" : 12.5';
    const { code2 } = roundTrip(code);
    expect(code2).toBe(code);
  });
});

// ============================================================
// Dispatcher 集成
// ============================================================

describe('Dispatcher 集成', () => {
  it('parseMermaid 应分发到 parsePieCode', () => {
    const result = parseMermaid('pie\n"Apple" : 30');
    expect(result.success).toBe(true);
    const canvas = result.canvas as PieCanvasState;
    expect(canvas.diagramType).toBe('pie');
    expect(canvas.slices).toHaveLength(1);
    expect(canvas.slices[0].label).toBe('Apple');
  });

  it('serializeMermaid 应分发到 serializePie', () => {
    const canvas: PieCanvasState = {
      diagramType: 'pie',
      slices: [{ label: 'Apple', value: 30 }],
    };
    const result = serializeMermaid(canvas);
    expect(result.mermaid).toBe('pie\n"Apple" : 30');
    expect(result.errors).toHaveLength(0);
  });
});

// ============================================================
// pie-helpers 工具函数
// ============================================================

describe('pie-helpers 工具函数', () => {
  it('escapePieLabel 应转义并用双引号包裹', () => {
    expect(escapePieLabel('Apple')).toBe('"Apple"');
    expect(escapePieLabel('Say "Hello"')).toBe('"Say \\"Hello\\""');
    expect(escapePieLabel('Back\\slash')).toBe('"Back\\\\slash"');
  });

  it('unescapePieLabel 应去除双引号并反转义', () => {
    expect(unescapePieLabel('"Apple"')).toBe('Apple');
    expect(unescapePieLabel('"Say \\"Hello\\""')).toBe('Say "Hello"');
    expect(unescapePieLabel('"Back\\\\slash"')).toBe('Back\\slash');
  });

  it('unescapePieLabel 无双引号时应原样返回', () => {
    expect(unescapePieLabel('Apple')).toBe('Apple');
  });

  it('calculatePercentage 应计算百分比', () => {
    expect(calculatePercentage(30, 100)).toBe(30);
    expect(calculatePercentage(25, 100)).toBe(25);
    expect(calculatePercentage(0, 100)).toBe(0);
  });

  it('calculatePercentage total 为 0 时应返回 0', () => {
    expect(calculatePercentage(30, 0)).toBe(0);
    expect(calculatePercentage(30, -1)).toBe(0);
  });
});

// ============================================================
// 编辑操作（通过 CanvasState 修改后序列化）
// ============================================================

describe('编辑操作', () => {
  it('添加切片后序列化应包含新切片', () => {
    const canvas: PieCanvasState = {
      diagramType: 'pie',
      slices: [{ label: 'A', value: 10 }],
    };
    const updated: PieCanvasState = {
      ...canvas,
      slices: [...canvas.slices, { label: 'B', value: 20 }],
    };
    const result = serializePie(updated);
    expect(result.mermaid).toBe('pie\n"A" : 10\n"B" : 20');
  });

  it('删除切片后序列化应不包含该切片', () => {
    const canvas: PieCanvasState = {
      diagramType: 'pie',
      slices: [
        { label: 'A', value: 10 },
        { label: 'B', value: 20 },
      ],
    };
    const updated: PieCanvasState = {
      ...canvas,
      slices: canvas.slices.filter((s) => s.label !== 'A'),
    };
    const result = serializePie(updated);
    expect(result.mermaid).toBe('pie\n"B" : 20');
  });

  it('修改切片值后序列化应反映新值', () => {
    const canvas: PieCanvasState = {
      diagramType: 'pie',
      slices: [{ label: 'A', value: 10 }],
    };
    const updated: PieCanvasState = {
      ...canvas,
      slices: [{ label: 'A', value: 50 }],
    };
    const result = serializePie(updated);
    expect(result.mermaid).toBe('pie\n"A" : 50');
  });

  it('切换 showData 后序列化应反映新状态', () => {
    const canvas: PieCanvasState = {
      diagramType: 'pie',
      slices: [{ label: 'A', value: 10 }],
      showData: false,
    };
    const updated: PieCanvasState = { ...canvas, showData: true };
    const result = serializePie(updated);
    expect(result.mermaid).toBe('pie showData\n"A" : 10');
  });
});

// ============================================================
// 官方示例
// ============================================================

describe('官方示例', () => {
  it('示例 1: 基本饼图', () => {
    // 官方示例输入：title 与 pie 同行
    const code = 'pie title Pets adopted by volunteers\n"Dogs" : 386\n"Cats" : 85\n"Rats" : 15';
    const { canvas, code2 } = roundTrip(code);
    expect(canvas.title).toBe('Pets adopted by volunteers');
    expect(canvas.slices).toHaveLength(3);
    expect(canvas.slices[0]).toEqual({ label: 'Dogs', value: 386 });
    expect(canvas.slices[1]).toEqual({ label: 'Cats', value: 85 });
    expect(canvas.slices[2]).toEqual({ label: 'Rats', value: 15 });
    // 序列化器输出分行格式（pie\ntitle...），语义与输入一致
    expect(code2).toBe('pie\ntitle Pets adopted by volunteers\n"Dogs" : 386\n"Cats" : 85\n"Rats" : 15');
  });

  it('示例 2: showData 饼图', () => {
    const code = 'pie showData\n"Apple" : 30\n"Banana" : 20\n"Cherry" : 50';
    const { canvas, code2 } = roundTrip(code);
    expect(canvas.showData).toBe(true);
    expect(canvas.slices).toHaveLength(3);
    expect(code2).toBe(code);
  });
});
