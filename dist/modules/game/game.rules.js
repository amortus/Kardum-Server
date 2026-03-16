"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameRules = void 0;
const types_1 = require("../../shared/types");
const constants_1 = require("../../shared/constants");
class GameRules {
    // Validate if a card can be played
    canPlayCard(player, card) {
        // Check resources
        if (player.warResources < card.cost) {
            return { valid: false, error: 'Insufficient war resources' };
        }
        // Check ability limit
        if (card.type === types_1.CardType.ABILITY && player.abilityUsedThisTurn) {
            return { valid: false, error: 'Only 1 ability per turn' };
        }
        // Check mount limit
        if (card.type === types_1.CardType.MOUNT && player.mountUsedThisTurn) {
            return { valid: false, error: 'Only 1 mount per turn' };
        }
        return { valid: true };
    }
    // Validate if a creature can attack
    canAttack(attacker, defender) {
        // Already attacked
        if (attacker.hasAttacked) {
            return { valid: false, error: 'Already attacked this turn' };
        }
        // Summoning sickness (unless has Rush or Charge)
        if (attacker.isSummoned && !attacker.hasAbilities.includes(types_1.Ability.RUSH) && !attacker.hasAbilities.includes(types_1.Ability.CHARGE)) {
            return { valid: false, error: 'Cannot attack on summoning turn (no Rush)' };
        }
        // Check if must attack Taunt
        const tauntCreatures = defender.field.filter(c => c.hasAbilities.includes(types_1.Ability.TAUNT));
        if (tauntCreatures.length > 0) {
            return { valid: true }; // Must select a Taunt target
        }
        return { valid: true };
    }
    // Validate deck
    validateDeck(deck) {
        if (deck.length < constants_1.GAME_CONSTANTS.MIN_DECK_SIZE || deck.length > constants_1.GAME_CONSTANTS.MAX_DECK_SIZE) {
            return {
                valid: false,
                error: `Deck must have between ${constants_1.GAME_CONSTANTS.MIN_DECK_SIZE} and ${constants_1.GAME_CONSTANTS.MAX_DECK_SIZE} cards`
            };
        }
        return { valid: true };
    }
    // Apply combat damage
    applyCombatDamage(_attacker, target) {
        const damage = _attacker.currentAttack;
        if ('currentDefense' in target) {
            // Target is a creature or general
            this.applyDamageToCreature(target, damage, _attacker);
        }
    }
    applyDamageToCreature(target, damage, source) {
        // Check Divine Shield
        if (target.hasAbilities.includes(types_1.Ability.DIVINE_SHIELD)) {
            // Remove Divine Shield instead of taking damage
            const index = target.hasAbilities.indexOf(types_1.Ability.DIVINE_SHIELD);
            target.hasAbilities.splice(index, 1);
            return;
        }
        // Apply damage
        target.currentDefense -= damage;
        // Apply Lifesteal if source has it
        if (source && source.hasAbilities.includes(types_1.Ability.LIFESTEAL)) {
            // Lifesteal healing will be handled by game logic
        }
    }
    // Check win condition
    checkWinCondition(player1, player2) {
        if (player1.health <= 0) {
            return 'player2';
        }
        if (player2.health <= 0) {
            return 'player1';
        }
        return null;
    }
    // Get valid attack targets
    getValidAttackTargets(_attacker, defender) {
        // Check for Taunt creatures
        const tauntCreatures = defender.field.filter(c => c.hasAbilities.includes(types_1.Ability.TAUNT));
        if (tauntCreatures.length > 0) {
            return tauntCreatures;
        }
        // Can attack any creature; direct player damage is validated in actions
        return defender.field;
    }
    // Check if player can equip
    canEquip(target, _equipment) {
        // Equipment can only be equipped to Defenders
        if (target.type !== types_1.CardType.DEFENDER) {
            return { valid: false, error: 'Can only equip Defenders' };
        }
        // Already has equipment
        if (target.equipped) {
            // Will replace existing equipment
        }
        return { valid: true };
    }
}
exports.GameRules = GameRules;
exports.default = new GameRules();
//# sourceMappingURL=game.rules.js.map