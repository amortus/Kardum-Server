import dbHelpers from '../../config/database';
import type {
  MonsterTemplate,
  MonsterSpawn,
  MonsterDifficulty,
  MonsterTemplateDrop
} from '../../shared/types';

type MonsterSpawnRow = MonsterSpawn & {
  template_name: string;
  deck_id: number;
  difficulty: MonsterDifficulty;
  sprite_ref?: string | null;
  visual?: string | null;
  collection_id?: string | null;
  deck_mode?: 'auto' | 'manual' | 'hybrid';
  manual_deck_cards?: string[];
};

export class MonsterRepository {
  async listTemplateDrops(templateId: number): Promise<MonsterTemplateDrop[]> {
    const rows = await dbHelpers.queryAll<any>(
      `SELECT *
       FROM monster_template_drops
       WHERE template_id = ? AND is_active = 1
       ORDER BY drop_chance_percent DESC, id ASC`,
      [templateId]
    );
    return rows.map((row) => ({
      id: row.id,
      template_id: row.template_id,
      card_id: row.card_id,
      drop_chance_percent: Number(row.drop_chance_percent || 0),
      is_active: row.is_active === 1 || row.is_active === true,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));
  }

  async upsertTemplateDrop(templateId: number, cardId: string, dropChancePercent: number): Promise<void> {
    const existing = await dbHelpers.query<{ id: number }>(
      'SELECT id FROM monster_template_drops WHERE template_id = ? AND card_id = ?',
      [templateId, cardId]
    );
    if (existing) {
      await dbHelpers.run(
        `UPDATE monster_template_drops
         SET drop_chance_percent = ?, is_active = 1, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [dropChancePercent, existing.id]
      );
      return;
    }
    await dbHelpers.run(
      `INSERT INTO monster_template_drops (template_id, card_id, drop_chance_percent, is_active)
       VALUES (?, ?, ?, 1)`,
      [templateId, cardId, dropChancePercent]
    );
  }

  async removeTemplateDrop(templateId: number, cardId: string): Promise<void> {
    await dbHelpers.run(
      `UPDATE monster_template_drops
       SET is_active = 0, updated_at = CURRENT_TIMESTAMP
       WHERE template_id = ? AND card_id = ?`,
      [templateId, cardId]
    );
  }

  async getTemplates(): Promise<MonsterTemplate[]> {
    const rows = await dbHelpers.queryAll<any>(
      'SELECT * FROM monster_templates WHERE is_active = 1 ORDER BY id DESC'
    );
    return rows.map(this.parseTemplate);
  }

  async getTemplateById(templateId: number): Promise<MonsterTemplate | null> {
    const row = await dbHelpers.query<any>(
      'SELECT * FROM monster_templates WHERE id = ? AND is_active = 1',
      [templateId]
    );
    return row ? this.parseTemplate(row) : null;
  }

  async getTemplateByName(name: string): Promise<MonsterTemplate | null> {
    const row = await dbHelpers.query<any>(
      'SELECT * FROM monster_templates WHERE LOWER(name) = LOWER(?) AND is_active = 1',
      [name]
    );
    return row ? this.parseTemplate(row) : null;
  }

  async createTemplate(data: {
    name: string;
    deck_id: number;
    difficulty: MonsterDifficulty;
    sprite_ref?: string | null;
    visual?: string | null;
    collection_id?: string | null;
    deck_mode?: 'auto' | 'manual' | 'hybrid';
    manual_deck_cards?: string[];
  }): Promise<number> {
    const result = await dbHelpers.run(
      `INSERT INTO monster_templates (name, deck_id, difficulty, sprite_ref, visual, collection_id, deck_mode, manual_deck_cards)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.name,
        data.deck_id,
        data.difficulty,
        data.sprite_ref || null,
        data.visual || null,
        data.collection_id || 'shadowland_creatures',
        data.deck_mode || 'hybrid',
        data.manual_deck_cards ? JSON.stringify(data.manual_deck_cards) : null
      ]
    );
    return result.lastInsertRowid || 0;
  }

  async updateTemplate(
    templateId: number,
    data: Partial<{
      name: string;
      deck_id: number;
      difficulty: MonsterDifficulty;
      sprite_ref: string | null;
      visual: string | null;
      collection_id: string | null;
      deck_mode: 'auto' | 'manual' | 'hybrid';
      manual_deck_cards: string[];
      is_active: boolean;
    }>
  ): Promise<void> {
    const current = await dbHelpers.query<any>(
      'SELECT * FROM monster_templates WHERE id = ?',
      [templateId]
    );
    if (!current) throw new Error('Template not found');

    await dbHelpers.run(
      `UPDATE monster_templates
       SET name = ?, deck_id = ?, difficulty = ?, sprite_ref = ?, visual = ?, collection_id = ?, deck_mode = ?, manual_deck_cards = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        data.name ?? current.name,
        data.deck_id ?? current.deck_id,
        data.difficulty ?? current.difficulty,
        data.sprite_ref ?? current.sprite_ref,
        data.visual ?? current.visual,
        data.collection_id ?? current.collection_id,
        data.deck_mode ?? current.deck_mode,
        data.manual_deck_cards ? JSON.stringify(data.manual_deck_cards) : current.manual_deck_cards,
        data.is_active == null ? current.is_active : (data.is_active ? 1 : 0),
        templateId
      ]
    );
  }

  async getSpawns(zone?: string): Promise<MonsterSpawnRow[]> {
    const whereClause = zone ? 'WHERE s.is_active = 1 AND s.zone = ?' : 'WHERE s.is_active = 1';
    const params = zone ? [zone] : [];
    const rows = await dbHelpers.queryAll<any>(
      `SELECT s.*, t.name as template_name, t.deck_id, t.difficulty, t.sprite_ref, t.visual, t.collection_id, t.deck_mode, t.manual_deck_cards
       FROM monster_spawns s
       JOIN monster_templates t ON t.id = s.template_id
       ${whereClause}
       ORDER BY s.id DESC`,
      params
    );
    return rows.map(this.parseSpawnRow);
  }

  async getSpawnByUid(spawnUid: string): Promise<MonsterSpawnRow | null> {
    const row = await dbHelpers.query<any>(
      `SELECT s.*, t.name as template_name, t.deck_id, t.difficulty, t.sprite_ref, t.visual, t.collection_id, t.deck_mode, t.manual_deck_cards
       FROM monster_spawns s
       JOIN monster_templates t ON t.id = s.template_id
       WHERE s.spawn_uid = ?`,
      [spawnUid]
    );
    return row ? this.parseSpawnRow(row) : null;
  }

  async createSpawn(data: {
    spawn_uid: string;
    template_id: number;
    zone: string;
    spawn_x: number;
    spawn_y: number;
    respawn_seconds: number;
    move_radius: number;
  }): Promise<number> {
    const result = await dbHelpers.run(
      `INSERT INTO monster_spawns (spawn_uid, template_id, zone, spawn_x, spawn_y, respawn_seconds, move_radius)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.spawn_uid,
        data.template_id,
        data.zone,
        data.spawn_x,
        data.spawn_y,
        data.respawn_seconds,
        data.move_radius
      ]
    );
    return result.lastInsertRowid || 0;
  }

