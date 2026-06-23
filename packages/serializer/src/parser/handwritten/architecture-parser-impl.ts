/**
 * Architecture Parser 实现 — architecture-beta 图表语法分析器
 * 单一职责：将 Token 数组解析为 ArchitectureAST
 *
 * 注意: 本文件为 M0 基础设施，仅提供骨架。
 * 完整实现在 M7 模块中完成。
 *
 * 数据流:
 *   Token[] → parse() → ArchitectureAST
 *
 * 语法规则（对齐官方 architectureDb.ts）:
 *   diagram := 'architecture-beta' statement*
 *   statement := group | service | junction | edge | layout
 *   group := 'group' id ['(' icon ')'] ['[' title ']'] ['in' groupId]
 *   service := 'service' id ['(' icon ')'] ['[' title ']'] ['in' groupId]
 *   junction := 'junction' id
 *   edge := nodeId ':' dir ['--' | '-->'] dir ':' nodeId [':' title]
 *   layout := 'layout' ':' direction '[' id (',' id)* ']'
 */

import type {
  ArchitectureAST,
  ArchitectureServiceAST,
  ArchitectureJunctionAST,
  ArchitectureGroupAST,
  ArchitectureEdgeAST,
  ArchitectureLayoutHintAST,
} from '../../ast/index.js';
import type { ArchitectureDirection } from '../../types.js';
import type { ParseError } from '../../types.js';
import type { Token } from './token-types.js';
import { ArchitectureTokenizer } from './architecture-tokenizer.js';

/** Architecture 解析结果 */
export interface ArchitectureParseResult {
  ast: ArchitectureAST;
  errors: ParseError[];
}

/** 解析 architecture-beta 源代码 */
export function parseArchitecture(source: string): ArchitectureParseResult {
  const tokenizer = new ArchitectureTokenizer(source);
  const { tokens, errors: tokenizeErrors } = tokenizer.tokenize();

  if (tokenizeErrors.length > 0) {
    return {
      ast: createEmptyArchitectureAST(),
      errors: tokenizeErrors.map((e) => ({
        line: e.line,
        column: e.column,
        message: e.message,
        severity: 'error' as const,
        context: e.context,
      })),
    };
  }

  const parser = new ArchitectureParserImpl(tokens);
  return parser.parse();
}

