"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = __importDefault(require("../../config/database"));
class FriendsRepository {
    async createRequest(userId, friendId) {
        await database_1.default.run(`INSERT INTO friendships (user_id, friend_id, status)
       VALUES (?, ?, 'pending')`, [userId, friendId]);
    }
    async getRelationship(userId, friendId) {
        return database_1.default.query(`SELECT id, user_id, friend_id, status, requested_at, accepted_at
       FROM friendships
       WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)
       LIMIT 1`, [userId, friendId, friendId, userId]);
    }
    async acceptRequest(requestId) {
        await database_1.default.run(`UPDATE friendships
       SET status = 'accepted', accepted_at = CURRENT_TIMESTAMP
       WHERE id = ?`, [requestId]);
    }
    async removeRelationship(userId, friendId) {
        await database_1.default.run(`DELETE FROM friendships
       WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)`, [userId, friendId, friendId, userId]);
    }
    async listUserFriends(userId) {
        return database_1.default.queryAll(`SELECT
         CASE WHEN f.user_id = ? THEN f.friend_id ELSE f.user_id END AS "userId",
         u.username AS username,
         f.status AS status,
         CASE WHEN f.user_id = ? THEN 'outgoing' ELSE 'incoming' END AS direction
       FROM friendships f
       INNER JOIN users u ON u.id = CASE WHEN f.user_id = ? THEN f.friend_id ELSE f.user_id END
       WHERE f.user_id = ? OR f.friend_id = ?
       ORDER BY u.username ASC`, [userId, userId, userId, userId, userId]);
    }
    async getAcceptedFriendIds(userId) {
        const rows = await database_1.default.queryAll(`SELECT CASE WHEN user_id = ? THEN friend_id ELSE user_id END AS friend_id
       FROM friendships
       WHERE status = 'accepted' AND (user_id = ? OR friend_id = ?)`, [userId, userId, userId]);
        return rows.map((r) => r.friend_id);
    }
}
exports.default = new FriendsRepository();
//# sourceMappingURL=friends.repository.js.map