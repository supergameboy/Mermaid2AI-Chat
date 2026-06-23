/**
 * gantt 行为验证测试 — M8
 *
 * 验证 gantt 解析器、序列化器的行为符合官方 mermaid gantt 标准
 * 覆盖：官方语法、dateFormat/section/task、tags 多标签、dependencies 多依赖、click URL、round-trip、边界
 *
 * 测试策略：行为验证（不测试实现细节，只测试接口和行为）
 *
 * v4 根因修复:
 *   - tags/dependencies 统一使用数组（移除 status/afterId）
 *   - clickUrl 从 GanttTask.clickUrl 读取（单一数据源）
 *   - dateFormat 必填
 *   - weekday 收窄为 'sunday' | 'monday'
 */

import { describe, it, expect } from 'vitest';
import { parseGanttCode } from '../../src/parser/gantt-parser.js';
import { serializeGantt } from '../../src/serializer/gantt-serializer.js';
import type { GanttCanvasState } from '../../src/types.js';

// ============================================================
// 辅助函数
// ============================================================

/** 解析代码并返回 GanttCanvasState（断言成功） */
function parse(code: string): GanttCanvasState {
  const result = parseGanttCode(code);
  if (!result.success) {
    throw new Error(`解析失败: ${result.errors.map((e) => e.message).join(', ')}`);
  }
  return result.canvas as GanttCanvasState;
}

/** round-trip: 代码 → 解析 → 序列化 → 代码 */
function roundTrip(code: string): { canvas: GanttCanvasState; code2: string } {
  const parsed = parseGanttCode(code);
  if (!parsed.success) {
    throw new Error(`解析失败: ${parsed.errors.map((e) => e.message).join(', ')}`);
  }
  const serialized = serializeGantt(parsed.canvas as GanttCanvasState);
  if (serialized.errors.length > 0) {
    throw new Error(`序列化失败: ${serialized.errors.map((e) => e.message).join(', ')}`);
  }
  return {
    canvas: parsed.canvas as GanttCanvasState,
    code2: serialized.mermaid,
  };
}

// ============================================================
// 基本解析
// ============================================================

describe('基本解析', () => {
  it('应解析空 gantt（仅 dateFormat）', () => {
    const canvas = parse('gantt\ndateFormat YYYY-MM-DD');
    expect(canvas.diagramType).toBe('gantt');
    expect(canvas.dateFormat).toBe('YYYY-MM-DD');
    expect(canvas.sections).toHaveLength(0);
  });

  it('应解析 title', () => {
    const canvas = parse('gantt\ntitle A Gantt Diagram\ndateFormat YYYY-MM-DD');
    expect(canvas.title).toBe('A Gantt Diagram');
  });

  it('应解析 accTitle 和 accDescription', () => {
    const canvas = parse('gantt\naccTitle: My Gantt\naccDescription This is a gantt\ndateFormat YYYY-MM-DD');
    expect(canvas.accTitle).toBe('My Gantt');
    expect(canvas.accDescription).toBe('This is a gantt');
  });

  it('应解析 axisFormat', () => {
    const canvas = parse('gantt\ndateFormat YYYY-MM-DD\naxisFormat %m/%d');
    expect(canvas.axisFormat).toBe('%m/%d');
  });

  it('应解析 tickInterval', () => {
    const canvas = parse('gantt\ndateFormat YYYY-MM-DD\ntickInterval 1week');
    expect(canvas.tickInterval).toBe('1week');
  });

  it('应解析 todayMarker', () => {
    const canvas = parse('gantt\ndateFormat YYYY-MM-DD\ntodayMarker stroke:#f00');
    expect(canvas.todayMarker).toBe('stroke:#f00');
  });

  it('应解析 excludes', () => {
    const canvas = parse('gantt\ndateFormat YYYY-MM-DD\nexcludes weekends, monday');
    expect(canvas.excludes).toEqual(['weekends', 'monday']);
  });

  it('应解析 includes', () => {
    const canvas = parse('gantt\ndateFormat YYYY-MM-DD\nincludes 2024-01-15');
    expect(canvas.includes).toEqual(['2024-01-15']);
  });

  it('应解析 weekday monday', () => {
    const canvas = parse('gantt\ndateFormat YYYY-MM-DD\nweekday monday');
    expect(canvas.weekday).toBe('monday');
  });

  it('应解析 weekend friday', () => {
    const canvas = parse('gantt\ndateFormat YYYY-MM-DD\nweekend friday');
    expect(canvas.weekend).toBe('friday');
  });

  it('应解析 inclusiveEndDates', () => {
    const canvas = parse('gantt\ndateFormat YYYY-MM-DD\ninclusiveEndDates');
    expect(canvas.inclusiveEndDates).toBe(true);
  });

  it('应解析 topAxis', () => {
    const canvas = parse('gantt\ndateFormat YYYY-MM-DD\ntopAxis');
    expect(canvas.topAxis).toBe(true);
  });

  it('应解析 displayMode compact', () => {
    const canvas = parse('gantt\ndateFormat YYYY-MM-DD\ndisplayMode compact');
    expect(canvas.displayMode).toBe('compact');
  });
});

