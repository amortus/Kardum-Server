import dbHelpers from '../../config/database';
import type { MailAttachment } from './mail.types';

export type MailAudience =
  | { type: 'all_users' }
  | { type: 'user_ids'; userIds: number[] }
  | { type: 'created_between'; from: string; to: string }
  | { type: 'logged_in_between'; from: string; to: string }
  | { type: 'login_on_day'; day: string };

export interface CreateCampaignInput {
  name: string;
  subject: string;
  body: string;
  deliverAt: string; // ISO
  audience: MailAudience;
  attachments: MailAttachment[];
  adminId: number;
}

export interface CampaignRow {
  id: number;
  name: string;
  subject: string;
  body: string;
  deliver_at: any;
  audience_json: string;
  attachments_json: string;
  status: string;
  created_by_admin_id: number;
  created_at: any;
  sent_at: any;
}

function normalizeAttachments(raw: any): MailAttachment[] {
  const arr: any[] = Array.isArray(raw) ? raw : [];
  const out: MailAttachment[] = [];
  for (const a of arr) {
    if (!a) continue;
    if (a.type === 'card_unlock') {
      const cardId = String(a.cardId || '').trim();
      if (cardId) out.push({ type: 'card_unlock', cardId });
    }
  }
  return out;
}

export function normalizeAudience(raw: any): MailAudience {
  if (!raw || typeof raw !== 'object') return { type: 'all_users' };
  const t = String(raw.type || '').trim();
  if (t === 'user_ids') {
    const userIds = Array.isArray(raw.userIds) ? raw.userIds.map((n: any) => Number(n)).filter((n: any) => Number.isFinite(n) && n > 0) : [];
    return { type: 'user_ids', userIds };
  }
  if (t === 'created_between' || t === 'logged_in_between') {
    return { type: t as any, from: String(raw.from || ''), to: String(raw.to || '') };
  }
  if (t === 'login_on_day') {
    return { type: 'login_on_day', day: String(raw.day || '') };
  }
  return { type: 'all_users' };
}

export class MailAdminService {
  async createCampaign(input: CreateCampaignInput): Promise<{ id: number }> {
    const attachments = normalizeAttachments(input.attachments);
    const audience = normalizeAudience(input.audience);
    const result = await dbHelpers.run(
      `INSERT INTO mail_campaigns (name, subject, body, deliver_at, audience_json, attachments_json, status, created_by_admin_id)
       VALUES (?, ?, ?, ?, ?, ?, 'scheduled', ?)`,
      [
        input.name,
        input.subject,
        input.body,
        input.deliverAt,
        JSON.stringify(audience),
        JSON.stringify(attachments),
        input.adminId
      ]
    );
    const id = Number((result as any)?.lastID || (result as any)?.insertId || 0);
    return { id };
  }

  async listCampaigns(limit: number = 100): Promise<CampaignRow[]> {
    return await dbHelpers.queryAll<any>(
      `SELECT * FROM mail_campaigns ORDER BY id DESC LIMIT ?`,
      [limit]
    );
  }

  async cancelCampaign(id: number): Promise<void> {
    await dbHelpers.run(
      `UPDATE mail_campaigns SET status='cancelled' WHERE id = ? AND status IN ('draft','scheduled')`,
      [id]
    );
  }

  async sendUserMail(params: {
    userId: number;
    adminId: number | null;
    subject: string;
    body: string;
    deliverAt: string;
    attachments: MailAttachment[];
  }): Promise<{ id: number }> {
    const attachments = normalizeAttachments(params.attachments);
    const result = await dbHelpers.run(
      `INSERT INTO mail_messages (user_id, sender_admin_id, subject, body, status, deliver_at, delivered_at)
       VALUES (?, ?, ?, ?, 'unread', ?, CURRENT_TIMESTAMP)`,
      [params.userId, params.adminId, params.subject, params.body, params.deliverAt]
    );
    const mailId = Number((result as any)?.lastID || (result as any)?.insertId || 0);
    for (const a of attachments) {
      await dbHelpers.run(
        `INSERT INTO mail_attachments (mail_id, type, payload_json) VALUES (?, ?, ?)`,
        [mailId, a.type, JSON.stringify(a)]
      );
    }
    return { id: mailId };
  }
}

export default new MailAdminService();

