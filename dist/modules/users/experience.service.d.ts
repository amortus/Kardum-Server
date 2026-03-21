export interface ExpResult {
    expGained: number;
    newExp: number;
    newLevel: number;
    leveledUp: boolean;
    levelsGained: number;
}
declare class ExperienceService {
    /** EXP acumulada mínima para estar no nível informado (início desse nível). */
    totalExpForLevel(level: number): number;
    /** EXP necessária para sair do nível `level` rumo ao próximo (tamanho do segmento). */
    expForNextLevel(level: number): number;
    /** Nível e progresso a partir da EXP total acumulada (tabela 1–100). */
    computeLevel(totalExp: number): {
        level: number;
        expIntoLevel: number;
        expToNext: number;
        progressPercent: number;
    };
    /** Award EXP to a user after a match and persist to DB. */
    awardExp(userId: number, matchType: 'casual' | 'ranked' | 'ai', won: boolean): Promise<ExpResult>;
    /**
     * Adiciona EXP bruta em uma única gravação (recompensas de quest, etc.).
     * Evita milhares de UPDATEs e mantém experience dentro do limite de INTEGER no Postgres.
     */
    addExpPoints(userId: number, rawPoints: number): Promise<ExpResult>;
}
declare const _default: ExperienceService;
export default _default;
//# sourceMappingURL=experience.service.d.ts.map