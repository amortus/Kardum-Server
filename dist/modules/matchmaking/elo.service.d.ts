declare class EloService {
    private toSafeInt;
    calculateEloChange(winnerElo: number, loserElo: number, matchType: 'casual' | 'ranked' | 'ai'): {
        winnerChange: number;
        loserChange: number;
    };
    updateEloAfterMatch(player1Id: number, player2Id: number, winnerId: number, matchType: 'casual' | 'ranked' | 'ai'): Promise<{
        player1EloChange: number;
        player2EloChange: number;
        player1NewElo: number;
        player2NewElo: number;
        expUpdate: {
            player1ExpGained: number;
            player1NewLevel: number;
            player1LeveledUp: boolean;
            player2ExpGained: number;
            player2NewLevel: number;
            player2LeveledUp: boolean;
        };
    }>;
}
declare const _default: EloService;
export default _default;
//# sourceMappingURL=elo.service.d.ts.map