/**
 * Pie Tokenizer — pie 图表词法分析器
 * 单一职责：将 pie 源代码转换为 Token 数组
 *
 * pie 语法（对齐官方 pieDb.ts）:
 *   pie [showData] [title X]
 *   [accTitle X]
 *   [accDescription X]
 *   "Label" : value
 *   "Label" : value
 *   ...
 *
 * Token 类型:
 *   - keyword: pie, showData, title, accTitle, accDescription
 *   - string: "Label"（双引号包裹）
 *   - operator: :（分隔 label 和 value）
 *   - number: value（整数或浮点）
 *   - newline: 换行符
 *   - eof: 输入结束
 */

import type { Token, TokenType } from './token-types.js';
import { BaseTokenizer } from './base-tokenizer.js';

/** Pie 关键字集合 */
const PIE_KEYWORDS = new Set([
  'pie',
  'showData',
  'title',
  'accTitle',
  'accDescription',
]);

export class PieTokenizer extends BaseTokenizer {
  /** 扫描一个 Token */
  protected scanToken(): void {
    // 跳过空白（不含换行）
    this.skipWhitespace();

    // 跳过注释
    if (this.skipLineComment()) return;

    if (this.isAtEnd()) return;

    const ch = this.peek();

    // 换行符
    if (ch === '\n') {
      const line = this.line;
      const col = this.column;
      this.advance();
      this.addToken('newline', '\n', line, col);
      return;
    }

    // 字符串字面量（双引号包裹）
    if (ch === '"') {
      this.scanString();
      return;
    }

    // 数字（含负号）
    if (this.isDigit(ch) || (ch === '-' && this.isDigit(this.peekNext()))) {
      this.scanNumber();
      return;
    }

    // 运算符
    if (ch === ':') {
      const line = this.line;
      const col = this.column;
      this.advance();
      this.addToken('operator', ':', line, col);
      return;
    }

    // 标识符或关键字
    if (this.isAlpha(ch)) {
      this.scanIdentifierOrKeyword();
      return;
    }

    // 未知字符
    this.addError(`Unexpected character: ${ch}`);
    this.advance();
  }

  /** 扫描字符串字面量 */
  private scanString(): void {
    const line = this.line;
    const col = this.column;
    const raw = '"';
    this.advance(); // 消费开头的 "

    let value = '';
    while (!this.isAtEnd() && this.peek() !== '"') {
      if (this.peek() === '\n') {
        this.addError('Unterminated string literal');
        return;
      }
      if (this.peek() === '\\') {
        // 转义字符
        this.advance();
        const escaped = this.advance();
        value += this.unescapeChar(escaped);
      } else {
        value += this.advance();
      }
    }

    if (this.isAtEnd()) {
      this.addError('Unterminated string literal');
      return;
    }

    this.advance(); // 消费结尾的 "
    this.addToken('string', value, line, col, raw + value + '"');
  }

  /** 转义字符处理 */
  private unescapeChar(ch: string): string {
    switch (ch) {
      case 'n': return '\n';
      case 't': return '\t';
      case 'r': return '\r';
      case '"': return '"';
      case '\\': return '\\';
      default: return ch;
    }
  }

  /** 扫描数字 */
  private scanNumber(): void {
    const line = this.line;
    const col = this.column;
    let value = '';

    if (this.peek() === '-') {
      value += this.advance();
    }

    while (!this.isAtEnd() && this.isDigit(this.peek())) {
      value += this.advance();
    }

    // 小数部分
    if (this.peek() === '.' && this.isDigit(this.peekNext())) {
      value += this.advance(); // .
      while (!this.isAtEnd() && this.isDigit(this.peek())) {
        value += this.advance();
      }
    }

    this.addToken('number', value, line, col);
  }

  /** 扫描标识符或关键字 */
  private scanIdentifierOrKeyword(): void {
    const line = this.line;
    const col = this.column;
    let value = '';

    while (!this.isAtEnd() && this.isAlphaNumeric(this.peek())) {
      value += this.advance();
    }

    const type: TokenType = PIE_KEYWORDS.has(value) ? 'keyword' : 'identifier';
    this.addToken(type, value, line, col);
  }
}
