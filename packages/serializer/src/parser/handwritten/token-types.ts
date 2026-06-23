/**
 * 手写解析器通用 Token 类型
 * 单一职责：定义 pie 和 architecture 手写解析器共用的 Token 结构
 *
 * 设计依据:
 *   - 官方 pie/architecture 使用 Langium 解析器，本项目改为手写
 *   - 手写解析器分为两个阶段: tokenizer（词法分析）→ parser（语法分析）
 *   - Token 是词法分析的输出，语法分析的输入
 */

/** Token 类型枚举（字符串字面量联合，便于调试） */
export type TokenType =
  | 'keyword'      // 关键字: pie, showData, title, accTitle, accDescription, architecture-beta, service, junction, group, in, layout
  | 'identifier'   // 标识符: 节点 ID、组 ID 等
  | 'string'       // 字符串字面量（双引号包裹）
  | 'number'       // 数字字面量（整数或浮点）
  | 'direction'    // 方向: L, R, T, B
  | 'operator'     // 运算符: --, -->, :, (, ), [, ], {, }, ,, ;
  | 'newline'      // 换行符
  | 'eof';         // 输入结束

/** Token 结构 */
export interface Token {
  /** Token 类型 */
  type: TokenType;
  /** Token 文本值（string 字面量已去除引号） */
  value: string;
  /** 在源代码中的行号（1-based） */
  line: number;
  /** 在源代码中的列号（1-based） */
  column: number;
  /** Token 原始文本（string 字面量保留引号，便于错误定位） */
  raw?: string;
}

/** 词法分析错误 */
export interface TokenizeError {
  message: string;
  line: number;
  column: number;
  context?: string;
}

/** 词法分析结果 */
export interface TokenizeResult {
  tokens: Token[];
  errors: TokenizeError[];
}
