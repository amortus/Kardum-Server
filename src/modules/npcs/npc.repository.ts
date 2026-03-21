import crypto from 'crypto';
import dbHelpers from '../../config/database';

export type NpcTemplate = {
  id: number;
  code: string;
  name: string;
  sprite_ref: string | null;
  frame_count: number;
  frame_cols: number;
  frame_rows: number;
  idle_start: number;
  idle_count: number;
  dialogue_json: string | null;
  is_active: boolean;
};

export type NpcSpawn = {
  id: number;
  spawn_uid: string;
  npc_template_id: number;
  zone: string;
  spawn_x: number;
  spawn_y: number;
  interaction_radius: number;
  is_active: boolean;
};

class NpcRepository {
  async listTemplates(): Promise<NpcTemplate[]> {
    const rows = await dbHelpers.queryAll<any>(
      `SELECT *
       FROM npc_templates
       WHERE is_active = 1
       ORDER BY id ASC`
    );
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

  async getTemplateByCode(code: string): Promise<NpcTemplate | null> {
    const row = await dbHelpers.query<any>(
      `SELECT *
       FROM npc_templates
       WHERE code = ?`,
      [code]
    );
    if (!row) return null;
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

  async getTemplateByNameOrCode(nameOrCode: string): Promise<NpcTemplate | null> {
    const normalized = String(nameOrCode || '').trim().toLowerCase();
    if (!normalized) return null;
    const row = await dbHelpers.query<any>(
      `SELECT *
       FROM npc_templates
       WHERE LOWER(code) = ? OR LOWER(name) = ?
       ORDER BY CASE WHEN LOWER(code) = ? THEN 0 ELSE 1 END, id ASC
       LIMIT 1`,
      [normalized, normalized, normalized]
    );
    if (!row) return null;
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

  async createTemplate(payload: {
    code: string;
    name: string;
    sprite_ref: string;
    frame_count?: number;
    frame_cols?: number;
    frame_rows?: number;
    idle_start?: number;
    idle_count?: number;
    dialogue_json?: string | null;
  }): Promise<number> {
    const result = await dbHelpers.run(
      `INSERT INTO npc_templates
      (code, name, sprite_ref, frame_count, frame_cols, frame_rows, idle_start, idle_count, dialogue_json, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        payload.code,
        payload.name,
        payload.sprite_ref,
        payload.frame_count ?? 6,
        payload.frame_cols ?? 6,
        payload.frame_rows ?? 1,
        payload.idle_start ?? 0,
        payload.idle_count ?? 6,
        payload.dialogue_json ?? null
      ]
    );
    return Number(result.lastInsertRowid || 0);
  }

  async updateTemplate(
    templateId: number,
    payload: Partial<{
      code: string;
      name: string;
      sprite_ref: string;
      frame_count: number;
      frame_cols: number;
      frame_rows: number;
      idle_start: number;
      idle_count: number;
      dialogue_json: string | null;
      is_active: boolean;
    }>
  ): Promise<void> {
    const current = await dbHelpers.query<any>(
      `SELECT * FROM npc_templates WHERE id = ?`,
      [templateId]
    );
    if (!current) throw new Error('NPC template not found');
    await dbHelpers.run(
      `UPDATE npc_templates
       SET code = ?, name = ?, sprite_ref = ?, frame_count = ?, frame_cols = ?, frame_rows = ?,
           idle_start = ?, idle_count = ?, dialogue_json = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
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
      ]
    );
  }

  async listSpawns(zone: string): Promise<NpcSpawn[]> {
    const rows = await dbHelpers.queryAll<any>(
      `SELECT *
       FROM npc_spawns
       WHERE zone = ? AND is_active = 1
       ORDER BY id ASC`,
      [zone]
    );
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

  async createSpawn(payload: {
    npc_template_id: number;
    zone: string;
    spawn_x: number;
    spawn_y: number;
    interaction_radius?: number;
  }): Promise<string> {
    const spawnUid = `npc_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    await dbHelpers.run(
      `INSERT INTO npc_spawns
      (spawn_uid, npc_template_id, zone, spawn_x, spawn_y, interaction_radius, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [
        spawnUid,
        payload.npc_template_id,
        payload.zone,
        payload.spawn_x,
        payload.spawn_y,
        payload.interaction_radius ?? 80
      ]
    );
    return spawnUid;
  }

  async updateSpawn(spawnUid: string, payload: Partial<{
    npc_template_id: number;
    zone: string;
    spawn_x: number;
    spawn_y: number;
    interaction_radius: number;
    is_active: boolean;
  }>): Promise<void> {
    const current = await dbHelpers.query<any>(
      `SELECT * FROM npc_spawns WHERE spawn_uid = ?`,
      [spawnUid]
    );
    if (!current) throw new Error('NPC spawn not found');
    await dbHelpers.run(
      `UPDATE npc_spawns
       SET npc_template_id = ?, zone = ?, spawn_x = ?, spawn_y = ?, interaction_radius = ?,
           is_active = ?, updated_at = CURRENT_TIMESTAMP
       WHERE spawn_uid = ?`,
      [
        payload.npc_template_id ?? current.npc_template_id,
        payload.zone ?? current.zone,
        payload.spawn_x ?? current.spawn_x,
        payload.spawn_y ?? current.spawn_y,
        payload.interaction_radius ?? current.interaction_radius,
        payload.is_active == null ? current.is_active : (payload.is_active ? 1 : 0),
        spawnUid
      ]
    );
  }

  async removeSpawn(spawnUid: string): Promise<void> {
    await dbHelpers.run(
      `UPDATE npc_spawns
       SET is_active = 0, updated_at = CURRENT_TIMESTAMP
       WHERE spawn_uid = ?`,
      [spawnUid]
    );
  }
}

export default new NpcRepository();
