/**
 * Quadrant 序列化器
 *
 * 单一职责：将 QuadrantCanvasState 序列化为 Mermaid quadrantChart 代码
 *
 * 数据流:
 *   QuadrantCanvasState
 *     → serializeQuadrant(canvas)
 *     → 输出 quadrantChart 代码
 *
 * 序列化规则（对齐官方 quadrantChart 语法，与 parseQuadrantCode 解析顺序一致）:
 *   1. 输出 'quadrantChart'
 *   2. 输出 title（如有）
 *   3. 输出 accTitle（如有）
 *   4. 输出 accDescription（如有）
 *   5. 输出 x-axis：x-axis LeftText --> RightText
 *   6. 输出 y-axis：y-axis BottomText --> TopText
 *   7. 输出 quadrant-1 ~ quadrant-4
 *   8. 输出 classDef（如有）
 *   9. 输出 points
 */

import type {
  QuadrantCanvasState,
  QuadrantPoint,
  SerializeResult,
  ParseError,
} from '../types.js';
import {
  serializePointLine,
  serializeClassDefStatement,
  isValidNormalizedCoordinate,
} from './shared/quadrant-helpers.js';

// ============================================================
// 主入口
// ============================================================

/**
 * 序列化 QuadrantCanvasState 为 Mermaid quadrantChart 代码
 *
 * @param canvas - QuadrantCanvasState
 * @returns SerializeResult，包含 mermaid 代码和错误
 */
export function serializeQuadrant(canvas: QuadrantCanvasState): SerializeResult {
  if (canvas.diagramType !== 'quadrantChart') {
    return {
      mermaid: '',
      errors: [{
        line: 0,
        column: 0,
        message: `serializeQuadrant: diagramType 不匹配，期望 'quadrantChart'，收到 '${canvas.diagramType}'`,
        severity: 'error',
      }],
    };
  }

  const lines: string[] = [];

  // 1. quadrantChart 关键字
  lines.push('quadrantChart');

  // 2. title（如有）
  if (canvas.title !== undefined && canvas.title !== '') {
    lines.push(`title ${canvas.title}`);
  }

  // 3. accTitle（如有）
  if (canvas.accTitle !== undefined && canvas.accTitle !== '') {
    lines.push(`accTitle: ${canvas.accTitle}`);
  }

  // 4. accDescription（如有）
  if (canvas.accDescription !== undefined && canvas.accDescription !== '') {
    lines.push(`accDescription: ${canvas.accDescription}`);
  }

  // 5. x-axis：x-axis LeftText --> RightText
  // 仅在有标签时输出
  if (canvas.xAxis.leftText || canvas.xAxis.rightText) {
    lines.push(serializeXAxis(canvas.xAxis.leftText, canvas.xAxis.rightText));
  }

  // 6. y-axis：y-axis BottomText --> TopText
  // 仅在有标签时输出
  if (canvas.yAxis.topText || canvas.yAxis.bottomText) {
    lines.push(serializeYAxis(canvas.yAxis.bottomText, canvas.yAxis.topText));
  }

  // 7. quadrant-1 ~ quadrant-4（仅在有文本时输出）
  if (canvas.quadrants['1']) {
    lines.push(`quadrant-1 ${canvas.quadrants['1']}`);
  }
  if (canvas.quadrants['2']) {
    lines.push(`quadrant-2 ${canvas.quadrants['2']}`);
  }
  if (canvas.quadrants['3']) {
    lines.push(`quadrant-3 ${canvas.quadrants['3']}`);
  }
  if (canvas.quadrants['4']) {
    lines.push(`quadrant-4 ${canvas.quadrants['4']}`);
  }

  // 8. classDef（如有）
  if (canvas.classDefs) {
    for (const classDef of canvas.classDefs) {
      lines.push(serializeClassDefStatement(classDef));
    }
  }

  // 9. points（含坐标范围验证）
  const errors: ParseError[] = [];
  for (const point of canvas.points) {
    // 验证坐标范围（0-1 归一化），超出范围记录错误（不 fallback，不静默丢弃）
    if (!isValidNormalizedCoordinate(point.x) || !isValidNormalizedCoordinate(point.y)) {
      errors.push({
        line: 0,
        column: 0,
        message: `serializeQuadrant: 数据点 "${point.label}" 坐标超出 0-1 范围 (x=${point.x}, y=${point.y})`,
        severity: 'error',
      });
    }
    lines.push(serializePointLine(point));
  }

  return {
    mermaid: lines.join('\n'),
    errors,
  };
}

// ============================================================
// 坐标轴序列化
// ============================================================

/**
 * 序列化 x-axis 行
 *
 * 格式:
 *   - 有左右标签: `x-axis LeftText --> RightText`
 *   - 仅左标签: `x-axis LeftText`
 *   - 仅右标签: `x-axis --> RightText`
 */
function serializeXAxis(leftText: string, rightText: string): string {
  if (leftText && rightText) {
    return `x-axis ${leftText} --> ${rightText}`;
  }
  if (leftText) {
    return `x-axis ${leftText}`;
  }
  if (rightText) {
    return `x-axis --> ${rightText}`;
  }
  return 'x-axis';
}

/**
 * 序列化 y-axis 行
 *
 * 格式:
 *   - 有上下标签: `y-axis BottomText --> TopText`
 *   - 仅下标签: `y-axis BottomText`
 *   - 仅上标签: `y-axis --> TopText`
 */
function serializeYAxis(bottomText: string, topText: string): string {
  if (bottomText && topText) {
    return `y-axis ${bottomText} --> ${topText}`;
  }
  if (bottomText) {
    return `y-axis ${bottomText}`;
  }
  if (topText) {
    return `y-axis --> ${topText}`;
  }
  return 'y-axis';
}

// ============================================================
// QuadrantSerializer 类（对齐其他序列化器的类形式）
// ============================================================

/**
 * Quadrant 序列化器类
 * 提供 OOP 风格的序列化接口，与 FlowchartSerializer/SequenceSerializer 等保持一致
 */
export class QuadrantSerializer {
  readonly diagramType = 'quadrantChart' as const;

  serialize(canvas: QuadrantCanvasState): SerializeResult {
    return serializeQuadrant(canvas);
  }
}
