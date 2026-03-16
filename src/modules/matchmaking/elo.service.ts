import userRepository from '../users/user.repository';
import experienceService from '../users/experience.service';

class EloService {
  private toSafeInt(value: unknown, fallback: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.trunc(parsed);
  }

  // Calculate ELO change
  calculateEloChange(
    winnerElo: number,
    loserElo: number,
    matchType: 'casual' | 'ranked' | 'ai'
  ): { winnerChange: number; loserChange: number } {
    const K = matchType === 'ranked' ? 32 : 24; // K-factor

    // Expected scores
    const expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
    const expectedLoser = 1 / (1 + Math.pow(10, (winnerElo - loserElo) / 400));

    // Actual scores (1 = win, 0 = loss)
    const winnerChange = Math.round(K * (1 - expectedWinner));
    const loserChange = Math.round(K * (0 - expectedLoser));

    return { winnerChange, loserChange };
  }

  // Update ELO after match
  async updateEloAfterMatch(
    player1Id: number,
    player2Id: number,
    winnerId: number,
    matchType: 'casual' | 'ranked' | 'ai'
  ): Promise<{
    player1EloChange: number;
    player2EloChange: number;
    player1NewElo: number;
    player2NewElo: number;
    expUpdate: {
      player1ExpGained: number;
      player1NewLevel: number;
      player1LeveledUp: boolean;
      player2ExpGained: number;
      player2NewLevel: number;
      player2LeveledUp: boolean;
    };
  }> {
    const player1 = await userRepository.getUserById(player1Id);
    const player2 = await userRepository.getUserById(player2Id);

    if (!player1 || !player2) {
      throw new Error('Player not found');
    }

    const player1EloRaw = matchType === 'ranked' ? player1.elo_ranked : player1.elo_casual;
    const player2EloRaw = matchType === 'ranked' ? player2.elo_ranked : player2.elo_casual;
    const player1Elo = this.toSafeInt(player1EloRaw, 1000);
    const player2Elo = this.toSafeInt(player2EloRaw, 1000);

    let player1Change: number;
    let player2Change: number;

    const eloMatchType = matchType === 'ai' ? 'casual' : matchType;

    if (winnerId === player1Id) {
      const changes = this.calculateEloChange(player1Elo, player2Elo, eloMatchType);
      player1Change = changes.winnerChange;
      player2Change = changes.loserChange;
    } else {
      const changes = this.calculateEloChange(player2Elo, player1Elo, eloMatchType);
      player2Change = changes.winnerChange;
      player1Change = changes.loserChange;
    }

    const player1NewElo = this.toSafeInt(player1Elo + player1Change, player1Elo);
    const player2NewElo = this.toSafeInt(player2Elo + player2Change, player2Elo);

    // Update ELO in database (AI matches don't affect ELO)
    if (matchType !== 'ai') {
      await userRepository.updateUserElo(player1Id, matchType, player1NewElo);
      await userRepository.updateUserElo(player2Id, matchType, player2NewElo);
    }

    // Update win/loss stats
    await userRepository.updateUserStats(player1Id, winnerId === player1Id);
    await userRepository.updateUserStats(player2Id, winnerId === player2Id);

    // Award EXP for both players
    const [p1Exp, p2Exp] = await Promise.all([
      experienceService.awardExp(player1Id, matchType, winnerId === player1Id),
      player2Id > 0
        ? experienceService.awardExp(player2Id, matchType, winnerId === player2Id)
        : Promise.resolve({ expGained: 0, newExp: 0, newLevel: 1, leveledUp: false, levelsGained: 0 })
    ]);

    console.log(`[ELO] Player ${player1Id}: ${player1Elo} → ${player1NewElo} (${player1Change > 0 ? '+' : ''}${player1Change})`);
    console.log(`[ELO] Player ${player2Id}: ${player2Elo} → ${player2NewElo} (${player2Change > 0 ? '+' : ''}${player2Change})`);

    return {
      player1EloChange: player1Change,
      player2EloChange: player2Change,
      player1NewElo,
      player2NewElo,
      expUpdate: {
        player1ExpGained: p1Exp.expGained,
        player1NewLevel: p1Exp.newLevel,
        player1LeveledUp: p1Exp.leveledUp,
        player2ExpGained: p2Exp.expGained,
        player2NewLevel: p2Exp.newLevel,
        player2LeveledUp: p2Exp.leveledUp
      }
    };
  }
}

export default new EloService();
