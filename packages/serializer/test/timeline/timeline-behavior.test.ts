/**
 * timeline 行为验证测试 — M10
 *
 * 验证 timeline 解析器、序列化器的行为符合官方 mermaid timeline 标准
 * 覆盖：官方语法、title/direction/sections/periods/events、续行事件、多事件、round-trip、边界
 *
 * 测试策略：行为验证（不测试实现细节，只测试接口和行为）
 */

import { describe, it, expect } from 'vitest';
import { parseTimelineCode } from '../../src/parser/timeline-parser.js';
import { serializeTimeline } from '../../src/serializer/timeline-serializer.js';
import { parseMermaid } from '../../src/parse-dispatcher.js';
import { serializeMermaid } from '../../src/serialize-dispatcher.js';
import {
  isContinuationEvent,
  splitPeriodAndEvents,
  calculateSectionDepth,
  formatPeriodLine,
} from '../../src/serializer/shared/timeline-helpers.js';
import type { TimelineCanvasState } from '../../src/types.js';

// ============================================================
// 辅助函数
// ============================================================

/** 解析代码并返回 TimelineCanvasState（断言成功） */
function parse(code: string): TimelineCanvasState {
  const result = parseTimelineCode(code);
  if (!result.success) {
    throw new Error(`解析失败: ${result.errors.map((e) => e.message).join(', ')}`);
  }
  return result.canvas as TimelineCanvasState;
}

/** round-trip: 代码 → 解析 → 序列化 → 代码 */
function roundTrip(code: string): { canvas: TimelineCanvasState; code2: string } {
  const parsed = parseTimelineCode(code);
  if (!parsed.success) {
    throw new Error(`解析失败: ${parsed.errors.map((e) => e.message).join(', ')}`);
  }
  const serialized = serializeTimeline(parsed.canvas as TimelineCanvasState);
  if (serialized.errors.length > 0) {
    throw new Error(`序列化失败: ${serialized.errors.map((e) => e.message).join(', ')}`);
  }
  return {
    canvas: parsed.canvas as TimelineCanvasState,
    code2: serialized.mermaid,
  };
}

// ============================================================
// 基本解析
// ============================================================

describe('基本解析', () => {
  it('应解析空 timeline（仅 timeline 关键字）', () => {
    const canvas = parse('timeline');
    expect(canvas.diagramType).toBe('timeline');
    expect(canvas.sections).toHaveLength(0);
  });

  it('应解析 title', () => {
    const canvas = parse('timeline\ntitle History of Social Media');
    expect(canvas.title).toBe('History of Social Media');
  });

  it('应解析 direction LR（显式）', () => {
    const canvas = parse('timeline LR\ntitle Test');
    // direction LR 是默认值，不存储
    expect(canvas.direction).toBeUndefined();
  });

  it('应解析 direction TD → TB 映射', () => {
    const canvas = parse('timeline TD\ntitle Test');
    expect(canvas.direction).toBe('TB');
  });

  it('应解析 accTitle（带冒号格式）', () => {
    const canvas = parse('timeline\naccTitle: My Accessibility Title');
    expect(canvas.accTitle).toBe('My Accessibility Title');
  });

  it('应解析 accDescription（不带冒号格式）', () => {
    const canvas = parse('timeline\naccDescription This is a timeline');
    expect(canvas.accDescription).toBe('This is a timeline');
  });

  it('应解析完整配置（title + direction + accTitle + accDescription）', () => {
    const canvas = parse('timeline TD\ntitle Test\naccTitle: Acc\naccDescription Desc');
    expect(canvas.title).toBe('Test');
    expect(canvas.direction).toBe('TB');
    expect(canvas.accTitle).toBe('Acc');
    expect(canvas.accDescription).toBe('Desc');
  });
});

// ============================================================
// 时间段和事件解析
// ============================================================

