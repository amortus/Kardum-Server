import { MatchState } from '../../shared/types';
export declare class MatchManager {
    createMatch(player1Id: number, player2Id: number, player1DeckId: number, player2DeckId: number, matchType: 'casual' | 'ranked' | 'ai'): Promise<number>;
    startMatch(matchId: number): Promise<void>;
    getMatch(matchId: number): MatchState | null;
    setPlayerReady(matchId: number, playerId: number): void;
    areBothPlayersReady(matchId: number): boolean;
    processAction(matchId: number, playerId: number, action: any): Promise<{
        success: boolean;
        error?: string;
        state?: any;
    }>;
    autoAdvanceExpiredPhases(timeoutMs: number): Promise<Array<{
        match: MatchState;
        matchId: number;
        state: any;
    }>>;
    endMatch(matchId: number, winnerId: number): void;
    getMatchState(matchId: number): any;
    findActiveMatchByUser(userId: number): MatchState | null;
}
declare const _default: MatchManager;
export default _default;
//# sourceMappingURL=match.manager.d.ts.map