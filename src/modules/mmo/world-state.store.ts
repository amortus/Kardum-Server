import { ENV } from '../../config/env';
import { getRedisCommandClient, getRedisSubClient, isRedisReady } from '../../config/redis';

type WorldPosition = { zone: string; x: number; y: number; updatedAt: number };
type StateEvent =
  | { type: 'user_zone_set'; userId: number; zone: string }
  | { type: 'user_zone_delete'; userId: number }
  | { type: 'user_zone_key_set'; userId: number; zoneKey: string }
  | { type: 'user_zone_key_delete'; userId: number }
  | { type: 'user_position_set'; userId: number; position: WorldPosition }
  | { type: 'user_position_delete'; userId: number }
  | { type: 'visible_players_set'; userId: number; visible: number[] }
  | { type: 'visible_players_delete'; userId: number }
  | { type: 'zone_member_add'; zoneKey: string; userId: number }
  | { type: 'zone_member_remove'; zoneKey: string; userId: number };

const STATE_CHANNEL = 'mmo:state:events';

class WorldStateStore {
  readonly userZones = new Map<number, string>();
  readonly userZoneChannels = new Map<number, string>();
  readonly zoneChannelMembers = new Map<string, Set<number>>();
  readonly userWorldPosition = new Map<number, WorldPosition>();
  readonly userVisiblePlayers = new Map<number, Set<number>>();
  private subscribed = false;

  async initialize(): Promise<void> {
    if (!ENV.MMO_DISTRIBUTED_STATE_ENABLED || !isRedisReady() || this.subscribed) return;
    const sub = getRedisSubClient();
    if (!sub) return;
    await sub.subscribe(this.key(STATE_CHANNEL), (message) => {
      try {
        const event = JSON.parse(message) as StateEvent;
        this.applyRemoteEvent(event);
      } catch (error) {
        console.warn('[WorldState] failed to parse state event', error);
      }
    });
    this.subscribed = true;
  }

  setUserZone(userId: number, zone: string): void {
    this.userZones.set(userId, zone);
    void this.persistAndPublish(
      async () => {
        const redis = getRedisCommandClient();
        if (!redis) return;
        await redis.hSet(this.key('mmo:user:zones'), String(userId), zone);
      },
      { type: 'user_zone_set', userId, zone }
    );
  }

  deleteUserZone(userId: number): void {
    this.userZones.delete(userId);
    void this.persistAndPublish(
      async () => {
        const redis = getRedisCommandClient();
        if (!redis) return;
        await redis.hDel(this.key('mmo:user:zones'), String(userId));
      },
      { type: 'user_zone_delete', userId }
    );
  }

  setUserZoneChannel(userId: number, zoneKey: string): void {
    this.userZoneChannels.set(userId, zoneKey);
    void this.persistAndPublish(
      async () => {
        const redis = getRedisCommandClient();
        if (!redis) return;
        await redis.hSet(this.key('mmo:user:zoneKeys'), String(userId), zoneKey);
      },
      { type: 'user_zone_key_set', userId, zoneKey }
    );
  }

  deleteUserZoneChannel(userId: number): void {
    this.userZoneChannels.delete(userId);
    void this.persistAndPublish(
      async () => {
        const redis = getRedisCommandClient();
        if (!redis) return;
        await redis.hDel(this.key('mmo:user:zoneKeys'), String(userId));
      },
      { type: 'user_zone_key_delete', userId }
    );
  }

  setUserWorldPosition(userId: number, position: WorldPosition): void {
    this.userWorldPosition.set(userId, position);
    void this.persistAndPublish(
      async () => {
        const redis = getRedisCommandClient();
        if (!redis) return;
        await redis.hSet(this.key('mmo:user:positions'), String(userId), JSON.stringify(position));
      },
      { type: 'user_position_set', userId, position }
    );
  }

  deleteUserWorldPosition(userId: number): void {
    this.userWorldPosition.delete(userId);
    void this.persistAndPublish(
      async () => {
        const redis = getRedisCommandClient();
        if (!redis) return;
        await redis.hDel(this.key('mmo:user:positions'), String(userId));
      },
      { type: 'user_position_delete', userId }
    );
  }

  setUserVisiblePlayers(userId: number, visible: Set<number>): void {
    this.userVisiblePlayers.set(userId, new Set(visible));
    void this.persistAndPublish(
      async () => {
        const redis = getRedisCommandClient();
        if (!redis) return;
        const values = Array.from(visible.values()).map(String);
        const listKey = this.key(`mmo:visible:${userId}`);
        await redis.del(listKey);
        if (values.length > 0) {
          await redis.sAdd(listKey, values);
        }
      },
      { type: 'visible_players_set', userId, visible: Array.from(visible.values()) }
    );
  }

  deleteUserVisiblePlayers(userId: number): void {
    this.userVisiblePlayers.delete(userId);
    void this.persistAndPublish(
      async () => {
        const redis = getRedisCommandClient();
        if (!redis) return;
        await redis.del(this.key(`mmo:visible:${userId}`));
      },
      { type: 'visible_players_delete', userId }
    );
  }

  addUserToZoneChannel(zoneKey: string, userId: number): void {
    if (!this.zoneChannelMembers.has(zoneKey)) {
      this.zoneChannelMembers.set(zoneKey, new Set<number>());
    }
    this.zoneChannelMembers.get(zoneKey)!.add(userId);
    void this.persistAndPublish(
      async () => {
        const redis = getRedisCommandClient();
        if (!redis) return;
        await redis.sAdd(this.key(`mmo:zone:${zoneKey}:members`), String(userId));
      },
      { type: 'zone_member_add', zoneKey, userId }
    );
  }

  removeUserFromZoneChannel(zoneKey: string, userId: number): void {
    const members = this.zoneChannelMembers.get(zoneKey);
    if (members) {
      members.delete(userId);
      if (members.size === 0) this.zoneChannelMembers.delete(zoneKey);
    }
    void this.persistAndPublish(
      async () => {
        const redis = getRedisCommandClient();
        if (!redis) return;
        await redis.sRem(this.key(`mmo:zone:${zoneKey}:members`), String(userId));
      },
      { type: 'zone_member_remove', zoneKey, userId }
    );
  }

  private async persistAndPublish(persistOp: () => Promise<void>, event: StateEvent): Promise<void> {
    if (!ENV.MMO_DISTRIBUTED_STATE_ENABLED || !isRedisReady()) return;
    const redis = getRedisCommandClient();
    if (!redis) return;
    try {
      await persistOp();
      await redis.publish(this.key(STATE_CHANNEL), JSON.stringify(event));
    } catch (error) {
      console.warn('[WorldState] persist/publish failed:', error);
    }
  }

  private applyRemoteEvent(event: StateEvent): void {
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
          this.zoneChannelMembers.set(event.zoneKey, new Set<number>());
        }
        this.zoneChannelMembers.get(event.zoneKey)!.add(event.userId);
        break;
      }
      case 'zone_member_remove': {
        const members = this.zoneChannelMembers.get(event.zoneKey);
        if (!members) break;
        members.delete(event.userId);
        if (members.size === 0) this.zoneChannelMembers.delete(event.zoneKey);
        break;
      }
      default:
        break;
    }
  }

  private key(suffix: string): string {
    return `${ENV.REDIS_KEY_PREFIX}:${suffix}`;
  }
}

export const worldStateStore = new WorldStateStore();
export type { WorldPosition };

