"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const env_1 = require("../../config/env");
const database_1 = __importDefault(require("../../config/database"));
class ChatRepository {
    async saveMessagesBatch(messages) {
        if (messages.length === 0)
            return;
        const chunkSize = Math.max(1, Math.min(messages.length, env_1.ENV.CHAT_PERSIST_CHUNK_SIZE, 120));
        for (let start = 0; start < messages.length; start += chunkSize) {
            const chunk = messages.slice(start, start + chunkSize);
            const placeholders = [];
            const params = [];
            for (const msg of chunk) {
                placeholders.push('(?, ?, ?, ?, ?, ?, ?)');
                params.push(msg.channel, msg.senderUserId ?? null, msg.senderUsername, msg.recipientUserId ?? null, msg.recipientUsername ?? null, msg.message, msg.timestamp);
            }
            await database_1.default.run(`INSERT INTO chat_messages
          (channel, sender_user_id, sender_username, recipient_user_id, recipient_username, message, timestamp)
         VALUES ${placeholders.join(', ')}`, params);
        }
    }
    async getChannelHistory(channel, limit) {
        const rows = await database_1.default.queryAll(`SELECT id, channel, sender_user_id, sender_username, recipient_user_id, recipient_username, message, timestamp
       FROM chat_messages
       WHERE channel = ?
       ORDER BY timestamp DESC, id DESC
       LIMIT ?`, [channel, limit]);
        return rows
            .map((r) => ({
            id: r.id,
            channel: r.channel,
            senderUserId: r.sender_user_id,
            senderUsername: r.sender_username,
            recipientUserId: r.recipient_user_id,
            recipientUsername: r.recipient_username,
            message: r.message,
            timestamp: r.timestamp
        }))
            .reverse();
    }
    async runCleanupKeepLatestPerChannel(keepPublicPerChannel = 100, keepWhisperPerChannel = 300, maxDeletePerRun = 5000) {
        const channels = await database_1.default.queryAll('SELECT DISTINCT channel FROM chat_messages');
        let totalDeleted = 0;
        for (const row of channels) {
            if (totalDeleted >= maxDeletePerRun)
                break;
            const channel = String(row.channel || '');
            if (!channel)
                continue;
            const keep = channel === 'whisper' ? keepWhisperPerChannel : keepPublicPerChannel;
            const remainingBudget = maxDeletePerRun - totalDeleted;
            const result = await database_1.default.run(`DELETE FROM chat_messages
         WHERE id IN (
           SELECT id
           FROM chat_messages
           WHERE channel = ?
           ORDER BY timestamp DESC, id DESC
           LIMIT ? OFFSET ?
         )`, [channel, remainingBudget, keep]);
            totalDeleted += result.changes;
        }
        return totalDeleted;
    }
}
exports.default = new ChatRepository();
//# sourceMappingURL=chat.repository.js.map