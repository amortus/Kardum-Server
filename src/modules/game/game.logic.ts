import { GameStateManager } from './game.state';
import { GameActions } from './game.actions';
import gameRules from './game.rules';

export class GameLogic {
  private gameState: GameStateManager;
  private gameActions: GameActions;

  constructor() {
    this.gameState = new GameStateManager();
    this.gameActions = new GameActions(this.gameState);
  }

  // Initialize game
  async initialize(player1Deck: string[], player2Deck: string[]): Promise<void> {
    // Validate decks
    const deck1Validation = gameRules.validateDeck(player1Deck);
    if (!deck1Validation.valid) {
      throw new Error(`Player 1 deck invalid: ${deck1Validation.error}`);
    }

    const deck2Validation = gameRules.validateDeck(player2Deck);
    if (!deck2Validation.valid) {
      throw new Error(`Player 2 deck invalid: ${deck2Validation.error}`);
    }

    // Start game
    await this.gameState.startGame(player1Deck, player2Deck);
    await this.gameState.startTurn();
  }

  // Process player action
  async processAction(
    playerId: 'player1' | 'player2',
    action: { type: string; [key: string]: any }
  ): Promise<{ success: boolean; error?: string; state?: any }> {
    try {
      let result: { success: boolean; error?: string };

      switch (action.type) {
        case 'playCard':
          const playOptions = {
            ...(action.options || {}),
            targetId: action.targetId ?? action.options?.targetId,
            asDefender:
              action.asDefender ??
              action.playAsDefender ??
              action.options?.asDefender
          };
          result = await this.gameActions.playCard(
            playerId,
            action.cardInstanceId,
            playOptions
          );
          break;

        case 'attack':
          result = this.gameActions.declareAttack(
            playerId,
            action.attackerId,
            action.targetId
          );
          break;

        case 'sacrifice': {
          const sid =
            action.cardInstanceId ??
            action.cardInstanceID ??
            action.card_instance_id ??
            '';
          result = this.gameActions.sacrificeCard(playerId, String(sid).trim());
          break;
        }

        case 'endTurn':
          const stateBeforeEnd = this.gameState.getState();
          const currentPhase = stateBeforeEnd.currentPhase;
          const activePlayer = stateBeforeEnd.currentPlayer;
          if (currentPhase === 'combat') {
            this.gameActions.processTurnBoundaryEffects(activePlayer, 'END_TURN');
          }
          await this.gameState.endTurn();
          if (currentPhase === 'combat') {
            const stateAfterEnd = this.gameState.getState();
            this.gameActions.processTurnBoundaryEffects(stateAfterEnd.currentPlayer, 'START_TURN');
          }
          result = { success: true };
          break;

        default:
          result = { success: false, error: 'Unknown action type' };
      }

      // Check win condition
      const state = this.gameState.getState();
      const winner = gameRules.checkWinCondition(state.players.player1, state.players.player2);
      if (winner) {
        this.gameState.endGame(winner);
      }

      return {
        ...result,
        state: this.gameState.getState()
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Unknown error'
      };
    }
  }

  // Get current game state
  getState(): any {
    return this.gameState.getState();
  }

  // Get full state (for debugging)
  getFullState(): any {
    return this.gameState.getState();
  }

  // Add event listener
  addEventListener(listener: (event: string, data: any) => void): void {
    this.gameState.addEventListener(listener);
  }
}
