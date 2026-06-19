import type { ParseResult } from './types.js';
import type { ErrorCollector } from './error-collector.js';
/**
 * 解析 Mermaid 代码为画布状态
 * 宽容模式：即使有错误也返回部分结果
 */
export declare function parseMermaid(source: string, errorCollector?: ErrorCollector): ParseResult;
//# sourceMappingURL=parser.d.ts.map