/** Architecture 解析器实现 */
class ArchitectureParserImpl {
  private tokens: Token[];
  private pos = 0;
  private errors: ParseError[] = [];
  private ast: ArchitectureAST = createEmptyArchitectureAST();

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): ArchitectureParseResult {
    this.skipNewlines();

    // 期望 'architecture-beta' 关键字
    if (!this.matchKeyword('architecture-beta')) {
      this.addError('Expected "architecture-beta" keyword at the beginning');
      return { ast: this.ast, errors: this.errors };
    }

    // 解析语句
    while (!this.isAtEnd()) {
      this.skipNewlines();
      if (this.isAtEnd()) break;

      if (!this.parseStatement()) {
        // 解析失败时跳过当前行避免死循环
        this.skipToNextLine();
      }
    }

    return { ast: this.ast, errors: this.errors };
  }

  /** 解析单条语句 */
  private parseStatement(): boolean {
    const token = this.peek();

    if (token.type === 'keyword') {
      switch (token.value) {
        case 'group':
          return this.parseGroup();
        case 'service':
          return this.parseService();
        case 'junction':
          return this.parseJunction();
        case 'layout':
          return this.parseLayout();
        default:
          this.addError(`Unexpected keyword: ${token.value}`);
          return false;
      }
    }

    // 边语句: id:dir -- dir:id 或 id:dir --> dir:id
    if (token.type === 'identifier') {
      return this.parseEdge();
    }

    this.addError(`Unexpected token: ${token.type} "${token.value}"`);
    return false;
  }

  /** 解析 group 语句 */
  private parseGroup(): boolean {
    this.advance(); // 消费 'group'

    const id = this.consumeIdentifier('group id');
    if (!id) return false;

    let icon: string | undefined;
    let title: string | undefined;
    let inGroup: string | undefined;

    // 可选: (icon)
    if (this.matchOperator('(')) {
      icon = this.consumeIdentifier('icon name') ?? undefined;
      if (!this.matchOperator(')')) {
        this.addError('Expected ")" after icon name');
        return false;
      }
    }

    // 可选: [title]
    if (this.matchOperator('[')) {
      title = this.consumeRestOfBracket();
    }

    // 可选: in groupId
    if (this.matchKeyword('in')) {
      inGroup = this.consumeIdentifier('parent group id') ?? undefined;
    }

    const group: ArchitectureGroupAST = {
      id,
      icon,
      title,
      in: inGroup,
    };
    this.ast.groups.push(group);
    return true;
  }

  /** 解析 service 语句 */
  private parseService(): boolean {
    this.advance(); // 消费 'service'

    const id = this.consumeIdentifier('service id');
    if (!id) return false;

    let icon: string | undefined;
    let iconText: string | undefined;
    let title: string | undefined;
    let inGroup: string | undefined;

    // 可选: (icon)
    if (this.matchOperator('(')) {
      icon = this.consumeIdentifier('icon name') ?? undefined;
      if (!this.matchOperator(')')) {
        this.addError('Expected ")" after icon name');
        return false;
      }
    }

    // 可选: [title]
    if (this.matchOperator('[')) {
      title = this.consumeRestOfBracket();
    }

    // 可选: in groupId
    if (this.matchKeyword('in')) {
      inGroup = this.consumeIdentifier('parent group id') ?? undefined;
    }

    const service: ArchitectureServiceAST = {
      id,
      icon,
      iconText,
      title,
      edges: [],
      ...(inGroup ? { in: inGroup } : {}),
    };
    this.ast.services.push(service);
    return true;
  }

  /** 解析 junction 语句 */
  private parseJunction(): boolean {
    this.advance(); // 消费 'junction'

    const id = this.consumeIdentifier('junction id');
    if (!id) return false;

    // 可选: in groupId
    let inGroup: string | undefined;
    if (this.matchKeyword('in')) {
      inGroup = this.consumeIdentifier('parent group id') ?? undefined;
    }

    const junction: ArchitectureJunctionAST = {
      id,
      edges: [],
      ...(inGroup ? { in: inGroup } : {}),
    };
    this.ast.junctions.push(junction);
    return true;
  }

  /** 解析 edge 语句: id:dir [--|-->|<--|<-->] dir:id [: title]
   *
   * v4 修复：支持 4 种箭头操作符
   *   - `--`：lhsInto=false, rhsInto=false（无箭头）
   *   - `-->`：lhsInto=false, rhsInto=true（右箭头）
   *   - `<--`：lhsInto=true, rhsInto=false（左箭头）
   *   - `<-->`：lhsInto=true, rhsInto=true（双向箭头）
   */
  private parseEdge(): boolean {
    const lhsId = this.consumeIdentifier('edge lhs id');
    if (!lhsId) return false;

    if (!this.matchOperator(':')) {
      this.addError('Expected ":" after edge lhs id');
      return false;
    }

    const lhsDir = this.consumeDirection('lhs direction');
    if (!lhsDir) return false;

    // v4 修复：支持 4 种箭头操作符 --/-->/<--/<-->
    let lhsInto = false;
    let rhsInto = false;
    if (this.matchOperator('<-->')) {
      lhsInto = true;
      rhsInto = true;
    } else if (this.matchOperator('<--')) {
      lhsInto = true;
      rhsInto = false;
    } else if (this.matchOperator('-->')) {
      lhsInto = false;
      rhsInto = true;
    } else if (this.matchOperator('--')) {
      lhsInto = false;
      rhsInto = false;
    } else {
      this.addError('Expected "--", "-->", "<--", or "<-->" in edge');
      return false;
    }

    const rhsDir = this.consumeDirection('rhs direction');
    if (!rhsDir) return false;

    if (!this.matchOperator(':')) {
      this.addError('Expected ":" after rhs direction');
      return false;
    }

    const rhsId = this.consumeIdentifier('edge rhs id');
    if (!rhsId) return false;

    // 可选: : title
    let title: string | undefined;
    if (this.matchOperator(':')) {
      title = this.consumeRestOfLine();
    }

    const edge: ArchitectureEdgeAST = {
      lhsId,
      lhsDir,
      lhsInto,
      rhsId,
      rhsDir,
      rhsInto,
      title,
    };
    this.ast.edges.push(edge);
    return true;
  }

  /** 解析 layout 语句: layout : direction [id, id, ...] */
  private parseLayout(): boolean {
    this.advance(); // 消费 'layout'

    if (!this.matchOperator(':')) {
      this.addError('Expected ":" after "layout"');
      return false;
    }

    const direction = this.consumeKeyword('layout direction (row/column)');
    if (!direction) return false;

    if (!this.matchOperator('[')) {
      this.addError('Expected "[" after layout direction');
      return false;
    }

    // 解析成员列表
    const members: string[] = [];
    while (!this.isAtEnd() && this.peek().type !== 'operator' && this.peek().value !== ']') {
      const id = this.consumeIdentifier('layout member id');
      if (id) members.push(id);
      if (!this.matchOperator(',')) break;
    }

    if (!this.matchOperator(']')) {
      this.addError('Expected "]" after layout members');
      return false;
    }

    // v4：将 layout hint 存入 AST（供 parser 入口映射到 GraphMetadata.layoutHints）
    if (direction === 'row' || direction === 'column') {
      const hint: ArchitectureLayoutHintAST = {
        direction,
        members,
      };
      this.ast.layoutHints.push(hint);
    } else {
      this.addError(`Invalid layout direction: ${direction}, expected 'row' or 'column'`);
      return false;
    }
    return true;
  }

  // ============================================================
  // Token 消费辅助
  // ============================================================

  private peek(): Token {
    return this.tokens[this.pos] ?? this.tokens[this.tokens.length - 1];
  }

  private advance(): Token {
    return this.tokens[this.pos++] ?? this.tokens[this.tokens.length - 1];
  }

  private isAtEnd(): boolean {
    return this.peek().type === 'eof';
  }

  private matchKeyword(keyword: string): boolean {
    const token = this.peek();
    if (token.type === 'keyword' && token.value === keyword) {
      this.advance();
      return true;
    }
    return false;
  }

  private matchOperator(op: string): boolean {
    const token = this.peek();
    if (token.type === 'operator' && token.value === op) {
      this.advance();
      return true;
    }
    return false;
  }

  private skipNewlines(): void {
    while (this.peek().type === 'newline') {
      this.advance();
    }
  }

  private skipToNextLine(): void {
    while (!this.isAtEnd() && this.peek().type !== 'newline') {
      this.advance();
    }
    if (this.peek().type === 'newline') {
      this.advance();
    }
  }

  private consumeIdentifier(context: string): string | null {
    const token = this.peek();
    if (token.type === 'identifier') {
      this.advance();
      return token.value;
    }
    this.addError(`Expected identifier (${context}), got ${token.type}: "${token.value}"`);
    return null;
  }

  private consumeDirection(context: string): ArchitectureDirection | null {
    const token = this.peek();
    if (token.type === 'direction') {
      this.advance();
      return token.value as ArchitectureDirection;
    }
    this.addError(`Expected direction L/R/T/B (${context}), got ${token.type}: "${token.value}"`);
    return null;
  }

  private consumeKeyword(context: string): string | null {
    const token = this.peek();
    if (token.type === 'keyword') {
      this.advance();
      return token.value;
    }
    this.addError(`Expected keyword (${context}), got ${token.type}: "${token.value}"`);
    return null;
  }

  /** 消费 [ ] 之间的内容作为文本 */
  private consumeRestOfBracket(): string | undefined {
    const parts: string[] = [];
    while (!this.isAtEnd()) {
      const token = this.peek();
      if (token.type === 'operator' && token.value === ']') {
        this.advance();
        return parts.join(' ').trim() || undefined;
      }
      this.advance();
      if (token.type !== 'eof') {
        parts.push(token.value);
      }
    }
    this.addError('Unterminated "[" ... "]"');
    return undefined;
  }

  /** 消费当前行剩余内容作为文本 */
  private consumeRestOfLine(): string | undefined {
    const parts: string[] = [];
    while (!this.isAtEnd() && this.peek().type !== 'newline') {
      const token = this.advance();
      if (token.type !== 'eof') {
        parts.push(token.value);
      }
    }
    return parts.join(' ').trim() || undefined;
  }

  private addError(message: string): void {
    const token = this.peek();
    this.errors.push({
      line: token.line,
      column: token.column,
      message,
      severity: 'error',
      context: undefined,
    });
  }
}

/** 创建空 ArchitectureAST（v4：包含 layoutHints 字段） */
function createEmptyArchitectureAST(): ArchitectureAST {
  return {
    services: [],
    junctions: [],
    groups: [],
    edges: [],
    layoutHints: [],
  };
}
