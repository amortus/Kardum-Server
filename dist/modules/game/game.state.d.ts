import { GameState } from '../../shared/types';
export declare class GameStateManager {
    private state;
    private listeners;
    constructor();
    private createInitialState;
    private createPlayerState;
    startGame(player1Deck: string[], player2Deck: string[]): Promise<void>;
    private createCardInstance;
    private drawCards;
    private applyEmptyDeckPenalty;
    startTurn(): Promise<void>;
    endTurn(): Promise<void>;
    endGame(winnerId: string): void;
    logAction(action: string, data: any): void;
    getState(): GameState;
    getPublicState(): any;
    private getPlayerPublicState;
    addEventListener(listener: (event: string, data: any) => void): void;
    private emit;
    private shuffle;
}
//# sourceMappingURL=game.state.d.ts.map