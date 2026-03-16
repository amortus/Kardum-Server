"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameLogic = void 0;
const game_state_1 = require("./game.state");
const game_actions_1 = require("./game.actions");
const game_rules_1 = __importDefault(require("./game.rules"));
class GameLogic {
    constructor() {
        this.gameState = new game_state_1.GameStateManager();
        this.gameActions = new game_actions_1.GameActions(this.gameState);
    }
    // Initialize game
    async initialize(player1Deck, player2Deck) {
        // Validate decks
        const deck1Validation = game_rules_1.default.validateDeck(player1Deck);
        if (!deck1Validation.valid) {
            throw new Error(`Player 1 deck invalid: ${deck1Validation.error}`);
        }
        const deck2Validation = game_rules_1.default.validateDeck(player2Deck);
        if (!deck2Validation.valid) {
            throw new Error(`Player 2 deck invalid: ${deck2Validation.error}`);
        }
        // Start game
        await this.gameState.startGame(player1Deck, player2Deck);
        await this.gameState.startTurn();
    }
    // Process player action
    async processAction(playerId, action) {
        try {
            let result;
            switch (action.type) {
                case 'playCard':
                    const playOptions = {
                        ...(action.options || {}),
                        targetId: action.targetId ?? action.options?.targetId,
                        asDefender: action.asDefender ??
                            action.playAsDefender ??
                            action.options?.asDefender
                    };
                    result = await this.gameActions.playCard(playerId, action.cardInstanceId, playOptions);
                    break;
                case 'attack':
                    result = this.gameActions.declareAttack(playerId, action.attackerId, action.targetId);
                    break;
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
            const winner = game_rules_1.default.checkWinCondition(state.players.player1, state.players.player2);
            if (winner) {
                this.gameState.endGame(winner);
            }
            return {
                ...result,
                state: this.gameState.getState()
            };
        }
        catch (error) {
            return {
                success: false,
                error: error.message || 'Unknown error'
            };
        }
    }
    // Get current game state
    getState() {
        return this.gameState.getState();
    }
    // Get full state (for debugging)
    getFullState() {
        return this.gameState.getState();
    }
    // Add event listener
    addEventListener(listener) {
        this.gameState.addEventListener(listener);
    }
}
exports.GameLogic = GameLogic;
//# sourceMappingURL=game.logic.js.map