"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shardAuthorityService = void 0;
const env_1 = require("../../config/env");
const redis_1 = require("../../config/redis");
class ShardAuthorityService {
    constructor() {
        this.ownedUntilMs = new Map();
    }
    async tryClaimOrRenew(shardKey) {
        if (!env_1.ENV.MMO_SHARD_AUTHORITY_ENABLED || !(0, redis_1.isRedisReady)())
            return true;
        const redis = (0, redis_1.getRedisCommandClient)();
        if (!redis)
            return false;
        const key = this.key(shardKey);
        const ttl = Math.max(3000, env_1.ENV.SHARD_LOCK_TTL_MS);
        try {
            const currentOwner = await redis.get(key);
            if (currentOwner === env_1.ENV.INSTANCE_ID) {
                await redis.pExpire(key, ttl);
                this.ownedUntilMs.set(shardKey, Date.now() + ttl);
                return true;
            }
            const acquired = await redis.set(key, env_1.ENV.INSTANCE_ID, { NX: true, PX: ttl });
            if (acquired === 'OK') {
                this.ownedUntilMs.set(shardKey, Date.now() + ttl);
                return true;
            }
            return false;
        }
        catch (error) {
            console.warn('[ShardAuthority] lock operation failed:', error);
            return false;
        }
    }
    isOwner(shardKey) {
        if (!env_1.ENV.MMO_SHARD_AUTHORITY_ENABLED || !(0, redis_1.isRedisReady)())
            return true;
        const until = this.ownedUntilMs.get(shardKey) || 0;
        return until > Date.now();
    }
    async release(shardKey) {
        if (!env_1.ENV.MMO_SHARD_AUTHORITY_ENABLED || !(0, redis_1.isRedisReady)())
            return;
        const redis = (0, redis_1.getRedisCommandClient)();
        if (!redis)
            return;
        const key = this.key(shardKey);
        try {
            const owner = await redis.get(key);
            if (owner === env_1.ENV.INSTANCE_ID) {
                await redis.del(key);
            }
        }
        catch (error) {
            console.warn('[ShardAuthority] release failed:', error);
        }
        finally {
            this.ownedUntilMs.delete(shardKey);
        }
    }
    key(shardKey) {
        return `${env_1.ENV.REDIS_KEY_PREFIX}:mmo:lock:${shardKey}`;
    }
}
exports.shardAuthorityService = new ShardAuthorityService();
//# sourceMappingURL=shard-authority.service.js.map