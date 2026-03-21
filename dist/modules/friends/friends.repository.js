"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = __importStar(require("../../config/database"));
class FriendsRepository {
    async createRequest(userId, friendId) {
        const insert = () => database_1.default.run(`INSERT INTO friendships (user_id, friend_id, status)
         VALUES (?, ?, 'pending')`, [userId, friendId]);
        try {
            await insert();
        }
        catch (e) {
            const msg = String(e?.message || '');
            const code = String(e?.code || '');
            const idBroken = database_1.usePostgres &&
                (code === '23502' || (msg.includes('null value') && msg.includes('"id"') && msg.includes('friendships')));
            if (!idBroken)
                throw e;
            await database_1.default
                .exec(`
DO $fix$
BEGIN
  CREATE SEQUENCE IF NOT EXISTS friendships_id_seq;
  PERFORM setval(
    'friendships_id_seq',
    GREATEST(COALESCE((SELECT MAX(id) FROM friendships), 0), 1)
  );
  ALTER TABLE friendships ALTER COLUMN id SET DEFAULT nextval('friendships_id_seq');
END;
$fix$;
        `)
                .catch(() => { });
            await insert();
        }
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