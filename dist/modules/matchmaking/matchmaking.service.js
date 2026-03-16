"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const user_repository_1 = __importDefault(require("../users/user.repository"));
const constants_1 = require("../../shared/constants");
const env_1 = require("../../config/env");
const matchmaking_store_1 = require("./matchmaking.store");
class MatchmakingService {
    constructor() {
        this.queues = {
            casual: new Map(),
            ranked: new Map()
        };
    }
    async addToQueue(userId, socketId, matchType, deckId) {
        const user = await user_repository_1.default.getUserById(userId);
        if (!user) {
            throw new Error('User not found');
        }
        const elo = matchType === 'ranked' ? user.elo_ranked : user.elo_casual;
        if (env_1.ENV.MM_MATCHMAKING_REDIS_ENABLED) {
            const entry = {
                userId,
                socketId,
                matchType,
                elo,
                deckId,
                joinedAt: Date.now()
            };
            await matchmaking_store_1.matchmakingStore.upsert(matchType, entry);
            console.log(`[Matchmaking] User ${userId} added to distributed ${matchType} queue (ELO: ${elo})`);
            const distributedMatch = await this.findMatchDistributed(userId, matchType);
            if (!distributedMatch)
                return null;
            return {
                player1: { ...distributedMatch.player1 },
                player2: { ...distributedMatch.player2 }
            };
        }
        const queue = this.queues[matchType];
        // Remove if already in queue
        if (queue.has(userId)) {
            const existing = queue.get(userId);
            clearTimeout(existing.timeout);
            queue.delete(userId);
        }
        // Create entry
        const entry = {
            userId,
            socketId,
            matchType,
            elo,
            deckId,
            joinedAt: Date.now(),
            timeout: setTimeout(() => {
                queue.delete(userId);
                console.log(`[Matchmaking] User ${userId} removed from ${matchType} queue (timeout)`);
            }, constants_1.GAME_CONSTANTS.MATCHMAKING_TIMEOUT_MS)
        };
        queue.set(userId, entry);
        console.log(`[Matchmaking] User ${userId} added to ${matchType} queue (ELO: ${elo})`);
        // Try to find match immediately
        return this.findMatch(userId, matchType);
    }
    removeFromQueue(userId, matchType) {
        if (env_1.ENV.MM_MATCHMAKING_REDIS_ENABLED) {
            void matchmaking_store_1.matchmakingStore.remove(matchType, userId);
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
    findMatch(userId, matchType) {
        const queue = this.queues[matchType];
        const player = queue.get(userId);
        if (!player) {
            return null;
        }
        // Matchmaking parameters
        const eloRange = matchType === 'ranked'
            ? constants_1.GAME_CONSTANTS.ELO_RANGE_RANKED
            : constants_1.GAME_CONSTANTS.ELO_RANGE_CASUAL;
        const minElo = player.elo - eloRange;
        const maxElo = player.elo + eloRange;
        // Find best opponent
        let bestMatch = null;
        let bestEloDiff = Infinity;
        for (const [opponentId, opponent] of queue.entries()) {
            if (opponentId === userId)
                continue;
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
    getQueueStatus(userId, matchType) {
        if (env_1.ENV.MM_MATCHMAKING_REDIS_ENABLED) {
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
    clearQueues() {
        this.queues.casual.clear();
        this.queues.ranked.clear();
        if (env_1.ENV.MM_MATCHMAKING_REDIS_ENABLED) {
            void matchmaking_store_1.matchmakingStore.clearAll();
        }
    }
    async findMatchDistributed(userId, matchType) {
        const locked = await matchmaking_store_1.matchmakingStore.withLock(matchType, async () => {
            const player = await matchmaking_store_1.matchmakingStore.get(matchType, userId);
            if (!player)
                return null;
            const timeoutMs = constants_1.GAME_CONSTANTS.MATCHMAKING_TIMEOUT_MS;
            const now = Date.now();
            const allEntries = (await matchmaking_store_1.matchmakingStore.getAll(matchType)).filter((entry) => now - entry.joinedAt <= timeoutMs);
            const eloRange = matchType === 'ranked' ? constants_1.GAME_CONSTANTS.ELO_RANGE_RANKED : constants_1.GAME_CONSTANTS.ELO_RANGE_CASUAL;
            const minElo = player.elo - eloRange;
            const maxElo = player.elo + eloRange;
            let bestMatch = null;
            let bestEloDiff = Infinity;
            for (const candidate of allEntries) {
                if (candidate.userId === userId)
                    continue;
                const eloDiff = Math.abs(candidate.elo - player.elo);
                if (candidate.elo >= minElo && candidate.elo <= maxElo && eloDiff < bestEloDiff) {
                    bestMatch = candidate;
                    bestEloDiff = eloDiff;
                }
            }
            if (!bestMatch)
                return null;
            await Promise.all([
                matchmaking_store_1.matchmakingStore.remove(matchType, userId),
                matchmaking_store_1.matchmakingStore.remove(matchType, bestMatch.userId)
            ]);
            console.log(`[Matchmaking] Distributed match found: ${userId} (ELO: ${player.elo}) vs ${bestMatch.userId} (ELO: ${bestMatch.elo})`);
            return { player1: player, player2: bestMatch };
        });
        return locked;
    }
}
exports.default = new MatchmakingService();
//# sourceMappingURL=matchmaking.service.js.map