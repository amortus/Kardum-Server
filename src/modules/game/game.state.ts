import { CardInstance, GamePhase, GameState, PlayerState } from '../../shared/types';
import { GAME_CONSTANTS } from '../../shared/constants';
import cardRepository from '../cards/card.repository';

export class GameStateManager {
  private state: GameState;
  private listeners: Array<(event: string, data: any) => void> = [];

  constructor() {
    this.state = this.createInitialState();
  }

  private createInitialState(): GameState {
    return {
      players: {
        player1: this.createPlayerState('player1'),
        player2: this.createPlayerState('player2')
      },
      currentPlayer: 'player1',
      currentPhase: GamePhase.DRAW,
      turnNumber: 1,
      winner: null,
      gameStarted: false,
      isFirstTurn: true,
      actionHistory: []
    };
  }

  private createPlayerState(playerId: string): PlayerState {
    return {
      id: playerId,
      health: GAME_CONSTANTS.PLAYER_INITIAL_HEALTH,
      warResources: GAME_CONSTANTS.INITIAL_WAR_RESOURCES,
      maxWarResources: GAME_CONSTANTS.INITIAL_WAR_RESOURCES,
      deck: [],
      hand: [],
      field: [],
      graveyard: [],
      equipments: {},
      mounts: [],
      abilityUsedThisTurn: false,
      mountUsedThisTurn: false
    };
  }

  async startGame(player1Deck: string[], player2Deck: string[]): Promise<void> {
    // Reset state
    this.state = this.createInitialState();

    // Configure decks (shuffle)
    this.state.players.player1.deck = this.shuffle([...player1Deck]);
    this.state.players.player2.deck = this.shuffle([...player2Deck]);

    // Draw initial cards
    await this.drawCards(this.state.players.player1, GAME_CONSTANTS.INITIAL_HAND_SIZE);
    await this.drawCards(this.state.players.player2, GAME_CONSTANTS.INITIAL_HAND_SIZE);

    this.state.gameStarted = true;
    this.emit('gameStarted', { state: this.getPublicState() });
  }

  private async createCardInstance(cardId: string): Promise<CardInstance> {
    const cardData = await cardRepository.getCardById(cardId);
    
    if (!cardData) {
      throw new Error(`Card not found: ${cardId}`);
    }

    return {
      instanceId: `${cardId}_${Date.now()}_${Math.random()}`,
      cardId: cardId,
      ...JSON.parse(JSON.stringify(cardData)),
      currentAttack: cardData.attack || 0,
      currentDefense: cardData.defense || 0,
      hasAttacked: false,
      isSummoned: false,
      hasAbilities: [...(cardData.abilities || [])].map((ability) => String(ability).toLowerCase() as any),
      equipped: null
    };
  }

  private async drawCards(player: PlayerState, count: number): Promise<CardInstance[]> {
    const drawn: CardInstance[] = [];
    
    for (let i = 0; i < count; i++) {
      if (player.deck.length === 0) {
        this.applyEmptyDeckPenalty(player);
        break;
      }
      
      const cardId = player.deck.pop()!;
      const cardInstance = await this.createCardInstance(cardId);
      player.hand.push(cardInstance);
      drawn.push(cardInstance);
    }
    
    this.emit('cardsDrawn', { playerId: player.id, cards: drawn });
    return drawn;
  }

  private applyEmptyDeckPenalty(player: PlayerState): void {
    player.health -= GAME_CONSTANTS.EMPTY_DECK_DAMAGE;
    this.emit('emptyDeckPenalty', { playerId: player.id, damage: GAME_CONSTANTS.EMPTY_DECK_DAMAGE });

    if (player.health <= 0) {
      this.endGame(player.id === 'player1' ? 'player2' : 'player1');
    }
  }

  async startTurn(): Promise<void> {
    const player = this.state.players[this.state.currentPlayer];

    // Draw phase
    this.state.currentPhase = GamePhase.DRAW;

    // Player who starts doesn't draw on first turn
    if (!this.state.isFirstTurn) {
      await this.drawCards(player, GAME_CONSTANTS.CARDS_DRAWN_PER_TURN);

      // Increment war resources
      if (player.maxWarResources < GAME_CONSTANTS.MAX_WAR_RESOURCES) {
        player.maxWarResources += GAME_CONSTANTS.WAR_RESOURCES_PER_TURN;
      }
      player.warResources = player.maxWarResources;
    } else {
      player.warResources = player.maxWarResources;
    }

    this.state.isFirstTurn = false;

    // Reset turn flags
    player.abilityUsedThisTurn = false;
    player.mountUsedThisTurn = false;

    // Reset cards in field
    player.field.forEach(card => {
      card.hasAttacked = false;
      if (card.isSummoned) {
        card.isSummoned = false;
      }
    });

    // Move to strategy phase
    this.state.currentPhase = GamePhase.STRATEGY;
    this.emit('turnStarted', { playerId: player.id, phase: this.state.currentPhase });
  }

  async endTurn(): Promise<void> {
    if (this.state.currentPhase === GamePhase.STRATEGY) {
      this.state.currentPhase = GamePhase.COMBAT;
      this.emit('phaseChanged', { playerId: this.state.currentPlayer, phase: this.state.currentPhase });
      return;
    }

    this.state.turnNumber++;
    this.state.currentPlayer = this.state.currentPlayer === 'player1' ? 'player2' : 'player1';
    await this.startTurn();
  }

  endGame(winnerId: string): void {
    this.state.winner = winnerId;
    this.emit('gameEnded', { winner: winnerId });
  }

  logAction(action: string, data: any): void {
    this.state.actionHistory.push({
      turn: this.state.turnNumber,
      player: this.state.currentPlayer,
      action,
      data,
      timestamp: Date.now()
    });
  }

  getState(): GameState {
    return this.state;
  }

  getPublicState(): any {
    return {
      currentPlayer: this.state.currentPlayer,
      currentPhase: this.state.currentPhase,
      turnNumber: this.state.turnNumber,
      winner: this.state.winner,
      players: {
        player1: this.getPlayerPublicState('player1'),
        player2: this.getPlayerPublicState('player2')
      }
    };
  }

  private getPlayerPublicState(playerId: string): any {
    const player = this.state.players[playerId as 'player1' | 'player2'];
    return {
      id: playerId,
      health: player.health,
      warResources: player.warResources,
      maxWarResources: player.maxWarResources,
      handSize: player.hand.length,
      deckSize: player.deck.length,
      fieldSize: player.field.length
    };
  }

  addEventListener(listener: (event: string, data: any) => void): void {
    this.listeners.push(listener);
  }

  private emit(event: string, data: any): void {
    this.listeners.forEach(listener => listener(event, data));
  }

  private shuffle<T>(array: T[]): T[] {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  }
}
