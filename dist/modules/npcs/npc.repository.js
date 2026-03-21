"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = __importDefault(require("crypto"));
const database_1 = __importDefault(require("../../config/database"));
class NpcRepository {
    async listTemplates() {
        const rows = await database_1.default.queryAll(`SELECT *
       FROM npc_templates
       WHERE is_active = 1
       ORDER BY id ASC`);
        return rows.map((row) => ({
            id: Number(row.id),
            code: String(row.code),
            name: String(row.name),
            sprite_ref: row.sprite_ref == null ? null : String(row.sprite_ref),
            frame_count: Number(row.frame_count || 6),
            frame_cols: Number(row.frame_cols || 6),
            frame_rows: Number(row.frame_rows || 1),
            idle_start: Number(row.idle_start || 0),
            idle_count: Number(row.idle_count || 6),
            dialogue_json: row.dialogue_json == null ? null : String(row.dialogue_json),
            is_active: Number(row.is_active || 0) === 1 || row.is_active === true
        }));
    }
    async getTemplateByCode(code) {
        const row = await database_1.default.query(`SELECT *
       FROM npc_templates
       WHERE code = ?`, [code]);
        if (!row)
            return null;
        return {
            id: Number(row.id),
            code: String(row.code),
            name: String(row.name),
            sprite_ref: row.sprite_ref == null ? null : String(row.sprite_ref),
            frame_count: Number(row.frame_count || 6),
            frame_cols: Number(row.frame_cols || 6),
            frame_rows: Number(row.frame_rows || 1),
            idle_start: Number(row.idle_start || 0),
            idle_count: Number(row.idle_count || 6),
            dialogue_json: row.dialogue_json == null ? null : String(row.dialogue_json),
            is_active: Number(row.is_active || 0) === 1 || row.is_active === true
        };
    }
    async getTemplateByNameOrCode(nameOrCode) {
        const normalized = String(nameOrCode || '').trim().toLowerCase();
        if (!normalized)
            return null;
        const row = await database_1.default.query(`SELECT *
       FROM npc_templates
       WHERE LOWER(code) = ? OR LOWER(name) = ?
       ORDER BY CASE WHEN LOWER(code) = ? THEN 0 ELSE 1 END, id ASC
       LIMIT 1`, [normalized, normalized, normalized]);
        if (!row)
            return null;
        return {
            id: Number(row.id),
            code: String(row.code),
            name: String(row.name),
            sprite_ref: row.sprite_ref == null ? null : String(row.sprite_ref),
            frame_count: Number(row.frame_count || 6),
            frame_cols: Number(row.frame_cols || 6),
            frame_rows: Number(row.frame_rows || 1),
            idle_start: Number(row.idle_start || 0),
            idle_count: Number(row.idle_count || 6),
            dialogue_json: row.dialogue_json == null ? null : String(row.dialogue_json),
            is_active: Number(row.is_active || 0) === 1 || row.is_active === true
        };
    }
    async createTemplate(payload) {
        const result = await database_1.default.run(`INSERT INTO npc_templates
      (code, name, sprite_ref, frame_count, frame_cols, frame_rows, idle_start, idle_count, dialogue_json, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`, [
            payload.code,
            payload.name,
            payload.sprite_ref,
            payload.frame_count ?? 6,
            payload.frame_cols ?? 6,
            payload.frame_rows ?? 1,
            payload.idle_start ?? 0,
            payload.idle_count ?? 6,
            payload.dialogue_json ?? null
        ]);
        return Number(result.lastInsertRowid || 0);
    }
    async updateTemplate(templateId, payload) {
        const current = await database_1.default.query(`SELECT * FROM npc_templates WHERE id = ?`, [templateId]);
        if (!current)
            throw new Error('NPC template not found');
        await database_1.default.run(`UPDATE npc_templates
       SET code = ?, name = ?, sprite_ref = ?, frame_count = ?, frame_cols = ?, frame_rows = ?,
           idle_start = ?, idle_count = ?, dialogue_json = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`, [
            payload.code ?? current.code,
            payload.name ?? current.name,
            payload.sprite_ref ?? current.sprite_ref,
            payload.frame_count ?? current.frame_count,
            payload.frame_cols ?? current.frame_cols,
            payload.frame_rows ?? current.frame_rows,
            payload.idle_start ?? current.idle_start,
            payload.idle_count ?? current.idle_count,
            payload.dialogue_json == null ? current.dialogue_json : payload.dialogue_json,
            payload.is_active == null ? current.is_active : (payload.is_active ? 1 : 0),
            templateId
        ]);
    }
    async listSpawns(zone) {
        const rows = await database_1.default.queryAll(`SELECT *
       FROM npc_spawns
       WHERE zone = ? AND is_active = 1
       ORDER BY id ASC`, [zone]);
        return rows.map((row) => ({
            id: Number(row.id),
            spawn_uid: String(row.spawn_uid),
            npc_template_id: Number(row.npc_template_id),
            zone: String(row.zone),
            spawn_x: Number(row.spawn_x || 0),
            spawn_y: Number(row.spawn_y || 0),
            interaction_radius: Number(row.interaction_radius || 80),
            is_active: Number(row.is_active || 0) === 1 || row.is_active === true
        }));
    }
    async createSpawn(payload) {
        const spawnUid = `npc_${crypto_1.default.randomUUID().replace(/-/g, '').slice(0, 16)}`;
        await database_1.default.run(`INSERT INTO npc_spawns
      (spawn_uid, npc_template_id, zone, spawn_x, spawn_y, interaction_radius, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`, [
            spawnUid,
            payload.npc_template_id,
            payload.zone,
            payload.spawn_x,
            payload.spawn_y,
            payload.interaction_radius ?? 80
        ]);
        return spawnUid;
    }
    async updateSpawn(spawnUid, payload) {
        const current = await database_1.default.query(`SELECT * FROM npc_spawns WHERE spawn_uid = ?`, [spawnUid]);
        if (!current)
            throw new Error('NPC spawn not found');
        await database_1.default.run(`UPDATE npc_spawns
       SET npc_template_id = ?, zone = ?, spawn_x = ?, spawn_y = ?, interaction_radius = ?,
           is_active = ?, updated_at = CURRENT_TIMESTAMP
       WHERE spawn_uid = ?`, [
            payload.npc_template_id ?? current.npc_template_id,
            payload.zone ?? current.zone,
            payload.spawn_x ?? current.spawn_x,
            payload.spawn_y ?? current.spawn_y,
            payload.interaction_radius ?? current.interaction_radius,
            payload.is_active == null ? current.is_active : (payload.is_active ? 1 : 0),
            spawnUid
        ]);
    }
    async removeSpawn(spawnUid) {
        await database_1.default.run(`UPDATE npc_spawns
       SET is_active = 0, updated_at = CURRENT_TIMESTAMP
       WHERE spawn_uid = ?`, [spawnUid]);
    }
}
exports.default = new NpcRepository();
//# sourceMappingURL=npc.repository.js.map