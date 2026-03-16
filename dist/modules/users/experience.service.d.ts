export interface ExpResult {
    expGained: number;
    newExp: number;
    newLevel: number;
    leveledUp: boolean;
    levelsGained: number;
}
declare class ExperienceService {
    /** Total EXP required to reach the given level from level 1. */
    totalExpForLevel(level: number): number;
    /** EXP needed to go from current level to next level. */
    expForNextLevel(level: number): number;
    /** Compute level and progress from a total accumulated EXP value. */
    computeLevel(totalExp: number): {
        level: number;
        expIntoLevel: number;
        expToNext: number;
        progressPercent: number;
    };
    /** Award EXP to a user after a match and persist to DB. */
    awardExp(userId: number, matchType: 'casual' | 'ranked' | 'ai', won: boolean): Promise<ExpResult>;
}
declare const _default: ExperienceService;
export default _default;
//# sourceMappingURL=experience.service.d.ts.map