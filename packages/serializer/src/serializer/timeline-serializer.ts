/**
 * Timeline 序列化器
 *
 * 单一职责：将 TimelineCanvasState 序列化为 Mermaid timeline 代码
 *
 * 数据流:
 *   TimelineCanvasState
 *     → serializeTimeline(canvas)
 *     → 输出 timeline 代码
 *
 * 序列化规则（对齐官方 timeline 语法，与 parseTimelineCode 解析顺序一致）:
 *   1. 输出 'timeline'
 *   2. 输出 direction（如有非默认值 LR，格式 `timeline TB`）
 *   3. 输出 title（如有）
 *   4. 输出 accTitle（如有，格式 `accTitle: value`，带冒号）
 *   5. 输出 accDescription（如有，格式 `accDescription value`，不带冒号，对齐 gantt-serializer）
 *   6. 遍历 sections：
 *      - section SectionName（如有 name）
 *      - 遍历 periods：PeriodLabel : Event1 : Event2（多事件同行格式，决策 7）
 *
 * 决策 7：序列化统一用多事件同行格式 `PeriodLabel : Event1 : Event2`
 *   续行事件格式（`: Event`）仅用于解析，序列化时不使用
 */

import type {
  TimelineCanvasState,
  TimelineSection,
  TimelinePeriod,
  SerializeResult,
} from '../types.js';
import { formatPeriodLine } from './shared/timeline-helpers.js';

// ============================================================
// 主入口
// ============================================================

/**
 * 序列化 TimelineCanvasState 为 Mermaid timeline 代码
 *
 * @param canvas - TimelineCanvasState
 * @returns SerializeResult，包含 mermaid 代码和错误
 */
export function serializeTimeline(canvas: TimelineCanvasState): SerializeResult {
  if (canvas.diagramType !== 'timeline') {
    return {
      mermaid: '',
      errors: [{
        line: 0,
        column: 0,
        message: `serializeTimeline: diagramType 不匹配，期望 'timeline'，收到 '${canvas.diagramType}'`,
        severity: 'error',
      }],
    };
  }

  const lines: string[] = [];

  // 1. timeline 关键字 + direction（如有非默认值 LR）
  // 官方语法：`timeline` 或 `timeline LR` 或 `timeline TD`
  // direction 默认为 LR，仅非默认值时输出
  // 内部 direction 'TB' 映射为官方语法 'TD'（决策：direction TD→TB 映射）
  if (canvas.direction && canvas.direction !== 'LR') {
    const directionSyntax = canvas.direction === 'TB' ? 'TD' : canvas.direction;
    lines.push(`timeline ${directionSyntax}`);
  } else {
    lines.push('timeline');
  }

  // 2. title（如有）
  if (canvas.title !== undefined && canvas.title !== '') {
    lines.push(`title ${canvas.title}`);
  }

  // 3. accTitle（如有）— jison 文法要求 "accTitle: value"（带冒号）
  if (canvas.accTitle !== undefined && canvas.accTitle !== '') {
    lines.push(`accTitle: ${canvas.accTitle}`);
  }

  // 4. accDescription（如有）— jison 文法支持 "accDescription value"（不带冒号，对齐 gantt-serializer）
  if (canvas.accDescription !== undefined && canvas.accDescription !== '') {
    lines.push(`accDescription ${canvas.accDescription}`);
  }

  // 5. 遍历 sections
  for (const section of canvas.sections) {
    // section SectionName（如有 name）
    if (section.name !== undefined && section.name !== '') {
      lines.push(`section ${section.name}`);
    }
    // 遍历 periods
    for (const period of section.periods) {
      lines.push(serializePeriod(period));
    }
  }

  return {
    mermaid: lines.join('\n'),
    errors: [],
  };
}

/**
 * 序列化单个时间段
 *
 * 决策 7：多事件同行格式 `PeriodLabel : Event1 : Event2`
 * - 无事件：`PeriodLabel`
 * - 有事件：`PeriodLabel : Event1 : Event2 : ...`
 */
function serializePeriod(period: TimelinePeriod): string {
  const eventLabels = period.events.map((e) => e.label);
  return formatPeriodLine(period.label, eventLabels);
}

// ============================================================
// TimelineSerializer 类（对齐其他序列化器的类形式）
// ============================================================

/**
 * Timeline 序列化器类
 * 提供 OOP 风格的序列化接口，与 FlowchartSerializer/SequenceSerializer 等保持一致
 */
export class TimelineSerializer {
  readonly diagramType = 'timeline' as const;

  serialize(canvas: TimelineCanvasState): SerializeResult {
    return serializeTimeline(canvas);
  }
}
