type WorldPosition = {
    zone: string;
    x: number;
    y: number;
    updatedAt: number;
};
declare class WorldStateStore {
    readonly userZones: Map<number, string>;
    readonly userZoneChannels: Map<number, string>;
    readonly zoneChannelMembers: Map<string, Set<number>>;
    readonly userWorldPosition: Map<number, WorldPosition>;
    readonly userVisiblePlayers: Map<number, Set<number>>;
    private subscribed;
    initialize(): Promise<void>;
    setUserZone(userId: number, zone: string): void;
    deleteUserZone(userId: number): void;
    setUserZoneChannel(userId: number, zoneKey: string): void;
    deleteUserZoneChannel(userId: number): void;
    setUserWorldPosition(userId: number, position: WorldPosition): void;
    deleteUserWorldPosition(userId: number): void;
    setUserVisiblePlayers(userId: number, visible: Set<number>): void;
    deleteUserVisiblePlayers(userId: number): void;
    addUserToZoneChannel(zoneKey: string, userId: number): void;
    removeUserFromZoneChannel(zoneKey: string, userId: number): void;
    private persistAndPublish;
    private applyRemoteEvent;
    private key;
}
export declare const worldStateStore: WorldStateStore;
export type { WorldPosition };
//# sourceMappingURL=world-state.store.d.ts.map