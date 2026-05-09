import dbHelpers from '../../config/database';
import type {
  QuestDefinitionRow,
  QuestPrerequisiteRow,
  QuestObjectiveProgressRow,
  QuestObjectiveRow,
  QuestRewardRow,
  UserQuestRow
} from './quest.types';

function safeQuestRewardAmount(raw: unknown): number {
  if (typeof raw === 'bigint') {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.min(50_000, Math.floor(n));
  }
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!/^\d{1,9}$/.test(t)) return 0;
    return Math.min(50_000, parseInt(t, 10));
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(50_000, Math.floor(n));
}

type NpcSpawnRow = {
  id: number;
  spawn_uid: string;
  npc_template_id: number;
  zone: string;
  spawn_x: number;
  spawn_y: number;
  interaction_radius: number;
  is_active: number | boolean;
};

class QuestRepository {
  async listQuestDefinitions(): Promise<QuestDefinitionRow[]> {
    const rows = await dbHelpers.queryAll<any>(
      `SELECT *
       FROM quest_definitions
       WHERE is_active = 1
       ORDER BY id ASC`
    );
    return rows.map((row) => ({
      id: Number(row.id),
      code: String(row.code),
      title: String(row.title || ''),
      description: String(row.description || ''),
      giver_npc_template_id: row.giver_npc_template_id == null ? null : Number(row.giver_npc_template_id),
      turnin_npc_template_id: row.turnin_npc_template_id == null ? null : Number(row.turnin_npc_template_id),
      min_level: Number(row.min_level || 1),
      recurrence_type: String(row.recurrence_type || 'none'),
      auto_track: Number(row.auto_track || 0) === 1 || row.auto_track === true,
      is_active: Number(row.is_active || 0) === 1 || row.is_active === true,
      objective_logic: String(row.objective_logic || 'all') === 'any' ? 'any' : 'all',
      metadata_json: row.metadata_json == null ? null : String(row.metadata_json)
    }));
  }

