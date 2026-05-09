/**
 * Curva de experiência níveis 1–100 (estilo MMO: progressão suave no início, grind maior no fim).
 * Deve ser espelhada em tcg-godot/autoloads/level_experience.gd
 */

export const MAX_LEVEL = 100;

export function expRequiredToAdvanceFromLevel(levelFrom: number): number {
  if (levelFrom < 1 || levelFrom >= MAX_LEVEL) return 0;
  const L = levelFrom;
  const linear = 80 + L * 12;
  const curve = Math.floor(15 * L ** 1.85);
  return Math.min(400_000, Math.max(40, linear + curve));
}

/** EXP para passar do nível L para L+1 (L = 1..99). */
export const LEVEL_UP_EXP_REQUIREMENTS: readonly number[] = Array.from({ length: MAX_LEVEL - 1 }, (_, i) =>
  expRequiredToAdvanceFromLevel(i + 1)
);

/** EXP total necessária para estar no nível `level` (início desse nível). Índice 1..100. */
export const LEVEL_CUMULATIVE_MIN_EXP: readonly number[] = (() => {
  const c: number[] = new Array(MAX_LEVEL + 1).fill(0);
  for (let L = 1; L < MAX_LEVEL; L += 1) {
    c[L + 1] = c[L] + LEVEL_UP_EXP_REQUIREMENTS[L - 1];
  }
  return c;
})();

/** EXP acumulada mínima para alcançar o nível informado (primeiro frame nesse nível). */
export function totalExpRequiredForLevel(level: number): number {
  if (level <= 1) return 0;
  const clamped = Math.min(MAX_LEVEL, Math.max(1, Math.floor(level)));
  return LEVEL_CUMULATIVE_MIN_EXP[clamped];
}
