export type MatchType = 'casual' | 'ranked';
export type QueueEntryRecord = {
    userId: number;
    socketId: string;
    matchType: MatchType;
    elo: number;
    deckId: number;
    joinedAt: number;
};
declare class MatchmakingStore {
    private lastRedisNotReadyLogAt;
    private ensureRedisReady;
    upsert(matchType: MatchType, entry: QueueEntryRecord): Promise<void>;
    remove(matchType: MatchType, userId: number): Promise<boolean>;
    get(matchType: MatchType, userId: number): Promise<QueueEntryRecord | null>;
    getAll(matchType: MatchType): Promise<QueueEntryRecord[]>;
    size(matchType: MatchType): Promise<number>;
    clearAll(): Promise<void>;
    withLock<T>(matchType: MatchType, fn: () => Promise<T>): Promise<T | null>;
    private queueKey;
    private lockKey;
    private parse;
}
export declare const matchmakingStore: MatchmakingStore;
export {};
//# sourceMappingURL=matchmaking.store.d.ts.map