"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.worldStateStore = void 0;
const env_1 = require("../../config/env");
const redis_1 = require("../../config/redis");
const STATE_CHANNEL = 'mmo:state:events';
class WorldStateStore {
    constructor() {
        this.userZones = new Map();
        this.userZoneChannels = new Map();
        this.zoneChannelMembers = new Map();
        this.userWorldPosition = new Map();
        this.userVisiblePlayers = new Map();
        this.subscribed = false;
    }
    async initialize() {
        if (!env_1.ENV.MMO_DISTRIBUTED_STATE_ENABLED || !(0, redis_1.isRedisReady)() || this.subscribed)
            return;
        const sub = (0, redis_1.getRedisSubClient)();
        if (!sub)
            return;
        await sub.subscribe(this.key(STATE_CHANNEL), (message) => {
            try {
                const event = JSON.parse(message);
                this.applyRemoteEvent(event);
            }
            catch (error) {
                console.warn('[WorldState] failed to parse state event', error);
            }
        });
        this.subscribed = true;
    }
    setUserZone(userId, zone) {
        this.userZones.set(userId, zone);
        void this.persistAndPublish(async () => {
            const redis = (0, redis_1.getRedisCommandClient)();
            if (!redis)
                return;
            await redis.hSet(this.key('mmo:user:zones'), String(userId), zone);
        }, { type: 'user_zone_set', userId, zone });
    }
    deleteUserZone(userId) {
        this.userZones.delete(userId);
        void this.persistAndPublish(async () => {
            const redis = (0, redis_1.getRedisCommandClient)();
            if (!redis)
                return;
            await redis.hDel(this.key('mmo:user:zones'), String(userId));
        }, { type: 'user_zone_delete', userId });
    }
    setUserZoneChannel(userId, zoneKey) {
        this.userZoneChannels.set(userId, zoneKey);
        void this.persistAndPublish(async () => {
            const redis = (0, redis_1.getRedisCommandClient)();
            if (!redis)
                return;
            await redis.hSet(this.key('mmo:user:zoneKeys'), String(userId), zoneKey);
        }, { type: 'user_zone_key_set', userId, zoneKey });
    }
    deleteUserZoneChannel(userId) {
        this.userZoneChannels.delete(userId);
        void this.persistAndPublish(async () => {
            const redis = (0, redis_1.getRedisCommandClient)();
            if (!redis)
                return;
            await redis.hDel(this.key('mmo:user:zoneKeys'), String(userId));
        }, { type: 'user_zone_key_delete', userId });
    }
    setUserWorldPosition(userId, position) {
        this.userWorldPosition.set(userId, position);
        void this.persistAndPublish(async () => {
            const redis = (0, redis_1.getRedisCommandClient)();
            if (!redis)
                return;
            await redis.hSet(this.key('mmo:user:positions'), String(userId), JSON.stringify(position));
        }, { type: 'user_position_set', userId, position });
    }
    deleteUserWorldPosition(userId) {
        this.userWorldPosition.delete(userId);
        void this.persistAndPublish(async () => {
            const redis = (0, redis_1.getRedisCommandClient)();
            if (!redis)
                return;
            await redis.hDel(this.key('mmo:user:positions'), String(userId));
        }, { type: 'user_position_delete', userId });
    }
    setUserVisiblePlayers(userId, visible) {
        this.userVisiblePlayers.set(userId, new Set(visible));
        void this.persistAndPublish(async () => {
            const redis = (0, redis_1.getRedisCommandClient)();
            if (!redis)
                return;
            const values = Array.from(visible.values()).map(String);
            const listKey = this.key(`mmo:visible:${userId}`);
            await redis.del(listKey);
            if (values.length > 0) {
                await redis.sAdd(listKey, values);
            }
        }, { type: 'visible_players_set', userId, visible: Array.from(visible.values()) });
    }
    deleteUserVisiblePlayers(userId) {
        this.userVisiblePlayers.delete(userId);
        void this.persistAndPublish(async () => {
            const redis = (0, redis_1.getRedisCommandClient)();
            if (!redis)
                return;
            await redis.del(this.key(`mmo:visible:${userId}`));
        }, { type: 'visible_players_delete', userId });
    }
    addUserToZoneChannel(zoneKey, userId) {
        if (!this.zoneChannelMembers.has(zoneKey)) {
            this.zoneChannelMembers.set(zoneKey, new Set());
        }
        this.zoneChannelMembers.get(zoneKey).add(userId);
        void this.persistAndPublish(async () => {
            const redis = (0, redis_1.getRedisCommandClient)();
            if (!redis)
                return;
            await redis.sAdd(this.key(`mmo:zone:${zoneKey}:members`), String(userId));
        }, { type: 'zone_member_add', zoneKey, userId });
    }
    removeUserFromZoneChannel(zoneKey, userId) {
        const members = this.zoneChannelMembers.get(zoneKey);
        if (members) {
            members.delete(userId);
            if (members.size === 0)
                this.zoneChannelMembers.delete(zoneKey);
        }
        void this.persistAndPublish(async () => {
            const redis = (0, redis_1.getRedisCommandClient)();
            if (!redis)
                return;
            await redis.sRem(this.key(`mmo:zone:${zoneKey}:members`), String(userId));
        }, { type: 'zone_member_remove', zoneKey, userId });
    }
    async persistAndPublish(persistOp, event) {
        if (!env_1.ENV.MMO_DISTRIBUTED_STATE_ENABLED || !(0, redis_1.isRedisReady)())
            return;
        const redis = (0, redis_1.getRedisCommandClient)();
        if (!redis)
            return;
        try {
            await persistOp();
            await redis.publish(this.key(STATE_CHANNEL), JSON.stringify(event));
        }
        catch (error) {
            console.warn('[WorldState] persist/publish failed:', error);
        }
    }
    applyRemoteEvent(event) {
        switch (event.type) {
            case 'user_zone_set':
                this.userZones.set(event.userId, event.zone);
                break;
            case 'user_zone_delete':
                this.userZones.delete(event.userId);
                break;
            case 'user_zone_key_set':
                this.userZoneChannels.set(event.userId, event.zoneKey);
                break;
            case 'user_zone_key_delete':
                this.userZoneChannels.delete(event.userId);
                break;
            case 'user_position_set':
                this.userWorldPosition.set(event.userId, event.position);
                break;
            case 'user_position_delete':
                this.userWorldPosition.delete(event.userId);
                break;
            case 'visible_players_set':
                this.userVisiblePlayers.set(event.userId, new Set(event.visible));
                break;
            case 'visible_players_delete':
                this.userVisiblePlayers.delete(event.userId);
                break;
            case 'zone_member_add': {
                if (!this.zoneChannelMembers.has(event.zoneKey)) {
                    this.zoneChannelMembers.set(event.zoneKey, new Set());
                }
                this.zoneChannelMembers.get(event.zoneKey).add(event.userId);
                break;
            }
            case 'zone_member_remove': {
                const members = this.zoneChannelMembers.get(event.zoneKey);
                if (!members)
                    break;
                members.delete(event.userId);
                if (members.size === 0)
                    this.zoneChannelMembers.delete(event.zoneKey);
                break;
            }
            default:
                break;
        }
    }
    key(suffix) {
        return `${env_1.ENV.REDIS_KEY_PREFIX}:${suffix}`;
    }
}
exports.worldStateStore = new WorldStateStore();
//# sourceMappingURL=world-state.store.js.map