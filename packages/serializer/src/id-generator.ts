/**
 * ID 生成器 — 自动短 ID（A, B, C... Z, AA, AB...）
 * 双射 26 进制算法，保证唯一性
 */
export class IdGenerator {
  private counter = 0;
  private usedIds: Set<string> = new Set();

  /**
   * 生成下一个短 ID
   */
  next(): string {
    let id: string;
    do {
      id = this.encode(this.counter);
      this.counter++;
    } while (this.usedIds.has(id));
    this.usedIds.add(id);
    return id;
  }

  /**
   * 预注册已存在的 ID（解析时保留原始 ID）
   */
  register(id: string): void {
    this.usedIds.add(id);
  }

  /**
   * 重置生成器
   */
  reset(): void {
    this.counter = 0;
    this.usedIds.clear();
  }

  /**
   * 26 进制编码（A=0, B=1, ... Z=25, AA=26, AB=27...）
   */
  private encode(n: number): string {
    if (n < 0) return 'A';
    let result = '';
    let num = n;
    do {
      result = String.fromCharCode(65 + (num % 26)) + result;
      num = Math.floor(num / 26) - 1;
    } while (num >= 0);
    return result;
  }
}

/** 全局默认实例 */
export const idGenerator = new IdGenerator();
