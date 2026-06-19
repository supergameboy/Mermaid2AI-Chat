import type { ParseError } from './types.js';
/**
 * 错误收集器 — 解析错误收集、定位、反馈
 * 宽容模式：收集错误但不中断解析
 */
export declare class ErrorCollector {
    private errors;
    add(error: ParseError): void;
    addError(line: number, column: number, message: string, context?: string): void;
    addWarning(line: number, column: number, message: string, context?: string): void;
    getErrors(): ParseError[];
    hasErrors(): boolean;
    hasWarnings(): boolean;
    clear(): void;
    getSummary(): {
        errors: number;
        warnings: number;
        total: number;
    };
}
//# sourceMappingURL=error-collector.d.ts.map