  async listQuestDefinitionsForAdmin(options?: {
    page?: number;
    limit?: number;
    search?: string;
    giverNpcTemplateId?: number | null;
    includeInactive?: boolean;
  }): Promise<{ items: QuestDefinitionRow[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, Number(options?.page || 1));
    const limit = Math.max(1, Math.min(200, Number(options?.limit || 50)));
    const offset = (page - 1) * limit;
    const clauses: string[] = [];
    const params: any[] = [];
    if (!options?.includeInactive) {
      clauses.push(`is_active = 1`);
    }
    const search = String(options?.search || '').trim();
    if (search !== '') {
      clauses.push(`(LOWER(code) LIKE ? OR LOWER(title) LIKE ? OR LOWER(description) LIKE ?)`);
      const like = `%${search.toLowerCase()}%`;
      params.push(like, like, like);
    }
    if (Number.isFinite(options?.giverNpcTemplateId as number) && Number(options?.giverNpcTemplateId) > 0) {
      clauses.push(`giver_npc_template_id = ?`);
      params.push(Number(options?.giverNpcTemplateId));
    }
    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const totalRow = await dbHelpers.query<{ total: number }>(
      `SELECT COUNT(1) as total FROM quest_definitions ${where}`,
      params
    );
    const rows = await dbHelpers.queryAll<any>(
      `SELECT *
       FROM quest_definitions
       ${where}
       ORDER BY id ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    return {
      items: rows.map((row) => ({
        id: Number(row.id),
        code: String(row.code),
        title: String(row.title || ''),
        description: String(row.description || ''),
        giver_npc_template_id: row.giver_npc_template_id == null ? null : Number(row.giver_npc_template_id),
        turnin_npc_template_id: row.turnin_npc_template_id == null ? null : Number(row.turnin_npc_template_id),
        min_level: Number(row.min_level || 1),
        recurrence_type: String(row.recurrence_type || 'none'),
        auto_track: Number(row.auto_track || 0) === 1 || row.auto_track === true,
        is_active: Number(row.is_active || 0) === 1 || row.is_active === true,
        objective_logic: String(row.objective_logic || 'all') === 'any' ? 'any' : 'all',
        metadata_json: row.metadata_json == null ? null : String(row.metadata_json)
      })),
      total: Number(totalRow?.total || 0),
      page,
      limit
    };
  }

  async listQuestDefinitionsByNpcTemplate(npcTemplateId: number): Promise<QuestDefinitionRow[]> {
    const rows = await dbHelpers.queryAll<any>(
      `SELECT *
       FROM quest_definitions
       WHERE giver_npc_template_id = ? OR turnin_npc_template_id = ?
       ORDER BY id ASC`,
      [npcTemplateId, npcTemplateId]
    );
    return rows.map((row) => ({
      id: Number(row.id),
      code: String(row.code),
      title: String(row.title || ''),
      description: String(row.description || ''),
      giver_npc_template_id: row.giver_npc_template_id == null ? null : Number(row.giver_npc_template_id),
      turnin_npc_template_id: row.turnin_npc_template_id == null ? null : Number(row.turnin_npc_template_id),
      min_level: Number(row.min_level || 1),
      recurrence_type: String(row.recurrence_type || 'none'),
      auto_track: Number(row.auto_track || 0) === 1 || row.auto_track === true,
      is_active: Number(row.is_active || 0) === 1 || row.is_active === true,
      objective_logic: String(row.objective_logic || 'all') === 'any' ? 'any' : 'all',
      metadata_json: row.metadata_json == null ? null : String(row.metadata_json)
    }));
  }

  async getQuestDefinitionById(questId: number): Promise<QuestDefinitionRow | null> {
    const row = await dbHelpers.query<any>(
      `SELECT *
       FROM quest_definitions
       WHERE id = ? AND is_active = 1`,
      [questId]
    );
    if (!row) return null;
    return {
      id: Number(row.id),
      code: String(row.code),
      title: String(row.title || ''),
      description: String(row.description || ''),
      giver_npc_template_id: row.giver_npc_template_id == null ? null : Number(row.giver_npc_template_id),
      turnin_npc_template_id: row.turnin_npc_template_id == null ? null : Number(row.turnin_npc_template_id),
      min_level: Number(row.min_level || 1),
      recurrence_type: String(row.recurrence_type || 'none'),
      auto_track: Number(row.auto_track || 0) === 1 || row.auto_track === true,
      is_active: Number(row.is_active || 0) === 1 || row.is_active === true,
      objective_logic: String(row.objective_logic || 'all') === 'any' ? 'any' : 'all',
      metadata_json: row.metadata_json == null ? null : String(row.metadata_json)
    };
  }

  async getQuestByCode(code: string): Promise<QuestDefinitionRow | null> {
    const row = await dbHelpers.query<any>(
      `SELECT *
       FROM quest_definitions
       WHERE code = ?`,
      [code]
    );
    if (!row) return null;
    return {
      id: Number(row.id),
      code: String(row.code),
      title: String(row.title || ''),
      description: String(row.description || ''),
      giver_npc_template_id: row.giver_npc_template_id == null ? null : Number(row.giver_npc_template_id),
      turnin_npc_template_id: row.turnin_npc_template_id == null ? null : Number(row.turnin_npc_template_id),
      min_level: Number(row.min_level || 1),
      recurrence_type: String(row.recurrence_type || 'none'),
      auto_track: Number(row.auto_track || 0) === 1 || row.auto_track === true,
      is_active: Number(row.is_active || 0) === 1 || row.is_active === true,
      objective_logic: String(row.objective_logic || 'all') === 'any' ? 'any' : 'all',
      metadata_json: row.metadata_json == null ? null : String(row.metadata_json)
    };
  }

  async createQuestDefinition(payload: {
    code: string;
    title: string;
    description: string;
    giver_npc_template_id?: number | null;
    turnin_npc_template_id?: number | null;
    min_level?: number;
    recurrence_type?: string;
    auto_track?: boolean;
    objective_logic?: 'all' | 'any';
    metadata_json?: string | null;
    is_active?: boolean;
  }): Promise<number> {
    const result = await dbHelpers.run(
      `INSERT INTO quest_definitions
      (code, title, description, giver_npc_template_id, turnin_npc_template_id, min_level, recurrence_type, auto_track, objective_logic, metadata_json, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.code,
        payload.title,
        payload.description,
        payload.giver_npc_template_id ?? null,
        payload.turnin_npc_template_id ?? null,
        payload.min_level ?? 1,
        payload.recurrence_type ?? 'none',
        payload.auto_track === false ? 0 : 1,
        payload.objective_logic === 'any' ? 'any' : 'all',
        payload.metadata_json ?? null,
        payload.is_active === false ? 0 : 1
      ]
    );
    return Number(result.lastInsertRowid || 0);
  }

