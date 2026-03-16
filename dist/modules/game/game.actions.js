"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameActions = void 0;
const types_1 = require("../../shared/types");
const game_rules_1 = __importDefault(require("./game.rules"));
const constants_1 = require("../../shared/constants");
class GameActions {
    constructor(gameState) {
        this.gameState = gameState;
    }
    // Play a card from hand
    async playCard(playerId, cardInstanceId, options = {}) {
        const state = this.gameState.getState();
        const player = state.players[playerId];
        const opponent = state.players[playerId === 'player1' ? 'player2' : 'player1'];
        // Check if it's player's turn
        if (state.currentPlayer !== playerId) {
            return { success: false, error: 'Not your turn' };
        }
        // Match Play vs AI flow:
        // - STRATEGY: all playable card types.
        // - COMBAT: only ABILITY cards.
        if (state.currentPhase !== types_1.GamePhase.STRATEGY && state.currentPhase !== types_1.GamePhase.COMBAT) {
            return { success: false, error: 'Cannot play cards in this phase' };
        }
        // Find card in hand
        const cardIndex = player.hand.findIndex(c => c.instanceId === cardInstanceId);
        if (cardIndex === -1) {
            return { success: false, error: 'Card not in hand' };
        }
        const card = player.hand[cardIndex];
        if (state.currentPhase === types_1.GamePhase.COMBAT && card.type !== types_1.CardType.ABILITY) {
            return { success: false, error: 'Only abilities can be played in combat phase' };
        }
        // Validate if can play
        const validation = game_rules_1.default.canPlayCard(player, card);
        if (!validation.valid) {
            return { success: false, error: validation.error };
        }
        // Pre-validate target requirements before consuming resources.
        const targetCheck = this.prevalidatePlayTarget(player, opponent, card, options);
        if (!targetCheck.success) {
            return targetCheck;
        }
        // Consume resources
        player.warResources = this.toSafeNumber(player.warResources, 0) - this.toSafeNumber(card.cost, 0);
        // Remove from hand
        player.hand.splice(cardIndex, 1);
        // Process based on type
        let result = { success: true };
        switch (card.type) {
            case types_1.CardType.DEFENDER:
                card.isSummoned = true;
                player.field.push(card);
                this.applyOnEnterEffects(player, opponent, card);
                break;
            case types_1.CardType.EQUIPMENT:
                if (options.targetId) {
                    result = this.equipCard(player, card, options.targetId);
                }
                else {
                    return { success: false, error: 'Equipment requires target' };
                }
                break;
            case types_1.CardType.MOUNT:
                player.mountUsedThisTurn = true;
                if (options.asDefender !== false) {
                    card.isSummoned = true;
                    player.field.push(card);
                    this.applyOnEnterEffects(player, opponent, card);
                }
                else if (options.targetId) {
                    result = this.equipCard(player, card, options.targetId);
                }
                else {
                    return { success: false, error: 'Mount requires choice' };
                }
                break;
            case types_1.CardType.CONSUMABLE:
                result = this.activateConsumable(player, opponent, card, options);
                if (result.success) {
                    player.graveyard.push(card);
                }
                break;
            case types_1.CardType.ABILITY:
                player.abilityUsedThisTurn = true;
                result = this.activateAbility(player, opponent, card, options);
                if (result.success) {
                    player.graveyard.push(card);
                }
                break;
        }
        if (!result.success) {
            player.warResources = this.toSafeNumber(player.warResources, 0) + this.toSafeNumber(card.cost, 0);
            player.hand.splice(Math.min(cardIndex, player.hand.length), 0, card);
            return result;
        }
        this.gameState.logAction('playCard', { playerId, card: card.name });
        return result;
    }
    // Declare attack
    declareAttack(playerId, attackerId, targetId) {
        const state = this.gameState.getState();
        if (state.currentPlayer !== playerId) {
            return { success: false, error: 'Not your turn' };
        }
        if (state.currentPhase !== types_1.GamePhase.COMBAT) {
            return { success: false, error: 'Attacks are only allowed in combat phase' };
        }
        const attacker = state.players[playerId];
        const defender = state.players[playerId === 'player1' ? 'player2' : 'player1'];
        // Find attacker
        const attackerCard = attacker.field.find(c => c.instanceId === attackerId);
        if (!attackerCard) {
            return { success: false, error: 'Attacker not found' };
        }
        if (attackerCard.currentAttack <= 0) {
            return { success: false, error: 'Attacker has no attack' };
        }
        if (attackerCard.isSummoned && !this.hasAbility(attackerCard, 'rush') && !this.hasAbility(attackerCard, 'charge')) {
            return { success: false, error: 'Summoning sickness' };
        }
        // Validate can attack
        const validation = game_rules_1.default.canAttack(attackerCard, defender);
        if (!validation.valid) {
            return { success: false, error: validation.error };
        }
        // Find target
        let target = null;
        if (targetId !== 'general') {
            target = defender.field.find(c => c.instanceId === targetId) || null;
        }
        if (targetId !== 'general' && !target) {
            return { success: false, error: 'Target not found' };
        }
        // Stealth target validation
        if (target && this.hasAbility(target, 'stealth')) {
            return { success: false, error: 'Cannot attack stealth target' };
        }
        // Taunt validation
        const taunts = defender.field.filter((c) => this.hasAbility(c, 'taunt') && !this.hasAbility(c, 'stealth'));
        if (taunts.length > 0) {
            if (targetId === 'general') {
                return { success: false, error: 'Must attack taunt first' };
            }
            if (!taunts.find((t) => t.instanceId === targetId)) {
                return { success: false, error: 'Must attack taunt first' };
            }
        }
        // Stealth breaks as soon as the attacker declares an attack.
        if (this.hasAbility(attackerCard, 'stealth')) {
            attackerCard.hasAbilities = attackerCard.hasAbilities.filter((ability) => String(ability).toLowerCase() !== 'stealth');
        }
        // Apply combat
        if (targetId === 'general') {
            defender.health = this.toSafeNumber(defender.health, constants_1.GAME_CONSTANTS.PLAYER_INITIAL_HEALTH) - this.toSafeNumber(attackerCard.currentAttack, 0);
            this.applyOnAttackEffects(attacker, defender, attackerCard, null);
        }
        else {
            // Creature combat is simultaneous
            const attackerDamage = attackerCard.currentAttack;
            const defenderDamage = target.currentAttack;
            game_rules_1.default.applyCombatDamage(attackerCard, target);
            game_rules_1.default.applyCombatDamage(target, attackerCard);
            this.applyOnDamageEffects(defender, attacker, target);
            this.applyOnDamageEffects(attacker, defender, attackerCard);
            this.applyOnAttackEffects(attacker, defender, attackerCard, target);
            // Simple poison parity
            if (this.hasAbility(attackerCard, 'poison') && target.currentDefense > 0) {
                target.currentDefense = 0;
            }
            if (this.hasAbility(target, 'poison') && attackerCard.currentDefense > 0) {
                attackerCard.currentDefense = 0;
            }
            // Lifesteal parity on attacker
            if (this.hasAbility(attackerCard, 'lifesteal') && attackerDamage > 0) {
                attacker.health = Math.min(attacker.health + attackerDamage, 30);
            }
            // Remove dead attacker if needed
            if (attackerCard.currentDefense <= 0) {
                this.handleCreatureDeath(attacker, defender, attackerCard);
            }
            // Keep lints happy for computed value in parity logic
            void defenderDamage;
        }
        attackerCard.hasAttacked = true;
        // Check if target died
        if (targetId === 'general') {
            if (defender.health <= 0) {
                this.gameState.endGame(playerId);
            }
        }
        else if (target.currentDefense <= 0) {
            this.handleCreatureDeath(defender, attacker, target);
        }
        this.gameState.logAction('attack', {
            attackerId: attackerCard.name,
            targetId: targetId === 'general' ? 'player' : target?.name
        });
        return { success: true };
    }
    equipCard(player, equipment, targetInstanceId) {
        const target = player.field.find(c => c.instanceId === targetInstanceId) || null;
        if (!target) {
            return { success: false, error: 'Target not found' };
        }
        // Validate can equip
        const validation = game_rules_1.default.canEquip(target, equipment);
        if (!validation.valid) {
            return { success: false, error: validation.error };
        }
        // Remove old equipment bonuses before replacing to avoid stat stacking.
        if (target.equipped) {
            target.currentAttack = this.toSafeNumber(target.currentAttack, this.toSafeNumber(target.attack, 0)) - this.toSafeNumber(target.equipped.attack, 0);
            target.currentDefense = this.toSafeNumber(target.currentDefense, this.toSafeNumber(target.defense, 0)) - this.toSafeNumber(target.equipped.defense, 0);
            player.graveyard.push(target.equipped);
        }
        // Equip
        target.equipped = equipment;
        target.currentAttack = this.toSafeNumber(target.currentAttack, this.toSafeNumber(target.attack, 0)) + this.toSafeNumber(equipment.attack, 0);
        target.currentDefense = this.toSafeNumber(target.currentDefense, this.toSafeNumber(target.defense, 0)) + this.toSafeNumber(equipment.defense, 0);
        return { success: true };
    }
    activateConsumable(player, opponent, card, options) {
        const effects = this.getCardEffects(card);
        if (effects.length === 0) {
            return { success: true, message: `${card.name} used` };
        }
        for (const effect of effects) {
            const effectResult = this.applyCardEffect(player, opponent, effect, options);
            if (!effectResult.success) {
                return effectResult;
            }
        }
        return { success: true, message: `${card.name} activated` };
    }
    activateAbility(player, opponent, card, options) {
        const effects = this.getCardEffects(card);
        if (effects.length === 0) {
            return { success: true, message: `${card.name} activated` };
        }
        for (const effect of effects) {
            const effectResult = this.applyCardEffect(player, opponent, effect, options);
            if (!effectResult.success) {
                return effectResult;
            }
        }
        return { success: true, message: `${card.name} activated` };
    }
    getCardEffects(card) {
        if (Array.isArray(card.effects) && card.effects.length > 0) {
            return card.effects;
        }
        if (card.effect) {
            return [card.effect];
        }
        return [];
    }
    applyOnEnterEffects(owner, opponent, card) {
        const onEnter = this.getCardEffects(card).filter((effect) => String(effect?.trigger || '').toUpperCase() === 'ON_ENTER');
        for (const effect of onEnter) {
            const type = String(effect?.type || '').toLowerCase();
            if (type === 'damage_random_enemy') {
                const target = this.pickRandomEnemyCreature(opponent);
                if (target) {
                    const effectAmount = this.toSafeNumber(effect?.value ?? effect?.amount, 0);
                    target.currentDefense = this.toSafeNumber(target.currentDefense, this.toSafeNumber(target.defense, 0)) - effectAmount;
                    this.removeDeadCreatures(opponent, owner);
                }
            }
            else {
                this.applyCardEffect(owner, opponent, effect, { target: this.pickRandomEnemyCreature(opponent) });
            }
        }
    }
    applyOnDamageEffects(owner, opponent, card) {
        const onDamage = this.getCardEffects(card).filter((effect) => String(effect?.trigger || '').toUpperCase() === 'ON_DAMAGE');
        for (const effect of onDamage) {
            const type = String(effect?.type || '').toLowerCase();
            if (type === 'summon') {
                const amount = Math.max(1, Number(effect.amount || 1));
                for (let i = 0; i < amount; i++) {
                    this.summonTokenFromEffect(owner, effect);
                }
            }
            else {
                this.applyCardEffect(owner, opponent, effect, {});
            }
        }
        // keep board sane if summons/effects change states
        this.removeDeadCreatures(owner, opponent);
        this.removeDeadCreatures(opponent, owner);
    }
    applyOnAttackEffects(attackerOwner, defenderOwner, attackerCard, target) {
        const onAttack = this.getCardEffects(attackerCard).filter((effect) => String(effect?.trigger || '').toUpperCase() === 'ON_ATTACK');
        for (const effect of onAttack) {
            const type = String(effect?.type || '').toLowerCase();
            if (type === 'coin_poison_bonus' && target) {
                if (Math.random() < 0.5) {
                    const effectAmount = this.toSafeNumber(effect?.value ?? effect?.amount, 0);
                    target.currentDefense = this.toSafeNumber(target.currentDefense, this.toSafeNumber(target.defense, 0)) - effectAmount;
                    if (!target.hasAbilities.includes('poison')) {
                        target.hasAbilities.push('poison');
                    }
                    this.removeDeadCreatures(defenderOwner, attackerOwner);
                }
            }
            else if (type === 'self_and_general_heal_on_attack') {
                const healAmount = this.toSafeNumber(effect?.value ?? effect?.amount, 0);
                attackerCard.currentDefense = this.toSafeNumber(attackerCard.currentDefense, this.toSafeNumber(attackerCard.defense, 0)) + healAmount;
                attackerOwner.health = Math.min(this.toSafeNumber(attackerOwner.health, constants_1.GAME_CONSTANTS.PLAYER_INITIAL_HEALTH) + healAmount, 30);
            }
            else {
                this.applyCardEffect(attackerOwner, defenderOwner, effect, { target });
            }
        }
    }
    summonTokenFromEffect(owner, effect) {
        const tokenCardId = String(effect?.card_id || 'slc_req_slime').trim() || 'slc_req_slime';
        const tokenName = tokenCardId === 'slc_req_slime' ? 'Slime' : 'Invocado';
        owner.field.push({
            instanceId: `${tokenCardId}_${Date.now()}_${Math.random()}`,
            cardId: tokenCardId,
            id: tokenCardId,
            name: tokenName,
            type: types_1.CardType.DEFENDER,
            race: null,
            cost: 1,
            attack: 1,
            defense: 1,
            currentAttack: 1,
            currentDefense: 1,
            hasAttacked: false,
            isSummoned: true,
            hasAbilities: [],
            equipped: null,
            text: 'Token invocado.',
            rarity: 'common',
            abilities: [],
            effects: [],
            default_unlocked: false
        });
    }
    pickRandomEnemyCreature(opponent) {
        if (!Array.isArray(opponent.field) || opponent.field.length === 0) {
            return null;
        }
        const idx = Math.floor(Math.random() * opponent.field.length);
        return opponent.field[idx] || null;
    }
    handleCreatureDeath(deadOwner, enemyOwner, card) {
        const idx = deadOwner.field.findIndex((c) => c.instanceId === card.instanceId);
        if (idx !== -1) {
            deadOwner.field.splice(idx, 1);
        }
        deadOwner.graveyard.push(card);
        const onDeath = this.getCardEffects(card).filter((effect) => String(effect?.trigger || '').toUpperCase() === 'ON_DEATH');
        for (const effect of onDeath) {
            const type = String(effect?.type || '').toLowerCase();
            if (type === 'damage_all_board') {
                const amount = this.toSafeNumber(effect?.value ?? effect?.amount, 0);
                deadOwner.field.forEach((creature) => {
                    creature.currentDefense = this.toSafeNumber(creature.currentDefense, this.toSafeNumber(creature.defense, 0)) - amount;
                });
                enemyOwner.field.forEach((creature) => {
                    creature.currentDefense = this.toSafeNumber(creature.currentDefense, this.toSafeNumber(creature.defense, 0)) - amount;
                });
                this.removeDeadCreatures(deadOwner, enemyOwner);
                this.removeDeadCreatures(enemyOwner, deadOwner);
            }
            else {
                this.applyCardEffect(deadOwner, enemyOwner, effect, {});
            }
        }
    }
    applyCardEffect(player, opponent, effect, options) {
        const normalizedType = String(effect.type || '').toLowerCase();
        const amount = this.toSafeNumber(effect?.value ?? effect?.amount, 0);
        const targetResolution = this.resolveEffectTarget(player, opponent, effect, options);
        if (!targetResolution.success) {
            return targetResolution;
        }
        const target = targetResolution.target;
        const durationTurns = Math.max(0, Number(effect?.duration || 0));
        const normalizedTarget = String(effect?.target || '').toUpperCase();
        switch (normalizedType) {
            case 'heal':
                if ((normalizedTarget === 'SINGLE_ALLY' || normalizedTarget === 'SELF') && target) {
                    target.currentDefense = this.toSafeNumber(target.currentDefense, this.toSafeNumber(target.defense, 0)) + amount;
                }
                else if (normalizedTarget === 'OWN_GENERAL') {
                    player.health = Math.min(this.toSafeNumber(player.health, constants_1.GAME_CONSTANTS.PLAYER_INITIAL_HEALTH) + amount, constants_1.GAME_CONSTANTS.PLAYER_INITIAL_HEALTH);
                }
                else if (normalizedTarget === 'ENEMY_GENERAL') {
                    opponent.health = Math.min(this.toSafeNumber(opponent.health, constants_1.GAME_CONSTANTS.PLAYER_INITIAL_HEALTH) + amount, constants_1.GAME_CONSTANTS.PLAYER_INITIAL_HEALTH);
                }
                else {
                    player.health = Math.min(this.toSafeNumber(player.health, constants_1.GAME_CONSTANTS.PLAYER_INITIAL_HEALTH) + amount, constants_1.GAME_CONSTANTS.PLAYER_INITIAL_HEALTH);
                }
                break;
            case 'draw':
                break;
            case 'add_resources':
                {
                    const cap = Math.max(0, Number(player.maxWarResources || constants_1.GAME_CONSTANTS.MAX_WAR_RESOURCES));
                    player.warResources = Math.min(this.toSafeNumber(player.warResources, 0) + amount, cap);
                }
                break;
            case 'damage':
            case 'damage_general':
                if (normalizedTarget === 'OWN_GENERAL') {
                    player.health = this.toSafeNumber(player.health, constants_1.GAME_CONSTANTS.PLAYER_INITIAL_HEALTH) - amount;
                }
                else if (normalizedTarget === 'ENEMY_GENERAL') {
                    opponent.health = this.toSafeNumber(opponent.health, constants_1.GAME_CONSTANTS.PLAYER_INITIAL_HEALTH) - amount;
                }
                else if (target) {
                    target.currentDefense = this.toSafeNumber(target.currentDefense, this.toSafeNumber(target.defense, 0)) - amount;
                }
                else {
                    opponent.health = this.toSafeNumber(opponent.health, constants_1.GAME_CONSTANTS.PLAYER_INITIAL_HEALTH) - amount;
                }
                break;
            case 'damage_all':
            case 'damage_all_enemy':
                opponent.field.forEach(creature => {
                    creature.currentDefense = this.toSafeNumber(creature.currentDefense, this.toSafeNumber(creature.defense, 0)) - amount;
                });
                this.removeDeadCreatures(opponent, player);
                break;
            case 'buff_attack':
                if (target) {
                    target.currentAttack = this.toSafeNumber(target.currentAttack, this.toSafeNumber(target.attack, 0)) + amount;
                    this.applyTimedBuffIfNeeded(target, amount, 0, durationTurns);
                }
                break;
            case 'buff_defense':
                if (target) {
                    target.currentDefense = this.toSafeNumber(target.currentDefense, this.toSafeNumber(target.defense, 0)) + amount;
                    this.applyTimedBuffIfNeeded(target, 0, amount, durationTurns);
                }
                break;
            case 'buff_both':
                if (target) {
                    target.currentAttack = this.toSafeNumber(target.currentAttack, this.toSafeNumber(target.attack, 0)) + amount;
                    target.currentDefense = this.toSafeNumber(target.currentDefense, this.toSafeNumber(target.defense, 0)) + amount;
                    this.applyTimedBuffIfNeeded(target, amount, amount, durationTurns);
                }
                break;
            case 'buff_all':
                player.field.forEach(creature => {
                    const hasAttack = effect?.attack !== undefined && effect?.attack !== null && String(effect.attack).trim() !== '';
                    const hasDefense = effect?.defense !== undefined && effect?.defense !== null && String(effect.defense).trim() !== '';
                    const attackBuff = hasAttack ? Number(effect.attack) : (hasDefense ? 0 : amount);
                    const defenseBuff = hasDefense ? Number(effect.defense) : (hasAttack ? 0 : amount);
                    creature.currentAttack = this.toSafeNumber(creature.currentAttack, this.toSafeNumber(creature.attack, 0)) + attackBuff;
                    creature.currentDefense = this.toSafeNumber(creature.currentDefense, this.toSafeNumber(creature.defense, 0)) + defenseBuff;
                    this.applyTimedBuffIfNeeded(creature, attackBuff, defenseBuff, durationTurns);
                });
                break;
            case 'grant_ability':
                if (target && effect.ability) {
                    const normalizedAbility = String(effect.ability).toLowerCase();
                    if (!target.hasAbilities.includes(normalizedAbility)) {
                        target.hasAbilities.push(normalizedAbility);
                    }
                }
                break;
            case 'destroy':
                if (target) {
                    const targetIndex = opponent.field.findIndex(c => c.instanceId === target.instanceId);
                    if (targetIndex !== -1) {
                        const removed = opponent.field.splice(targetIndex, 1)[0];
                        opponent.graveyard.push(removed);
                    }
                }
                break;
        }
        // Global state-based action:
        // any creature that reaches 0 or less defense dies immediately.
        this.resolveBoardDeaths(player, opponent);
        return { success: true };
    }
    prevalidatePlayTarget(player, opponent, card, options) {
        if (card.type === types_1.CardType.EQUIPMENT) {
            if (!options.targetId) {
                return { success: false, error: 'Equipment requires target' };
            }
            const allyTarget = player.field.find((c) => c.instanceId === options.targetId) || null;
            if (!allyTarget) {
                return { success: false, error: 'Equipment target must be an allied creature' };
            }
            return { success: true };
        }
        if (card.type === types_1.CardType.MOUNT && options.asDefender === false) {
            if (!options.targetId) {
                return { success: false, error: 'Mount requires target when played as equipment' };
            }
            const allyTarget = player.field.find((c) => c.instanceId === options.targetId) || null;
            if (!allyTarget) {
                return { success: false, error: 'Mount target must be an allied creature' };
            }
            return { success: true };
        }
        if (card.type !== types_1.CardType.CONSUMABLE && card.type !== types_1.CardType.ABILITY) {
            return { success: true };
        }
        const effects = this.getCardEffects(card);
        const hasSingleTargetEffect = effects.some((effect) => {
            const normalizedTarget = String(effect?.target || '').toUpperCase();
            return normalizedTarget === 'SINGLE_ALLY' || normalizedTarget === 'SINGLE_ENEMY';
        });
        if (!hasSingleTargetEffect) {
            return { success: true };
        }
        if (!options.targetId) {
            return { success: false, error: 'This card requires a targetId' };
        }
        const targetResolution = this.resolveTargetById(player, opponent, options.targetId);
        if (!targetResolution.target) {
            return { success: false, error: 'Target not found' };
        }
        for (const effect of effects) {
            const normalizedTarget = String(effect?.target || '').toUpperCase();
            if (normalizedTarget !== 'SINGLE_ALLY' && normalizedTarget !== 'SINGLE_ENEMY') {
                continue;
            }
            if (normalizedTarget === 'SINGLE_ALLY' && targetResolution.side !== 'ally') {
                return { success: false, error: 'Target is invalid for SINGLE_ALLY effect' };
            }
            if (normalizedTarget === 'SINGLE_ENEMY' && targetResolution.side !== 'enemy') {
                return { success: false, error: 'Target is invalid for SINGLE_ENEMY effect' };
            }
        }
        return { success: true };
    }
    resolveTargetById(player, opponent, targetId) {
        const allyTarget = player.field.find((c) => c.instanceId === targetId) || null;
        if (allyTarget) {
            return { target: allyTarget, side: 'ally' };
        }
        const enemyTarget = opponent.field.find((c) => c.instanceId === targetId) || null;
        if (enemyTarget) {
            return { target: enemyTarget, side: 'enemy' };
        }
        return { target: null, side: 'none' };
    }
    resolveEffectTarget(player, opponent, effect, options) {
        const normalizedTarget = String(effect?.target || '').toUpperCase();
        const requiresSingleTarget = normalizedTarget === 'SINGLE_ALLY' || normalizedTarget === 'SINGLE_ENEMY';
        if (!requiresSingleTarget) {
            return { success: true, target: options?.target || null };
        }
        const targetId = String(options?.targetId || '').trim();
        if (!targetId) {
            return { success: false, error: `Missing targetId for ${normalizedTarget}` };
        }
        const resolved = this.resolveTargetById(player, opponent, targetId);
        if (!resolved.target) {
            return { success: false, error: 'Target not found' };
        }
        if (normalizedTarget === 'SINGLE_ALLY' && resolved.side !== 'ally') {
            return { success: false, error: 'targetId must reference an allied creature' };
        }
        if (normalizedTarget === 'SINGLE_ENEMY' && resolved.side !== 'enemy') {
            return { success: false, error: 'targetId must reference an enemy creature' };
        }
        return { success: true, target: resolved.target };
    }
    removeDeadCreatures(player, enemy) {
        for (let i = player.field.length - 1; i >= 0; i--) {
            const card = player.field[i];
            if (card.currentDefense <= 0) {
                if (enemy) {
                    this.handleCreatureDeath(player, enemy, card);
                }
                else {
                    player.field.splice(i, 1);
                    player.graveyard.push(card);
                }
            }
        }
    }
    resolveBoardDeaths(player, opponent) {
        this.removeDeadCreatures(player, opponent);
        this.removeDeadCreatures(opponent, player);
    }
    applyTimedBuffIfNeeded(card, attackBuff, defenseBuff, durationTurns) {
        if (durationTurns <= 0)
            return;
        const activeEffects = Array.isArray(card.active_effects) ? card.active_effects : [];
        activeEffects.push({
            type: 'BUFF',
            atk: attackBuff,
            def: defenseBuff,
            remaining_turns: durationTurns
        });
        card.active_effects = activeEffects;
    }
    processTurnBoundaryEffects(playerId, trigger) {
        const state = this.gameState.getState();
        const player = state.players[playerId];
        const opponent = state.players[playerId === 'player1' ? 'player2' : 'player1'];
        if (!player || !opponent)
            return;
        if (trigger === 'START_TURN') {
            this.processDurationEffects(player);
        }
        const snapshot = [...player.field];
        for (const card of snapshot) {
            const triggerEffects = this.getCardEffects(card).filter((effect) => String(effect?.trigger || '').toUpperCase() === trigger);
            for (const effect of triggerEffects) {
                this.applyCardEffect(player, opponent, effect, {});
            }
            // REGENERATE fallback parity with AI simulator.
            if (trigger === 'START_TURN' && this.hasAbility(card, 'regenerate')) {
                const hasExplicitRegen = this.getCardEffects(card).some((effect) => String(effect?.trigger || '').toUpperCase() === 'START_TURN' &&
                    String(effect?.type || '').toLowerCase() === 'heal');
                if (!hasExplicitRegen) {
                    player.health = Math.min(30, player.health + 1);
                }
            }
        }
        this.resolveBoardDeaths(player, opponent);
    }
    processDurationEffects(player) {
        for (const card of player.field) {
            const activeEffects = Array.isArray(card.active_effects) ? card.active_effects : [];
            if (activeEffects.length === 0)
                continue;
            const nextEffects = [];
            for (const effect of activeEffects) {
                const remaining = Number(effect?.remaining_turns || 0) - 1;
                if (remaining <= 0) {
                    if (String(effect?.type || '').toUpperCase() === 'BUFF') {
                        card.currentAttack = this.toSafeNumber(card.currentAttack, this.toSafeNumber(card.attack, 0)) - this.toSafeNumber(effect?.atk, 0);
                        card.currentDefense = this.toSafeNumber(card.currentDefense, this.toSafeNumber(card.defense, 0)) - this.toSafeNumber(effect?.def, 0);
                    }
                    continue;
                }
                effect.remaining_turns = remaining;
                nextEffects.push(effect);
            }
            card.active_effects = nextEffects;
        }
    }
    hasAbility(card, ability) {
        const normalized = ability.toLowerCase();
        return card.hasAbilities.some((value) => String(value).toLowerCase() === normalized);
    }
    toSafeNumber(value, fallback = 0) {
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    }
}
exports.GameActions = GameActions;
//# sourceMappingURL=game.actions.js.map