// ============================================================
// section 和 task 解析
// ============================================================

describe('section 和 task 解析', () => {
  it('应解析 section 和 task', () => {
    const canvas = parse('gantt\ndateFormat YYYY-MM-DD\nsection Section1\nTask1 :a1, 2024-01-01, 7d');
    expect(canvas.sections).toHaveLength(1);
    expect(canvas.sections[0]?.name).toBe('Section1');
    expect(canvas.sections[0]?.tasks).toHaveLength(1);
    expect(canvas.sections[0]?.tasks[0]?.label).toBe('Task1');
    expect(canvas.sections[0]?.tasks[0]?.id).toBe('a1');
    expect(canvas.sections[0]?.tasks[0]?.startDate).toBe('2024-01-01');
    expect(canvas.sections[0]?.tasks[0]?.duration).toBe('7d');
  });

  it('应解析多个 section', () => {
    const canvas = parse(`gantt
dateFormat YYYY-MM-DD
section Section1
Task1 :a1, 2024-01-01, 7d
section Section2
Task2 :a2, 2024-01-08, 5d`);
    expect(canvas.sections).toHaveLength(2);
    expect(canvas.sections[0]?.name).toBe('Section1');
    expect(canvas.sections[1]?.name).toBe('Section2');
  });

  it('应解析无 id 的 task（自动生成 id）', () => {
    const canvas = parse('gantt\ndateFormat YYYY-MM-DD\nsection Section1\nTask1 :2024-01-01, 7d');
    expect(canvas.sections[0]?.tasks[0]?.label).toBe('Task1');
    expect(canvas.sections[0]?.tasks[0]?.startDate).toBe('2024-01-01');
    expect(canvas.sections[0]?.tasks[0]?.duration).toBe('7d');
  });

  it('应解析只有 duration 的 task（prevTaskEnd）', () => {
    const canvas = parse('gantt\ndateFormat YYYY-MM-DD\nsection Section1\nTask1 :a1, 2024-01-01, 7d\nTask2 :5d');
    expect(canvas.sections[0]?.tasks).toHaveLength(2);
    expect(canvas.sections[0]?.tasks[1]?.label).toBe('Task2');
    expect(canvas.sections[0]?.tasks[1]?.duration).toBe('5d');
  });
});

// ============================================================
// tags 多标签组合（v4 根因修复）
// ============================================================

describe('tags 多标签组合', () => {
  it('应解析单标签 done', () => {
    const canvas = parse('gantt\ndateFormat YYYY-MM-DD\nsection Section1\nTask1 :done, a1, 2024-01-01, 7d');
    expect(canvas.sections[0]?.tasks[0]?.tags).toEqual(['done']);
  });

  it('应解析多标签 done, crit', () => {
    const canvas = parse('gantt\ndateFormat YYYY-MM-DD\nsection Section1\nTask1 :done, crit, a1, 2024-01-01, 7d');
    expect(canvas.sections[0]?.tasks[0]?.tags).toEqual(['done', 'crit']);
  });

  it('应解析 milestone 标签', () => {
    const canvas = parse('gantt\ndateFormat YYYY-MM-DD\nsection Section1\nTask1 :milestone, a1, 2024-01-01, 0d');
    expect(canvas.sections[0]?.tasks[0]?.tags).toEqual(['milestone']);
  });

  it('应解析 active 标签', () => {
    const canvas = parse('gantt\ndateFormat YYYY-MM-DD\nsection Section1\nTask1 :active, a1, 2024-01-01, 7d');
    expect(canvas.sections[0]?.tasks[0]?.tags).toEqual(['active']);
  });
});

// ============================================================
// dependencies 多依赖（v4 根因修复）
// ============================================================