  async updateSpawn(
    spawnUid: string,
    data: Partial<{
      template_id: number;
      zone: string;
      spawn_x: number;
      spawn_y: number;
      respawn_seconds: number;
      move_radius: number;
      is_active: boolean;
    }>
  ): Promise<void> {
    const current = await dbHelpers.query<any>(
      'SELECT * FROM monster_spawns WHERE spawn_uid = ?',
      [spawnUid]
    );
    if (!current) throw new Error('Spawn not found');

    await dbHelpers.run(
      `UPDATE monster_spawns
       SET template_id = ?, zone = ?, spawn_x = ?, spawn_y = ?, respawn_seconds = ?, move_radius = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
       WHERE spawn_uid = ?`,
      [
        data.template_id ?? current.template_id,
        data.zone ?? current.zone,
        data.spawn_x ?? current.spawn_x,
        data.spawn_y ?? current.spawn_y,
        data.respawn_seconds ?? current.respawn_seconds,
        data.move_radius ?? current.move_radius,
        data.is_active == null ? current.is_active : (data.is_active ? 1 : 0),
        spawnUid
      ]
    );
  }

  async removeSpawn(spawnUid: string): Promise<void> {
    await dbHelpers.run(
      'UPDATE monster_spawns SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE spawn_uid = ?',
      [spawnUid]
    );
  }

  async logEncounterStart(data: {
    spawn_uid: string;
    template_id: number;
    user_id: number;
    match_id: number;
  }): Promise<number> {
    const result = await dbHelpers.run(
      `INSERT INTO monster_encounters (spawn_uid, template_id, user_id, match_id)
       VALUES (?, ?, ?, ?)`,
      [data.spawn_uid, data.template_id, data.user_id, data.match_id]
    );
    return result.lastInsertRowid || 0;
  }

  async logEncounterEnd(encounterId: number, result: 'win' | 'loss' | 'draw'): Promise<void> {
    await dbHelpers.run(
      `UPDATE monster_encounters
       SET result = ?, ended_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [result, encounterId]
    );
  }

  private parseTemplate(row: any): MonsterTemplate {
    return {
      id: row.id,
      name: row.name,
      deck_id: row.deck_id,
      difficulty: row.difficulty,
      sprite_ref: row.sprite_ref || null,
      visual: row.visual || null,
      collection_id: row.collection_id || null,
      deck_mode: row.deck_mode || 'hybrid',
      manual_deck_cards: row.manual_deck_cards ? JSON.parse(row.manual_deck_cards) : [],
      is_active: row.is_active === 1 || row.is_active === true,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  private parseSpawnRow(row: any): MonsterSpawnRow {
    return {
      id: row.id,
      spawn_uid: row.spawn_uid,
      template_id: row.template_id,
      zone: row.zone,
      spawn_x: row.spawn_x,
      spawn_y: row.spawn_y,
      respawn_seconds: row.respawn_seconds,
      move_radius: row.move_radius,
      is_active: row.is_active === 1 || row.is_active === true,
      template_name: row.template_name,
      deck_id: row.deck_id,
      difficulty: row.difficulty,
      sprite_ref: row.sprite_ref || null,
      visual: row.visual || null,
      collection_id: row.collection_id || null,
      deck_mode: row.deck_mode || 'hybrid',
      manual_deck_cards: row.manual_deck_cards ? JSON.parse(row.manual_deck_cards) : [],
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
}

export default new MonsterRepository();
