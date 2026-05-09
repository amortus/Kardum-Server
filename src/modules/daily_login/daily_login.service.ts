import dbHelpers from '../../config/database';
import cardRepository from '../cards/card.repository';

export type DailyReward = { type: 'gold'; amount: number } | { type: 'card_unlock'; cardId: string };
export interface DailyConfigRow {
  id: number;
  month_key: string;
  days_total: number;
  rewards_json: string;
  is_active: number;
}

export interface DailyLoginStatus {
  month: string;
  daysTotal: number;
  rewards: Array<{ day: number; rewards: DailyReward[] }>;
  claimedDays: number[];
  todayDayIndex: number;
}

function monthKeyNowUTC(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function dayIndexNowUTC(): number {
  return new Date().getUTCDate();
}

function parseRewardsJson(raw: any): Array<{ day: number; rewards: DailyReward[] }> {
  if (!raw) return [];
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(arr)) return [];
    const out: Array<{ day: number; rewards: DailyReward[] }> = [];
    for (const row of arr) {
      if (!row || typeof row !== 'object') continue;
      const day = Number((row as any).day);
      const rewardsRaw = Array.isArray((row as any).rewards) ? (row as any).rewards : [];
      const rewards: DailyReward[] = [];
      for (const r of rewardsRaw) {
        if (!r || typeof r !== 'object') continue;
        const t = String((r as any).type || '').trim();
        if (t === 'gold') {
          const amount = Math.max(0, Math.floor(Number((r as any).amount || 0)));
          if (amount > 0) rewards.push({ type: 'gold', amount });
        } else if (t === 'card_unlock') {
          const cardId = String((r as any).cardId || '').trim();
          if (cardId) rewards.push({ type: 'card_unlock', cardId });
        }
      }
      if (Number.isFinite(day) && day > 0 && rewards.length > 0) out.push({ day, rewards });
    }
    return out;
  } catch (_e) {
    return [];
  }
}

export class DailyLoginService {
  async getActiveConfig(monthKey?: string): Promise<DailyConfigRow | null> {
    const month = (monthKey || monthKeyNowUTC()).trim();
    const row = await dbHelpers.query<any>(
      `SELECT * FROM daily_login_calendar_configs WHERE month_key = ? AND is_active = 1`,
      [month]
    );
    return row || null;
  }

  async getStatus(userId: number, monthKey?: string): Promise<DailyLoginStatus> {
    const month = (monthKey || monthKeyNowUTC()).trim();
    const cfg = await this.getActiveConfig(month);
    const daysTotal = cfg ? Number(cfg.days_total || 20) : 20;
    const rewards = cfg ? parseRewardsJson(cfg.rewards_json) : [];

    const claimRows = await dbHelpers.queryAll<{ day_index: number }>(
      `SELECT day_index FROM user_daily_login_claims WHERE user_id = ? AND month_key = ?`,
      [userId, month]
    );
    const claimedDays = claimRows
      .map((r) => Number(r.day_index))
      .filter((n) => Number.isFinite(n) && n >= 1 && n <= daysTotal)
      .sort((a, b) => a - b);

    const today = Math.min(dayIndexNowUTC(), daysTotal);
    return { month, daysTotal, rewards, claimedDays, todayDayIndex: today };
  }

  async claimDay(userId: number, month: string, dayIndex: number): Promise<{ rewards: DailyReward[]; gold: number }> {
    const cfg = await this.getActiveConfig(month);
    if (!cfg) throw new Error('No active calendar for this month');
    const daysTotal = Number(cfg.days_total || 20);
    if (!Number.isFinite(dayIndex) || dayIndex < 1 || dayIndex > daysTotal) throw new Error('Invalid dayIndex');

    // Enforce: can only claim up to today (UTC day-of-month capped at daysTotal)
    const today = Math.min(dayIndexNowUTC(), daysTotal);
    if (dayIndex > today) throw new Error('Day not available yet');

    // Enforce sequential: must claim next unclaimed day
    const claimed = await dbHelpers.queryAll<{ day_index: number }>(
      `SELECT day_index FROM user_daily_login_claims WHERE user_id = ? AND month_key = ?`,
      [userId, month]
    );
    const claimedSet = new Set(claimed.map((r) => Number(r.day_index)));
    let next = 1;
    while (claimedSet.has(next) && next <= daysTotal) next += 1;
    if (dayIndex != next) throw new Error('You must claim the next available day');

    // Idempotency via UNIQUE(user_id, month_key, day_index)
    try {
      await dbHelpers.run(
        `INSERT INTO user_daily_login_claims (user_id, month_key, day_index) VALUES (?, ?, ?)`,
        [userId, month, dayIndex]
      );
    } catch (_e) {
      // already claimed
    }

    const rewardsAll = parseRewardsJson(cfg.rewards_json);
    const dayRewards = rewardsAll.find((r) => r.day === dayIndex)?.rewards || [];

    for (const r of dayRewards) {
      if (r.type === 'gold') {
        await dbHelpers.run(`UPDATE users SET gold = COALESCE(gold, 0) + ? WHERE id = ?`, [r.amount, userId]);
      } else if (r.type === 'card_unlock') {
        await cardRepository.unlockCardForUser(userId, r.cardId, 'daily_login');
      }
    }
    const userRow = await dbHelpers.query<any>(`SELECT gold FROM users WHERE id = ?`, [userId]);
    const gold = userRow && Number.isFinite(Number(userRow.gold)) ? Number(userRow.gold) : 0;
    return { rewards: dayRewards, gold };
  }
}

export default new DailyLoginService();

