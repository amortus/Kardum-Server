import { CardInstance, PlayerState, CardType, Ability } from '../../shared/types';
import { GAME_CONSTANTS } from '../../shared/constants';

export class GameRules {
  // Validate if a card can be played
  canPlayCard(player: PlayerState, card: CardInstance): { valid: boolean; error?: string } {
    // Check resources
    if (player.warResources < card.cost) {
      return { valid: false, error: 'Insufficient war resources' };
    }

    // Check ability limit
    if (card.type === CardType.ABILITY && player.abilityUsedThisTurn) {
      return { valid: false, error: 'Only 1 ability per turn' };
    }

    // Check mount limit
    if (card.type === CardType.MOUNT && player.mountUsedThisTurn) {
      return { valid: false, error: 'Only 1 mount per turn' };
    }

    return { valid: true };
  }

  // Validate if a creature can attack
  canAttack(attacker: CardInstance, defender: PlayerState): { valid: boolean; error?: string } {
    // Already attacked
    if (attacker.hasAttacked) {
      return { valid: false, error: 'Already attacked this turn' };
    }

    // Summoning sickness (unless has Rush or Charge)
    if (attacker.isSummoned && !attacker.hasAbilities.includes(Ability.RUSH) && !attacker.hasAbilities.includes(Ability.CHARGE)) {
      return { valid: false, error: 'Cannot attack on summoning turn (no Rush)' };
    }

    // Check if must attack Taunt
    const tauntCreatures = defender.field.filter(c => c.hasAbilities.includes(Ability.TAUNT));
    if (tauntCreatures.length > 0) {
      return { valid: true }; // Must select a Taunt target
    }

    return { valid: true };
  }

  // Validate deck
  validateDeck(deck: string[]): { valid: boolean; error?: string } {
    if (deck.length < GAME_CONSTANTS.MIN_DECK_SIZE || deck.length > GAME_CONSTANTS.MAX_DECK_SIZE) {
      return { 
        valid: false, 
        error: `Deck must have between ${GAME_CONSTANTS.MIN_DECK_SIZE} and ${GAME_CONSTANTS.MAX_DECK_SIZE} cards` 
      };
    }

    return { valid: true };
  }

  // Apply combat damage
  applyCombatDamage(_attacker: CardInstance, target: CardInstance | PlayerState): void {
    const damage = _attacker.currentAttack;

    if ('currentDefense' in target) {
      // Target is a creature or general
      this.applyDamageToCreature(target, damage, _attacker);
    }
  }

  private applyDamageToCreature(target: CardInstance, damage: number, source?: CardInstance): void {
    // Check Divine Shield
    if (target.hasAbilities.includes(Ability.DIVINE_SHIELD)) {
      // Remove Divine Shield instead of taking damage
      const index = target.hasAbilities.indexOf(Ability.DIVINE_SHIELD);
      target.hasAbilities.splice(index, 1);
      return;
    }

    // Apply damage
    target.currentDefense -= damage;

    // Apply Lifesteal if source has it
    if (source && source.hasAbilities.includes(Ability.LIFESTEAL)) {
      // Lifesteal healing will be handled by game logic
    }
  }

  // Check win condition
  checkWinCondition(player1: PlayerState, player2: PlayerState): string | null {
    if (player1.health <= 0) {
      return 'player2';
    }
    if (player2.health <= 0) {
      return 'player1';
    }
    return null;
  }

  // Get valid attack targets
  getValidAttackTargets(_attacker: CardInstance, defender: PlayerState): CardInstance[] {
    // Check for Taunt creatures
    const tauntCreatures = defender.field.filter(c => c.hasAbilities.includes(Ability.TAUNT));
    
    if (tauntCreatures.length > 0) {
      return tauntCreatures;
    }

    // Can attack any creature; direct player damage is validated in actions
    return defender.field;
  }

  // Check if player can equip
  canEquip(target: CardInstance, _equipment: CardInstance): { valid: boolean; error?: string } {
    // Equipment can only be equipped to Defenders
    if (target.type !== CardType.DEFENDER) {
      return { valid: false, error: 'Can only equip Defenders' };
    }

    // Already has equipment
    if (target.equipped) {
      // Will replace existing equipment
    }

    return { valid: true };
  }
}

export default new GameRules();