describe('dependencies 多依赖', () => {
  it('应解析单依赖 after t1', () => {
    const canvas = parse('gantt\ndateFormat YYYY-MM-DD\nsection Section1\nTask1 :a1, 2024-01-01, 7d\nTask2 :active, a2, after a1, 5d');
    expect(canvas.sections[0]?.tasks[1]?.dependencies).toEqual(['a1']);
  });

  it('应解析多依赖 after t1 t2', () => {
    const canvas = parse('gantt\ndateFormat YYYY-MM-DD\nsection Section1\nTask1 :a1, 2024-01-01, 7d\nTask2 :a2, 2024-01-01, 7d\nTask3 :active, a3, after a1 a2, 5d');
    expect(canvas.sections[0]?.tasks[2]?.dependencies).toEqual(['a1', 'a2']);
  });
});

// ============================================================
// click URL（v4 根因修复）
// ============================================================

describe('click URL', () => {
  it('应解析 click href', () => {
    const canvas = parse('gantt\ndateFormat YYYY-MM-DD\nsection Section1\nTask1 :a1, 2024-01-01, 7d\nclick a1 href "https://example.com"');
    expect(canvas.sections[0]?.tasks[0]?.clickUrl).toBe('https://example.com');
  });

  it('应解析多个 click href', () => {
    const canvas = parse('gantt\ndateFormat YYYY-MM-DD\nsection Section1\nTask1 :a1, 2024-01-01, 7d\nTask2 :a2, 2024-01-01, 7d\nclick a1 href "https://example.com"\nclick a2 href "https://test.com"');
    expect(canvas.sections[0]?.tasks[0]?.clickUrl).toBe('https://example.com');
    expect(canvas.sections[0]?.tasks[1]?.clickUrl).toBe('https://test.com');
  });
});

// ============================================================
// 序列化
// ============================================================

describe('序列化', () => {
  it('应序列化空 gantt', () => {
    const canvas: GanttCanvasState = {
      diagramType: 'gantt',
      dateFormat: 'YYYY-MM-DD',
      sections: [],
    };
    const result = serializeGantt(canvas);
    expect(result.errors).toHaveLength(0);
    expect(result.mermaid).toContain('gantt');
    expect(result.mermaid).toContain('dateFormat YYYY-MM-DD');
  });

  it('应序列化 title', () => {
    const canvas: GanttCanvasState = {
      diagramType: 'gantt',
      title: 'My Gantt',
      dateFormat: 'YYYY-MM-DD',
      sections: [],
    };
    const result = serializeGantt(canvas);
    expect(result.mermaid).toContain('title My Gantt');
  });

  it('应序列化 section 和 task', () => {
    const canvas: GanttCanvasState = {
      diagramType: 'gantt',
      dateFormat: 'YYYY-MM-DD',
      sections: [{
        name: 'Section1',
        tasks: [{
          id: 'a1',
          label: 'Task1',
          startDate: '2024-01-01',
          duration: '7d',
        }],
      }],
    };
    const result = serializeGantt(canvas);
    expect(result.mermaid).toContain('section Section1');
    expect(result.mermaid).toContain('Task1 :a1, 2024-01-01, 7d');
  });

  it('应序列化 tags 多标签', () => {
    const canvas: GanttCanvasState = {
      diagramType: 'gantt',
      dateFormat: 'YYYY-MM-DD',
      sections: [{
        name: 'Section1',
        tasks: [{
          id: 'a1',
          label: 'Task1',
          tags: ['done', 'crit'],
          startDate: '2024-01-01',
          duration: '7d',
        }],
      }],
    };
    const result = serializeGantt(canvas);
    expect(result.mermaid).toContain('Task1 :done, crit, a1, 2024-01-01, 7d');
  });

  it('应序列化 dependencies 多依赖', () => {
    const canvas: GanttCanvasState = {
      diagramType: 'gantt',
      dateFormat: 'YYYY-MM-DD',
      sections: [{
        name: 'Section1',
        tasks: [{
          id: 'a3',
          label: 'Task3',
          tags: ['active'],
          dependencies: ['a1', 'a2'],
          duration: '5d',
        }],
      }],
    };
    const result = serializeGantt(canvas);
    expect(result.mermaid).toContain('Task3 :active, a3, after a1 a2, 5d');
  });

  it('应序列化 click URL', () => {
    const canvas: GanttCanvasState = {
      diagramType: 'gantt',
      dateFormat: 'YYYY-MM-DD',
      sections: [{
        name: 'Section1',
        tasks: [{
          id: 'a1',
          label: 'Task1',
          startDate: '2024-01-01',
          duration: '7d',
          clickUrl: 'https://example.com',
        }],
      }],
    };
    const result = serializeGantt(canvas);
    expect(result.mermaid).toContain('click a1 href "https://example.com"');
  });

  it('应序列化 excludes/includes', () => {
    const canvas: GanttCanvasState = {
      diagramType: 'gantt',
      dateFormat: 'YYYY-MM-DD',
      excludes: ['weekends', 'monday'],
      includes: ['2024-01-15'],
      sections: [],
    };
    const result = serializeGantt(canvas);
    expect(result.mermaid).toContain('excludes weekends, monday');
    expect(result.mermaid).toContain('includes 2024-01-15');
  });

  it('应序列化 weekday/weekend（非默认值）', () => {
    const canvas: GanttCanvasState = {
      diagramType: 'gantt',
      dateFormat: 'YYYY-MM-DD',
      weekday: 'monday',
      weekend: 'friday',
      sections: [],
    };
    const result = serializeGantt(canvas);
    expect(result.mermaid).toContain('weekday monday');
    expect(result.mermaid).toContain('weekend friday');
  });

  it('不应序列化 weekday/weekend（默认值）', () => {
    const canvas: GanttCanvasState = {
      diagramType: 'gantt',
      dateFormat: 'YYYY-MM-DD',
      weekday: 'sunday',
      weekend: 'saturday',
      sections: [],
    };
    const result = serializeGantt(canvas);
    expect(result.mermaid).not.toContain('weekday');
    expect(result.mermaid).not.toContain('weekend');
  });

  it('应序列化 inclusiveEndDates/topAxis/displayMode', () => {
    const canvas: GanttCanvasState = {
      diagramType: 'gantt',
      dateFormat: 'YYYY-MM-DD',
      inclusiveEndDates: true,
      topAxis: true,
      displayMode: 'compact',
      sections: [],
    };
    const result = serializeGantt(canvas);
    expect(result.mermaid).toContain('inclusiveEndDates');
    expect(result.mermaid).toContain('topAxis');
    expect(result.mermaid).toContain('displayMode compact');
  });

  it('应在 dateFormat 缺失时报错', () => {
    const canvas: GanttCanvasState = {
      diagramType: 'gantt',
      dateFormat: '',
      sections: [],
    };
    const result = serializeGantt(canvas);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]?.message).toContain('dateFormat is required');
  });
});

