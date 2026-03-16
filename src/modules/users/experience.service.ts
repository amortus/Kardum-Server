import { LEVEL_BASE_EXP, LEVEL_EXP_INCREMENT, MAX_LEVEL, EXP_REWARDS } from '../../shared/constants';
import userRepository from './user.repository';

export interface ExpResult {
  expGained: number;
  newExp: number;
  newLevel: number;
  leveledUp: boolean;
  levelsGained: number;
}

class ExperienceService {
  /** Total EXP required to reach the given level from level 1. */
  totalExpForLevel(level: number): number {
    if (level <= 1) return 0;
    // Sum of (LEVEL_BASE_EXP + (i-1) * LEVEL_EXP_INCREMENT) for i = 1 to level-1
    // = (level-1)*LEVEL_BASE_EXP + LEVEL_EXP_INCREMENT * (level-1)*(level-2)/2
    const n = level - 1;
    return n * LEVEL_BASE_EXP + LEVEL_EXP_INCREMENT * n * (n - 1) / 2;
  }

  /** EXP needed to go from current level to next level. */
  expForNextLevel(level: number): number {
    return LEVEL_BASE_EXP + (level - 1) * LEVEL_EXP_INCREMENT;
  }

  /** Compute level and progress from a total accumulated EXP value. */
  computeLevel(totalExp: number): { level: number; expIntoLevel: number; expToNext: number; progressPercent: number } {
    let level = 1;
    let remaining = totalExp;

    while (level < MAX_LEVEL) {
      const needed = this.expForNextLevel(level);
      if (remaining < needed) break;
      remaining -= needed;
      level++;
    }

    const expToNext = level < MAX_LEVEL ? this.expForNextLevel(level) : 0;
    const progressPercent = expToNext > 0 ? Math.floor((remaining / expToNext) * 100) : 100;

    return { level, expIntoLevel: remaining, expToNext, progressPercent };
  }

  /** Award EXP to a user after a match and persist to DB. */
  async awardExp(
    userId: number,
    matchType: 'casual' | 'ranked' | 'ai',
    won: boolean
  ): Promise<ExpResult> {
    const user = await userRepository.getUserById(userId);
    if (!user) throw new Error(`User ${userId} not found`);

    const rewardTable = EXP_REWARDS[matchType] ?? EXP_REWARDS.casual;
    const expGained = won ? rewardTable.win : rewardTable.loss;

    const oldLevel = user.level ?? 1;
    const oldExp = user.experience ?? 0;
    const newExp = oldExp + expGained;

    const { level: newLevel } = this.computeLevel(newExp);
    const leveledUp = newLevel > oldLevel;
    const levelsGained = newLevel - oldLevel;

    await userRepository.updateUserLevelExp(userId, newLevel, newExp);

    if (leveledUp) {
      console.log(`[EXP] User ${userId} leveled up: ${oldLevel} → ${newLevel} (+${expGained} EXP)`);
    }

    return { expGained, newExp, newLevel, leveledUp, levelsGained };
  }
}

export default new ExperienceService();
