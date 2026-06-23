/**
 * 测试辅助函数统一导出
 * 单一职责：导出测试辅助函数
 */

export {
  roundTrip,
  deepEqual,
} from './round-trip.js';
export type {
  RoundTripResult,
  ParseFn,
  SerializeFn,
} from './round-trip.js';

export {
  getOfficialExamples,
  getAllOfficialExamples,
  registerExample,
  getCustomExamples,
} from './official-examples.js';
export type { OfficialExample } from './official-examples.js';