  async updateQuestDefinition(
    questId: number,
    payload: Partial<{
      code: string;
      title: string;
      description: string;
      giver_npc_template_id: number | null;
      turnin_npc_template_id: number | null;
      min_level: number;
      recurrence_type: string;
      auto_track: boolean;
      objective_logic: 'all' | 'any';
      metadata_json: string | null;
      is_active: boolean;
    }>
  ): Promise<void> {
    const current = await this.getQuestDefinitionById(questId);
    if (!current) throw new Error('Quest not found');
    await dbHelpers.run(
      `UPDATE quest_definitions
       SET code = ?, title = ?, description = ?, giver_npc_template_id = ?, turnin_npc_template_id = ?,
           min_level = ?, recurrence_type = ?, auto_track = ?, objective_logic = ?, metadata_json = ?,
           is_active = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        payload.code ?? current.code,
        payload.title ?? current.title,
        payload.description ?? current.description,
        payload.giver_npc_template_id == null ? current.giver_npc_template_id : payload.giver_npc_template_id,
        payload.turnin_npc_template_id == null ? current.turnin_npc_template_id : payload.turnin_npc_template_id,
        payload.min_level ?? current.min_level,
        payload.recurrence_type ?? current.recurrence_type,
        payload.auto_track == null ? (current.auto_track ? 1 : 0) : (payload.auto_track ? 1 : 0),
        payload.objective_logic ?? current.objective_logic,
        payload.metadata_json == null ? current.metadata_json : payload.metadata_json,
        payload.is_active == null ? (current.is_active ? 1 : 0) : (payload.is_active ? 1 : 0),
        questId
      ]
    );
  }

  async replaceQuestObjectives(
    questId: number,
    objectives: Array<{
      objective_type: string;
      target_ref: string;
      required_count: number;
      filters_json?: string | null;
      order_index?: number;
    }>
  ): Promise<void> {
    await dbHelpers.run(`DELETE FROM quest_objectives WHERE quest_id = ?`, [questId]);
    for (let i = 0; i < objectives.length; i += 1) {
      const objective = objectives[i];
      await dbHelpers.run(
        `INSERT INTO quest_objectives (quest_id, objective_type, target_ref, required_count, filters_json, order_index)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          questId,
          objective.objective_type,
          objective.target_ref,
          Math.max(1, Number(objective.required_count || 1)),
          objective.filters_json ?? null,
          Number.isFinite(objective.order_index as number) ? Number(objective.order_index) : i
        ]
      );
    }
  }

  async replaceQuestRewards(
    questId: number,
    rewards: Array<{
      reward_type: string;
      reward_ref?: string | null;
      amount?: number;
      metadata_json?: string | null;
    }>
  ): Promise<void> {
    await dbHelpers.run(`DELETE FROM quest_rewards WHERE quest_id = ?`, [questId]);
    for (const reward of rewards) {
      await dbHelpers.run(
        `INSERT INTO quest_rewards (quest_id, reward_type, reward_ref, amount, metadata_json)
         VALUES (?, ?, ?, ?, ?)`,
        [
          questId,
          reward.reward_type,
          reward.reward_ref ?? null,
          Number(reward.amount || 0),
          reward.metadata_json ?? null
        ]
      );
    }
  }

  async listQuestObjectives(questId: number): Promise<QuestObjectiveRow[]> {
    const rows = await dbHelpers.queryAll<any>(
      `SELECT *
       FROM quest_objectives
       WHERE quest_id = ?
       ORDER BY order_index ASC, id ASC`,
      [questId]
    );
    return rows.map((row) => ({
      id: Number(row.id),
      quest_id: Number(row.quest_id),
      objective_type: row.objective_type,
      target_ref: String(row.target_ref || ''),
      required_count: Math.max(1, Number(row.required_count || 1)),
      filters_json: row.filters_json == null ? null : String(row.filters_json),
      order_index: Number(row.order_index || 0)
    }));
  }

  async listQuestRewards(questId: number): Promise<QuestRewardRow[]> {
    const rows = await dbHelpers.queryAll<any>(
      `SELECT *
       FROM quest_rewards
       WHERE quest_id = ?
       ORDER BY id ASC`,
      [questId]
    );
    return rows.map((row) => ({
      id: Number(row.id),
      quest_id: Number(row.quest_id),
      reward_type: row.reward_type,
      reward_ref: row.reward_ref == null ? null : String(row.reward_ref),
      amount: safeQuestRewardAmount(row.amount),
      metadata_json: row.metadata_json == null ? null : String(row.metadata_json)
    }));
  }

  async listQuestPrerequisites(questId: number): Promise<QuestPrerequisiteRow[]> {
    const rows = await dbHelpers.queryAll<any>(
      `SELECT *
       FROM quest_prerequisites
       WHERE quest_id = ?
       ORDER BY id ASC`,
      [questId]
    );
    return rows.map((row) => ({
      id: Number(row.id),
      quest_id: Number(row.quest_id),
      prerequisite_type: String(row.prerequisite_type || 'QUEST_COMPLETED') as QuestPrerequisiteRow['prerequisite_type'],
      reference_value: String(row.reference_value || ''),
      operator: String(row.operator || 'eq'),
      required_count: Math.max(1, Number(row.required_count || 1))
    }));
  }

  async listQuestPrerequisitesByQuestIds(questIds: number[]): Promise<QuestPrerequisiteRow[]> {
    const ids = Array.from(new Set(questIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)));
    if (ids.length <= 0) return [];
    const placeholders = ids.map(() => '?').join(', ');
    const rows = await dbHelpers.queryAll<any>(
      `SELECT *
       FROM quest_prerequisites
       WHERE quest_id IN (${placeholders})
       ORDER BY quest_id ASC, id ASC`,
      ids
    );
    return rows.map((row) => ({
      id: Number(row.id),
      quest_id: Number(row.quest_id),
      prerequisite_type: String(row.prerequisite_type || 'QUEST_COMPLETED') as QuestPrerequisiteRow['prerequisite_type'],
      reference_value: String(row.reference_value || ''),
      operator: String(row.operator || 'eq'),
      required_count: Math.max(1, Number(row.required_count || 1))
    }));
  }

  async replaceQuestPrerequisites(
    questId: number,
    prerequisites: Array<{
      prerequisite_type: string;
      reference_value: string;
      operator?: string;
      required_count?: number;
    }>
  ): Promise<void> {
    await dbHelpers.run(`DELETE FROM quest_prerequisites WHERE quest_id = ?`, [questId]);
    for (const prerequisite of prerequisites) {
      const prerequisiteType = String(prerequisite.prerequisite_type || '').trim().toUpperCase();
      const referenceValue = String(prerequisite.reference_value || '').trim();
      if (prerequisiteType === '' || referenceValue === '') {
        continue;
      }
      await dbHelpers.run(
        `INSERT INTO quest_prerequisites (quest_id, prerequisite_type, reference_value, operator, required_count)
         VALUES (?, ?, ?, ?, ?)`,
        [
          questId,
          prerequisiteType,
          referenceValue,
          String(prerequisite.operator || 'eq'),
          Math.max(1, Number(prerequisite.required_count || 1))
        ]
      );
    }
  }

  async listUserQuests(userId: number): Promise<UserQuestRow[]> {
    const rows = await dbHelpers.queryAll<any>(
      `SELECT *
       FROM user_quests
       WHERE user_id = ?
       ORDER BY accepted_at DESC, id DESC`,
      [userId]
    );
    return rows.map((row) => ({
      id: Number(row.id),
      user_id: Number(row.user_id),
      quest_id: Number(row.quest_id),
      state: String(row.state || 'accepted') as UserQuestRow['state'],
      accepted_at: row.accepted_at == null ? null : String(row.accepted_at),
      completed_at: row.completed_at == null ? null : String(row.completed_at),
      abandoned_at: row.abandoned_at == null ? null : String(row.abandoned_at),
      expires_at: row.expires_at == null ? null : String(row.expires_at),
      last_updated_at: row.last_updated_at == null ? null : String(row.last_updated_at)
    }));
  }

  async getUserQuestByUserAndQuest(userId: number, questId: number): Promise<UserQuestRow | null> {
    const row = await dbHelpers.query<any>(
      `SELECT *
       FROM user_quests
       WHERE user_id = ? AND quest_id = ?`,
      [userId, questId]
    );
    if (!row) return null;
    return {
      id: Number(row.id),
      user_id: Number(row.user_id),
      quest_id: Number(row.quest_id),
      state: String(row.state || 'accepted') as UserQuestRow['state'],
      accepted_at: row.accepted_at == null ? null : String(row.accepted_at),
      completed_at: row.completed_at == null ? null : String(row.completed_at),
      abandoned_at: row.abandoned_at == null ? null : String(row.abandoned_at),
      expires_at: row.expires_at == null ? null : String(row.expires_at),
      last_updated_at: row.last_updated_at == null ? null : String(row.last_updated_at)
    };
  }

  async createUserQuest(userId: number, questId: number, initialState: string = 'accepted'): Promise<number> {
    const result = await dbHelpers.run(
      `INSERT INTO user_quests (user_id, quest_id, state, accepted_at, last_updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [userId, questId, initialState]
    );
    return Number(result.lastInsertRowid || 0);
  }

  async updateUserQuestState(userQuestId: number, state: string): Promise<void> {
    const completedAt = state === 'completed' ? 'CURRENT_TIMESTAMP' : null;
    const abandonedAt = state === 'abandoned' ? 'CURRENT_TIMESTAMP' : null;
    if (completedAt) {
      await dbHelpers.run(
        `UPDATE user_quests
         SET state = ?, completed_at = CURRENT_TIMESTAMP, last_updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [state, userQuestId]
      );
      return;
    }
    if (abandonedAt) {
      await dbHelpers.run(
        `UPDATE user_quests
         SET state = ?, abandoned_at = CURRENT_TIMESTAMP, last_updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [state, userQuestId]
      );
      return;
    }
    await dbHelpers.run(
      `UPDATE user_quests
       SET state = ?, last_updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [state, userQuestId]
    );
  }

  async listObjectiveProgressByUserQuest(userQuestId: number): Promise<QuestObjectiveProgressRow[]> {
    const rows = await dbHelpers.queryAll<any>(
      `SELECT *
       FROM user_quest_objective_progress
       WHERE user_quest_id = ?`,
      [userQuestId]
    );
    return rows.map((row) => ({
      id: Number(row.id),
      user_quest_id: Number(row.user_quest_id),
      objective_id: Number(row.objective_id),
      current_count: Number(row.current_count || 0),
      completed_at: row.completed_at == null ? null : String(row.completed_at),
      last_event_key: row.last_event_key == null ? null : String(row.last_event_key)
    }));
  }

  async upsertObjectiveProgress(
    userQuestId: number,
    objectiveId: number,
    currentCount: number,
    completed: boolean,
    lastEventKey: string
  ): Promise<void> {
    const existing = await dbHelpers.query<{ id: number }>(
      `SELECT id
       FROM user_quest_objective_progress
       WHERE user_quest_id = ? AND objective_id = ?`,
      [userQuestId, objectiveId]
    );
    if (existing) {
      await dbHelpers.run(
        `UPDATE user_quest_objective_progress
         SET current_count = ?, completed_at = ?, last_event_key = ?
         WHERE id = ?`,
        [currentCount, completed ? new Date().toISOString() : null, lastEventKey, existing.id]
      );
      return;
    }
    await dbHelpers.run(
      `INSERT INTO user_quest_objective_progress
      (user_quest_id, objective_id, current_count, completed_at, last_event_key)
       VALUES (?, ?, ?, ?, ?)`,
      [userQuestId, objectiveId, currentCount, completed ? new Date().toISOString() : null, lastEventKey]
    );
  }

  async listTrackedQuestIds(userId: number): Promise<number[]> {
    const rows = await dbHelpers.queryAll<{ quest_id: number }>(
      `SELECT quest_id
       FROM user_tracked_quests
       WHERE user_id = ?
       ORDER BY pin_order ASC, id ASC`,
      [userId]
    );
    return rows.map((row) => Number(row.quest_id));
  }

  async trackQuest(userId: number, questId: number): Promise<void> {
    const existing = await dbHelpers.query<{ id: number }>(
      `SELECT id
       FROM user_tracked_quests
       WHERE user_id = ? AND quest_id = ?`,
      [userId, questId]
    );
    if (existing) return;
    const maxRow = await dbHelpers.query<{ max_pin: number }>(
      `SELECT MAX(pin_order) as max_pin
       FROM user_tracked_quests
       WHERE user_id = ?`,
      [userId]
    );
    const nextPin = Number(maxRow?.max_pin || 0) + 1;
    await dbHelpers.run(
      `INSERT INTO user_tracked_quests (user_id, quest_id, pin_order)
       VALUES (?, ?, ?)`,
      [userId, questId, nextPin]
    );
  }

  async untrackQuest(userId: number, questId: number): Promise<void> {
    await dbHelpers.run(
      `DELETE FROM user_tracked_quests
       WHERE user_id = ? AND quest_id = ?`,
      [userId, questId]
    );
  }

  async clearTrackingForQuest(userId: number, questId: number): Promise<void> {
    await this.untrackQuest(userId, questId);
  }

  /** Remove progresso de objetivos e histórico de eventos (abandonar / reaceitar). */
  async clearUserQuestProgressAndLedger(userQuestId: number, userId: number, questId: number): Promise<void> {
    await dbHelpers.run(`DELETE FROM user_quest_objective_progress WHERE user_quest_id = ?`, [userQuestId]);
    await dbHelpers.run(`DELETE FROM quest_event_ledger WHERE user_id = ? AND quest_id = ?`, [userId, questId]);
  }

  /** Volta a `accepted` limpando datas de abandono/conclusão (reabrir quest). */
  async resetUserQuestRowToFreshAccepted(userQuestId: number): Promise<void> {
    await dbHelpers.run(
      `UPDATE user_quests
       SET state = 'accepted',
           abandoned_at = NULL,
           completed_at = NULL,
           last_updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [userQuestId]
    );
  }

  async markEventIfNew(userId: number, questId: number, eventKey: string, eventType: string): Promise<boolean> {
    const existing = await dbHelpers.query<{ id: number }>(
      `SELECT id
       FROM quest_event_ledger
       WHERE user_id = ? AND quest_id = ? AND event_key = ?`,
      [userId, questId, eventKey]
    );
    if (existing) return false;
    await dbHelpers.run(
      `INSERT INTO quest_event_ledger (user_id, quest_id, event_key, event_type)
       VALUES (?, ?, ?, ?)`,
      [userId, questId, eventKey, eventType]
    );
    return true;
  }

  async listNpcSpawns(zone: string): Promise<NpcSpawnRow[]> {
    return dbHelpers.queryAll<NpcSpawnRow>(
      `SELECT *
       FROM npc_spawns
       WHERE zone = ? AND is_active = 1
       ORDER BY id ASC`,
      [zone]
    );
  }

  async getMonsterTemplateNameById(templateId: number): Promise<string> {
    const row = await dbHelpers.query<{ name: string }>(
      `SELECT name
       FROM monster_templates
       WHERE id = ?`,
      [templateId]
    );
    return String(row?.name || '').trim();
  }

  async getMonsterTemplateIdentityById(
    templateId: number
  ): Promise<{ id: number; code: string; name: string } | null> {
    // Schema atual de monster_templates não tem coluna `code` (evita SQL error que impedia progresso de quest).
    const row = await dbHelpers.query<{ id: number; name: string }>(
      `SELECT id, name
       FROM monster_templates
       WHERE id = ?
       LIMIT 1`,
      [templateId]
    );
    if (!row) return null;
    return {
      id: Number(row.id),
      code: '',
      name: String(row.name || '').trim()
    };
  }
}

export default new QuestRepository();
