/** 连续失败计数：达到上限后锁定一段时间，成功后清零 */
export class FailureLimiter {
  private entries = new Map<string, { count: number; lockedUntil: number }>();

  constructor(
    private max: number,
    private lockMs: number,
    private now: () => number = Date.now,
  ) {}

  /** 剩余锁定毫秒数，0 表示未锁定 */
  remaining(key: string): number {
    const e = this.entries.get(key);
    return e ? Math.max(0, e.lockedUntil - this.now()) : 0;
  }

  /** 记录一次失败，返回是否因此进入锁定 */
  fail(key: string): boolean {
    const count = (this.entries.get(key)?.count ?? 0) + 1;
    if (count >= this.max) {
      this.entries.set(key, { count: 0, lockedUntil: this.now() + this.lockMs });
      return true;
    }
    this.entries.set(key, { count, lockedUntil: 0 });
    this.prune();
    return false;
  }

  reset(key: string) {
    this.entries.delete(key);
  }

  private prune() {
    if (this.entries.size < 10_000) return;
    const at = this.now();
    for (const [k, e] of this.entries) if (e.lockedUntil < at) this.entries.delete(k);
  }
}

/** 固定窗口计数：每个窗口内最多 limit 次 */
export class WindowLimiter {
  private entries = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private limit: number,
    private windowMs: number,
    private now: () => number = Date.now,
  ) {}

  /** 计一次请求，超过上限时返回 false */
  hit(key: string): boolean {
    const at = this.now();
    const e = this.entries.get(key);
    if (!e || e.resetAt <= at) {
      if (this.entries.size >= 10_000) {
        for (const [k, v] of this.entries) if (v.resetAt <= at) this.entries.delete(k);
      }
      this.entries.set(key, { count: 1, resetAt: at + this.windowMs });
      return true;
    }
    e.count++;
    return e.count <= this.limit;
  }
}
