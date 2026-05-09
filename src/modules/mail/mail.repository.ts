import dbHelpers from '../../config/database';
import type { MailAttachment, MailAttachmentType, MailMessageRow, MailStatus } from './mail.types';

export interface MailInboxItem {
  id: number;
  subject: string;
  body: string;
  status: MailStatus;
  deliver_at: string | Date;
  delivered_at: string | Date | null;
  read_at: string | Date | null;
  created_at: string | Date;
  attachments: MailAttachment[];
}

export class MailRepository {
  async listInbox(userId: number, limit: number = 50, cursorId?: number): Promise<MailInboxItem[]> {
    const params: any[] = [userId];
    let where = 'user_id = ? AND deliver_at <= CURRENT_TIMESTAMP';
    if (cursorId && Number.isFinite(cursorId) && cursorId > 0) {
      where += ' AND id < ?';
      params.push(cursorId);
    }
    params.push(limit);
    const rows = await dbHelpers.queryAll<MailMessageRow & { delivered_at: any; read_at: any }>(
      `SELECT *
       FROM mail_messages
       WHERE ${where}
       ORDER BY id DESC
       LIMIT ?`,
      params
    );
    if (!rows || rows.length === 0) return [];

    const ids = rows.map((r) => Number(r.id)).filter((n) => Number.isFinite(n));
    const placeholders = ids.map(() => '?').join(',');
    const attRows = await dbHelpers.queryAll<{ mail_id: number; type: MailAttachmentType; payload_json: string }>(
      `SELECT mail_id, type, payload_json
       FROM mail_attachments
       WHERE mail_id IN (${placeholders})`,
      ids
    );
    const byMail = new Map<number, MailAttachment[]>();
    for (const a of attRows) {
      const mid = Number(a.mail_id);
      if (!byMail.has(mid)) byMail.set(mid, []);
      try {
        const payload = JSON.parse(String(a.payload_json || '{}'));
        if (a.type === 'card_unlock') {
          const cardId = String(payload.cardId || payload.card_id || '').trim();
          if (cardId) byMail.get(mid)!.push({ type: 'card_unlock', cardId });
        }
      } catch (_e) {
        // ignore malformed attachment
      }
    }

    return rows.map((r) => ({
      id: Number(r.id),
      subject: String(r.subject || ''),
      body: String(r.body || ''),
      status: (String(r.status || 'unread') as MailStatus),
      deliver_at: r.deliver_at,
      delivered_at: r.delivered_at,
      read_at: r.read_at,
      created_at: r.created_at,
      attachments: byMail.get(Number(r.id)) || []
    }));
  }

  async markRead(userId: number, mailId: number): Promise<void> {
    await dbHelpers.run(
      `UPDATE mail_messages
       SET status = CASE WHEN status = 'unread' THEN 'read' ELSE status END,
           read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
       WHERE id = ? AND user_id = ?`,
      [mailId, userId]
    );
  }

  async getMessageForClaim(userId: number, mailId: number): Promise<(MailMessageRow & { attachments: MailAttachment[] }) | null> {
    const row = await dbHelpers.query<MailMessageRow>(
      `SELECT *
       FROM mail_messages
       WHERE id = ? AND user_id = ?`,
      [mailId, userId]
    );
    if (!row) return null;
    const attRows = await dbHelpers.queryAll<{ type: MailAttachmentType; payload_json: string }>(
      `SELECT type, payload_json FROM mail_attachments WHERE mail_id = ?`,
      [mailId]
    );
    const attachments: MailAttachment[] = [];
    for (const a of attRows) {
      try {
        const payload = JSON.parse(String(a.payload_json || '{}'));
        if (a.type === 'card_unlock') {
          const cardId = String(payload.cardId || payload.card_id || '').trim();
          if (cardId) attachments.push({ type: 'card_unlock', cardId });
        }
      } catch (_e) {}
    }
    return { ...(row as any), attachments };
  }

  async hasClaim(mailId: number): Promise<boolean> {
    const row = await dbHelpers.query<{ id: number }>(
      `SELECT id FROM mail_claims WHERE mail_id = ?`,
      [mailId]
    );
    return Boolean(row);
  }

  async createClaim(userId: number, mailId: number): Promise<void> {
    await dbHelpers.run(
      `INSERT INTO mail_claims (mail_id, user_id) VALUES (?, ?)`,
      [mailId, userId]
    );
  }

  async markClaimed(userId: number, mailId: number): Promise<void> {
    await dbHelpers.run(
      `UPDATE mail_messages
       SET status = 'claimed'
       WHERE id = ? AND user_id = ?`,
      [mailId, userId]
    );
  }
}

export default new MailRepository();

