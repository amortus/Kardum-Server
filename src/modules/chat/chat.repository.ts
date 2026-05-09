import { ENV } from '../../config/env';
import dbHelpers from '../../config/database';
import type { ChatMessage } from '../../shared/types';

type ChatMessageRow = {
  id: number;
  channel: string;
  sender_user_id: number | null;
  sender_username: string;
  recipient_user_id: number | null;
  recipient_username: string | null;
  message: string;
  timestamp: number;
};

class ChatRepository {
  async saveMessagesBatch(messages: ChatMessage[]): Promise<void> {
    if (messages.length === 0) return;
    const chunkSize = Math.max(1, Math.min(messages.length, ENV.CHAT_PERSIST_CHUNK_SIZE, 120));
    for (let start = 0; start < messages.length; start += chunkSize) {
      const chunk = messages.slice(start, start + chunkSize);
      const placeholders: string[] = [];
      const params: Array<string | number | null> = [];
      for (const msg of chunk) {
        placeholders.push('(?, ?, ?, ?, ?, ?, ?)');
        const tsRaw = msg.timestamp;
        const tsNum = typeof tsRaw === 'bigint' ? Number(tsRaw) : Number(tsRaw);
        const safeTs =
          Number.isFinite(tsNum) ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(tsNum))) : Date.now();
        params.push(
          msg.channel,
          msg.senderUserId ?? null,
          msg.senderUsername,
          msg.recipientUserId ?? null,
          msg.recipientUsername ?? null,
          msg.message,
          safeTs
        );
      }
      await dbHelpers.run(
        `INSERT INTO chat_messages
          (channel, sender_user_id, sender_username, recipient_user_id, recipient_username, message, timestamp)
         VALUES ${placeholders.join(', ')}`,
        params
      );
    }
  }

  async getChannelHistory(channel: string, limit: number): Promise<ChatMessage[]> {
    const rows = await dbHelpers.queryAll<ChatMessageRow>(
      `SELECT id, channel, sender_user_id, sender_username, recipient_user_id, recipient_username, message, timestamp
       FROM chat_messages
       WHERE channel = ?
       ORDER BY timestamp DESC, id DESC
       LIMIT ?`,
      [channel, limit]
    );

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

  async runCleanupKeepLatestPerChannel(
    keepPublicPerChannel = 100,
    keepWhisperPerChannel = 300,
    maxDeletePerRun = 5000
  ): Promise<number> {
    const channels = await dbHelpers.queryAll<{ channel: string }>(
      'SELECT DISTINCT channel FROM chat_messages'
    );
    let totalDeleted = 0;
    for (const row of channels) {
      if (totalDeleted >= maxDeletePerRun) break;
      const channel = String(row.channel || '');
      if (!channel) continue;
      const keep = channel === 'whisper' ? keepWhisperPerChannel : keepPublicPerChannel;
      const remainingBudget = maxDeletePerRun - totalDeleted;
      const result = await dbHelpers.run(
        `DELETE FROM chat_messages
         WHERE id IN (
           SELECT id
           FROM chat_messages
           WHERE channel = ?
           ORDER BY timestamp DESC, id DESC
           LIMIT ? OFFSET ?
         )`,
        [channel, remainingBudget, keep]
      );
      totalDeleted += result.changes;
    }
    return totalDeleted;
  }
}

export default new ChatRepository();
