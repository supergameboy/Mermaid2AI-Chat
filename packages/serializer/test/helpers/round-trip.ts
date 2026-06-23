/**
 * Round-trip 测试辅助函数
 * 单一职责：验证「源代码 → CanvasState → 源代码」的等价性
 *
 * 测试策略（对齐 L0 决策6 方案D 行为验证测试）:
 *   1. 解析源代码为 CanvasState
 *   2. 序列化 CanvasState 回源代码
 *   3. 再次解析序列化后的源代码
 *   4. 比较两次解析的 CanvasState 是否等价
 *
 * 注意:
 *   - 不要求源代码字符串完全相同（空白、顺序可能变化）
 *   - 要求语义等价（节点、边、元数据一致）
 *   - 各图表类型模块提供自己的 round-trip 实现
 */

import type { CanvasState, ParseError, SerializeResult } from '../../src/types.js';

/** Round-trip 测试结果 */
export interface RoundTripResult {
  /** 是否通过 */
  passed: boolean;
  /** 第一次解析错误 */
  parseErrors1: ParseError[];
  /** 序列化错误 */
  serializeErrors: ParseError[];
  /** 第二次解析错误 */
  parseErrors2: ParseError[];
  /** 第一次解析的 CanvasState */
  canvas1: CanvasState | null;
  /** 第二次解析的 CanvasState */
  canvas2: CanvasState | null;
  /** 序列化后的源代码 */
  serializedCode: string;
  /** 失败原因（如未通过） */
  reason?: string;
}

/** 解析函数类型 */
export type ParseFn = (source: string) => { canvas: CanvasState; errors: ParseError[] };

/** 序列化函数类型 */
export type SerializeFn = (canvas: CanvasState) => SerializeResult;

/**
 * 执行 round-trip 测试
 *
 * @param source 原始源代码
 * @param parseFn 解析函数
 * @param serializeFn 序列化函数
 * @param compareFn CanvasState 等价比较函数（各图表类型提供）
 */
export function roundTrip(
  source: string,
  parseFn: ParseFn,
  serializeFn: SerializeFn,
  compareFn: (a: CanvasState, b: CanvasState) => boolean,
): RoundTripResult {
  // 第一次解析
  const parse1 = parseFn(source);
  if (parse1.errors.length > 0) {
    return {
      passed: false,
      parseErrors1: parse1.errors,
      serializeErrors: [],
      parseErrors2: [],
      canvas1: parse1.canvas,
      canvas2: null,
      serializedCode: '',
      reason: 'First parse failed',
    };
  }

  // 序列化
  const serializeResult = serializeFn(parse1.canvas);
  if (serializeResult.errors.length > 0) {
    return {
      passed: false,
      parseErrors1: [],
      serializeErrors: serializeResult.errors,
      parseErrors2: [],
      canvas1: parse1.canvas,
      canvas2: null,
      serializedCode: serializeResult.mermaid,
      reason: 'Serialize failed',
    };
  }

  // 第二次解析
  const parse2 = parseFn(serializeResult.mermaid);
  if (parse2.errors.length > 0) {
    return {
      passed: false,
      parseErrors1: [],
      serializeErrors: [],
      parseErrors2: parse2.errors,
      canvas1: parse1.canvas,
      canvas2: parse2.canvas,
      serializedCode: serializeResult.mermaid,
      reason: 'Second parse failed',
    };
  }

  // 比较 CanvasState
  const equal = compareFn(parse1.canvas, parse2.canvas);
  return {
    passed: equal,
    parseErrors1: [],
    serializeErrors: [],
    parseErrors2: [],
    canvas1: parse1.canvas,
    canvas2: parse2.canvas,
    serializedCode: serializeResult.mermaid,
    reason: equal ? undefined : 'CanvasState not equal after round-trip',
  };
}

/**
 * 深度比较两个值是否等价（用于 CanvasState 比较）
 * 忽略数组顺序（节点/边顺序不影响语义）
 * 忽略以下辅助字段（不影响语义等价性）:
 *   - rawCode: 增量序列化辅助字段，保留原始代码
 *   - _sourceLine: 增量序列化辅助字段，标记节点/边在原始代码中的行号
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    // 对数组元素排序后比较（忽略顺序）
    const sortedA = [...a].sort(compareByStringify);
    const sortedB = [...b].sort(compareByStringify);
    return sortedA.every((item, i) => deepEqual(item, sortedB[i]));
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const objA = a as Record<string, unknown>;
    const objB = b as Record<string, unknown>;
    // 忽略辅助字段（增量序列化辅助字段，不影响语义等价性）
    const ignoredKeys = new Set(['rawCode', '_sourceLine']);
    const keysA = Object.keys(objA).filter((k) => !ignoredKeys.has(k));
    const keysB = Object.keys(objB).filter((k) => !ignoredKeys.has(k));
    if (keysA.length !== keysB.length) return false;
    return keysA.every((key) => deepEqual(objA[key], objB[key]));
  }

  return false;
}

/** 通过 JSON.stringify 比较用于排序 */
function compareByStringify(a: unknown, b: unknown): number {
  return JSON.stringify(a).localeCompare(JSON.stringify(b));
}
