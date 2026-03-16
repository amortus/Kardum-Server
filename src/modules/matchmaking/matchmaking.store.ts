import { ENV } from '../../config/env';
import { getRedisCommandClient, isRedisReady } from '../../config/redis';

export type MatchType = 'casual' | 'ranked';
export type QueueEntryRecord = {
  userId: number;
  socketId: string;
  matchType: MatchType;
  elo: number;
  deckId: number;
  joinedAt: number;
};

class MatchmakingStore {
  private lastRedisNotReadyLogAt = 0;

  private ensureRedisReady(context: string): boolean {
    const redis = getRedisCommandClient();
    if (redis && isRedisReady()) return true;
    const now = Date.now();
    if ((now - this.lastRedisNotReadyLogAt) >= 15000) {
      this.lastRedisNotReadyLogAt = now;
      console.warn(`[MatchmakingStore] Redis not ready for ${context}.`);
    }
    return false;
  }

  async upsert(matchType: MatchType, entry: QueueEntryRecord): Promise<void> {
    const redis = getRedisCommandClient();
    if (!redis || !this.ensureRedisReady('upsert')) return;
    await redis.hSet(this.queueKey(matchType), String(entry.userId), JSON.stringify(entry));
  }

  async remove(matchType: MatchType, userId: number): Promise<boolean> {
    const redis = getRedisCommandClient();
    if (!redis || !this.ensureRedisReady('remove')) return false;
    const removed = await redis.hDel(this.queueKey(matchType), String(userId));
    return removed > 0;
  }

  async get(matchType: MatchType, userId: number): Promise<QueueEntryRecord | null> {
    const redis = getRedisCommandClient();
    if (!redis || !this.ensureRedisReady('get')) return null;
    const raw = await redis.hGet(this.queueKey(matchType), String(userId));
    return this.parse(raw);
  }

  async getAll(matchType: MatchType): Promise<QueueEntryRecord[]> {
    const redis = getRedisCommandClient();
    if (!redis || !this.ensureRedisReady('getAll')) return [];
    const all = await redis.hGetAll(this.queueKey(matchType));
    const parsed: QueueEntryRecord[] = [];
    for (const raw of Object.values(all)) {
      const item = this.parse(raw);
      if (item) parsed.push(item);
    }
    return parsed;
  }

  async size(matchType: MatchType): Promise<number> {
    const redis = getRedisCommandClient();
    if (!redis || !this.ensureRedisReady('size')) return 0;
    return redis.hLen(this.queueKey(matchType));
  }

  async clearAll(): Promise<void> {
    const redis = getRedisCommandClient();
    if (!redis || !this.ensureRedisReady('clearAll')) return;
    await Promise.all([redis.del(this.queueKey('casual')), redis.del(this.queueKey('ranked'))]);
  }

  async withLock<T>(matchType: MatchType, fn: () => Promise<T>): Promise<T | null> {
    const redis = getRedisCommandClient();
    if (!redis || !this.ensureRedisReady('withLock')) return null;
    const lockKey = this.lockKey(matchType);
    const token = `${ENV.INSTANCE_ID}-${Date.now()}`;
    const acquired = await redis.set(lockKey, token, { NX: true, PX: 2500 });
    if (acquired !== 'OK') return null;
    try {
      return await fn();
    } finally {
      try {
        const current = await redis.get(lockKey);
        if (current === token) {
          await redis.del(lockKey);
        }
      } catch {
        // Ignore lock release errors in best-effort path.
      }
    }
  }

  private queueKey(matchType: MatchType): string {
    return `${ENV.REDIS_KEY_PREFIX}:mm:queue:${matchType}`;
  }

  private lockKey(matchType: MatchType): string {
    return `${ENV.REDIS_KEY_PREFIX}:mm:lock:${matchType}`;
  }

  private parse(raw: string | null | undefined): QueueEntryRecord | null {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as QueueEntryRecord;
    } catch {
      return null;
    }
  }
}

export const matchmakingStore = new MatchmakingStore();

