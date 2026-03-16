import { type MatchType } from './matchmaking.store';
interface QueueEntry {
    userId: number;
    socketId: string;
    matchType: MatchType;
    elo: number;
    deckId: number;
    joinedAt: number;
    timeout?: NodeJS.Timeout;
}
declare class MatchmakingService {
    private queues;
    constructor();
    addToQueue(userId: number, socketId: string, matchType: MatchType, deckId: number): Promise<{
        player1: QueueEntry;
        player2: QueueEntry;
    } | null>;
    removeFromQueue(userId: number, matchType: MatchType): boolean;
    private findMatch;
    getQueueStatus(userId: number, matchType: 'casual' | 'ranked'): any;
    clearQueues(): void;
    private findMatchDistributed;
}
declare const _default: MatchmakingService;
export default _default;
//# sourceMappingURL=matchmaking.service.d.ts.map