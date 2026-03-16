type Bucket = {
  count: number;
  resetAt: number;
};

export class ChatRateLimit {
  private readonly buckets = new Map<number, Bucket>();

  constructor(
    private readonly windowMs: number,
    private readonly maxMessages: number
  ) {}

  allow(userId: number): boolean {
    const now = Date.now();
    const current = this.buckets.get(userId);
    if (!current || now >= current.resetAt) {
      this.buckets.set(userId, {
        count: 1,
        resetAt: now + this.windowMs
      });
      return true;
    }

    if (current.count >= this.maxMessages) {
      return false;
    }
    current.count += 1;
    return true;
  }
}
