/**
 * Architecture Tokenizer — architecture-beta 图表词法分析器
 * 单一职责：将 architecture-beta 源代码转换为 Token 数组
 *
 * architecture-beta 语法（对齐官方 architectureDb.ts）:
 *   architecture-beta
 *   group id(icon)[title]
 *   service id(icon)[title] in groupId
 *   junction id
 *   A:L -- R:B
 *   A:L --> R:B
 *   A:L -- R:B : Title
 *   layout:row [a, b, c]
 *
 * Token 类型:
 *   - keyword: architecture-beta, group, service, junction, in, layout
 *   - identifier: 节点 ID、组 ID
 *   - string: title（方括号内的文本）
 *   - direction: L, R, T, B
 *   - operator: --, -->, <--, <-->, :, (, ), [, ], ,, ;
 *   - newline: 换行符
 *   - eof: 输入结束
 */
// v4 修复：支持 4 种边箭头操作符 --/-->/<--/<-->

import type { Token, TokenType } from './token-types.js';
import { BaseTokenizer } from './base-tokenizer.js';

/** Architecture 关键字集合 */
const ARCH_KEYWORDS = new Set([
  'architecture-beta',
  'group',
  'service',
  'junction',
  'in',
  'layout',
]);

/** layout 方向关键字 */
const LAYOUT_DIRECTIONS = new Set(['row', 'column']);

export class ArchitectureTokenizer extends BaseTokenizer {
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

    // 运算符: --, -->, <--, <-->, :, (, ), [, ], ,, ;
    if (ch === '-') {
      // 可能是 -- 或 -->
      if (this.peekNext() === '-') {
        const line = this.line;
        const col = this.column;
        this.advance();
        this.advance();
        if (this.peek() === '>') {
          this.advance();
          this.addToken('operator', '-->', line, col);
        } else {
          this.addToken('operator', '--', line, col);
        }
        return;
      }
      this.addError(`Unexpected character: ${ch}`);
      this.advance();
      return;
    }

    // v4 修复：支持 <-- 和 <--> 操作符
    if (ch === '<') {
      if (this.peekNext() === '-' && this.peekNext(2) === '-') {
        const line = this.line;
        const col = this.column;
        this.advance(); // <
        this.advance(); // -
        this.advance(); // -
        if (this.peek() === '>') {
          this.advance();
          this.addToken('operator', '<-->', line, col);
        } else {
          this.addToken('operator', '<--', line, col);
        }
        return;
      }
      this.addError(`Unexpected character: ${ch}`);
      this.advance();
      return;
    }

    if (ch === ':') {
      const line = this.line;
      const col = this.column;
      this.advance();
      this.addToken('operator', ':', line, col);
      return;
    }

    if (ch === '(') {
      const line = this.line;
      const col = this.column;
      this.advance();
      this.addToken('operator', '(', line, col);
      return;
    }

    if (ch === ')') {
      const line = this.line;
      const col = this.column;
      this.advance();
      this.addToken('operator', ')', line, col);
      return;
    }

    if (ch === '[') {
      const line = this.line;
      const col = this.column;
      this.advance();
      this.addToken('operator', '[', line, col);
      return;
    }

    if (ch === ']') {
      const line = this.line;
      const col = this.column;
      this.advance();
      this.addToken('operator', ']', line, col);
      return;
    }

    if (ch === ',') {
      const line = this.line;
      const col = this.column;
      this.advance();
      this.addToken('operator', ',', line, col);
      return;
    }

    // 方括号内的 title 字符串（不要求双引号）
    // 注意: title 在 [ ] 之间，由 parser 根据上下文判断
    // 这里只处理双引号字符串
    if (ch === '"') {
      this.scanString();
      return;
    }

    // 方向字符 L/R/T/B（单独出现时为 direction token）
    // 注意: 必须在标识符扫描之前判断，避免被当作 identifier
    // 但 L/R/T/B 也可能是标识符的一部分（如 "LB"），所以只在特定上下文识别
    // 这里采用: 单字符且紧跟 : 或 -- 时为 direction
    // 简化处理: 单独的 L/R/T/B 作为 direction，多字符作为 identifier
    if (this.isDirection(ch) && !this.isAlphaNumeric(this.peekNext())) {
      const line = this.line;
      const col = this.column;
      this.advance();
      this.addToken('direction', ch, line, col);
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
    this.advance(); // 消费开头的 "

    let value = '';
    while (!this.isAtEnd() && this.peek() !== '"') {
      if (this.peek() === '\n') {
        this.addError('Unterminated string literal');
        return;
      }
      if (this.peek() === '\\') {
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
    this.addToken('string', value, line, col, `"${value}"`);
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

  /** 扫描标识符或关键字 */
  private scanIdentifierOrKeyword(): void {
    const line = this.line;
    const col = this.column;
    let value = '';

    while (!this.isAtEnd() && this.isAlphaNumeric(this.peek())) {
      value += this.advance();
    }

    // 检查是否为 architecture-beta（带连字符）
    if (value === 'architecture' && this.peek() === '-') {
      value += this.advance(); // -
      while (!this.isAtEnd() && this.isAlphaNumeric(this.peek())) {
        value += this.advance();
      }
    }

    // layout:row 或 layout:column 中的 row/column 作为 keyword
    const type: TokenType = ARCH_KEYWORDS.has(value) || LAYOUT_DIRECTIONS.has(value)
      ? 'keyword'
      : 'identifier';
    this.addToken(type, value, line, col);
  }
}
