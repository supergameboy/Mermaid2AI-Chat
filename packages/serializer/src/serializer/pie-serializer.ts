/**
 * Pie 序列化器
 *
 * 单一职责：将 PieCanvasState 序列化为 Mermaid pie 代码
 *
 * 数据流:
 *   PieCanvasState
 *     → serializePie(canvas)
 *     → 输出 pie 代码
 *
 * 序列化规则（对齐官方 pie 语法，与 parsePie 解析顺序一致）:
 *   1. 输出 'pie'
 *   2. 输出 showData（如有，紧跟 pie 关键字后）
 *   3. 输出 title（如有）
 *   4. 输出 accTitle（如有）
 *   5. 输出 accDescription（如有）
 *   6. 遍历 slices：输出 "Label" : value
 */

import type {
  PieCanvasState,
  PieSlice,
  SerializeResult,
} from '../types.js';
import { escapePieLabel } from './shared/pie-helpers.js';

// ============================================================
// 主入口
// ============================================================

/**
 * 序列化 PieCanvasState 为 Mermaid pie 代码
 *
 * @param canvas - PieCanvasState
 * @returns SerializeResult，包含 mermaid 代码和错误
 */
export function serializePie(canvas: PieCanvasState): SerializeResult {
  if (canvas.diagramType !== 'pie') {
    return {
      mermaid: '',
      errors: [{
        line: 0,
        column: 0,
        message: `serializePie: diagramType 不匹配，期望 'pie'，收到 '${canvas.diagramType}'`,
        severity: 'error',
      }],
    };
  }

  const lines: string[] = [];

  // 1. pie 关键字
  // showData 紧跟 pie 关键字（对齐官方语法 pie showData）
  const pieLine = canvas.showData ? 'pie showData' : 'pie';
  lines.push(pieLine);

  // 2. title（如有）
  if (canvas.title !== undefined && canvas.title !== '') {
    lines.push(`title ${canvas.title}`);
  }

  // 3. accTitle（如有）
  if (canvas.accTitle !== undefined && canvas.accTitle !== '') {
    lines.push(`accTitle ${canvas.accTitle}`);
  }

  // 4. accDescription（如有）
  if (canvas.accDescription !== undefined && canvas.accDescription !== '') {
    lines.push(`accDescription ${canvas.accDescription}`);
  }

  // 5. 遍历 slices
  for (const slice of canvas.slices) {
    lines.push(serializeSlice(slice));
  }

  return {
    mermaid: lines.join('\n'),
    errors: [],
  };
}

/**
 * 序列化单个切片
 *
 * 格式：`"Label" : value`
 * - label 用双引号包裹（调用 escapePieLabel 转义内部特殊字符）
 * - value 为数字（整数或浮点）
 */
function serializeSlice(slice: PieSlice): string {
  const label = escapePieLabel(slice.label);
  // 数值序列化：Number→string 自动处理整数和浮点（去除尾随零）
  const value = String(slice.value);
  return `${label} : ${value}`;
}

// ============================================================
// PieSerializer 类（对齐其他序列化器的类形式）
// ============================================================

/**
 * Pie 序列化器类
 * 提供 OOP 风格的序列化接口，与 FlowchartSerializer/SequenceSerializer 等保持一致
 */
export class PieSerializer {
  readonly diagramType = 'pie' as const;

  serialize(canvas: PieCanvasState): SerializeResult {
    return serializePie(canvas);
  }
}
