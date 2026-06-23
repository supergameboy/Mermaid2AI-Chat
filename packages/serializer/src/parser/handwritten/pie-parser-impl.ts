/**
 * Pie Parser 实现 — pie 图表语法分析器
 * 单一职责：将 Token 数组解析为 PieAST
 *
 * 数据流:
 *   Token[] → parse() → PieAST
 *
 * 语法规则（对齐官方 pieDb.ts）:
 *   diagram := 'pie' [showData] [title X] [accTitle X] [accDescription X] section*
 *   section := string ':' number
 *
 * 错误处理（决策 6 方案 B）:
 *   - parsePie 签名不变，通过 this.errors 记录错误/警告
 *   - parsePieCode 包装函数将 errors 转换到 ErrorCollector
 *   - 负值：记录 error，跳过该切片
 *   - 重复 label：记录 warning，静默忽略（对齐官方 if (!sections.has(label))）
 */

import type { PieAST, PieSliceAST } from '../../ast/index.js';
import type {
  ParseError,
  ParseResult,
  PieCanvasState,
  PieSlice,
} from '../../types.js';
import { ErrorCollector } from '../../error-collector.js';
import { preprocessCode } from '../../detector/preprocessor.js';
import type { Token } from './token-types.js';
import { PieTokenizer } from './pie-tokenizer.js';

/** Pie 解析结果 */
export interface PieParseResult {
  ast: PieAST;
  errors: ParseError[];
}

/** 解析 pie 源代码 */
export function parsePie(source: string): PieParseResult {
  const tokenizer = new PieTokenizer(source);
  const { tokens, errors: tokenizeErrors } = tokenizer.tokenize();

  if (tokenizeErrors.length > 0) {
    return {
      ast: createEmptyPieAST(),
      errors: tokenizeErrors.map((e) => ({
        line: e.line,
        column: e.column,
        message: e.message,
        severity: 'error' as const,
        context: e.context,
      })),
    };
  }

  const parser = new PieParserImpl(tokens);
  return parser.parse();
}

/**
 * 解析 pie 代码为 PieCanvasState（包装 parsePie，接入 ErrorCollector）
 *
 * 决策 6 方案 B：parsePie 签名不变，本函数将 PieParseResult.errors 转换到 ErrorCollector
 *
 * 预处理（架构修复）:
 *   - 内部调用 preprocessCode 清理 frontmatter/指令/注释（保持行号一致）
 *   - 手写 parser 解析清理后的 code
 *
 * @param source - pie 源代码（可含 %% 注释、%%{directive}%%、frontmatter）
 * @param errorCollector - 可选的错误收集器，未提供时内部创建
 * @returns ParseResult（包含 PieCanvasState 和 errors）
 */
export function parsePieCode(
  source: string,
  errorCollector?: ErrorCollector,
): ParseResult {
  const collector = errorCollector ?? new ErrorCollector();
  // 预处理：清理 frontmatter/指令/注释（替换为等长换行，保持行号一致）
  // 手写 parser 的 tokenizer 不支持 %% 注释和 %%{directive}%%，必须预处理
  const preprocessedSource = preprocessCode(source);
  const { ast, errors } = parsePie(preprocessedSource);

  // 将 parsePie 的 errors 转换到 ErrorCollector
  for (const err of errors) {
    if (err.severity === 'error') {
      collector.addError(err.line, err.column, err.message, err.context);
    } else {
      collector.addWarning(err.line, err.column, err.message, err.context);
    }
  }

  const canvas = mapToPieCanvasState(ast);
  const collectedErrors = collector.getErrors();

  return {
    success: !collectedErrors.some((e) => e.severity === 'error'),
    canvas,
    errors: collectedErrors,
  };
}

/**
 * 将 PieAST 转换为 PieCanvasState
 *
 * 单一职责：AST 层 → CanvasState 层的映射
 */
