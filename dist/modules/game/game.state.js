"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameStateManager = void 0;
const types_1 = require("../../shared/types");
const constants_1 = require("../../shared/constants");
const card_repository_1 = __importDefault(require("../cards/card.repository"));
class GameStateManager {
    constructor() {
        this.listeners = [];
        this.state = this.createInitialState();
    }
    createInitialState() {
        return {
            players: {
                player1: this.createPlayerState('player1'),
                player2: this.createPlayerState('player2')
            },
            currentPlayer: 'player1',
            currentPhase: types_1.GamePhase.DRAW,
            turnNumber: 1,
            winner: null,
            gameStarted: false,
            isFirstTurn: true,
            actionHistory: []
        };
    }
    createPlayerState(playerId) {
        return {
            id: playerId,
            health: constants_1.GAME_CONSTANTS.PLAYER_INITIAL_HEALTH,
            warResources: constants_1.GAME_CONSTANTS.INITIAL_WAR_RESOURCES,
            maxWarResources: constants_1.GAME_CONSTANTS.INITIAL_WAR_RESOURCES,
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
    async startGame(player1Deck, player2Deck) {
        // Reset state
        this.state = this.createInitialState();
        // Configure decks (shuffle)
        this.state.players.player1.deck = this.shuffle([...player1Deck]);
        this.state.players.player2.deck = this.shuffle([...player2Deck]);
        // Draw initial cards
        await this.drawCards(this.state.players.player1, constants_1.GAME_CONSTANTS.INITIAL_HAND_SIZE);
        await this.drawCards(this.state.players.player2, constants_1.GAME_CONSTANTS.INITIAL_HAND_SIZE);
        this.state.gameStarted = true;
        this.emit('gameStarted', { state: this.getPublicState() });
    }
    async createCardInstance(cardId) {
        const cardData = await card_repository_1.default.getCardById(cardId);
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
            hasAbilities: [...(cardData.abilities || [])].map((ability) => String(ability).toLowerCase()),
            equipped: null
        };
    }
    async drawCards(player, count) {
        const drawn = [];
        for (let i = 0; i < count; i++) {
            if (player.deck.length === 0) {
                this.applyEmptyDeckPenalty(player);
                break;
            }
            const cardId = player.deck.pop();
            const cardInstance = await this.createCardInstance(cardId);
            player.hand.push(cardInstance);
            drawn.push(cardInstance);
        }
        this.emit('cardsDrawn', { playerId: player.id, cards: drawn });
        return drawn;
    }
    applyEmptyDeckPenalty(player) {
        player.health -= constants_1.GAME_CONSTANTS.EMPTY_DECK_DAMAGE;
        this.emit('emptyDeckPenalty', { playerId: player.id, damage: constants_1.GAME_CONSTANTS.EMPTY_DECK_DAMAGE });
        if (player.health <= 0) {
            this.endGame(player.id === 'player1' ? 'player2' : 'player1');
        }
    }
    async startTurn() {
        const player = this.state.players[this.state.currentPlayer];
        // Draw phase
        this.state.currentPhase = types_1.GamePhase.DRAW;
        // Player who starts doesn't draw on first turn
        if (!this.state.isFirstTurn) {
            await this.drawCards(player, constants_1.GAME_CONSTANTS.CARDS_DRAWN_PER_TURN);
            // Increment war resources
            if (player.maxWarResources < constants_1.GAME_CONSTANTS.MAX_WAR_RESOURCES) {
                player.maxWarResources += constants_1.GAME_CONSTANTS.WAR_RESOURCES_PER_TURN;
            }
            player.warResources = player.maxWarResources;
        }
        else {
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
        this.state.currentPhase = types_1.GamePhase.STRATEGY;
        this.emit('turnStarted', { playerId: player.id, phase: this.state.currentPhase });
    }
    async endTurn() {
        if (this.state.currentPhase === types_1.GamePhase.STRATEGY) {
            this.state.currentPhase = types_1.GamePhase.COMBAT;
            this.emit('phaseChanged', { playerId: this.state.currentPlayer, phase: this.state.currentPhase });
            return;
        }
        this.state.turnNumber++;
        this.state.currentPlayer = this.state.currentPlayer === 'player1' ? 'player2' : 'player1';
        await this.startTurn();
    }
    endGame(winnerId) {
        this.state.winner = winnerId;
        this.emit('gameEnded', { winner: winnerId });
    }
    logAction(action, data) {
        this.state.actionHistory.push({
            turn: this.state.turnNumber,
            player: this.state.currentPlayer,
            action,
            data,
            timestamp: Date.now()
        });
    }
    getState() {
        return this.state;
    }
    getPublicState() {
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
    getPlayerPublicState(playerId) {
        const player = this.state.players[playerId];
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
    addEventListener(listener) {
        this.listeners.push(listener);
    }
    emit(event, data) {
        this.listeners.forEach(listener => listener(event, data));
    }
    shuffle(array) {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    }
}
exports.GameStateManager = GameStateManager;
//# sourceMappingURL=game.state.js.map