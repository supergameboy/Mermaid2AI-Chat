/**
 * 手写解析器 Tokenizer 基类
 * 单一职责：提供字符流消费和 Token 生成的基础能力
 *
 * 设计依据:
 *   - pie 和 architecture 的词法规则有差异，但基础能力相同
 *   - 基类提供: 字符消费、位置追踪、错误记录、Token 构造
 *   - 子类提供: 具体的 keyword 集合和 tokenize() 实现
 *
 * 使用方式:
 *   class PieTokenizer extends BaseTokenizer { ... }
 *   const tokenizer = new PieTokenizer(source);
 *   const { tokens, errors } = tokenizer.tokenize();
 */

import type { Token, TokenizeError, TokenizeResult, TokenType } from './token-types.js';

/** Tokenizer 基类 */
export abstract class BaseTokenizer {
  protected readonly source: string;
  protected pos = 0;
  protected line = 1;
  protected column = 1;
  protected tokens: Token[] = [];
  protected errors: TokenizeError[] = [];

  constructor(source: string) {
    this.source = source;
  }

  /** 执行词法分析，返回 Token 数组和错误 */
  tokenize(): TokenizeResult {
    while (!this.isAtEnd()) {
      this.scanToken();
    }
    this.addToken('eof', '', this.line, this.column);
    return { tokens: this.tokens, errors: this.errors };
  }

  /** 子类实现: 扫描一个 Token */
  protected abstract scanToken(): void;

  // ============================================================
  // 字符流消费基础能力
  // ============================================================

  /** 当前字符（未消费） */
  protected peek(): string {
    return this.source[this.pos] ?? '';
  }

  /** 前瞻下一个字符（不消费） */
  protected peekNext(offset = 1): string {
    return this.source[this.pos + offset] ?? '';
  }

  /** 消费当前字符并前进 */
  protected advance(): string {
    const ch = this.source[this.pos];
    if (ch === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    this.pos++;
    return ch ?? '';
  }

  /** 匹配并消费字符（如匹配成功前进，否则不动） */
  protected match(expected: string): boolean {
    if (this.peek() === expected) {
      this.advance();
      return true;
    }
    return false;
  }

  /** 匹配字符串（多字符） */
  protected matchString(expected: string): boolean {
    if (this.source.slice(this.pos, this.pos + expected.length) === expected) {
      for (let i = 0; i < expected.length; i++) {
        this.advance();
      }
      return true;
    }
    return false;
  }

  /** 是否到达输入末尾 */
  protected isAtEnd(): boolean {
    return this.pos >= this.source.length;
  }

  // ============================================================
  // 空白和注释处理
  // ============================================================

  /** 跳过空白字符（不含换行） */
  protected skipWhitespace(): void {
    while (!this.isAtEnd()) {
      const ch = this.peek();
      if (ch === ' ' || ch === '\t' || ch === '\r') {
        this.advance();
      } else {
        break;
      }
    }
  }

  /** 跳过单行注释（%% 开头） */
  protected skipLineComment(): boolean {
    if (this.peek() === '%' && this.peekNext() === '%') {
      while (!this.isAtEnd() && this.peek() !== '\n') {
        this.advance();
      }
      return true;
    }
    return false;
  }

  // ============================================================
  // Token 构造
  // ============================================================

  /** 添加 Token */
  protected addToken(type: TokenType, value: string, line: number, column: number, raw?: string): void {
    this.tokens.push({ type, value, line, column, raw });
  }

  /** 记录词法错误 */
  protected addError(message: string): void {
    this.errors.push({
      message,
      line: this.line,
      column: this.column,
      context: this.source.split('\n')[this.line - 1] ?? undefined,
    });
  }

  // ============================================================
  // 字符判断辅助
  // ============================================================

  /** 是否为字母 */
  protected isAlpha(ch: string): boolean {
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_' || ch === '-';
  }

  /** 是否为数字 */
  protected isDigit(ch: string): boolean {
    return ch >= '0' && ch <= '9';
  }

  /** 是否为字母或数字 */
  protected isAlphaNumeric(ch: string): boolean {
    return this.isAlpha(ch) || this.isDigit(ch);
  }

  /** 是否为方向字符（L/R/T/B） */
  protected isDirection(ch: string): boolean {
    return ch === 'L' || ch === 'R' || ch === 'T' || ch === 'B';
  }
}
