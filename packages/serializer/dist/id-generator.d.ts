/**
 * ID 生成器 — 自动短 ID（A, B, C... Z, AA, AB...）
 * 双射 26 进制算法，保证唯一性
 */
export declare class IdGenerator {
    private counter;
    private usedIds;
    /**
     * 生成下一个短 ID
     */
    next(): string;
    /**
     * 预注册已存在的 ID（解析时保留原始 ID）
     */
    register(id: string): void;
    /**
     * 重置生成器
     */
    reset(): void;
    /**
     * 26 进制编码（A=0, B=1, ... Z=25, AA=26, AB=27...）
     */
    private encode;
}
/** 全局默认实例 */
export declare const idGenerator: IdGenerator;
//# sourceMappingURL=id-generator.d.ts.map