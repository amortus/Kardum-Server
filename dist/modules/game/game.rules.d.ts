import { CardInstance, PlayerState } from '../../shared/types';
export declare class GameRules {
    canPlayCard(player: PlayerState, card: CardInstance): {
        valid: boolean;
        error?: string;
    };
    canAttack(attacker: CardInstance, defender: PlayerState): {
        valid: boolean;
        error?: string;
    };
    validateDeck(deck: string[]): {
        valid: boolean;
        error?: string;
    };
    applyCombatDamage(_attacker: CardInstance, target: CardInstance | PlayerState): void;
    private applyDamageToCreature;
    checkWinCondition(player1: PlayerState, player2: PlayerState): string | null;
    getValidAttackTargets(_attacker: CardInstance, defender: PlayerState): CardInstance[];
    canEquip(target: CardInstance, _equipment: CardInstance): {
        valid: boolean;
        error?: string;
    };
}
declare const _default: GameRules;
export default _default;
//# sourceMappingURL=game.rules.d.ts.map