describe('时间段和事件解析', () => {
  it('应解析单个时间段（无事件）', () => {
    const canvas = parse('timeline\n2002');
    expect(canvas.sections).toHaveLength(1);
    expect(canvas.sections[0].periods).toHaveLength(1);
    expect(canvas.sections[0].periods[0].label).toBe('2002');
    expect(canvas.sections[0].periods[0].events).toHaveLength(0);
  });

  it('应解析单个时间段带单个事件', () => {
    const canvas = parse('timeline\n2002 : LinkedIn');
    expect(canvas.sections[0].periods[0].label).toBe('2002');
    expect(canvas.sections[0].periods[0].events).toHaveLength(1);
    expect(canvas.sections[0].periods[0].events[0].label).toBe('LinkedIn');
  });

  it('应解析多事件同行格式（Period : Event1 : Event2）', () => {
    const canvas = parse('timeline\nJanuary : Team hired : Tech stack chosen');
    expect(canvas.sections[0].periods[0].label).toBe('January');
    expect(canvas.sections[0].periods[0].events).toHaveLength(2);
    expect(canvas.sections[0].periods[0].events[0].label).toBe('Team hired');
    expect(canvas.sections[0].periods[0].events[1].label).toBe('Tech stack chosen');
  });

  it('应解析续行事件（: Event 格式，追加到上一时间段）', () => {
    const canvas = parse('timeline\n2004 : Facebook\n     : Google');
    expect(canvas.sections[0].periods).toHaveLength(1);
    expect(canvas.sections[0].periods[0].label).toBe('2004');
    expect(canvas.sections[0].periods[0].events).toHaveLength(2);
    expect(canvas.sections[0].periods[0].events[0].label).toBe('Facebook');
    expect(canvas.sections[0].periods[0].events[1].label).toBe('Google');
  });

  it('应解析多个时间段', () => {
    const canvas = parse('timeline\n2002 : LinkedIn\n2004 : Facebook\n2005 : YouTube');
    expect(canvas.sections[0].periods).toHaveLength(3);
    expect(canvas.sections[0].periods[0].label).toBe('2002');
    expect(canvas.sections[0].periods[1].label).toBe('2004');
    expect(canvas.sections[0].periods[2].label).toBe('2005');
  });
});

// ============================================================
// Section 解析
// ============================================================

describe('Section 解析', () => {
  it('应解析单个 section', () => {
    const canvas = parse('timeline\nsection Q1\nJanuary : Event1');
    expect(canvas.sections).toHaveLength(1);
    expect(canvas.sections[0].name).toBe('Q1');
    expect(canvas.sections[0].periods).toHaveLength(1);
  });

  it('应解析多个 section', () => {
    const canvas = parse('timeline\nsection Q1\nJanuary : Event1\nsection Q2\nApril : Event2');
    expect(canvas.sections).toHaveLength(2);
    expect(canvas.sections[0].name).toBe('Q1');
    expect(canvas.sections[1].name).toBe('Q2');
  });

  it('应解析无 section 的时间段（默认 section）', () => {
    const canvas = parse('timeline\n2002 : LinkedIn');
    expect(canvas.sections).toHaveLength(1);
    expect(canvas.sections[0].name).toBeUndefined();
    expect(canvas.sections[0].periods).toHaveLength(1);
  });
});

// ============================================================
// 官方示例验证
// ============================================================

describe('官方示例验证', () => {
  it('应解析 Project Timeline 示例', () => {
    const code = `timeline
    title History of Social Media Platform
    2002 : LinkedIn
    2004 : Facebook
         : Google
    2005 : YouTube
    2006 : Twitter`;
    const canvas = parse(code);
    expect(canvas.title).toBe('History of Social Media Platform');
    expect(canvas.sections[0].periods).toHaveLength(4);
    expect(canvas.sections[0].periods[0].label).toBe('2002');
    expect(canvas.sections[0].periods[0].events[0].label).toBe('LinkedIn');
    expect(canvas.sections[0].periods[1].label).toBe('2004');
    expect(canvas.sections[0].periods[1].events).toHaveLength(2);
    expect(canvas.sections[0].periods[1].events[0].label).toBe('Facebook');
    expect(canvas.sections[0].periods[1].events[1].label).toBe('Google');
  });

  it('应解析 Product Roadmap with Sections 示例', () => {
    const code = `timeline
    title Product Roadmap 2024
    section Q1 Foundations
        January : Team hired : Tech stack chosen
        February : MVP scoped
        March : Alpha release
    section Q2 Growth
        April : Beta program opens
        May : Mobile app : Public API
        June : v1.0 launch`;
    const canvas = parse(code);
    expect(canvas.title).toBe('Product Roadmap 2024');
    expect(canvas.sections).toHaveLength(2);
    expect(canvas.sections[0].name).toBe('Q1 Foundations');
    expect(canvas.sections[0].periods).toHaveLength(3);
    expect(canvas.sections[0].periods[0].label).toBe('January');
    expect(canvas.sections[0].periods[0].events).toHaveLength(2);
    expect(canvas.sections[1].name).toBe('Q2 Growth');
    expect(canvas.sections[1].periods).toHaveLength(3);
    expect(canvas.sections[1].periods[1].events).toHaveLength(2);
  });
});

