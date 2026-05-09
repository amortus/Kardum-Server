// server/services/elo.js - Sistema de cálculo de ELO
const { updateUserElo, getUserById } = require('../database');

/**
 * Calcular ELO esperado (probabilidade de vitória)
 */
function calculateExpectedScore(playerElo, opponentElo) {
    return 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
}

/**
 * Calcular novo ELO após partida
 * @param {number} playerElo - ELO atual do jogador
 * @param {number} opponentElo - ELO atual do oponente
 * @param {number} actualScore - 1 para vitória, 0 para derrota, 0.5 para empate
 * @param {string} matchType - 'ranked' ou 'casual'
 * @returns {number} Novo ELO do jogador
 */
function calculateNewElo(playerElo, opponentElo, actualScore, matchType = 'ranked') {
    const K = matchType === 'ranked' ? 32 : 16; // K-factor: ranked = 32, casual = 16
    const expectedScore = calculateExpectedScore(playerElo, opponentElo);
    const newElo = Math.round(playerElo + K * (actualScore - expectedScore));
    
    // ELO mínimo de 0
    return Math.max(0, newElo);
}

/**
 * Atualizar ELO de ambos os jogadores após partida
 * @param {number} player1Id - ID do jogador 1
 * @param {number} player2Id - ID do jogador 2
 * @param {number} winnerId - ID do vencedor (null para empate)
 * @param {string} matchType - 'ranked' ou 'casual'
 */
async function updateEloAfterMatch(player1Id, player2Id, winnerId, matchType) {
    const player1 = await getUserById(player1Id);
    const player2 = await getUserById(player2Id);

    if (!player1 || !player2) {
        console.error('[ELO] User not found');
        return;
    }

    const player1Elo = matchType === 'ranked' ? player1.elo_ranked : player1.elo_casual;
    const player2Elo = matchType === 'ranked' ? player2.elo_ranked : player2.elo_casual;

    // Calcular scores
    let player1Score, player2Score;
    if (winnerId === player1Id) {
        player1Score = 1;
        player2Score = 0;
    } else if (winnerId === player2Id) {
        player1Score = 0;
        player2Score = 1;
    } else {
        // Empate
        player1Score = 0.5;
        player2Score = 0.5;
    }

    // Calcular novos ELOs
    const newPlayer1Elo = calculateNewElo(player1Elo, player2Elo, player1Score, matchType);
    const newPlayer2Elo = calculateNewElo(player2Elo, player1Elo, player2Score, matchType);

    // Atualizar no banco
    await updateUserElo(player1Id, matchType, newPlayer1Elo);
    await updateUserElo(player2Id, matchType, newPlayer2Elo);

    console.log(`[ELO] Updated ${matchType} ELO: Player1 ${player1Elo} -> ${newPlayer1Elo} (${player1Score === 1 ? 'WIN' : player1Score === 0 ? 'LOSS' : 'DRAW'}), Player2 ${player2Elo} -> ${newPlayer2Elo} (${player2Score === 1 ? 'WIN' : player2Score === 0 ? 'LOSS' : 'DRAW'})`);

    return {
        player1: { oldElo: player1Elo, newElo: newPlayer1Elo, change: newPlayer1Elo - player1Elo },
        player2: { oldElo: player2Elo, newElo: newPlayer2Elo, change: newPlayer2Elo - player2Elo }
    };
}

module.exports = {
    calculateExpectedScore,
    calculateNewElo,
    updateEloAfterMatch
};

