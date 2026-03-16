"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchmakingStore = void 0;
const env_1 = require("../../config/env");
const redis_1 = require("../../config/redis");
class MatchmakingStore {
    constructor() {
        this.lastRedisNotReadyLogAt = 0;
    }
    ensureRedisReady(context) {
        const redis = (0, redis_1.getRedisCommandClient)();
        if (redis && (0, redis_1.isRedisReady)())
            return true;
        const now = Date.now();
        if ((now - this.lastRedisNotReadyLogAt) >= 15000) {
            this.lastRedisNotReadyLogAt = now;
            console.warn(`[MatchmakingStore] Redis not ready for ${context}.`);
        }
        return false;
    }
    async upsert(matchType, entry) {
        const redis = (0, redis_1.getRedisCommandClient)();
        if (!redis || !this.ensureRedisReady('upsert'))
            return;
        await redis.hSet(this.queueKey(matchType), String(entry.userId), JSON.stringify(entry));
    }
    async remove(matchType, userId) {
        const redis = (0, redis_1.getRedisCommandClient)();
        if (!redis || !this.ensureRedisReady('remove'))
            return false;
        const removed = await redis.hDel(this.queueKey(matchType), String(userId));
        return removed > 0;
    }
    async get(matchType, userId) {
        const redis = (0, redis_1.getRedisCommandClient)();
        if (!redis || !this.ensureRedisReady('get'))
            return null;
        const raw = await redis.hGet(this.queueKey(matchType), String(userId));
        return this.parse(raw);
    }
    async getAll(matchType) {
        const redis = (0, redis_1.getRedisCommandClient)();
        if (!redis || !this.ensureRedisReady('getAll'))
            return [];
        const all = await redis.hGetAll(this.queueKey(matchType));
        const parsed = [];
        for (const raw of Object.values(all)) {
            const item = this.parse(raw);
            if (item)
                parsed.push(item);
        }
        return parsed;
    }
    async size(matchType) {
        const redis = (0, redis_1.getRedisCommandClient)();
        if (!redis || !this.ensureRedisReady('size'))
            return 0;
        return redis.hLen(this.queueKey(matchType));
    }
    async clearAll() {
        const redis = (0, redis_1.getRedisCommandClient)();
        if (!redis || !this.ensureRedisReady('clearAll'))
            return;
        await Promise.all([redis.del(this.queueKey('casual')), redis.del(this.queueKey('ranked'))]);
    }
    async withLock(matchType, fn) {
        const redis = (0, redis_1.getRedisCommandClient)();
        if (!redis || !this.ensureRedisReady('withLock'))
            return null;
        const lockKey = this.lockKey(matchType);
        const token = `${env_1.ENV.INSTANCE_ID}-${Date.now()}`;
        const acquired = await redis.set(lockKey, token, { NX: true, PX: 2500 });
        if (acquired !== 'OK')
            return null;
        try {
            return await fn();
        }
        finally {
            try {
                const current = await redis.get(lockKey);
                if (current === token) {
                    await redis.del(lockKey);
                }
            }
            catch {
                // Ignore lock release errors in best-effort path.
            }
        }
    }
    queueKey(matchType) {
        return `${env_1.ENV.REDIS_KEY_PREFIX}:mm:queue:${matchType}`;
    }
    lockKey(matchType) {
        return `${env_1.ENV.REDIS_KEY_PREFIX}:mm:lock:${matchType}`;
    }
    parse(raw) {
        if (!raw)
            return null;
        try {
            return JSON.parse(raw);
        }
        catch {
            return null;
        }
    }
}
exports.matchmakingStore = new MatchmakingStore();
//# sourceMappingURL=matchmaking.store.js.map