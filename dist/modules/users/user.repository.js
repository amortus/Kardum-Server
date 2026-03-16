"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRepository = void 0;
const database_1 = __importDefault(require("../../config/database"));
class UserRepository {
    async getUserById(id) {
        return await database_1.default.query('SELECT * FROM users WHERE id = ?', [id]);
    }
    async getUserByUsername(username) {
        const normalizedUsername = username.trim().toLowerCase();
        return await database_1.default.query('SELECT * FROM users WHERE LOWER(username) = ?', [normalizedUsername]);
    }
    async createUser(username, passwordHash, email) {
        const result = await database_1.default.run('INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)', [username, passwordHash, email || null]);
        return result.lastInsertRowid;
    }
    async updateUserElo(userId, type, newElo) {
        const column = type === 'casual' ? 'elo_casual' : 'elo_ranked';
        await database_1.default.run(`UPDATE users SET ${column} = ? WHERE id = ?`, [newElo, userId]);
    }
    async updateUserStats(userId, won) {
        const winCol = won ? 'wins = wins + 1,' : 'losses = losses + 1,';
        await database_1.default.run(`UPDATE users SET ${winCol} total_matches = total_matches + 1 WHERE id = ?`, [userId]);
    }
    async updateUserLevelExp(userId, level, experience) {
        await database_1.default.run('UPDATE users SET level = ?, experience = ? WHERE id = ?', [level, experience, userId]);
    }
    async updateLastLogin(userId) {
        await database_1.default.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [userId]);
    }
    async updateUserCharacter(userId, character) {
        await database_1.default.run(`UPDATE users
       SET gender = ?, body_id = ?, head_id = ?, skin_body_id = ?, skin_head_id = ?, character_completed = ?
       WHERE id = ?`, [
            character.gender,
            character.body_id,
            character.head_id,
            character.skin_body_id ?? null,
            character.skin_head_id ?? null,
            character.character_completed,
            userId
        ]);
    }
    async updateUserProfileAvatar(userId, profileAvatarId) {
        await database_1.default.run(`UPDATE users
       SET profile_avatar_id = ?
       WHERE id = ?`, [profileAvatarId, userId]);
    }
    async getAllUsers() {
        return await database_1.default.queryAll('SELECT * FROM users ORDER BY elo_ranked DESC');
    }
    async getLeaderboard(limit = 50) {
        return await database_1.default.queryAll('SELECT * FROM users WHERE elo_ranked >= 1000 ORDER BY elo_ranked DESC LIMIT ?', [limit]);
    }
    async getRecentMatches(userId, limit = 20) {
        return await database_1.default.queryAll(`SELECT m.*, 
        u1.username AS player1_username, u1.level AS player1_level,
        u2.username AS player2_username, u2.level AS player2_level
       FROM matches m
       LEFT JOIN users u1 ON m.player1_id = u1.id
       LEFT JOIN users u2 ON m.player2_id = u2.id
       WHERE m.player1_id = ? OR m.player2_id = ?
       ORDER BY m.created_at DESC LIMIT ?`, [userId, userId, limit]);
    }
}
exports.UserRepository = UserRepository;
exports.default = new UserRepository();
//# sourceMappingURL=user.repository.js.map