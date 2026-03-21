/**
 * Curva de experiência níveis 1–100 (estilo MMO: progressão suave no início, grind maior no fim).
 * Deve ser espelhada em tcg-godot/autoloads/level_experience.gd
 */
export declare const MAX_LEVEL = 100;
export declare function expRequiredToAdvanceFromLevel(levelFrom: number): number;
/** EXP para passar do nível L para L+1 (L = 1..99). */
export declare const LEVEL_UP_EXP_REQUIREMENTS: readonly number[];
/** EXP total necessária para estar no nível `level` (início desse nível). Índice 1..100. */
export declare const LEVEL_CUMULATIVE_MIN_EXP: readonly number[];
/** EXP acumulada mínima para alcançar o nível informado (primeiro frame nesse nível). */
export declare function totalExpRequiredForLevel(level: number): number;
//# sourceMappingURL=levelExperience.d.ts.map