export function mapToPieCanvasState(ast: PieAST): PieCanvasState {
  const slices: PieSlice[] = ast.slices.map((s) => ({
    label: s.label,
    value: s.value,
  }));

  const canvas: PieCanvasState = {
    diagramType: 'pie',
    slices,
  };

  if (ast.title !== undefined) canvas.title = ast.title;
  if (ast.accTitle !== undefined) canvas.accTitle = ast.accTitle;
  if (ast.accDescription !== undefined) canvas.accDescription = ast.accDescription;
  if (ast.showData !== undefined) canvas.showData = ast.showData;

  return canvas;
}

/** Pie 解析器实现 */
class PieParserImpl {
  private tokens: Token[];
  private pos = 0;
  private errors: ParseError[] = [];
  private ast: PieAST = createEmptyPieAST();
  /** 已见 label 集合（用于重复 label 检测，对齐官方 sections.has(label)） */
  private seenLabels = new Set<string>();

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): PieParseResult {
    // 跳过起始的 newline
    this.skipNewlines();

    // 期望 'pie' 关键字
    if (!this.matchKeyword('pie')) {
      this.addError('Expected "pie" keyword at the beginning');
      return { ast: this.ast, errors: this.errors };
    }

    // 可选: showData（与 pie 同行或下一行）
    this.skipNewlines();
    if (this.matchKeyword('showData')) {
      this.ast.showData = true;
    }

    // 可选: title
    this.skipNewlines();
    if (this.matchKeyword('title')) {
      this.ast.title = this.consumeRestOfLine();
    }

    // 可选: accTitle
    this.skipNewlines();
    if (this.matchKeyword('accTitle')) {
      this.ast.accTitle = this.consumeRestOfLine();
    }

    // 可选: accDescription
    this.skipNewlines();
    if (this.matchKeyword('accDescription')) {
      this.ast.accDescription = this.consumeRestOfLine();
    }

    // 解析切片
    while (!this.isAtEnd()) {
      this.skipNewlines();
      if (this.isAtEnd()) break;

      const slice = this.parseSlice();
      if (slice) {
        // 重复 label 检测：静默忽略并记录警告（对齐官方 if (!sections.has(label))）
        if (this.seenLabels.has(slice.label)) {
          this.addWarning(`Duplicate slice label ignored: "${slice.label}"`);
        } else {
          this.seenLabels.add(slice.label);
          this.ast.slices.push(slice);
        }
      }
    }

    return { ast: this.ast, errors: this.errors };
  }

  /** 解析切片: "Label" : value */
  private parseSlice(): PieSliceAST | null {
    const labelToken = this.peek();
    if (labelToken.type !== 'string') {
      this.addError(`Expected string label, got ${labelToken.type}: "${labelToken.value}"`);
      this.advance();
      return null;
    }

    this.advance(); // 消费 label
    this.skipNewlines();

    // 期望 ':'
    if (!this.matchOperator(':')) {
      this.addError('Expected ":" after slice label');
      return null;
    }

    // 期望 number
    const valueToken = this.peek();
    if (valueToken.type !== 'number') {
      this.addError('Expected number value after ":"');
      return null;
    }

    this.advance(); // 消费 value
    const value = parseFloat(valueToken.value);
    if (isNaN(value)) {
      this.addError(`Invalid number: ${valueToken.value}`);
      return null;
    }

    if (value < 0) {
      this.addError(`Negative value not allowed: ${value}`);
      return null;
    }

    return { label: labelToken.value, value };
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

  /** 消费当前行剩余内容作为文本（用于 title 等） */
  private consumeRestOfLine(): string {
    const parts: string[] = [];
    while (!this.isAtEnd() && this.peek().type !== 'newline') {
      const token = this.advance();
      if (token.type !== 'eof') {
        parts.push(token.value);
      }
    }
    return parts.join(' ').trim();
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

  private addWarning(message: string): void {
    const token = this.peek();
    this.errors.push({
      line: token.line,
      column: token.column,
      message,
      severity: 'warning',
      context: undefined,
    });
  }
}

/** 创建空 PieAST */
function createEmptyPieAST(): PieAST {
  return { slices: [] };
}