// ============================================================
// round-trip 一致性
// ============================================================

describe('round-trip 一致性', () => {
  it('空 gantt round-trip', () => {
    const { code2 } = roundTrip('gantt\ndateFormat YYYY-MM-DD');
    expect(code2).toContain('gantt');
    expect(code2).toContain('dateFormat YYYY-MM-DD');
  });

  it('带 title 的 round-trip', () => {
    const { code2 } = roundTrip('gantt\ntitle My Gantt\ndateFormat YYYY-MM-DD');
    expect(code2).toContain('title My Gantt');
  });

  it('带 section 和 task 的 round-trip', () => {
    const { code2 } = roundTrip('gantt\ndateFormat YYYY-MM-DD\nsection Section1\nTask1 :a1, 2024-01-01, 7d');
    expect(code2).toContain('section Section1');
    expect(code2).toContain('Task1 :a1, 2024-01-01, 7d');
  });

  it('tags 多标签 round-trip', () => {
    const { code2 } = roundTrip('gantt\ndateFormat YYYY-MM-DD\nsection Section1\nTask1 :done, crit, a1, 2024-01-01, 7d');
    expect(code2).toContain('Task1 :done, crit, a1, 2024-01-01, 7d');
  });

  it('dependencies 多依赖 round-trip', () => {
    const { code2 } = roundTrip('gantt\ndateFormat YYYY-MM-DD\nsection Section1\nTask1 :a1, 2024-01-01, 7d\nTask2 :a2, 2024-01-01, 7d\nTask3 :active, a3, after a1 a2, 5d');
    expect(code2).toContain('Task3 :active, a3, after a1 a2, 5d');
  });

  it('click URL round-trip', () => {
    const { code2 } = roundTrip('gantt\ndateFormat YYYY-MM-DD\nsection Section1\nTask1 :a1, 2024-01-01, 7d\nclick a1 href "https://example.com"');
    expect(code2).toContain('click a1 href "https://example.com"');
  });

  it('excludes/includes round-trip', () => {
    const { code2 } = roundTrip('gantt\ndateFormat YYYY-MM-DD\nexcludes weekends, monday\nincludes 2024-01-15');
    expect(code2).toContain('excludes weekends, monday');
    expect(code2).toContain('includes 2024-01-15');
  });

  it('weekday/weekend round-trip', () => {
    const { code2 } = roundTrip('gantt\ndateFormat YYYY-MM-DD\nweekday monday\nweekend friday');
    expect(code2).toContain('weekday monday');
    expect(code2).toContain('weekend friday');
  });

  it('完整配置 round-trip', () => {
    const code = `gantt
title My Gantt
dateFormat YYYY-MM-DD
axisFormat %m/%d
tickInterval 1week
excludes weekends
todayMarker stroke:#f00
weekday monday
weekend friday
inclusiveEndDates
topAxis
displayMode compact
section Section1
Task1 :done, crit, a1, 2024-01-01, 7d
click a1 href "https://example.com"`;
    const { code2 } = roundTrip(code);
    expect(code2).toContain('title My Gantt');
    expect(code2).toContain('dateFormat YYYY-MM-DD');
    expect(code2).toContain('axisFormat %m/%d');
    expect(code2).toContain('tickInterval 1week');
    expect(code2).toContain('excludes weekends');
    expect(code2).toContain('todayMarker stroke:#f00');
    expect(code2).toContain('weekday monday');
    expect(code2).toContain('weekend friday');
    expect(code2).toContain('inclusiveEndDates');
    expect(code2).toContain('topAxis');
    expect(code2).toContain('displayMode compact');
    expect(code2).toContain('section Section1');
    expect(code2).toContain('Task1 :done, crit, a1, 2024-01-01, 7d');
    expect(code2).toContain('click a1 href "https://example.com"');
  });
});

