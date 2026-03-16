import userRepository from '../users/user.repository';
import { GAME_CONSTANTS } from '../../shared/constants';
import { ENV } from '../../config/env';
import { matchmakingStore, type MatchType, type QueueEntryRecord } from './matchmaking.store';

interface QueueEntry {
  userId: number;
  socketId: string;
  matchType: MatchType;
  elo: number;
  deckId: number;
  joinedAt: number;
  timeout?: NodeJS.Timeout;
}

class MatchmakingService {
  private queues: {
    casual: Map<number, QueueEntry>;
    ranked: Map<number, QueueEntry>;
  };

  constructor() {
    this.queues = {
      casual: new Map(),
      ranked: new Map()
    };
  }

  async addToQueue(
    userId: number,
    socketId: string,
    matchType: MatchType,
    deckId: number
  ): Promise<{
    player1: QueueEntry;
    player2: QueueEntry;
  } | null> {
    const user = await userRepository.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const elo = matchType === 'ranked' ? user.elo_ranked : user.elo_casual;
    if (ENV.MM_MATCHMAKING_REDIS_ENABLED) {
      const entry: QueueEntryRecord = {
        userId,
        socketId,
        matchType,
        elo,
        deckId,
        joinedAt: Date.now()
      };
      await matchmakingStore.upsert(matchType, entry);
      console.log(`[Matchmaking] User ${userId} added to distributed ${matchType} queue (ELO: ${elo})`);
      const distributedMatch = await this.findMatchDistributed(userId, matchType);
      if (!distributedMatch) return null;
      return {
        player1: { ...distributedMatch.player1 },
        player2: { ...distributedMatch.player2 }
      };
    }
    const queue = this.queues[matchType];

    // Remove if already in queue
    if (queue.has(userId)) {
      const existing = queue.get(userId)!;
      clearTimeout(existing.timeout);
      queue.delete(userId);
    }

    // Create entry
    const entry: QueueEntry = {
      userId,
      socketId,
      matchType,
      elo,
      deckId,
      joinedAt: Date.now(),
      timeout: setTimeout(() => {
        queue.delete(userId);
        console.log(`[Matchmaking] User ${userId} removed from ${matchType} queue (timeout)`);
      }, GAME_CONSTANTS.MATCHMAKING_TIMEOUT_MS)
    };

    queue.set(userId, entry);

    console.log(`[Matchmaking] User ${userId} added to ${matchType} queue (ELO: ${elo})`);

    // Try to find match immediately
    return this.findMatch(userId, matchType);
  }

  removeFromQueue(userId: number, matchType: MatchType): boolean {
    if (ENV.MM_MATCHMAKING_REDIS_ENABLED) {
      void matchmakingStore.remove(matchType, userId);
      return true;
    }
    const queue = this.queues[matchType];
    const entry = queue.get(userId);
    
    if (entry) {
      clearTimeout(entry.timeout);
      queue.delete(userId);
      console.log(`[Matchmaking] User ${userId} removed from ${matchType} queue`);
      return true;
    }
    
    return false;
  }

  private findMatch(
    userId: number,
    matchType: MatchType
  ): { player1: QueueEntry; player2: QueueEntry } | null {
    const queue = this.queues[matchType];
    const player = queue.get(userId);

    if (!player) {
      return null;
    }

    // Matchmaking parameters
    const eloRange = matchType === 'ranked' 
      ? GAME_CONSTANTS.ELO_RANGE_RANKED 
      : GAME_CONSTANTS.ELO_RANGE_CASUAL;
    const minElo = player.elo - eloRange;
    const maxElo = player.elo + eloRange;

    // Find best opponent
    let bestMatch: QueueEntry | null = null;
    let bestEloDiff = Infinity;

    for (const [opponentId, opponent] of queue.entries()) {
      if (opponentId === userId) continue;

      const eloDiff = Math.abs(opponent.elo - player.elo);

      if (opponent.elo >= minElo && opponent.elo <= maxElo && eloDiff < bestEloDiff) {
        bestMatch = opponent;
        bestEloDiff = eloDiff;
      }
    }

    if (bestMatch) {
      // Remove both from queue
      clearTimeout(player.timeout);
      clearTimeout(bestMatch.timeout);
      queue.delete(userId);
      queue.delete(bestMatch.userId);

      console.log(`[Matchmaking] Match found: ${userId} (ELO: ${player.elo}) vs ${bestMatch.userId} (ELO: ${bestMatch.elo})`);

      return {
        player1: player,
        player2: bestMatch
      };
    }

    return null;
  }

  getQueueStatus(userId: number, matchType: 'casual' | 'ranked'): any {
    if (ENV.MM_MATCHMAKING_REDIS_ENABLED) {
      return null;
    }
    const queue = this.queues[matchType];
    const player = queue.get(userId);

    if (!player) {
      return null;
    }

    return {
      inQueue: true,
      queueSize: queue.size,
      waitTime: Date.now() - player.joinedAt,
      elo: player.elo
    };
  }

  clearQueues(): void {
    this.queues.casual.clear();
    this.queues.ranked.clear();
    if (ENV.MM_MATCHMAKING_REDIS_ENABLED) {
      void matchmakingStore.clearAll();
    }
  }

  private async findMatchDistributed(
    userId: number,
    matchType: MatchType
  ): Promise<{ player1: QueueEntryRecord; player2: QueueEntryRecord } | null> {
    const locked = await matchmakingStore.withLock(matchType, async () => {
      const player = await matchmakingStore.get(matchType, userId);
      if (!player) return null;
      const timeoutMs = GAME_CONSTANTS.MATCHMAKING_TIMEOUT_MS;
      const now = Date.now();
      const allEntries = (await matchmakingStore.getAll(matchType)).filter((entry) => now - entry.joinedAt <= timeoutMs);
      const eloRange = matchType === 'ranked' ? GAME_CONSTANTS.ELO_RANGE_RANKED : GAME_CONSTANTS.ELO_RANGE_CASUAL;
      const minElo = player.elo - eloRange;
      const maxElo = player.elo + eloRange;
      let bestMatch: QueueEntryRecord | null = null;
      let bestEloDiff = Infinity;
      for (const candidate of allEntries) {
        if (candidate.userId === userId) continue;
        const eloDiff = Math.abs(candidate.elo - player.elo);
        if (candidate.elo >= minElo && candidate.elo <= maxElo && eloDiff < bestEloDiff) {
          bestMatch = candidate;
          bestEloDiff = eloDiff;
        }
      }
      if (!bestMatch) return null;
      await Promise.all([
        matchmakingStore.remove(matchType, userId),
        matchmakingStore.remove(matchType, bestMatch.userId)
      ]);
      console.log(
        `[Matchmaking] Distributed match found: ${userId} (ELO: ${player.elo}) vs ${bestMatch.userId} (ELO: ${bestMatch.elo})`
      );
      return { player1: player, player2: bestMatch };
    });
    return locked;
  }
}

export default new MatchmakingService();
