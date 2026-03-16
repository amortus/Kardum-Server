import { MatchState } from '../../shared/types';
import { GameLogic } from '../game/game.logic';
import deckRepository from '../decks/deck.repository';

type ActiveMatchState = MatchState & {
  gameLogic: GameLogic;
  phaseStartedAt: number;
};

// Active matches in memory
const activeMatches = new Map<number, ActiveMatchState>();
let nextMatchId = (Date.now() * 1000) + Math.floor(Math.random() * 1000);

export class MatchManager {
  async createMatch(
    player1Id: number,
    player2Id: number,
    player1DeckId: number,
    player2DeckId: number,
    matchType: 'casual' | 'ranked' | 'ai'
  ): Promise<number> {
    const matchId = nextMatchId++;

    // Load decks
    const player1Deck = await deckRepository.getDeckById(player1DeckId);
    const player2Deck = await deckRepository.getDeckById(player2DeckId);

    if (!player1Deck || !player2Deck) {
      throw new Error('Deck not found');
    }
    if (player1Deck.user_id !== player1Id) {
      throw new Error('Player1 deck does not belong to player');
    }
    if (matchType !== 'ai' && player2Deck.user_id !== player2Id) {
      throw new Error('Player2 deck does not belong to player');
    }

    // Create game logic instance
    const gameLogic = new GameLogic();

    // Initialize match state
    const matchState: ActiveMatchState = {
      matchId,
      player1Id,
      player2Id,
      player1DeckId,
      player2DeckId,
      player1Deck: {
        cards: player1Deck.cards
      },
      player2Deck: {
        cards: player2Deck.cards
      },
      matchType,
      gameState: null,
      currentPlayer: 'player1',
      turnNumber: 1,
      startedAt: Date.now(),
      lastActionAt: Date.now(),
      player1Ready: false,
      player2Ready: false,
      winner: null,
      ended: false,
      actionHistory: [],
      gameLogic,
      phaseStartedAt: Date.now()
    };

    activeMatches.set(matchId, matchState);

    console.log(`[MatchManager] Match ${matchId} created: ${player1Id} vs ${player2Id} (${matchType})`);

    return matchId;
  }

  async startMatch(matchId: number): Promise<void> {
    const match = activeMatches.get(matchId);
    if (!match) {
      throw new Error('Match not found');
    }

    // Initialize game
    await match.gameLogic.initialize(
      match.player1Deck.cards,
      match.player2Deck.cards
    );

    match.gameState = match.gameLogic.getFullState();
    if (match.gameState?.currentPlayer) {
      match.currentPlayer = match.gameState.currentPlayer;
    }
    match.phaseStartedAt = Date.now();
    match.lastActionAt = Date.now();

    console.log(`[MatchManager] Match ${matchId} started`);
  }

  getMatch(matchId: number): MatchState | null {
    const match = activeMatches.get(matchId);
    if (!match) return null;

    const { gameLogic, ...matchState } = match;
    return matchState;
  }

  setPlayerReady(matchId: number, playerId: number): void {
    const match = activeMatches.get(matchId);
    if (!match) {
      throw new Error('Match not found');
    }

    if (match.player1Id === playerId) {
      match.player1Ready = true;
    } else if (match.player2Id === playerId) {
      match.player2Ready = true;
    }

    console.log(`[MatchManager] Player ${playerId} ready for match ${matchId}`);
  }

  areBothPlayersReady(matchId: number): boolean {
    const match = activeMatches.get(matchId);
    if (!match) return false;
    return match.player1Ready && match.player2Ready;
  }

  async processAction(
    matchId: number,
    playerId: number,
    action: any
  ): Promise<{ success: boolean; error?: string; state?: any }> {
    const match = activeMatches.get(matchId);
    if (!match) {
      throw new Error('Match not found');
    }

    if (match.ended) {
      throw new Error('Match already ended');
    }

    // Determine which player
    const playerRole = match.player1Id === playerId ? 'player1' : 'player2';

    // Validate turn against authoritative game state (not stale cached field)
    const authoritativeState = match.gameLogic.getState();
    const currentTurnRole = authoritativeState?.currentPlayer || match.currentPlayer;
    if (currentTurnRole !== playerRole) {
      return { success: false, error: 'Not your turn' };
    }

    const previousTurn = Number(authoritativeState?.turnNumber || match.turnNumber || 0);
    const previousPhase = String(authoritativeState?.currentPhase || '');

    // Process action through game logic
    const result = await match.gameLogic.processAction(playerRole, action);

    // Update match state
    match.lastActionAt = Date.now();
    match.actionHistory.push({
      playerId,
      action,
      timestamp: Date.now()
    });

    // Update current state
    match.gameState = match.gameLogic.getFullState();
    if (match.gameState?.currentPlayer) {
      match.currentPlayer = match.gameState.currentPlayer;
    }
    const nextTurn = Number(match.gameState?.turnNumber || previousTurn);
    const nextPhase = String(match.gameState?.currentPhase || previousPhase);
    if (nextTurn !== previousTurn || nextPhase !== previousPhase) {
      match.phaseStartedAt = Date.now();
    }

    return result;
  }

  async autoAdvanceExpiredPhases(
    timeoutMs: number
  ): Promise<Array<{ match: MatchState; matchId: number; state: any }>> {
    const updates: Array<{ match: MatchState; matchId: number; state: any }> = [];
    const now = Date.now();
    for (const match of activeMatches.values()) {
      if (match.ended) continue;
      const state = match.gameLogic.getState();
      if (!state || state.winner) continue;
      const phase = String(state.currentPhase || '').toLowerCase();
      if (phase !== 'strategy' && phase !== 'combat') continue;
      const phaseStartedAt = Number(match.phaseStartedAt || match.lastActionAt || match.startedAt || now);
      if ((now - phaseStartedAt) < timeoutMs) continue;
      const currentRole = String(state.currentPlayer || match.currentPlayer);
      const actingUserId = currentRole === 'player2' ? match.player2Id : match.player1Id;
      const result = await this.processAction(match.matchId, actingUserId, { type: 'endTurn' });
      if (!result.success) {
        // Prevent tight retry loops when state is transient.
        match.phaseStartedAt = now;
        continue;
      }
      const currentMatch = this.getMatch(match.matchId);
      if (!currentMatch) continue;
      updates.push({
        match: currentMatch,
        matchId: match.matchId,
        state: result.state || match.gameLogic.getState()
      });
    }
    return updates;
  }

  endMatch(matchId: number, winnerId: number): void {
    const match = activeMatches.get(matchId);
    if (!match) {
      throw new Error('Match not found');
    }

    match.ended = true;
    match.winner = winnerId;

    console.log(`[MatchManager] Match ${matchId} ended. Winner: ${winnerId}`);

    // Remove from memory after 5 minutes
    setTimeout(() => {
      activeMatches.delete(matchId);
    }, 5 * 60 * 1000);
  }

  getMatchState(matchId: number): any {
    const match = activeMatches.get(matchId);
    if (!match) {
      throw new Error('Match not found');
    }

    return match.gameLogic.getState();
  }

  findActiveMatchByUser(userId: number): MatchState | null {
    for (const match of activeMatches.values()) {
      if (match.ended) continue;
      if (!match.gameState) continue;
      if (match.player1Id === userId || match.player2Id === userId) {
        const { gameLogic, ...matchState } = match;
        return matchState;
      }
    }
    return null;
  }
}

export default new MatchManager();
