/**
 * 错误收集器 — 解析错误收集、定位、反馈
 * 宽容模式：收集错误但不中断解析
 */
export class ErrorCollector {
    errors = [];
    add(error) {
        this.errors.push(error);
    }
    addError(line, column, message, context) {
        this.errors.push({ line, column, message, severity: 'error', context });
    }
    addWarning(line, column, message, context) {
        this.errors.push({ line, column, message, severity: 'warning', context });
    }
    getErrors() {
        return [...this.errors];
    }
    hasErrors() {
        return this.errors.some((e) => e.severity === 'error');
    }
    hasWarnings() {
        return this.errors.some((e) => e.severity === 'warning');
    }
    clear() {
        this.errors = [];
    }
    getSummary() {
        const errors = this.errors.filter((e) => e.severity === 'error').length;
        const warnings = this.errors.filter((e) => e.severity === 'warning').length;
        return { errors, warnings, total: this.errors.length };
    }
}
//# sourceMappingURL=error-collector.js.map