// ============================================================
// 序列化
// ============================================================

describe('序列化', () => {
  it('应序列化空 timeline', () => {
    const canvas: TimelineCanvasState = {
      diagramType: 'timeline',
      sections: [],
    };
    const result = serializeTimeline(canvas);
    expect(result.errors).toHaveLength(0);
    expect(result.mermaid).toBe('timeline');
  });

  it('应序列化 title', () => {
    const canvas: TimelineCanvasState = {
      diagramType: 'timeline',
      title: 'My Timeline',
      sections: [],
    };
    const result = serializeTimeline(canvas);
    expect(result.mermaid).toContain('title My Timeline');
  });

  it('应序列化 direction（非默认值 TB → 官方语法 TD）', () => {
    // 内部 direction 'TB' 序列化为官方语法 'TD'
    const canvas: TimelineCanvasState = {
      diagramType: 'timeline',
      direction: 'TB',
      sections: [],
    };
    const result = serializeTimeline(canvas);
    expect(result.mermaid).toContain('timeline TD');
  });

  it('应序列化 direction（默认值 LR 不输出）', () => {
    const canvas: TimelineCanvasState = {
      diagramType: 'timeline',
      direction: 'LR',
      sections: [],
    };
    const result = serializeTimeline(canvas);
    expect(result.mermaid).toBe('timeline');
  });

  it('应序列化 accTitle（带冒号）', () => {
    const canvas: TimelineCanvasState = {
      diagramType: 'timeline',
      accTitle: 'My Acc Title',
      sections: [],
    };
    const result = serializeTimeline(canvas);
    expect(result.mermaid).toContain('accTitle: My Acc Title');
  });

  it('应序列化 accDescription（不带冒号）', () => {
    const canvas: TimelineCanvasState = {
      diagramType: 'timeline',
      accDescription: 'My Description',
      sections: [],
    };
    const result = serializeTimeline(canvas);
    expect(result.mermaid).toContain('accDescription My Description');
  });

  it('应序列化 section 和时间段', () => {
    const canvas: TimelineCanvasState = {
      diagramType: 'timeline',
      sections: [
        {
          name: 'Q1',
          periods: [
            { label: 'January', events: [{ label: 'Event1' }] },
          ],
        },
      ],
    };
    const result = serializeTimeline(canvas);
    expect(result.mermaid).toContain('section Q1');
    expect(result.mermaid).toContain('January : Event1');
  });

  it('应序列化多事件（同行格式）', () => {
    const canvas: TimelineCanvasState = {
      diagramType: 'timeline',
      sections: [
        {
          name: undefined,
          periods: [
            {
              label: 'January',
              events: [
                { label: 'Event1' },
                { label: 'Event2' },
              ],
            },
          ],
        },
      ],
    };
    const result = serializeTimeline(canvas);
    expect(result.mermaid).toContain('January : Event1 : Event2');
  });

  it('应序列化无事件的时间段', () => {
    const canvas: TimelineCanvasState = {
      diagramType: 'timeline',
      sections: [
        {
          name: undefined,
          periods: [
            { label: '2002', events: [] },
          ],
        },
      ],
    };
    const result = serializeTimeline(canvas);
    expect(result.mermaid).toContain('2002');
    expect(result.mermaid).not.toContain('2002 :');
  });
});

