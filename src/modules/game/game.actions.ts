import { CardInstance, PlayerState, CardType, GamePhase } from '../../shared/types';
import { GameStateManager } from './game.state';
import gameRules from './game.rules';
import { GAME_CONSTANTS } from '../../shared/constants';

export class GameActions {
  private gameState: GameStateManager;

  constructor(gameState: GameStateManager) {
    this.gameState = gameState;
  }

  /** Próximo slot livre 0..MAX-1 (tabuleiro fixo; morte não compacta índices). */
  private takeNextFieldSlot(field: CardInstance[]): number {
    const used = new Set<number>();
    for (const c of field) {
      const s = c.fieldSlot;
      if (typeof s === 'number' && s >= 0 && s < GAME_CONSTANTS.MAX_FIELD_CREATURES) {
        used.add(s);
      }
    }
    for (let i = 0; i < GAME_CONSTANTS.MAX_FIELD_CREATURES; i++) {
      if (!used.has(i)) {
        return i;
      }
    }
    return 0;
  }

  // Play a card from hand
  async playCard(
    playerId: 'player1' | 'player2',
    cardInstanceId: string,
    options: { targetId?: string; asDefender?: boolean } = {}
  ): Promise<{ success: boolean; error?: string }> {
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
    if (state.currentPhase !== GamePhase.STRATEGY && state.currentPhase !== GamePhase.COMBAT) {
      return { success: false, error: 'Cannot play cards in this phase' };
    }

    // Find card in hand
    const cardIndex = player.hand.findIndex(c => c.instanceId === cardInstanceId);
    if (cardIndex === -1) {
      return { success: false, error: 'Card not in hand' };
    }

    const card = player.hand[cardIndex];
    if (state.currentPhase === GamePhase.COMBAT && card.type !== CardType.ABILITY) {
      return { success: false, error: 'Only abilities can be played in combat phase' };
    }

    // Validate if can play (inclui limite de criaturas no campo)
    const validation = gameRules.canPlayCard(player, card, options);
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
    let result: { success: boolean; error?: string } = { success: true };

    switch (card.type) {
      case CardType.DEFENDER:
        card.isSummoned = true;
        card.fieldSlot = this.takeNextFieldSlot(player.field);
        player.field.push(card);
        this.applyOnEnterEffects(player, opponent, card);
        break;

      case CardType.EQUIPMENT:
        if (options.targetId) {
          result = this.equipCard(player, card, options.targetId);
        } else {
          return { success: false, error: 'Equipment requires target' };
        }
        break;

      case CardType.MOUNT:
        if (options.asDefender !== false) {
          card.isSummoned = true;
          card.fieldSlot = this.takeNextFieldSlot(player.field);
          player.field.push(card);
          this.applyOnEnterEffects(player, opponent, card);
        } else if (options.targetId) {
          result = this.equipCard(player, card, options.targetId);
        } else {
          return { success: false, error: 'Mount requires choice' };
        }
        break;

      case CardType.CONSUMABLE:
        result = this.activateConsumable(player, opponent, card, options);
        if (result.success) {
          player.graveyard.push(card);
        }
        break;

      case CardType.ABILITY:
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

  /** Sacrifica uma criatura no campo (fase STRATEGY): libera slot e concede recursos de guerra. */
  sacrificeCard(
    playerId: 'player1' | 'player2',
    cardInstanceId: string
  ): { success: boolean; error?: string } {
    const state = this.gameState.getState();
    if (state.currentPlayer !== playerId) {
      return { success: false, error: 'Not your turn' };
    }
    if (state.currentPhase !== GamePhase.STRATEGY) {
      return { success: false, error: 'Sacrifice is only allowed in strategy phase' };
    }

    const player = state.players[playerId];
    const idx = player.field.findIndex((c) => c.instanceId === cardInstanceId);
    if (idx === -1) {
      return { success: false, error: 'Card not on field' };
    }

    const card = player.field[idx];
    const sacCheck = gameRules.canSacrificeCard(card);
    if (!sacCheck.valid) {
      return { success: false, error: sacCheck.error };
    }

    player.field.splice(idx, 1);
    player.graveyard.push(card);

    const cost = this.toSafeNumber(card.cost, 0);
    const gain = Math.max(0, Math.ceil(cost / 2));
    // Não limitar ao pool do turno (maxWarResources): no início warResources == maxWarResources
    // e o sacrifício somava 0. Teto absoluto de recursos gastáveis no match.
    player.warResources = Math.min(
      this.toSafeNumber(player.warResources, 0) + gain,
      GAME_CONSTANTS.MAX_WAR_RESOURCES
    );

    this.gameState.logAction('sacrifice', { playerId, card: card.name, gain });
    return { success: true };
  }

  // Declare attack
  declareAttack(
    playerId: 'player1' | 'player2',
    attackerId: string,
    targetId: string
  ): { success: boolean; error?: string } {
    const state = this.gameState.getState();
    if (state.currentPlayer !== playerId) {
      return { success: false, error: 'Not your turn' };
    }
    if (state.currentPhase !== GamePhase.COMBAT) {
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
    const validation = gameRules.canAttack(attackerCard, defender);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Find target
    let target: CardInstance | null = null;
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
      defender.health = this.toSafeNumber(defender.health, GAME_CONSTANTS.PLAYER_INITIAL_HEALTH) - this.toSafeNumber(attackerCard.currentAttack, 0);
      this.applyOnAttackEffects(attacker, defender, attackerCard, null);
    } else {
      // Creature combat is simultaneous
      const attackerDamage = attackerCard.currentAttack;
      const defenderDamage = target!.currentAttack;
      gameRules.applyCombatDamage(attackerCard, target!);
      gameRules.applyCombatDamage(target!, attackerCard);
      this.applyOnDamageEffects(defender, attacker, target!);
      this.applyOnDamageEffects(attacker, defender, attackerCard);
      this.applyOnAttackEffects(attacker, defender, attackerCard, target);

      // Simple poison parity
      if (this.hasAbility(attackerCard, 'poison') && target!.currentDefense > 0) {
        target!.currentDefense = 0;
      }
      if (this.hasAbility(target!, 'poison') && attackerCard.currentDefense > 0) {
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
    } else if (target!.currentDefense <= 0) {
      this.handleCreatureDeath(defender, attacker, target!);
    }

    this.gameState.logAction('attack', { 
      attackerId: attackerCard.name, 
      targetId: targetId === 'general' ? 'player' : target?.name
    });

    return { success: true };
  }

  private equipCard(
    player: PlayerState,
    equipment: CardInstance,
    targetInstanceId: string
  ): { success: boolean; error?: string } {
    const target = player.field.find(c => c.instanceId === targetInstanceId) || null;

    if (!target) {
      return { success: false, error: 'Target not found' };
    }

    // Validate can equip
    const validation = gameRules.canEquip(target, equipment);
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

  private activateConsumable(
    player: PlayerState,
    opponent: PlayerState,
    card: CardInstance,
    options: any
  ): { success: boolean; error?: string; message?: string } {
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

  private activateAbility(
    player: PlayerState,
    opponent: PlayerState,
    card: CardInstance,
    options: any
  ): { success: boolean; error?: string; message?: string } {
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

  private getCardEffects(card: CardInstance): any[] {
    if (Array.isArray((card as any).effects) && (card as any).effects.length > 0) {
      return (card as any).effects;
    }
    if ((card as any).effect) {
      return [(card as any).effect];
    }
    return [];
  }

  private applyOnEnterEffects(owner: PlayerState, opponent: PlayerState, card: CardInstance): void {
    const onEnter = this.getCardEffects(card).filter(
      (effect) => String(effect?.trigger || '').toUpperCase() === 'ON_ENTER'
    );
    for (const effect of onEnter) {
      const type = String(effect?.type || '').toLowerCase();
      if (type === 'damage_random_enemy') {
        const target = this.pickRandomEnemyCreature(opponent);
        if (target) {
          const effectAmount = this.toSafeNumber(effect?.value ?? effect?.amount, 0);
          target.currentDefense = this.toSafeNumber(target.currentDefense, this.toSafeNumber(target.defense, 0)) - effectAmount;
          this.removeDeadCreatures(opponent, owner);
        }
      } else {
        this.applyCardEffect(owner, opponent, effect, { target: this.pickRandomEnemyCreature(opponent) });
      }
    }
  }

  private applyOnDamageEffects(owner: PlayerState, opponent: PlayerState, card: CardInstance): void {
    const onDamage = this.getCardEffects(card).filter(
      (effect) => String(effect?.trigger || '').toUpperCase() === 'ON_DAMAGE'
    );
    for (const effect of onDamage) {
      const type = String(effect?.type || '').toLowerCase();
      if (type === 'summon') {
        const amount = Math.max(1, Number(effect.amount || 1));
        for (let i = 0; i < amount; i++) {
          this.summonTokenFromEffect(owner, effect);
        }
      } else {
        this.applyCardEffect(owner, opponent, effect, {});
      }
    }
    // keep board sane if summons/effects change states
    this.removeDeadCreatures(owner, opponent);
    this.removeDeadCreatures(opponent, owner);
  }

  private applyOnAttackEffects(
    attackerOwner: PlayerState,
    defenderOwner: PlayerState,
    attackerCard: CardInstance,
    target: CardInstance | null
  ): void {
    const onAttack = this.getCardEffects(attackerCard).filter(
      (effect) => String(effect?.trigger || '').toUpperCase() === 'ON_ATTACK'
    );
    for (const effect of onAttack) {
      const type = String(effect?.type || '').toLowerCase();
      if (type === 'coin_poison_bonus' && target) {
        if (Math.random() < 0.5) {
          const effectAmount = this.toSafeNumber(effect?.value ?? effect?.amount, 0);
          target.currentDefense = this.toSafeNumber(target.currentDefense, this.toSafeNumber(target.defense, 0)) - effectAmount;
          if (!target.hasAbilities.includes('poison' as any)) {
            target.hasAbilities.push('poison' as any);
          }
          this.removeDeadCreatures(defenderOwner, attackerOwner);
        }
      } else if (type === 'self_and_general_heal_on_attack') {
        const healAmount = this.toSafeNumber(effect?.value ?? effect?.amount, 0);
        attackerCard.currentDefense = this.toSafeNumber(attackerCard.currentDefense, this.toSafeNumber(attackerCard.defense, 0)) + healAmount;
        attackerOwner.health = Math.min(this.toSafeNumber(attackerOwner.health, GAME_CONSTANTS.PLAYER_INITIAL_HEALTH) + healAmount, 30);
      } else {
        this.applyCardEffect(attackerOwner, defenderOwner, effect, { target });
      }
    }
  }

  private summonTokenFromEffect(owner: PlayerState, effect: any): void {
    if (owner.field.length >= GAME_CONSTANTS.MAX_FIELD_CREATURES) {
      return;
    }
    const tokenCardId = String(effect?.card_id || 'slc_req_slime').trim() || 'slc_req_slime';
    const tokenName = tokenCardId === 'slc_req_slime' ? 'Slime' : 'Invocado';
    const token: CardInstance = {
      instanceId: `${tokenCardId}_${Date.now()}_${Math.random()}`,
      cardId: tokenCardId,
      id: tokenCardId,
      name: tokenName,
      type: CardType.DEFENDER,
      race: null as any,
      cost: 1,
      attack: 1,
      defense: 1,
      currentAttack: 1,
      currentDefense: 1,
      hasAttacked: false,
      isSummoned: true,
      fieldSlot: this.takeNextFieldSlot(owner.field),
      hasAbilities: [],
      equipped: null,
      text: 'Token invocado.',
      rarity: 'common' as any,
      abilities: [],
      effects: [],
      default_unlocked: false
    } as CardInstance;
    owner.field.push(token);
  }

  private pickRandomEnemyCreature(opponent: PlayerState): CardInstance | null {
    if (!Array.isArray(opponent.field) || opponent.field.length === 0) {
      return null;
    }
    const idx = Math.floor(Math.random() * opponent.field.length);
    return opponent.field[idx] || null;
  }

  private handleCreatureDeath(deadOwner: PlayerState, enemyOwner: PlayerState, card: CardInstance): void {
    const idx = deadOwner.field.findIndex((c) => c.instanceId === card.instanceId);
    if (idx !== -1) {
      deadOwner.field.splice(idx, 1);
    }
    deadOwner.graveyard.push(card);

    const onDeath = this.getCardEffects(card).filter(
      (effect) => String(effect?.trigger || '').toUpperCase() === 'ON_DEATH'
    );
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
      } else {
        this.applyCardEffect(deadOwner, enemyOwner, effect, {});
      }
    }
  }

  private applyCardEffect(
    player: PlayerState,
    opponent: PlayerState,
    effect: any,
    options: any
  ): { success: boolean; error?: string } {
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
        } else if (normalizedTarget === 'OWN_GENERAL') {
          player.health = Math.min(this.toSafeNumber(player.health, GAME_CONSTANTS.PLAYER_INITIAL_HEALTH) + amount, GAME_CONSTANTS.PLAYER_INITIAL_HEALTH);
        } else if (normalizedTarget === 'ENEMY_GENERAL') {
          opponent.health = Math.min(this.toSafeNumber(opponent.health, GAME_CONSTANTS.PLAYER_INITIAL_HEALTH) + amount, GAME_CONSTANTS.PLAYER_INITIAL_HEALTH);
        } else {
          player.health = Math.min(this.toSafeNumber(player.health, GAME_CONSTANTS.PLAYER_INITIAL_HEALTH) + amount, GAME_CONSTANTS.PLAYER_INITIAL_HEALTH);
        }
        break;

      case 'draw':
        break;

      case 'add_resources':
        {
          const cap = Math.max(0, Number(player.maxWarResources || GAME_CONSTANTS.MAX_WAR_RESOURCES));
          player.warResources = Math.min(this.toSafeNumber(player.warResources, 0) + amount, cap);
        }
        break;

      case 'damage':
      case 'damage_general':
        if (normalizedTarget === 'OWN_GENERAL') {
          player.health = this.toSafeNumber(player.health, GAME_CONSTANTS.PLAYER_INITIAL_HEALTH) - amount;
        } else if (normalizedTarget === 'ENEMY_GENERAL') {
          opponent.health = this.toSafeNumber(opponent.health, GAME_CONSTANTS.PLAYER_INITIAL_HEALTH) - amount;
        } else if (target) {
          target.currentDefense = this.toSafeNumber(target.currentDefense, this.toSafeNumber(target.defense, 0)) - amount;
        } else {
          opponent.health = this.toSafeNumber(opponent.health, GAME_CONSTANTS.PLAYER_INITIAL_HEALTH) - amount;
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
          if (!target.hasAbilities.includes(normalizedAbility as any)) {
            target.hasAbilities.push(normalizedAbility as any);
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

  private prevalidatePlayTarget(
    player: PlayerState,
    opponent: PlayerState,
    card: CardInstance,
    options: { targetId?: string; asDefender?: boolean }
  ): { success: boolean; error?: string } {
    if (card.type === CardType.EQUIPMENT) {
      if (!options.targetId) {
        return { success: false, error: 'Equipment requires target' };
      }
      const allyTarget = player.field.find((c) => c.instanceId === options.targetId) || null;
      if (!allyTarget) {
        return { success: false, error: 'Equipment target must be an allied creature' };
      }
      return { success: true };
    }

    if (card.type === CardType.MOUNT && options.asDefender === false) {
      if (!options.targetId) {
        return { success: false, error: 'Mount requires target when played as equipment' };
      }
      const allyTarget = player.field.find((c) => c.instanceId === options.targetId) || null;
      if (!allyTarget) {
        return { success: false, error: 'Mount target must be an allied creature' };
      }
      return { success: true };
    }

    if (card.type !== CardType.CONSUMABLE && card.type !== CardType.ABILITY) {
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

  private resolveTargetById(
    player: PlayerState,
    opponent: PlayerState,
    targetId: string
  ): { target: CardInstance | null; side: 'ally' | 'enemy' | 'none' } {
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

  private resolveEffectTarget(
    player: PlayerState,
    opponent: PlayerState,
    effect: any,
    options: any
  ): { success: boolean; error?: string; target?: CardInstance | null } {
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

  private removeDeadCreatures(player: PlayerState, enemy?: PlayerState): void {
    for (let i = player.field.length - 1; i >= 0; i--) {
      const card = player.field[i];
      if (card.currentDefense <= 0) {
        if (enemy) {
          this.handleCreatureDeath(player, enemy, card);
        } else {
          player.field.splice(i, 1);
          player.graveyard.push(card);
        }
      }
    }
  }

  private resolveBoardDeaths(player: PlayerState, opponent: PlayerState): void {
    this.removeDeadCreatures(player, opponent);
    this.removeDeadCreatures(opponent, player);
  }

  private applyTimedBuffIfNeeded(card: CardInstance, attackBuff: number, defenseBuff: number, durationTurns: number): void {
    if (durationTurns <= 0) return;
    const activeEffects = Array.isArray((card as any).active_effects) ? (card as any).active_effects : [];
    activeEffects.push({
      type: 'BUFF',
      atk: attackBuff,
      def: defenseBuff,
      remaining_turns: durationTurns
    });
    (card as any).active_effects = activeEffects;
  }

  processTurnBoundaryEffects(playerId: 'player1' | 'player2', trigger: 'START_TURN' | 'END_TURN'): void {
    const state = this.gameState.getState();
    const player = state.players[playerId];
    const opponent = state.players[playerId === 'player1' ? 'player2' : 'player1'];
    if (!player || !opponent) return;

    if (trigger === 'START_TURN') {
      this.processDurationEffects(player);
    }

    const snapshot = [...player.field];
    for (const card of snapshot) {
      const triggerEffects = this.getCardEffects(card).filter(
        (effect) => String(effect?.trigger || '').toUpperCase() === trigger
      );
      for (const effect of triggerEffects) {
        this.applyCardEffect(player, opponent, effect, {});
      }
      // REGENERATE fallback parity with AI simulator.
      if (trigger === 'START_TURN' && this.hasAbility(card, 'regenerate')) {
        const hasExplicitRegen = this.getCardEffects(card).some(
          (effect) =>
            String(effect?.trigger || '').toUpperCase() === 'START_TURN' &&
            String(effect?.type || '').toLowerCase() === 'heal'
        );
        if (!hasExplicitRegen) {
          player.health = Math.min(30, player.health + 1);
        }
      }
    }

    this.resolveBoardDeaths(player, opponent);
  }

  private processDurationEffects(player: PlayerState): void {
    for (const card of player.field) {
      const activeEffects = Array.isArray((card as any).active_effects) ? (card as any).active_effects : [];
      if (activeEffects.length === 0) continue;
      const nextEffects: any[] = [];
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
      (card as any).active_effects = nextEffects;
    }
  }

  private hasAbility(card: CardInstance, ability: string): boolean {
    const normalized = ability.toLowerCase();
    return card.hasAbilities.some((value) => String(value).toLowerCase() === normalized);
  }

  private toSafeNumber(value: any, fallback: number = 0): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
}
