// server/services/matchmaking.js - Serviço de matchmaking
const { getUserById } = require('../database');

// Estrutura de fila: Map<userId, queueEntry>
const queues = {
    casual: new Map(),
    ranked: new Map()
};

// Timeout de matchmaking (5 minutos)
const MATCHMAKING_TIMEOUT = 5 * 60 * 1000;

/**
 * Entrada na fila
 */
class QueueEntry {
    constructor(userId, socketId, matchType, elo) {
        this.userId = userId;
        this.socketId = socketId;
        this.matchType = matchType;
        this.elo = elo;
        this.joinedAt = Date.now();
        this.timeout = setTimeout(() => {
            this.removeFromQueue();
        }, MATCHMAKING_TIMEOUT);
    }

    removeFromQueue() {
        const queue = queues[this.matchType];
        if (queue) {
            queue.delete(this.userId);
        }
        if (this.timeout) {
            clearTimeout(this.timeout);
        }
    }
}

/**
 * Adicionar jogador à fila
 */
async function addToQueue(userId, socketId, matchType, deckId) {
    const user = await getUserById(userId);
    if (!user) {
        throw new Error('User not found');
    }

    const elo = matchType === 'ranked' ? user.elo_ranked : user.elo_casual;
    const queue = queues[matchType];

    // Remover se já estiver na fila
    if (queue.has(userId)) {
        const existing = queue.get(userId);
        existing.removeFromQueue();
    }

    // Adicionar à fila
    const entry = new QueueEntry(userId, socketId, matchType, elo);
    entry.deckId = deckId;
    queue.set(userId, entry);

    console.log(`[Matchmaking] User ${userId} added to ${matchType} queue (ELO: ${elo})`);
    
    // Tentar encontrar match imediatamente
    return findMatch(userId, matchType);
}

/**
 * Remover jogador da fila
 */
function removeFromQueue(userId, matchType) {
    const queue = queues[matchType];
    if (queue.has(userId)) {
        const entry = queue.get(userId);
        entry.removeFromQueue();
        console.log(`[Matchmaking] User ${userId} removed from ${matchType} queue`);
        return true;
    }
    return false;
}

/**
 * Buscar oponente para matchmaking
 */
function findMatch(userId, matchType) {
    const queue = queues[matchType];
    const player = queue.get(userId);
    
    if (!player) {
        return null;
    }

    // Parâmetros de busca
    const eloRange = matchType === 'ranked' ? 200 : 500; // ±200 para ranked, ±500 para casual
    const minElo = player.elo - eloRange;
    const maxElo = player.elo + eloRange;

    // Buscar oponente compatível
    let bestMatch = null;
    let bestEloDiff = Infinity;

    for (const [opponentId, opponent] of queue.entries()) {
        if (opponentId === userId) continue; // Não pode jogar contra si mesmo

        const eloDiff = Math.abs(opponent.elo - player.elo);
        
        if (opponent.elo >= minElo && opponent.elo <= maxElo && eloDiff < bestEloDiff) {
            bestMatch = opponent;
            bestEloDiff = eloDiff;
        }
    }

    if (bestMatch) {
        // Remover ambos da fila
        player.removeFromQueue();
        bestMatch.removeFromQueue();

        console.log(`[Matchmaking] Match found: ${userId} (ELO: ${player.elo}) vs ${bestMatch.userId} (ELO: ${bestMatch.elo})`);

        return {
            player1: {
                userId: player.userId,
                socketId: player.socketId,
                elo: player.elo,
                deckId: player.deckId
            },
            player2: {
                userId: bestMatch.userId,
                socketId: bestMatch.socketId,
                elo: bestMatch.elo,
                deckId: bestMatch.deckId
            }
        };
    }

    return null;
}

/**
 * Obter status da fila
 */
function getQueueStatus(userId, matchType) {
    const queue = queues[matchType];
    const player = queue.get(userId);
    
    if (!player) {
        return null;
    }

    // Contar jogadores na fila
    const queueSize = queue.size;
    const waitTime = Date.now() - player.joinedAt;

    return {
        inQueue: true,
        queueSize,
        waitTime,
        elo: player.elo
    };
}

/**
 * Limpar filas (útil para shutdown)
 */
function clearQueues() {
    queues.casual.clear();
    queues.ranked.clear();
}

module.exports = {
    addToQueue,
    removeFromQueue,
    findMatch,
    getQueueStatus,
    clearQueues,
    queues // Exportar para acesso externo se necessário
};

