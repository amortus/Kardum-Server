import { type RedisClientType } from 'redis';
export declare function initializeRedis(): Promise<void>;
export declare function isRedisReady(): boolean;
export declare function getRedisCommandClient(): RedisClientType | null;
export declare function getRedisPubClient(): RedisClientType | null;
export declare function getRedisSubClient(): RedisClientType | null;
export declare function pingRedis(): Promise<boolean>;
//# sourceMappingURL=redis.d.ts.map