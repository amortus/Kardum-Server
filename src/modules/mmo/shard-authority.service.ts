import { ENV } from '../../config/env';
import { getRedisCommandClient, isRedisReady } from '../../config/redis';

class ShardAuthorityService {
  private ownedUntilMs = new Map<string, number>();

  async tryClaimOrRenew(shardKey: string): Promise<boolean> {
    if (!ENV.MMO_SHARD_AUTHORITY_ENABLED || !isRedisReady()) return true;
    const redis = getRedisCommandClient();
    if (!redis) return false;
    const key = this.key(shardKey);
    const ttl = Math.max(3000, ENV.SHARD_LOCK_TTL_MS);
    try {
      const currentOwner = await redis.get(key);
      if (currentOwner === ENV.INSTANCE_ID) {
        await redis.pExpire(key, ttl);
        this.ownedUntilMs.set(shardKey, Date.now() + ttl);
        return true;
      }
      const acquired = await redis.set(key, ENV.INSTANCE_ID, { NX: true, PX: ttl });
      if (acquired === 'OK') {
        this.ownedUntilMs.set(shardKey, Date.now() + ttl);
        return true;
      }
      return false;
    } catch (error) {
      console.warn('[ShardAuthority] lock operation failed:', error);
      return false;
    }
  }

  isOwner(shardKey: string): boolean {
    if (!ENV.MMO_SHARD_AUTHORITY_ENABLED || !isRedisReady()) return true;
    const until = this.ownedUntilMs.get(shardKey) || 0;
    return until > Date.now();
  }

  async release(shardKey: string): Promise<void> {
    if (!ENV.MMO_SHARD_AUTHORITY_ENABLED || !isRedisReady()) return;
    const redis = getRedisCommandClient();
    if (!redis) return;
    const key = this.key(shardKey);
    try {
      const owner = await redis.get(key);
      if (owner === ENV.INSTANCE_ID) {
        await redis.del(key);
      }
    } catch (error) {
      console.warn('[ShardAuthority] release failed:', error);
    } finally {
      this.ownedUntilMs.delete(shardKey);
    }
  }

  private key(shardKey: string): string {
    return `${ENV.REDIS_KEY_PREFIX}:mmo:lock:${shardKey}`;
  }
}

export const shardAuthorityService = new ShardAuthorityService();

