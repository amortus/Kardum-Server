export declare class GameLogic {
    private gameState;
    private gameActions;
    constructor();
    initialize(player1Deck: string[], player2Deck: string[]): Promise<void>;
    processAction(playerId: 'player1' | 'player2', action: {
        type: string;
        [key: string]: any;
    }): Promise<{
        success: boolean;
        error?: string;
        state?: any;
    }>;
    getState(): any;
    getFullState(): any;
    addEventListener(listener: (event: string, data: any) => void): void;
}
//# sourceMappingURL=game.logic.d.ts.map