import { MAX_LEVEL, LEVEL_CUMULATIVE_MIN_EXP, LEVEL_UP_EXP_REQUIREMENTS, EXP_REWARDS } from '../../shared/constants';
import userRepository from './user.repository';

const MAX_USER_EXP_DB = 2_147_483_647;

function clampTotalExpFromDb(raw: unknown): number {
  if (raw == null) return 0;
  if (typeof raw === 'bigint') {
    if (raw > BigInt(MAX_USER_EXP_DB)) return MAX_USER_EXP_DB;
    if (raw < 0n) return 0;
    return Number(raw);
  }
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (/^\d{1,20}$/.test(t)) {
      try {
        const bi = BigInt(t);
        if (bi > BigInt(MAX_USER_EXP_DB)) return MAX_USER_EXP_DB;
        if (bi < 0n) return 0;
        return Number(bi);
      } catch {
        return 0;
      }
    }
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(MAX_USER_EXP_DB, Math.floor(n)));
}

export interface ExpResult {
  expGained: number;
  newExp: number;
  newLevel: number;
  leveledUp: boolean;
  levelsGained: number;
}

class ExperienceService {
  /** EXP acumulada mínima para estar no nível informado (início desse nível). */
  totalExpForLevel(level: number): number {
    if (level <= 1) return 0;
    const L = Math.min(MAX_LEVEL, Math.max(1, Math.floor(level)));
    return LEVEL_CUMULATIVE_MIN_EXP[L];
  }

  /** EXP necessária para sair do nível `level` rumo ao próximo (tamanho do segmento). */
  expForNextLevel(level: number): number {
    if (level < 1 || level >= MAX_LEVEL) return 0;
    return LEVEL_UP_EXP_REQUIREMENTS[level - 1];
  }

  /** Nível e progresso a partir da EXP total acumulada (tabela 1–100). */
  computeLevel(totalExp: number): { level: number; expIntoLevel: number; expToNext: number; progressPercent: number } {
    const te = Math.max(0, Math.floor(Number(totalExp) || 0));
    let level = 1;
    while (level < MAX_LEVEL) {
      const start = LEVEL_CUMULATIVE_MIN_EXP[level];
      const seg = LEVEL_UP_EXP_REQUIREMENTS[level - 1];
      if (te < start + seg) break;
      level += 1;
    }
    const start = LEVEL_CUMULATIVE_MIN_EXP[level];
    const expIntoLevel = te - start;
    const expToNext = level < MAX_LEVEL ? LEVEL_UP_EXP_REQUIREMENTS[level - 1] : 0;
    const progressPercent = expToNext > 0 ? Math.floor((expIntoLevel / expToNext) * 100) : 100;

    return { level, expIntoLevel, expToNext, progressPercent };
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

    const oldExp = clampTotalExpFromDb(user.experience);
    const newExp = oldExp + expGained;

    const oldSnap = this.computeLevel(oldExp);
    const newSnap = this.computeLevel(newExp);
    const leveledUp = newSnap.level > oldSnap.level;
    const levelsGained = newSnap.level - oldSnap.level;

    await userRepository.updateUserLevelExp(userId, newSnap.level, newExp);

    if (leveledUp) {
      console.log(`[EXP] User ${userId} leveled up: ${oldSnap.level} → ${newSnap.level} (+${expGained} EXP)`);
    }

    return { expGained, newExp, newLevel: newSnap.level, leveledUp, levelsGained };
  }

  /**
   * Adiciona EXP bruta em uma única gravação (recompensas de quest, etc.).
   * Evita milhares de UPDATEs e mantém experience dentro do limite de INTEGER no Postgres.
   */
  async addExpPoints(userId: number, rawPoints: number): Promise<ExpResult> {
    const user = await userRepository.getUserById(userId);
    if (!user) throw new Error(`User ${userId} not found`);

    const gain = Math.max(0, Math.min(1_000_000_000, Math.floor(Number(rawPoints) || 0)));
    const oldExp = clampTotalExpFromDb(user.experience);
    const newExp = Math.max(0, Math.min(2_147_483_647, oldExp + gain));

    const oldSnap = this.computeLevel(oldExp);
    const newSnap = this.computeLevel(newExp);
    const leveledUp = newSnap.level > oldSnap.level;
    const levelsGained = newSnap.level - oldSnap.level;

    await userRepository.updateUserLevelExp(userId, newSnap.level, newExp);

    if (leveledUp) {
      console.log(`[EXP] User ${userId} leveled up (bulk): ${oldSnap.level} → ${newSnap.level} (+${gain} EXP)`);
    }

    return { expGained: gain, newExp, newLevel: newSnap.level, leveledUp, levelsGained };
  }
}

export default new ExperienceService();
