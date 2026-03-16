"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = __importDefault(require("../../config/database"));
class QuestRepository {
    async listQuestDefinitions() {
        const rows = await database_1.default.queryAll(`SELECT *
       FROM quest_definitions
       WHERE is_active = 1
       ORDER BY id ASC`);
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
    async getQuestDefinitionById(questId) {
        const row = await database_1.default.query(`SELECT *
       FROM quest_definitions
       WHERE id = ? AND is_active = 1`, [questId]);
        if (!row)
            return null;
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
    async getQuestByCode(code) {
        const row = await database_1.default.query(`SELECT *
       FROM quest_definitions
       WHERE code = ?`, [code]);
        if (!row)
            return null;
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
    async createQuestDefinition(payload) {
        const result = await database_1.default.run(`INSERT INTO quest_definitions
      (code, title, description, giver_npc_template_id, turnin_npc_template_id, min_level, recurrence_type, auto_track, objective_logic, metadata_json, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
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
        ]);
        return Number(result.lastInsertRowid || 0);
    }
    async updateQuestDefinition(questId, payload) {
        const current = await this.getQuestDefinitionById(questId);
        if (!current)
            throw new Error('Quest not found');
        await database_1.default.run(`UPDATE quest_definitions
       SET code = ?, title = ?, description = ?, giver_npc_template_id = ?, turnin_npc_template_id = ?,
           min_level = ?, recurrence_type = ?, auto_track = ?, objective_logic = ?, metadata_json = ?,
           is_active = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`, [
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
        ]);
    }
    async replaceQuestObjectives(questId, objectives) {
        await database_1.default.run(`DELETE FROM quest_objectives WHERE quest_id = ?`, [questId]);
        for (let i = 0; i < objectives.length; i += 1) {
            const objective = objectives[i];
            await database_1.default.run(`INSERT INTO quest_objectives (quest_id, objective_type, target_ref, required_count, filters_json, order_index)
         VALUES (?, ?, ?, ?, ?, ?)`, [
                questId,
                objective.objective_type,
                objective.target_ref,
                Math.max(1, Number(objective.required_count || 1)),
                objective.filters_json ?? null,
                Number.isFinite(objective.order_index) ? Number(objective.order_index) : i
            ]);
        }
    }
    async replaceQuestRewards(questId, rewards) {
        await database_1.default.run(`DELETE FROM quest_rewards WHERE quest_id = ?`, [questId]);
        for (const reward of rewards) {
            await database_1.default.run(`INSERT INTO quest_rewards (quest_id, reward_type, reward_ref, amount, metadata_json)
         VALUES (?, ?, ?, ?, ?)`, [
                questId,
                reward.reward_type,
                reward.reward_ref ?? null,
                Number(reward.amount || 0),
                reward.metadata_json ?? null
            ]);
        }
    }
    async listQuestObjectives(questId) {
        const rows = await database_1.default.queryAll(`SELECT *
       FROM quest_objectives
       WHERE quest_id = ?
       ORDER BY order_index ASC, id ASC`, [questId]);
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
    async listQuestRewards(questId) {
        const rows = await database_1.default.queryAll(`SELECT *
       FROM quest_rewards
       WHERE quest_id = ?
       ORDER BY id ASC`, [questId]);
        return rows.map((row) => ({
            id: Number(row.id),
            quest_id: Number(row.quest_id),
            reward_type: row.reward_type,
            reward_ref: row.reward_ref == null ? null : String(row.reward_ref),
            amount: Number(row.amount || 0),
            metadata_json: row.metadata_json == null ? null : String(row.metadata_json)
        }));
    }
    async listUserQuests(userId) {
        const rows = await database_1.default.queryAll(`SELECT *
       FROM user_quests
       WHERE user_id = ?
       ORDER BY accepted_at DESC, id DESC`, [userId]);
        return rows.map((row) => ({
            id: Number(row.id),
            user_id: Number(row.user_id),
            quest_id: Number(row.quest_id),
            state: String(row.state || 'accepted'),
            accepted_at: row.accepted_at == null ? null : String(row.accepted_at),
            completed_at: row.completed_at == null ? null : String(row.completed_at),
            abandoned_at: row.abandoned_at == null ? null : String(row.abandoned_at),
            expires_at: row.expires_at == null ? null : String(row.expires_at),
            last_updated_at: row.last_updated_at == null ? null : String(row.last_updated_at)
        }));
    }
    async getUserQuestByUserAndQuest(userId, questId) {
        const row = await database_1.default.query(`SELECT *
       FROM user_quests
       WHERE user_id = ? AND quest_id = ?`, [userId, questId]);
        if (!row)
            return null;
        return {
            id: Number(row.id),
            user_id: Number(row.user_id),
            quest_id: Number(row.quest_id),
            state: String(row.state || 'accepted'),
            accepted_at: row.accepted_at == null ? null : String(row.accepted_at),
            completed_at: row.completed_at == null ? null : String(row.completed_at),
            abandoned_at: row.abandoned_at == null ? null : String(row.abandoned_at),
            expires_at: row.expires_at == null ? null : String(row.expires_at),
            last_updated_at: row.last_updated_at == null ? null : String(row.last_updated_at)
        };
    }
    async createUserQuest(userId, questId, initialState = 'accepted') {
        const result = await database_1.default.run(`INSERT INTO user_quests (user_id, quest_id, state, accepted_at, last_updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`, [userId, questId, initialState]);
        return Number(result.lastInsertRowid || 0);
    }
    async updateUserQuestState(userQuestId, state) {
        const completedAt = state === 'completed' ? 'CURRENT_TIMESTAMP' : null;
        const abandonedAt = state === 'abandoned' ? 'CURRENT_TIMESTAMP' : null;
        if (completedAt) {
            await database_1.default.run(`UPDATE user_quests
         SET state = ?, completed_at = CURRENT_TIMESTAMP, last_updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`, [state, userQuestId]);
            return;
        }
        if (abandonedAt) {
            await database_1.default.run(`UPDATE user_quests
         SET state = ?, abandoned_at = CURRENT_TIMESTAMP, last_updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`, [state, userQuestId]);
            return;
        }
        await database_1.default.run(`UPDATE user_quests
       SET state = ?, last_updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`, [state, userQuestId]);
    }
    async listObjectiveProgressByUserQuest(userQuestId) {
        const rows = await database_1.default.queryAll(`SELECT *
       FROM user_quest_objective_progress
       WHERE user_quest_id = ?`, [userQuestId]);
        return rows.map((row) => ({
            id: Number(row.id),
            user_quest_id: Number(row.user_quest_id),
            objective_id: Number(row.objective_id),
            current_count: Number(row.current_count || 0),
            completed_at: row.completed_at == null ? null : String(row.completed_at),
            last_event_key: row.last_event_key == null ? null : String(row.last_event_key)
        }));
    }
    async upsertObjectiveProgress(userQuestId, objectiveId, currentCount, completed, lastEventKey) {
        const existing = await database_1.default.query(`SELECT id
       FROM user_quest_objective_progress
       WHERE user_quest_id = ? AND objective_id = ?`, [userQuestId, objectiveId]);
        if (existing) {
            await database_1.default.run(`UPDATE user_quest_objective_progress
         SET current_count = ?, completed_at = ?, last_event_key = ?
         WHERE id = ?`, [currentCount, completed ? new Date().toISOString() : null, lastEventKey, existing.id]);
            return;
        }
        await database_1.default.run(`INSERT INTO user_quest_objective_progress
      (user_quest_id, objective_id, current_count, completed_at, last_event_key)
       VALUES (?, ?, ?, ?, ?)`, [userQuestId, objectiveId, currentCount, completed ? new Date().toISOString() : null, lastEventKey]);
    }
    async listTrackedQuestIds(userId) {
        const rows = await database_1.default.queryAll(`SELECT quest_id
       FROM user_tracked_quests
       WHERE user_id = ?
       ORDER BY pin_order ASC, id ASC`, [userId]);
        return rows.map((row) => Number(row.quest_id));
    }
    async trackQuest(userId, questId) {
        const existing = await database_1.default.query(`SELECT id
       FROM user_tracked_quests
       WHERE user_id = ? AND quest_id = ?`, [userId, questId]);
        if (existing)
            return;
        const maxRow = await database_1.default.query(`SELECT MAX(pin_order) as max_pin
       FROM user_tracked_quests
       WHERE user_id = ?`, [userId]);
        const nextPin = Number(maxRow?.max_pin || 0) + 1;
        await database_1.default.run(`INSERT INTO user_tracked_quests (user_id, quest_id, pin_order)
       VALUES (?, ?, ?)`, [userId, questId, nextPin]);
    }
    async untrackQuest(userId, questId) {
        await database_1.default.run(`DELETE FROM user_tracked_quests
       WHERE user_id = ? AND quest_id = ?`, [userId, questId]);
    }
    async clearTrackingForQuest(userId, questId) {
        await this.untrackQuest(userId, questId);
    }
    async markEventIfNew(userId, questId, eventKey, eventType) {
        const existing = await database_1.default.query(`SELECT id
       FROM quest_event_ledger
       WHERE user_id = ? AND quest_id = ? AND event_key = ?`, [userId, questId, eventKey]);
        if (existing)
            return false;
        await database_1.default.run(`INSERT INTO quest_event_ledger (user_id, quest_id, event_key, event_type)
       VALUES (?, ?, ?, ?)`, [userId, questId, eventKey, eventType]);
        return true;
    }
    async listNpcSpawns(zone) {
        return database_1.default.queryAll(`SELECT *
       FROM npc_spawns
       WHERE zone = ? AND is_active = 1
       ORDER BY id ASC`, [zone]);
    }
    async getMonsterTemplateNameById(templateId) {
        const row = await database_1.default.query(`SELECT name
       FROM monster_templates
       WHERE id = ?`, [templateId]);
        return String(row?.name || '').trim();
    }
}
exports.default = new QuestRepository();
//# sourceMappingURL=quest.repository.js.map