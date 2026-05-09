import dbHelpers from '../../config/database';
import mailAdminService, { normalizeAudience, type CampaignRow, type MailAudience } from './mail.admin';

function parseJsonSafe(raw: any): any {
  if (raw == null) return null;
  if (typeof raw === 'object') return raw;
  const s = String(raw || '').trim();
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch (_e) {
    return null;
  }
}

async function resolveAudience(audience: MailAudience): Promise<number[]> {
  if (!audience) return [];
  if (audience.type === 'all_users') {
    const rows = await dbHelpers.queryAll<{ id: number }>('SELECT id FROM users', []);
    return rows.map((r) => Number(r.id)).filter((n) => Number.isFinite(n) && n > 0);
  }
  if (audience.type === 'user_ids') {
    return (audience.userIds || []).map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0);
  }
  if (audience.type === 'created_between') {
    const rows = await dbHelpers.queryAll<{ id: number }>(
      `SELECT id FROM users WHERE created_at >= ? AND created_at <= ?`,
      [audience.from, audience.to]
    );
    return rows.map((r) => Number(r.id)).filter((n) => Number.isFinite(n) && n > 0);
  }
  if (audience.type === 'logged_in_between') {
    const rows = await dbHelpers.queryAll<{ id: number }>(
      `SELECT id FROM users WHERE last_login IS NOT NULL AND last_login >= ? AND last_login <= ?`,
      [audience.from, audience.to]
    );
    return rows.map((r) => Number(r.id)).filter((n) => Number.isFinite(n) && n > 0);
  }
  if (audience.type === 'login_on_day') {
    // Cross-db safe: compare string prefix for ISO YYYY-MM-DD in SQLite, and cast in PG.
    // We'll do a simple range: [day 00:00, day 23:59:59]
    const day = String(audience.day || '').trim();
    if (!day) return [];
    const from = `${day}T00:00:00.000Z`;
    const to = `${day}T23:59:59.999Z`;
    const rows = await dbHelpers.queryAll<{ id: number }>(
      `SELECT id FROM users WHERE last_login IS NOT NULL AND last_login >= ? AND last_login <= ?`,
      [from, to]
    );
    return rows.map((r) => Number(r.id)).filter((n) => Number.isFinite(n) && n > 0);
  }
  return [];
}

async function deliverCampaignRow(campaign: CampaignRow): Promise<void> {
  const audienceObj = normalizeAudience(parseJsonSafe((campaign as any).audience_json));
  const attachments = parseJsonSafe((campaign as any).attachments_json) || [];
  const userIds = await resolveAudience(audienceObj);
  if (userIds.length === 0) {
    await dbHelpers.run(`UPDATE mail_campaigns SET status='sent', sent_at=CURRENT_TIMESTAMP WHERE id = ?`, [campaign.id]);
    return;
  }
  for (const userId of userIds) {
    const msg = await mailAdminService.sendUserMail({
      userId,
      adminId: null,
      subject: String(campaign.subject || ''),
      body: String(campaign.body || ''),
      deliverAt: new Date().toISOString(),
      attachments
    });
    // Link message to campaign (best-effort).
    try {
      await dbHelpers.run(`UPDATE mail_messages SET campaign_id = ? WHERE id = ?`, [campaign.id, msg.id]);
    } catch (_e) {}
  }
  await dbHelpers.run(`UPDATE mail_campaigns SET status='sent', sent_at=CURRENT_TIMESTAMP WHERE id = ?`, [campaign.id]);
}

export class MailScheduler {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  start(intervalMs: number = 5000) {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick().catch(() => {}), intervalMs);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const due = await dbHelpers.queryAll<CampaignRow>(
        `SELECT * FROM mail_campaigns WHERE status = 'scheduled' AND deliver_at <= CURRENT_TIMESTAMP ORDER BY id ASC LIMIT 10`,
        []
      );
      for (const c of due) {
        await deliverCampaignRow(c);
      }
    } finally {
      this.running = false;
    }
  }
}

export default new MailScheduler();