// ============================================================
// 边界处理
// ============================================================

describe('边界处理', () => {
  it('dateFormat 缺失时应报错', () => {
    const result = parseGanttCode('gantt\nsection Section1\nTask1 :a1, 2024-01-01, 7d');
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.message.includes('dateFormat'))).toBe(true);
  });

  it('无效 weekday 应报错', () => {
    const result = parseGanttCode('gantt\ndateFormat YYYY-MM-DD\nweekday tuesday');
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.message.includes('weekday'))).toBe(true);
  });

  it('无效 displayMode 应报错', () => {
    const result = parseGanttCode('gantt\ndateFormat YYYY-MM-DD\ndisplayMode invalid');
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.message.includes('displayMode'))).toBe(true);
  });

  it('无效日期应报错', () => {
    const result = parseGanttCode('gantt\ndateFormat YYYY-MM-DD\nsection Section1\nTask1 :a1, invalid-date, 7d');
    expect(result.errors.some((e) => e.message.includes('Invalid date'))).toBe(true);
  });
});

// ============================================================
// 官方示例验证
// ============================================================

describe('官方示例验证', () => {
  it('应解析官方基本示例', () => {
    const code = `gantt
    title A Gantt Diagram
    dateFormat YYYY-MM-DD
    section Section
    A task           :a1, 2014-01-01, 30d
    Another task     :after a1, 20d
    section Another
    Task in sec      :2014-01-12, 12d
    another task     :24d`;
    const canvas = parse(code);
    expect(canvas.title).toBe('A Gantt Diagram');
    expect(canvas.dateFormat).toBe('YYYY-MM-DD');
    expect(canvas.sections).toHaveLength(2);
    expect(canvas.sections[0]?.name).toBe('Section');
    expect(canvas.sections[0]?.tasks).toHaveLength(2);
    expect(canvas.sections[1]?.name).toBe('Another');
    expect(canvas.sections[1]?.tasks).toHaveLength(2);
  });

  it('官方基本示例 round-trip', () => {
    const code = `gantt
    title A Gantt Diagram
    dateFormat YYYY-MM-DD
    section Section
    A task           :a1, 2014-01-01, 30d
    Another task     :after a1, 20d
    section Another
    Task in sec      :2014-01-12, 12d
    another task     :24d`;
    const { code2 } = roundTrip(code);
    expect(code2).toContain('title A Gantt Diagram');
    expect(code2).toContain('dateFormat YYYY-MM-DD');
    expect(code2).toContain('section Section');
    expect(code2).toContain('A task :a1, 2014-01-01, 30d');
    expect(code2).toContain('section Another');
  });
});
