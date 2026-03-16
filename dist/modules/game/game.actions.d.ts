import { GameStateManager } from './game.state';
export declare class GameActions {
    private gameState;
    constructor(gameState: GameStateManager);
    playCard(playerId: 'player1' | 'player2', cardInstanceId: string, options?: {
        targetId?: string;
        asDefender?: boolean;
    }): Promise<{
        success: boolean;
        error?: string;
    }>;
    declareAttack(playerId: 'player1' | 'player2', attackerId: string, targetId: string): {
        success: boolean;
        error?: string;
    };
    private equipCard;
    private activateConsumable;
    private activateAbility;
    private getCardEffects;
    private applyOnEnterEffects;
    private applyOnDamageEffects;
    private applyOnAttackEffects;
    private summonTokenFromEffect;
    private pickRandomEnemyCreature;
    private handleCreatureDeath;
    private applyCardEffect;
    private prevalidatePlayTarget;
    private resolveTargetById;
    private resolveEffectTarget;
    private removeDeadCreatures;
    private resolveBoardDeaths;
    private applyTimedBuffIfNeeded;
    processTurnBoundaryEffects(playerId: 'player1' | 'player2', trigger: 'START_TURN' | 'END_TURN'): void;
    private processDurationEffects;
    private hasAbility;
    private toSafeNumber;
}
//# sourceMappingURL=game.actions.d.ts.map