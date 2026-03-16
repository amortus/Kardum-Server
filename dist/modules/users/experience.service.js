"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const constants_1 = require("../../shared/constants");
const user_repository_1 = __importDefault(require("./user.repository"));
class ExperienceService {
    /** Total EXP required to reach the given level from level 1. */
    totalExpForLevel(level) {
        if (level <= 1)
            return 0;
        // Sum of (LEVEL_BASE_EXP + (i-1) * LEVEL_EXP_INCREMENT) for i = 1 to level-1
        // = (level-1)*LEVEL_BASE_EXP + LEVEL_EXP_INCREMENT * (level-1)*(level-2)/2
        const n = level - 1;
        return n * constants_1.LEVEL_BASE_EXP + constants_1.LEVEL_EXP_INCREMENT * n * (n - 1) / 2;
    }
    /** EXP needed to go from current level to next level. */
    expForNextLevel(level) {
        return constants_1.LEVEL_BASE_EXP + (level - 1) * constants_1.LEVEL_EXP_INCREMENT;
    }
    /** Compute level and progress from a total accumulated EXP value. */
    computeLevel(totalExp) {
        let level = 1;
        let remaining = totalExp;
        while (level < constants_1.MAX_LEVEL) {
            const needed = this.expForNextLevel(level);
            if (remaining < needed)
                break;
            remaining -= needed;
            level++;
        }
        const expToNext = level < constants_1.MAX_LEVEL ? this.expForNextLevel(level) : 0;
        const progressPercent = expToNext > 0 ? Math.floor((remaining / expToNext) * 100) : 100;
        return { level, expIntoLevel: remaining, expToNext, progressPercent };
    }
    /** Award EXP to a user after a match and persist to DB. */
    async awardExp(userId, matchType, won) {
        const user = await user_repository_1.default.getUserById(userId);
        if (!user)
            throw new Error(`User ${userId} not found`);
        const rewardTable = constants_1.EXP_REWARDS[matchType] ?? constants_1.EXP_REWARDS.casual;
        const expGained = won ? rewardTable.win : rewardTable.loss;
        const oldLevel = user.level ?? 1;
        const oldExp = user.experience ?? 0;
        const newExp = oldExp + expGained;
        const { level: newLevel } = this.computeLevel(newExp);
        const leveledUp = newLevel > oldLevel;
        const levelsGained = newLevel - oldLevel;
        await user_repository_1.default.updateUserLevelExp(userId, newLevel, newExp);
        if (leveledUp) {
            console.log(`[EXP] User ${userId} leveled up: ${oldLevel} → ${newLevel} (+${expGained} EXP)`);
        }
        return { expGained, newExp, newLevel, leveledUp, levelsGained };
    }
}
exports.default = new ExperienceService();
//# sourceMappingURL=experience.service.js.map