// ============================================================
// Round-trip 测试
// ============================================================

describe('Round-trip 测试', () => {
  it('简单 timeline round-trip', () => {
    const code = 'timeline\n2002 : LinkedIn';
    const { canvas, code2 } = roundTrip(code);
    expect(canvas.sections[0].periods[0].label).toBe('2002');
    expect(canvas.sections[0].periods[0].events[0].label).toBe('LinkedIn');
    expect(code2).toContain('timeline');
    expect(code2).toContain('2002 : LinkedIn');
  });

  it('带 title 的 timeline round-trip', () => {
    const code = 'timeline\ntitle My Timeline\n2002 : LinkedIn';
    const { canvas, code2 } = roundTrip(code);
    expect(canvas.title).toBe('My Timeline');
    expect(code2).toContain('title My Timeline');
  });

  it('带 direction TB 的 timeline round-trip', () => {
    // 官方语法用 `timeline TD`，内部映射为 direction 'TB'
    const code = 'timeline TD\n2002 : LinkedIn';
    const { canvas, code2 } = roundTrip(code);
    expect(canvas.direction).toBe('TB');
    expect(code2).toContain('timeline TD');
  });

  it('带 section 的 timeline round-trip', () => {
    const code = 'timeline\nsection Q1\nJanuary : Event1';
    const { canvas, code2 } = roundTrip(code);
    expect(canvas.sections[0].name).toBe('Q1');
    expect(code2).toContain('section Q1');
    expect(code2).toContain('January : Event1');
  });

  it('多事件同行格式 round-trip', () => {
    const code = 'timeline\nJanuary : Event1 : Event2';
    const { canvas, code2 } = roundTrip(code);
    expect(canvas.sections[0].periods[0].events).toHaveLength(2);
    expect(code2).toContain('January : Event1 : Event2');
  });

  it('续行事件 → 多事件格式（语义等价 round-trip）', () => {
    // 续行事件格式仅用于解析，序列化统一用多事件同行格式
    const code = 'timeline\n2004 : Facebook\n     : Google';
    const { canvas, code2 } = roundTrip(code);
    expect(canvas.sections[0].periods[0].events).toHaveLength(2);
    expect(canvas.sections[0].periods[0].events[0].label).toBe('Facebook');
    expect(canvas.sections[0].periods[0].events[1].label).toBe('Google');
    // 序列化后应为多事件同行格式
    expect(code2).toContain('2004 : Facebook : Google');
    expect(code2).not.toContain('\n     : Google');
  });

  it('官方 Project Timeline 示例 round-trip', () => {
    const code = `timeline
    title History of Social Media Platform
    2002 : LinkedIn
    2004 : Facebook
         : Google
    2005 : YouTube
    2006 : Twitter`;
    const { canvas, code2 } = roundTrip(code);
    expect(canvas.title).toBe('History of Social Media Platform');
    expect(canvas.sections[0].periods).toHaveLength(4);
    // 续行事件应被合并为多事件格式
    expect(code2).toContain('2004 : Facebook : Google');
  });

  it('官方 Product Roadmap 示例 round-trip', () => {
    const code = `timeline
    title Product Roadmap 2024
    section Q1 Foundations
        January : Team hired : Tech stack chosen
        February : MVP scoped
        March : Alpha release
    section Q2 Growth
        April : Beta program opens
        May : Mobile app : Public API
        June : v1.0 launch`;
    const { canvas, code2 } = roundTrip(code);
    expect(canvas.title).toBe('Product Roadmap 2024');
    expect(canvas.sections).toHaveLength(2);
    expect(canvas.sections[0].name).toBe('Q1 Foundations');
    expect(canvas.sections[1].name).toBe('Q2 Growth');
    expect(code2).toContain('section Q1 Foundations');
    expect(code2).toContain('section Q2 Growth');
    expect(code2).toContain('January : Team hired : Tech stack chosen');
  });
});

// ============================================================
// 调度器集成
// ============================================================

