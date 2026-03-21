"use strict";
/**
 * Curva de experiência níveis 1–100 (estilo MMO: progressão suave no início, grind maior no fim).
 * Deve ser espelhada em tcg-godot/autoloads/level_experience.gd
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LEVEL_CUMULATIVE_MIN_EXP = exports.LEVEL_UP_EXP_REQUIREMENTS = exports.MAX_LEVEL = void 0;
exports.expRequiredToAdvanceFromLevel = expRequiredToAdvanceFromLevel;
exports.totalExpRequiredForLevel = totalExpRequiredForLevel;
exports.MAX_LEVEL = 100;
function expRequiredToAdvanceFromLevel(levelFrom) {
    if (levelFrom < 1 || levelFrom >= exports.MAX_LEVEL)
        return 0;
    const L = levelFrom;
    const linear = 80 + L * 12;
    const curve = Math.floor(15 * L ** 1.85);
    return Math.min(400000, Math.max(40, linear + curve));
}
/** EXP para passar do nível L para L+1 (L = 1..99). */
exports.LEVEL_UP_EXP_REQUIREMENTS = Array.from({ length: exports.MAX_LEVEL - 1 }, (_, i) => expRequiredToAdvanceFromLevel(i + 1));
/** EXP total necessária para estar no nível `level` (início desse nível). Índice 1..100. */
exports.LEVEL_CUMULATIVE_MIN_EXP = (() => {
    const c = new Array(exports.MAX_LEVEL + 1).fill(0);
    for (let L = 1; L < exports.MAX_LEVEL; L += 1) {
        c[L + 1] = c[L] + exports.LEVEL_UP_EXP_REQUIREMENTS[L - 1];
    }
    return c;
})();
/** EXP acumulada mínima para alcançar o nível informado (primeiro frame nesse nível). */
function totalExpRequiredForLevel(level) {
    if (level <= 1)
        return 0;
    const clamped = Math.min(exports.MAX_LEVEL, Math.max(1, Math.floor(level)));
    return exports.LEVEL_CUMULATIVE_MIN_EXP[clamped];
}
//# sourceMappingURL=levelExperience.js.map