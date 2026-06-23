/**
 * 手写解析器统一导出
 * 单一职责：导出手写解析器的公共 API
 *
 * 包含:
 *   - pie 手写解析器（tokenizer + parser）
 *   - architecture 手写解析器（tokenizer + parser）
 *   - 通用 Token 类型和 Tokenizer 基类
 */

// Token 类型
export type { Token, TokenType, TokenizeError, TokenizeResult } from './token-types.js';

// Tokenizer 基类
export { BaseTokenizer } from './base-tokenizer.js';

// Pie 解析器
export { PieTokenizer } from './pie-tokenizer.js';
export { parsePie, parsePieCode, mapToPieCanvasState } from './pie-parser-impl.js';
export type { PieParseResult } from './pie-parser-impl.js';

// Architecture 解析器
export { ArchitectureTokenizer } from './architecture-tokenizer.js';
export { parseArchitecture } from './architecture-parser-impl.js';
export type { ArchitectureParseResult } from './architecture-parser-impl.js';