describe('调度器集成', () => {
  it('parseMermaid 应识别 timeline 类型', () => {
    const result = parseMermaid('timeline\n2002 : LinkedIn');
    expect(result.success).toBe(true);
    expect(result.canvas.diagramType).toBe('timeline');
  });

  it('serializeMermaid 应序列化 timeline', () => {
    const canvas: TimelineCanvasState = {
      diagramType: 'timeline',
      sections: [
        {
          name: undefined,
          periods: [
            { label: '2002', events: [{ label: 'LinkedIn' }] },
          ],
        },
      ],
    };
    const result = serializeMermaid(canvas);
    expect(result.errors).toHaveLength(0);
    expect(result.mermaid).toContain('timeline');
    expect(result.mermaid).toContain('2002 : LinkedIn');
  });
});

// ============================================================
// 辅助函数测试
// ============================================================

describe('辅助函数', () => {
  describe('isContinuationEvent', () => {
    it('应识别续行事件（行首为 :）', () => {
      expect(isContinuationEvent(': Google')).toBe(true);
      expect(isContinuationEvent('  : Google')).toBe(true);
    });

    it('应识别非续行事件', () => {
      expect(isContinuationEvent('2004 : Facebook')).toBe(false);
      expect(isContinuationEvent('section Q1')).toBe(false);
      expect(isContinuationEvent('')).toBe(false);
    });
  });

  describe('splitPeriodAndEvents', () => {
    it('应分割多事件行', () => {
      const result = splitPeriodAndEvents('January : Event1 : Event2');
      expect(result.period).toBe('January');
      expect(result.events).toHaveLength(2);
      expect(result.events[0]).toBe('Event1');
      expect(result.events[1]).toBe('Event2');
    });

    it('应处理无事件的行', () => {
      const result = splitPeriodAndEvents('2002');
      expect(result.period).toBe('2002');
      expect(result.events).toHaveLength(0);
    });

    it('应处理单个事件', () => {
      const result = splitPeriodAndEvents('2002 : LinkedIn');
      expect(result.period).toBe('2002');
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toBe('LinkedIn');
    });
  });

  describe('calculateSectionDepth', () => {
    it('应返回 section 数量', () => {
      expect(calculateSectionDepth([])).toBe(0);
      expect(calculateSectionDepth([{ name: 'Q1', periods: [] }])).toBe(1);
      expect(calculateSectionDepth([
        { name: 'Q1', periods: [] },
        { name: 'Q2', periods: [] },
      ])).toBe(2);
    });
  });

  describe('formatPeriodLine', () => {
    it('应格式化无事件的时间段', () => {
      expect(formatPeriodLine('2002', [])).toBe('2002');
    });

    it('应格式化单事件的时间段', () => {
      expect(formatPeriodLine('2002', ['LinkedIn'])).toBe('2002 : LinkedIn');
    });

    it('应格式化多事件的时间段', () => {
      expect(formatPeriodLine('January', ['Event1', 'Event2'])).toBe('January : Event1 : Event2');
    });
  });
});

// ============================================================
// 边界情况
// ============================================================

describe('边界情况', () => {
  it('应处理空 timeline（仅关键字）', () => {
    const canvas = parse('timeline');
    expect(canvas.sections).toHaveLength(0);
  });

  it('应处理 timeline 带空行', () => {
    const canvas = parse('timeline\n\n2002 : LinkedIn');
    expect(canvas.sections[0].periods[0].label).toBe('2002');
  });

  it('应处理 timeline 带注释', () => {
    const canvas = parse('timeline\n%% This is a comment\n2002 : LinkedIn');
    expect(canvas.sections[0].periods[0].label).toBe('2002');
  });

  it('应处理 section 无时间段', () => {
    const canvas = parse('timeline\nsection Q1\nsection Q2\n2002 : LinkedIn');
    expect(canvas.sections).toHaveLength(2);
    expect(canvas.sections[0].name).toBe('Q1');
    expect(canvas.sections[0].periods).toHaveLength(0);
    expect(canvas.sections[1].name).toBe('Q2');
    expect(canvas.sections[1].periods).toHaveLength(1);
  });
});
