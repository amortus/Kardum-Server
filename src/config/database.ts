import { ENV } from './env';

let db: any;
let dbType: 'sqlite' | 'postgres' = 'sqlite';
let usePostgres = false;
const POSTGRES_DB_INIT_LOCK_KEY = 914204331;

// Detectar qual banco usar
if (ENV.DATABASE_URL) {
  // PostgreSQL (Railway/Produção)
  usePostgres = true;
  dbType = 'postgres';
  const { Pool } = require('pg');
  
  const pool = new Pool({
    connectionString: ENV.DATABASE_URL,
    ssl: ENV.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  db = pool;
  console.log('✅ Using PostgreSQL database');
} else {
  // SQLite (Desenvolvimento local)
  const Database = require('better-sqlite3');
  const dbPath = ENV.DATABASE_PATH;
  db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  console.log('✅ Using SQLite database at:', dbPath);
}

// Helper functions para abstrair diferenças entre SQLite e PostgreSQL
export const dbHelpers = {
  // Executar query sem retorno (CREATE TABLE, etc)
  async exec(sql: string): Promise<void> {
    if (usePostgres) {
      const pgSql = convertToPostgresSQL(sql);
      await db.query(pgSql);
    } else {
      return new Promise((resolve, reject) => {
        try {
          db.exec(sql);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    }
  },

  // Query que retorna uma linha
  async query<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    if (usePostgres) {
      const pgSql = convertToPostgresSQL(sql);
      const pgParams = convertParams(params);
      const result = await db.query(pgSql, pgParams);
      return result.rows[0] || null;
    } else {
      const stmt = db.prepare(sql);
      return stmt.get(...params) || null;
    }
  },

  // Query que retorna múltiplas linhas
  async queryAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (usePostgres) {
      const pgSql = convertToPostgresSQL(sql);
      const pgParams = convertParams(params);
      const result = await db.query(pgSql, pgParams);
      return result.rows;
    } else {
      const stmt = db.prepare(sql);
      return stmt.all(...params);
    }
  },

  // Executar INSERT/UPDATE/DELETE
  async run(sql: string, params: any[] = []): Promise<{ lastInsertRowid: number | null; changes: number }> {
    if (usePostgres) {
      let pgSql = convertToPostgresSQL(sql);
      const pgParams = convertParams(params);
      
      // Para INSERTs, adicionar RETURNING id se não tiver
      if (sql.trim().toUpperCase().startsWith('INSERT') && !pgSql.includes('RETURNING')) {
        pgSql = pgSql.replace(/;?\s*$/, '') + ' RETURNING id';
      }
      
      const result = await db.query(pgSql, pgParams);
      
      // Obter ID do INSERT
      let insertId = null;
      if (sql.trim().toUpperCase().startsWith('INSERT')) {
        if (result.rows && result.rows.length > 0 && result.rows[0].id) {
          insertId = result.rows[0].id;
        }
      }
      
      return {
        lastInsertRowid: insertId,
        changes: result.rowCount || 0
      };
    } else {
      const stmt = db.prepare(sql);
      const info = stmt.run(...params);
      return {
        lastInsertRowid: info.lastInsertRowid,
        changes: info.changes
      };
    }
  }
};

// Converter SQLite SQL para PostgreSQL
function convertToPostgresSQL(sql: string): string {
  let pgSql = sql;
  
  // Converter named parameters @param para $1, $2, etc
  const namedParams = new Map<string, number>();
  let namedIndex = 1;
  pgSql = pgSql.replace(/@(\w+)/g, (_match, paramName) => {
    if (!namedParams.has(paramName)) {
      namedParams.set(paramName, namedIndex++);
    }
    return `$${namedParams.get(paramName)}`;
  });
  
  // Converter placeholders ? para $1, $2, $3
  if (namedParams.size === 0) {
    let paramIndex = 1;
    pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);
  }
  
  return pgSql;
}

// Converter parâmetros
function convertParams(params: any): any[] {
  return Array.isArray(params) ? params : [params];
}

async function withPostgresInitLock<T>(fn: () => Promise<T>): Promise<T> {
  if (!usePostgres) {
    return fn();
  }
  const pool = db as { connect: () => Promise<{ query: (sql: string, params?: any[]) => Promise<any>; release: () => void }> };
  const lockClient = await pool.connect();
  let lockAcquired = false;
  try {
    console.log('[DB] Waiting for init lock...');
    await lockClient.query('SELECT pg_advisory_lock($1)', [POSTGRES_DB_INIT_LOCK_KEY]);
    lockAcquired = true;
    console.log('[DB] Init lock acquired.');
    return await fn();
  } finally {
    if (lockAcquired) {
      try {
        await lockClient.query('SELECT pg_advisory_unlock($1)', [POSTGRES_DB_INIT_LOCK_KEY]);
        console.log('[DB] Init lock released.');
      } catch (error) {
        console.warn('[DB] Failed to release init lock:', error);
      }
    }
    lockClient.release();
  }
}

// Inicializar banco de dados
async function initDatabase(): Promise<void> {
  try {
    if (usePostgres) {
      // PostgreSQL schema
      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(255) UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          email VARCHAR(255) UNIQUE,
          elo_casual INTEGER DEFAULT 1000,
          elo_ranked INTEGER DEFAULT 1000,
          total_matches INTEGER DEFAULT 0,
          wins INTEGER DEFAULT 0,
          losses INTEGER DEFAULT 0,
          gender VARCHAR(16) DEFAULT 'male',
          body_id VARCHAR(64) DEFAULT 'clothes',
          head_id VARCHAR(64) DEFAULT 'male_head1',
          skin_body_id VARCHAR(64),
          skin_head_id VARCHAR(64),
          character_completed INTEGER DEFAULT 0,
          profile_avatar_id VARCHAR(128),
          gold INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_login TIMESTAMP,
          is_admin INTEGER DEFAULT 0
        )
      `);

      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS cards (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          type VARCHAR(50) NOT NULL,
          race VARCHAR(50),
          class VARCHAR(50),
          cost INTEGER NOT NULL,
          attack INTEGER,
          defense INTEGER,
          abilities TEXT,
          text TEXT,
          rarity VARCHAR(50),
          image_url TEXT,
          card_image_url TEXT,
          effects TEXT,
          hero_power_text TEXT,
          hero_power_cost INTEGER,
          hero_power_effect TEXT,
          passive_effect TEXT,
          default_unlocked INTEGER DEFAULT 1,
          visual_auras TEXT,
          collection_id VARCHAR(64),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          is_active INTEGER DEFAULT 1
        )
      `);

      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS card_collections (
          id VARCHAR(64) PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          description TEXT,
          is_active INTEGER DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS decks (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          name VARCHAR(255) NOT NULL,
          general_id VARCHAR(255),
          cards TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);

      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS matches (
          id SERIAL PRIMARY KEY,
          player1_id INTEGER NOT NULL,
          player2_id INTEGER,
          winner_id INTEGER,
          match_type VARCHAR(50) NOT NULL,
          duration_seconds INTEGER,
          player1_deck TEXT,
          player2_deck TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (player1_id) REFERENCES users(id),
          FOREIGN KEY (player2_id) REFERENCES users(id),
          FOREIGN KEY (winner_id) REFERENCES users(id)
        )
      `);

      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS admin_logs (
          id SERIAL PRIMARY KEY,
          admin_id INTEGER NOT NULL,
          action VARCHAR(255) NOT NULL,
          details TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (admin_id) REFERENCES users(id)
        )
      `);

      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS card_layouts (
          card_id VARCHAR(255) PRIMARY KEY,
          artwork_offset_left REAL,
          artwork_offset_top REAL,
          artwork_offset_right REAL,
          artwork_offset_bottom REAL,
          artwork_expand_mode INTEGER,
          artwork_stretch_mode INTEGER,
          cost_offset_left REAL,
          cost_offset_top REAL,
          attack_offset_left REAL,
          attack_offset_top REAL,
          defense_offset_left REAL,
          defense_offset_top REAL,
          name_offset_left REAL,
          name_offset_top REAL,
          name_width REAL,
          name_height REAL,
          name_font_size REAL,
          description_offset_left REAL,
          description_offset_top REAL,
          description_width REAL,
          description_height REAL,
          description_font_size REAL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (card_id) REFERENCES cards(id)
        )
      `);

      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS card_vfx_layout_global (
          id INTEGER PRIMARY KEY,
          cost_offset_left REAL,
          cost_offset_top REAL,
          attack_offset_left REAL,
          attack_offset_top REAL,
          defense_offset_left REAL,
          defense_offset_top REAL,
          name_offset_left REAL,
          name_offset_top REAL,
          name_width REAL,
          name_height REAL,
          name_font_size REAL,
          description_offset_left REAL,
          description_offset_top REAL,
          description_width REAL,
          description_height REAL,
          description_font_size REAL,
          cardbase_image_url TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS boosters (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          card_collection TEXT,
          rarity_weights TEXT,
          cards_per_pack INTEGER DEFAULT 5,
          price INTEGER DEFAULT 100,
          is_active INTEGER DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS monster_templates (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          deck_id INTEGER NOT NULL,
          difficulty VARCHAR(32) NOT NULL DEFAULT 'medium',
          sprite_ref TEXT,
          visual TEXT,
          collection_id VARCHAR(64),
          deck_mode VARCHAR(16) DEFAULT 'hybrid',
          manual_deck_cards TEXT,
          is_active INTEGER DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (deck_id) REFERENCES decks(id),
          FOREIGN KEY (collection_id) REFERENCES card_collections(id)
        )
      `);

      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS monster_spawns (
          id SERIAL PRIMARY KEY,
          spawn_uid VARCHAR(64) NOT NULL UNIQUE,
          template_id INTEGER NOT NULL,
          zone VARCHAR(64) NOT NULL DEFAULT 'shadowland',
          spawn_x REAL NOT NULL,
          spawn_y REAL NOT NULL,
          respawn_seconds INTEGER NOT NULL DEFAULT 30,
          move_radius REAL NOT NULL DEFAULT 120,
          is_active INTEGER DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (template_id) REFERENCES monster_templates(id)
        )
      `);

      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS monster_encounters (
          id SERIAL PRIMARY KEY,
          spawn_uid VARCHAR(64) NOT NULL,
          template_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          match_id INTEGER,
          result VARCHAR(16),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          ended_at TIMESTAMP,
          FOREIGN KEY (template_id) REFERENCES monster_templates(id),
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);

      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS monster_template_drops (
          id SERIAL PRIMARY KEY,
          template_id INTEGER NOT NULL,
          card_id VARCHAR(255) NOT NULL,
          drop_chance_percent REAL NOT NULL DEFAULT 0,
          is_active INTEGER DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (template_id) REFERENCES monster_templates(id),
          FOREIGN KEY (card_id) REFERENCES cards(id),
          UNIQUE(template_id, card_id)
        )
      `);

      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS user_card_unlocks (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          card_id VARCHAR(255) NOT NULL,
          source VARCHAR(64) DEFAULT 'monster_drop',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (card_id) REFERENCES cards(id),
          UNIQUE(user_id, card_id)
        )
      `);

      // ===== MAIL (player inbox + campaigns) =====
      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS mail_campaigns (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          subject TEXT NOT NULL,
          body TEXT NOT NULL,
          deliver_at TIMESTAMP NOT NULL,
          audience_json TEXT NOT NULL,
          attachments_json TEXT NOT NULL,
          status VARCHAR(16) NOT NULL DEFAULT 'draft',
          created_by_admin_id INTEGER NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          sent_at TIMESTAMP,
          FOREIGN KEY (created_by_admin_id) REFERENCES users(id)
        )
      `);
      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS mail_messages (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          sender_admin_id INTEGER,
          campaign_id INTEGER,
          subject TEXT NOT NULL,
          body TEXT NOT NULL,
          status VARCHAR(16) NOT NULL DEFAULT 'unread',
          deliver_at TIMESTAMP NOT NULL,
          delivered_at TIMESTAMP,
          read_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (sender_admin_id) REFERENCES users(id),
          FOREIGN KEY (campaign_id) REFERENCES mail_campaigns(id)
        )
      `);
      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS mail_attachments (
          id SERIAL PRIMARY KEY,
          mail_id INTEGER NOT NULL,
          type VARCHAR(32) NOT NULL,
          payload_json TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (mail_id) REFERENCES mail_messages(id)
        )
      `);
      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS mail_claims (
          id SERIAL PRIMARY KEY,
          mail_id INTEGER NOT NULL UNIQUE,
          user_id INTEGER NOT NULL,
          claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (mail_id) REFERENCES mail_messages(id),
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);

      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS npc_templates (
          id SERIAL PRIMARY KEY,
          code VARCHAR(64) NOT NULL UNIQUE,
          name VARCHAR(255) NOT NULL,
          sprite_ref TEXT,
          frame_count INTEGER DEFAULT 6,
          frame_cols INTEGER DEFAULT 6,
          frame_rows INTEGER DEFAULT 1,
          idle_start INTEGER DEFAULT 0,
          idle_count INTEGER DEFAULT 6,
          dialogue_json TEXT,
          is_active INTEGER DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS npc_spawns (
          id SERIAL PRIMARY KEY,
          spawn_uid VARCHAR(64) NOT NULL UNIQUE,
          npc_template_id INTEGER NOT NULL,
          zone VARCHAR(64) NOT NULL DEFAULT 'shadowland',
          spawn_x REAL NOT NULL,
          spawn_y REAL NOT NULL,
          interaction_radius REAL NOT NULL DEFAULT 80,
          is_active INTEGER DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (npc_template_id) REFERENCES npc_templates(id)
        )
      `);

      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS quest_definitions (
          id SERIAL PRIMARY KEY,
          code VARCHAR(64) NOT NULL UNIQUE,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          giver_npc_template_id INTEGER,
          turnin_npc_template_id INTEGER,
          min_level INTEGER DEFAULT 1,
          recurrence_type VARCHAR(24) DEFAULT 'none',
          auto_track INTEGER DEFAULT 1,
          objective_logic VARCHAR(8) DEFAULT 'all',
          metadata_json TEXT,
          is_active INTEGER DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (giver_npc_template_id) REFERENCES npc_templates(id),
          FOREIGN KEY (turnin_npc_template_id) REFERENCES npc_templates(id)
        )
      `);

      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS quest_objectives (
          id SERIAL PRIMARY KEY,
          quest_id INTEGER NOT NULL,
          objective_type VARCHAR(64) NOT NULL,
          target_ref VARCHAR(255) NOT NULL,
          required_count INTEGER DEFAULT 1,
          filters_json TEXT,
          order_index INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (quest_id) REFERENCES quest_definitions(id)
        )
      `);

      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS quest_prerequisites (
          id SERIAL PRIMARY KEY,
          quest_id INTEGER NOT NULL,
          prerequisite_type VARCHAR(64) NOT NULL,
          reference_value VARCHAR(255) NOT NULL,
          operator VARCHAR(16) DEFAULT 'eq',
          required_count INTEGER DEFAULT 1,
          FOREIGN KEY (quest_id) REFERENCES quest_definitions(id)
        )
      `);

      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS quest_transitions (
          id SERIAL PRIMARY KEY,
          from_quest_id INTEGER NOT NULL,
          to_quest_id INTEGER NOT NULL,
          trigger_event VARCHAR(32) DEFAULT 'completed',
          exclusive_group VARCHAR(64),
          FOREIGN KEY (from_quest_id) REFERENCES quest_definitions(id),
          FOREIGN KEY (to_quest_id) REFERENCES quest_definitions(id)
        )
      `);

      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS quest_rewards (
          id SERIAL PRIMARY KEY,
          quest_id INTEGER NOT NULL,
          reward_type VARCHAR(32) NOT NULL,
          reward_ref VARCHAR(255),
          amount INTEGER DEFAULT 0,
          metadata_json TEXT,
          FOREIGN KEY (quest_id) REFERENCES quest_definitions(id)
        )
      `);

      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS user_quests (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          quest_id INTEGER NOT NULL,
          state VARCHAR(24) NOT NULL DEFAULT 'accepted',
          accepted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          completed_at TIMESTAMP,
          abandoned_at TIMESTAMP,
          expires_at TIMESTAMP,
          last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (quest_id) REFERENCES quest_definitions(id),
          UNIQUE(user_id, quest_id)
        )
      `);

      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS user_quest_objective_progress (
          id SERIAL PRIMARY KEY,
          user_quest_id INTEGER NOT NULL,
          objective_id INTEGER NOT NULL,
          current_count INTEGER DEFAULT 0,
          completed_at TIMESTAMP,
          last_event_key VARCHAR(255),
          FOREIGN KEY (user_quest_id) REFERENCES user_quests(id),
          FOREIGN KEY (objective_id) REFERENCES quest_objectives(id),
          UNIQUE(user_quest_id, objective_id)
        )
      `);

      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS user_tracked_quests (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          quest_id INTEGER NOT NULL,
          pin_order INTEGER DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (quest_id) REFERENCES quest_definitions(id),
          UNIQUE(user_id, quest_id)
        )
      `);

      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS quest_event_ledger (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          quest_id INTEGER NOT NULL,
          event_key VARCHAR(255) NOT NULL,
          event_type VARCHAR(64) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (quest_id) REFERENCES quest_definitions(id),
          UNIQUE(user_id, quest_id, event_key)
        )
      `);

      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS chat_messages (
          id SERIAL PRIMARY KEY,
          channel VARCHAR(50) NOT NULL,
          sender_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          sender_username VARCHAR(100) NOT NULL,
          recipient_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          recipient_username VARCHAR(100),
          message TEXT NOT NULL,
          timestamp BIGINT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS friendships (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          friend_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          status VARCHAR(20) NOT NULL DEFAULT 'pending',
          requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          accepted_at TIMESTAMP,
          UNIQUE(user_id, friend_id)
        )
      `);

      await dbHelpers.exec(`
        CREATE INDEX IF NOT EXISTS idx_chat_channel_timestamp
        ON chat_messages(channel, timestamp DESC)
      `);
      await dbHelpers.exec(`
        CREATE INDEX IF NOT EXISTS idx_chat_sender
        ON chat_messages(sender_user_id)
      `);
      await dbHelpers.exec(`
        CREATE INDEX IF NOT EXISTS idx_chat_whisper
        ON chat_messages(sender_user_id, recipient_username)
      `);
      await dbHelpers.exec(`
        CREATE INDEX IF NOT EXISTS idx_friendships_user
        ON friendships(user_id, status)
      `);
      await dbHelpers.exec(`
        CREATE INDEX IF NOT EXISTS idx_friendships_friend
        ON friendships(friend_id, status)
      `);
      await dbHelpers.exec(`
        CREATE INDEX IF NOT EXISTS idx_monster_template_drops_template
        ON monster_template_drops(template_id)
      `);
      await dbHelpers.exec(`
        CREATE INDEX IF NOT EXISTS idx_user_card_unlocks_user
        ON user_card_unlocks(user_id)
      `);
      await dbHelpers.exec(`
        CREATE INDEX IF NOT EXISTS idx_mail_messages_user_deliver
        ON mail_messages(user_id, deliver_at)
      `);
      await dbHelpers.exec(`
        CREATE INDEX IF NOT EXISTS idx_mail_messages_user_status
        ON mail_messages(user_id, status)
      `);
      await dbHelpers.exec(`
        CREATE INDEX IF NOT EXISTS idx_mail_campaigns_status_deliver
        ON mail_campaigns(status, deliver_at)
      `);
      await dbHelpers.exec(`
        CREATE INDEX IF NOT EXISTS idx_npc_spawns_zone
        ON npc_spawns(zone, is_active)
      `);
      await dbHelpers.exec(`
        CREATE INDEX IF NOT EXISTS idx_quest_objectives_quest
        ON quest_objectives(quest_id, order_index)
      `);
      await dbHelpers.exec(`
        CREATE INDEX IF NOT EXISTS idx_user_quests_user_state
        ON user_quests(user_id, state)
      `);
      await dbHelpers.exec(`
        CREATE INDEX IF NOT EXISTS idx_user_quest_progress_user_quest
        ON user_quest_objective_progress(user_quest_id)
      `);
      await dbHelpers.exec(`
        CREATE INDEX IF NOT EXISTS idx_quest_event_ledger_user_quest
        ON quest_event_ledger(user_id, quest_id)
      `);
    } else {
      // SQLite schema
      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          email TEXT UNIQUE,
          elo_casual INTEGER DEFAULT 1000,
          elo_ranked INTEGER DEFAULT 1000,
          total_matches INTEGER DEFAULT 0,
          wins INTEGER DEFAULT 0,
          losses INTEGER DEFAULT 0,
          gender TEXT DEFAULT 'male',
          body_id TEXT DEFAULT 'clothes',
          head_id TEXT DEFAULT 'male_head1',
          skin_body_id TEXT,
          skin_head_id TEXT,
          character_completed INTEGER DEFAULT 0,
          profile_avatar_id TEXT,
          gold INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_login DATETIME,
          is_admin INTEGER DEFAULT 0
        )
      `);

      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS cards (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          race TEXT,
          class TEXT,
          cost INTEGER NOT NULL,
          attack INTEGER,
          defense INTEGER,
          abilities TEXT,
          text TEXT,
          rarity TEXT,
          image_url TEXT,
          card_image_url TEXT,
          effects TEXT,
          hero_power_text TEXT,
          hero_power_cost INTEGER,
          hero_power_effect TEXT,
          passive_effect TEXT,
          default_unlocked INTEGER DEFAULT 1,
          visual_auras TEXT,
          collection_id TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          is_active INTEGER DEFAULT 1
        )
      `);

      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS card_collections (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          is_active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS decks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          general_id TEXT,
          cards TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);

      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS matches (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          player1_id INTEGER NOT NULL,
          player2_id INTEGER,
          winner_id INTEGER,
          match_type TEXT NOT NULL,
          duration_seconds INTEGER,
          player1_deck TEXT,
          player2_deck TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (player1_id) REFERENCES users(id),
          FOREIGN KEY (player2_id) REFERENCES users(id),
          FOREIGN KEY (winner_id) REFERENCES users(id)
        )
      `);

      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS admin_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          admin_id INTEGER NOT NULL,
          action TEXT NOT NULL,
          details TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (admin_id) REFERENCES users(id)
        )
      `);

      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS card_layouts (
          card_id TEXT PRIMARY KEY,
          artwork_offset_left REAL,
          artwork_offset_top REAL,
          artwork_offset_right REAL,
          artwork_offset_bottom REAL,
          artwork_expand_mode INTEGER,
          artwork_stretch_mode INTEGER,
          cost_offset_left REAL,
          cost_offset_top REAL,
          attack_offset_left REAL,
          attack_offset_top REAL,
          defense_offset_left REAL,
          defense_offset_top REAL,
          name_offset_left REAL,
          name_offset_top REAL,
          name_width REAL,
          name_height REAL,
          name_font_size REAL,
          description_offset_left REAL,
          description_offset_top REAL,
          description_width REAL,
          description_height REAL,
          description_font_size REAL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (card_id) REFERENCES cards(id)
        )
      `);

      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS card_vfx_layout_global (
          id INTEGER PRIMARY KEY,
          cost_offset_left REAL,
          cost_offset_top REAL,
          attack_offset_left REAL,
          attack_offset_top REAL,
          defense_offset_left REAL,
          defense_offset_top REAL,
          name_offset_left REAL,
          name_offset_top REAL,
          name_width REAL,
          name_height REAL,
          name_font_size REAL,
          description_offset_left REAL,
          description_offset_top REAL,
          description_width REAL,
          description_height REAL,
          description_font_size REAL,
          cardbase_image_url TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS boosters (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          card_collection TEXT,
          rarity_weights TEXT,
          cards_per_pack INTEGER DEFAULT 5,
          price INTEGER DEFAULT 100,
          is_active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS monster_templates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          deck_id INTEGER NOT NULL,
          difficulty TEXT NOT NULL DEFAULT 'medium',
          sprite_ref TEXT,
          visual TEXT,
          collection_id TEXT,
          deck_mode TEXT DEFAULT 'hybrid',
          manual_deck_cards TEXT,
          is_active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (deck_id) REFERENCES decks(id),
          FOREIGN KEY (collection_id) REFERENCES card_collections(id)
        )
      `);

      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS monster_spawns (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          spawn_uid TEXT NOT NULL UNIQUE,
          template_id INTEGER NOT NULL,
          zone TEXT NOT NULL DEFAULT 'shadowland',
          spawn_x REAL NOT NULL,
          spawn_y REAL NOT NULL,
          respawn_seconds INTEGER NOT NULL DEFAULT 30,
          move_radius REAL NOT NULL DEFAULT 120,
          is_active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (template_id) REFERENCES monster_templates(id)
        )
      `);

      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS monster_encounters (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          spawn_uid TEXT NOT NULL,
          template_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          match_id INTEGER,
          result TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          ended_at DATETIME,
          FOREIGN KEY (template_id) REFERENCES monster_templates(id),
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);

      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS monster_template_drops (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          template_id INTEGER NOT NULL,
          card_id TEXT NOT NULL,
          drop_chance_percent REAL NOT NULL DEFAULT 0,
          is_active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (template_id) REFERENCES monster_templates(id),
          FOREIGN KEY (card_id) REFERENCES cards(id),
          UNIQUE(template_id, card_id)
        )
      `);

      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS user_card_unlocks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          card_id TEXT NOT NULL,
          source TEXT DEFAULT 'monster_drop',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (card_id) REFERENCES cards(id),
          UNIQUE(user_id, card_id)
        )
      `);

      // ===== MAIL (player inbox + campaigns) =====
      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS mail_campaigns (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          subject TEXT NOT NULL,
          body TEXT NOT NULL,
          deliver_at DATETIME NOT NULL,
          audience_json TEXT NOT NULL,
          attachments_json TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'draft',
          created_by_admin_id INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          sent_at DATETIME,
          FOREIGN KEY (created_by_admin_id) REFERENCES users(id)
        )
      `);
      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS mail_messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          sender_admin_id INTEGER,
          campaign_id INTEGER,
          subject TEXT NOT NULL,
          body TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'unread',
          deliver_at DATETIME NOT NULL,
          delivered_at DATETIME,
          read_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (sender_admin_id) REFERENCES users(id),
          FOREIGN KEY (campaign_id) REFERENCES mail_campaigns(id)
        )
      `);
      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS mail_attachments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          mail_id INTEGER NOT NULL,
          type TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (mail_id) REFERENCES mail_messages(id)
        )
      `);
      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS mail_claims (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          mail_id INTEGER NOT NULL UNIQUE,
          user_id INTEGER NOT NULL,
          claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (mail_id) REFERENCES mail_messages(id),
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);

      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS npc_templates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          sprite_ref TEXT,
          frame_count INTEGER DEFAULT 6,
          frame_cols INTEGER DEFAULT 6,
          frame_rows INTEGER DEFAULT 1,
          idle_start INTEGER DEFAULT 0,
          idle_count INTEGER DEFAULT 6,
          dialogue_json TEXT,
          is_active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS npc_spawns (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          spawn_uid TEXT NOT NULL UNIQUE,
          npc_template_id INTEGER NOT NULL,
          zone TEXT NOT NULL DEFAULT 'shadowland',
          spawn_x REAL NOT NULL,
          spawn_y REAL NOT NULL,
          interaction_radius REAL NOT NULL DEFAULT 80,
          is_active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (npc_template_id) REFERENCES npc_templates(id)
        )
      `);

      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS quest_definitions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT NOT NULL UNIQUE,
          title TEXT NOT NULL,
          description TEXT,
          giver_npc_template_id INTEGER,
          turnin_npc_template_id INTEGER,
          min_level INTEGER DEFAULT 1,
          recurrence_type TEXT DEFAULT 'none',
          auto_track INTEGER DEFAULT 1,
          objective_logic TEXT DEFAULT 'all',
          metadata_json TEXT,
          is_active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (giver_npc_template_id) REFERENCES npc_templates(id),
          FOREIGN KEY (turnin_npc_template_id) REFERENCES npc_templates(id)
        )
      `);

      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS quest_objectives (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          quest_id INTEGER NOT NULL,
          objective_type TEXT NOT NULL,
          target_ref TEXT NOT NULL,
          required_count INTEGER DEFAULT 1,
          filters_json TEXT,
          order_index INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (quest_id) REFERENCES quest_definitions(id)
        )
      `);

      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS quest_prerequisites (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          quest_id INTEGER NOT NULL,
          prerequisite_type TEXT NOT NULL,
          reference_value TEXT NOT NULL,
          operator TEXT DEFAULT 'eq',
          required_count INTEGER DEFAULT 1,
          FOREIGN KEY (quest_id) REFERENCES quest_definitions(id)
        )
      `);

      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS quest_transitions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          from_quest_id INTEGER NOT NULL,
          to_quest_id INTEGER NOT NULL,
          trigger_event TEXT DEFAULT 'completed',
          exclusive_group TEXT,
          FOREIGN KEY (from_quest_id) REFERENCES quest_definitions(id),
          FOREIGN KEY (to_quest_id) REFERENCES quest_definitions(id)
        )
      `);

      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS quest_rewards (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          quest_id INTEGER NOT NULL,
          reward_type TEXT NOT NULL,
          reward_ref TEXT,
          amount INTEGER DEFAULT 0,
          metadata_json TEXT,
          FOREIGN KEY (quest_id) REFERENCES quest_definitions(id)
        )
      `);

      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS user_quests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          quest_id INTEGER NOT NULL,
          state TEXT NOT NULL DEFAULT 'accepted',
          accepted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          completed_at DATETIME,
          abandoned_at DATETIME,
          expires_at DATETIME,
          last_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (quest_id) REFERENCES quest_definitions(id),
          UNIQUE(user_id, quest_id)
        )
      `);

      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS user_quest_objective_progress (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_quest_id INTEGER NOT NULL,
          objective_id INTEGER NOT NULL,
          current_count INTEGER DEFAULT 0,
          completed_at DATETIME,
          last_event_key TEXT,
          FOREIGN KEY (user_quest_id) REFERENCES user_quests(id),
          FOREIGN KEY (objective_id) REFERENCES quest_objectives(id),
          UNIQUE(user_quest_id, objective_id)
        )
      `);

      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS user_tracked_quests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          quest_id INTEGER NOT NULL,
          pin_order INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (quest_id) REFERENCES quest_definitions(id),
          UNIQUE(user_id, quest_id)
        )
      `);

      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS quest_event_ledger (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          quest_id INTEGER NOT NULL,
          event_key TEXT NOT NULL,
          event_type TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (quest_id) REFERENCES quest_definitions(id),
          UNIQUE(user_id, quest_id, event_key)
        )
      `);

      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS chat_messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          channel TEXT NOT NULL,
          sender_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          sender_username TEXT NOT NULL,
          recipient_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          recipient_username TEXT,
          message TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await dbHelpers.exec(`
        CREATE TABLE IF NOT EXISTS friendships (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          friend_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          status TEXT NOT NULL DEFAULT 'pending',
          requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          accepted_at DATETIME,
          UNIQUE(user_id, friend_id)
        )
      `);

      await dbHelpers.exec(`
        CREATE INDEX IF NOT EXISTS idx_chat_channel_timestamp
        ON chat_messages(channel, timestamp DESC)
      `);
      await dbHelpers.exec(`
        CREATE INDEX IF NOT EXISTS idx_chat_sender
        ON chat_messages(sender_user_id)
      `);
      await dbHelpers.exec(`
        CREATE INDEX IF NOT EXISTS idx_chat_whisper
        ON chat_messages(sender_user_id, recipient_username)
      `);
      await dbHelpers.exec(`
        CREATE INDEX IF NOT EXISTS idx_friendships_user
        ON friendships(user_id, status)
      `);
      await dbHelpers.exec(`
        CREATE INDEX IF NOT EXISTS idx_friendships_friend
        ON friendships(friend_id, status)
      `);
      await dbHelpers.exec(`
        CREATE INDEX IF NOT EXISTS idx_monster_template_drops_template
        ON monster_template_drops(template_id)
      `);
      await dbHelpers.exec(`
        CREATE INDEX IF NOT EXISTS idx_user_card_unlocks_user
        ON user_card_unlocks(user_id)
      `);
      await dbHelpers.exec(`
        CREATE INDEX IF NOT EXISTS idx_mail_messages_user_deliver
        ON mail_messages(user_id, deliver_at)
      `);
      await dbHelpers.exec(`
        CREATE INDEX IF NOT EXISTS idx_mail_messages_user_status
        ON mail_messages(user_id, status)
      `);
      await dbHelpers.exec(`
        CREATE INDEX IF NOT EXISTS idx_mail_campaigns_status_deliver
        ON mail_campaigns(status, deliver_at)
      `);
      await dbHelpers.exec(`
        CREATE INDEX IF NOT EXISTS idx_npc_spawns_zone
        ON npc_spawns(zone, is_active)
      `);
      await dbHelpers.exec(`
        CREATE INDEX IF NOT EXISTS idx_quest_objectives_quest
        ON quest_objectives(quest_id, order_index)
      `);
      await dbHelpers.exec(`
        CREATE INDEX IF NOT EXISTS idx_user_quests_user_state
        ON user_quests(user_id, state)
      `);
      await dbHelpers.exec(`
        CREATE INDEX IF NOT EXISTS idx_user_quest_progress_user_quest
        ON user_quest_objective_progress(user_quest_id)
      `);
      await dbHelpers.exec(`
        CREATE INDEX IF NOT EXISTS idx_quest_event_ledger_user_quest
        ON quest_event_ledger(user_id, quest_id)
      `);
    }

    // Migration: add name/description columns to card_layouts if missing (existing DBs)
    await migrateCardLayoutsNameDescription();
    await migrateGlobalVfxLayout();
    await migrateGlobalCardbaseField();

    // Migration: add level/experience columns to users if missing (existing DBs)
    await migrateUserLevelExp();
    
    // Migration: add character columns to users if missing (existing DBs)
    await migrateUserCharacterColumns();
    await migrateUserSkinColumns();
    await migrateUserProfileAvatarColumn();
    await migrateUserGoldColumn();
    await migrateUserWorldPositionColumns();
    await migrateMailSchema();
    await migrateDailyLoginSchema();
    await migrateChatAndFriendshipSchema();
    await migrateFriendshipsIdDefaultPostgres();
    await migratePostgresNumericSanity();
    await migrateMonsterEncountersMatchIdBigintPostgres();

    // Migration: add default_unlocked column to cards if missing (existing DBs)
    await migrateCardsDefaultUnlocked();

    // Migration: add visual_auras column to cards if missing (existing DBs)
    await migrateCardsVisualAuras();

    // Migration: add collection_id to cards if missing
    await migrateCardsCollectionId();

    // Migration: add card_image_url (full card art) to cards if missing
    await migrateCardsCardImageUrl();

    // Migration: stop serving legacy rendered images via image_url
    await migrateCardsRemoveRenderedImageUrls();

    // Migration: extend monster templates for dashboard UX
    await migrateMonsterTemplateFields();

    // Migration: world regions (named areas for Dark Souls-style region names)
    await migrateWorldRegions();

    // Migration: expand monster spawn patrol radius (120 → 600)
    await migrateMonsterSpawnRadius();

    // Ensure default collections exist
    await seedDefaultCollections();

    console.log('✅ Database tables initialized');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  }
}

async function migrateUserLevelExp(): Promise<void> {
  const columns = [
    'level INTEGER DEFAULT 1',
    'experience INTEGER DEFAULT 0'
  ];
  for (const col of columns) {
    try {
      if (usePostgres) {
        const colName = col.split(' ')[0];
        const colType = col.split(' ').slice(1).join(' ');
        await dbHelpers.exec(`ALTER TABLE users ADD COLUMN ${colName} ${colType}`);
      } else {
        await dbHelpers.exec(`ALTER TABLE users ADD COLUMN ${col}`);
      }
    } catch (e: any) {
      const msg = e?.message || String(e);
      if (!msg.includes('duplicate column') && !msg.includes('already exists')) {
        console.warn('Migration users level/exp column:', msg);
      }
    }
  }
}

async function migrateUserCharacterColumns(): Promise<void> {
  const columns = [
    "gender TEXT DEFAULT 'male'",
    "body_id TEXT DEFAULT 'clothes'",
    "head_id TEXT DEFAULT 'male_head1'",
    "character_completed INTEGER DEFAULT 0"
  ];
  for (const col of columns) {
    try {
      if (usePostgres) {
        const colName = col.split(' ')[0];
        const colType = col.split(' ').slice(1).join(' ');
        await dbHelpers.exec(`ALTER TABLE users ADD COLUMN ${colName} ${colType}`);
      } else {
        await dbHelpers.exec(`ALTER TABLE users ADD COLUMN ${col}`);
      }
    } catch (e: any) {
      const msg = e?.message || String(e);
      if (!msg.includes('duplicate column') && !msg.includes('already exists')) {
        console.warn('Migration users character column:', msg);
      }
    }
  }

  await dbHelpers.run(
    `UPDATE users
     SET gender = COALESCE(gender, 'male'),
         body_id = COALESCE(body_id, 'clothes'),
         head_id = COALESCE(head_id, 'male_head1'),
         character_completed = COALESCE(character_completed, 0)`
  );
}

async function migrateUserProfileAvatarColumn(): Promise<void> {
  try {
    if (usePostgres) {
      await dbHelpers.exec(`ALTER TABLE users ADD COLUMN profile_avatar_id VARCHAR(128)`);
    } else {
      await dbHelpers.exec(`ALTER TABLE users ADD COLUMN profile_avatar_id TEXT`);
    }
  } catch (e: any) {
    const msg = e?.message || String(e);
    if (!msg.includes('duplicate column') && !msg.includes('already exists')) {
      console.warn('Migration users profile_avatar_id column:', msg);
    }
  }
}

async function migrateUserGoldColumn(): Promise<void> {
  try {
    await dbHelpers.exec(`ALTER TABLE users ADD COLUMN gold INTEGER DEFAULT 0`);
  } catch (e: any) {
    const msg = e?.message || String(e);
    if (!msg.includes('duplicate column') && !msg.includes('already exists')) {
      console.warn('Migration users gold column:', msg);
    }
  }
  try {
    await dbHelpers.run(`UPDATE users SET gold = COALESCE(gold, 0)`);
  } catch (_e) {}
}

async function migrateUserWorldPositionColumns(): Promise<void> {
  // Server-authoritative MMO position persistence (Shadowland).
  const postgresCols = [
    'world_zone VARCHAR(64)',
    'world_x INTEGER',
    'world_y INTEGER',
    'world_updated_at TIMESTAMP'
  ];
  const sqliteCols = [
    'world_zone TEXT',
    'world_x INTEGER',
    'world_y INTEGER',
    'world_updated_at DATETIME'
  ];
  const columns = usePostgres ? postgresCols : sqliteCols;
  for (const col of columns) {
    try {
      if (usePostgres) {
        const colName = col.split(' ')[0];
        const colType = col.split(' ').slice(1).join(' ');
        await dbHelpers.exec(`ALTER TABLE users ADD COLUMN ${colName} ${colType}`);
      } else {
        await dbHelpers.exec(`ALTER TABLE users ADD COLUMN ${col}`);
      }
    } catch (e: any) {
      const msg = e?.message || String(e);
      if (!msg.includes('duplicate column') && !msg.includes('already exists')) {
        console.warn('Migration users world position column:', msg);
      }
    }
  }
}

async function migrateMailSchema(): Promise<void> {
  // For existing DBs: create tables if missing. Creating is safe and idempotent.
  // NOTE: We don't use ALTER TABLE here (more complex across PG/SQLite); we always create the tables.
  const tsType = usePostgres ? 'TIMESTAMP' : 'DATETIME';
  const pk = usePostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
  const textType = usePostgres ? 'TEXT' : 'TEXT';
  const intType = usePostgres ? 'INTEGER' : 'INTEGER';
  const varchar255 = usePostgres ? 'VARCHAR(255)' : 'TEXT';

  await dbHelpers.exec(`
    CREATE TABLE IF NOT EXISTS mail_campaigns (
      id ${pk},
      name ${varchar255} NOT NULL,
      subject ${textType} NOT NULL,
      body ${textType} NOT NULL,
      deliver_at ${tsType} NOT NULL,
      audience_json ${textType} NOT NULL,
      attachments_json ${textType} NOT NULL,
      status ${usePostgres ? 'VARCHAR(16)' : 'TEXT'} NOT NULL DEFAULT 'draft',
      created_by_admin_id ${intType} NOT NULL,
      created_at ${tsType} DEFAULT CURRENT_TIMESTAMP,
      sent_at ${tsType},
      FOREIGN KEY (created_by_admin_id) REFERENCES users(id)
    )
  `);
  await dbHelpers.exec(`
    CREATE TABLE IF NOT EXISTS mail_messages (
      id ${pk},
      user_id ${intType} NOT NULL,
      sender_admin_id ${intType},
      campaign_id ${intType},
      subject ${textType} NOT NULL,
      body ${textType} NOT NULL,
      status ${usePostgres ? 'VARCHAR(16)' : 'TEXT'} NOT NULL DEFAULT 'unread',
      deliver_at ${tsType} NOT NULL,
      delivered_at ${tsType},
      read_at ${tsType},
      created_at ${tsType} DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (sender_admin_id) REFERENCES users(id),
      FOREIGN KEY (campaign_id) REFERENCES mail_campaigns(id)
    )
  `);
  await dbHelpers.exec(`
    CREATE TABLE IF NOT EXISTS mail_attachments (
      id ${pk},
      mail_id ${intType} NOT NULL,
      type ${usePostgres ? 'VARCHAR(32)' : 'TEXT'} NOT NULL,
      payload_json ${textType} NOT NULL,
      created_at ${tsType} DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (mail_id) REFERENCES mail_messages(id)
    )
  `);
  await dbHelpers.exec(`
    CREATE TABLE IF NOT EXISTS mail_claims (
      id ${pk},
      mail_id ${intType} NOT NULL UNIQUE,
      user_id ${intType} NOT NULL,
      claimed_at ${tsType} DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (mail_id) REFERENCES mail_messages(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Indexes
  try {
    await dbHelpers.exec(`CREATE INDEX IF NOT EXISTS idx_mail_messages_user_deliver ON mail_messages(user_id, deliver_at)`);
  } catch (_e) {}
  try {
    await dbHelpers.exec(`CREATE INDEX IF NOT EXISTS idx_mail_messages_user_status ON mail_messages(user_id, status)`);
  } catch (_e) {}
  try {
    await dbHelpers.exec(`CREATE INDEX IF NOT EXISTS idx_mail_campaigns_status_deliver ON mail_campaigns(status, deliver_at)`);
  } catch (_e) {}
}

async function migrateDailyLoginSchema(): Promise<void> {
  const tsType = usePostgres ? 'TIMESTAMP' : 'DATETIME';
  const pk = usePostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
  const textType = 'TEXT';
  const intType = 'INTEGER';

  await dbHelpers.exec(`
    CREATE TABLE IF NOT EXISTS daily_login_calendar_configs (
      id ${pk},
      month_key ${usePostgres ? 'VARCHAR(7)' : 'TEXT'} NOT NULL,
      days_total ${intType} NOT NULL DEFAULT 20,
      rewards_json ${textType} NOT NULL,
      is_active ${intType} NOT NULL DEFAULT 1,
      created_at ${tsType} DEFAULT CURRENT_TIMESTAMP,
      updated_at ${tsType} DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(month_key)
    )
  `);

  await dbHelpers.exec(`
    CREATE TABLE IF NOT EXISTS user_daily_login_claims (
      id ${pk},
      user_id ${intType} NOT NULL,
      month_key ${usePostgres ? 'VARCHAR(7)' : 'TEXT'} NOT NULL,
      day_index ${intType} NOT NULL,
      claimed_at ${tsType} DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(user_id, month_key, day_index)
    )
  `);

  try {
    await dbHelpers.exec(
      `CREATE INDEX IF NOT EXISTS idx_user_daily_login_claims_user_month ON user_daily_login_claims(user_id, month_key)`
    );
  } catch (_e) {}
}

async function migrateUserSkinColumns(): Promise<void> {
  const columns = [
    'skin_body_id TEXT',
    'skin_head_id TEXT'
  ];
  for (const col of columns) {
    try {
      if (usePostgres) {
        const colName = col.split(' ')[0];
        const colType = col.split(' ').slice(1).join(' ');
        await dbHelpers.exec(`ALTER TABLE users ADD COLUMN ${colName} ${colType}`);
      } else {
        await dbHelpers.exec(`ALTER TABLE users ADD COLUMN ${col}`);
      }
    } catch (e: any) {
      const msg = e?.message || String(e);
      if (!msg.includes('duplicate column') && !msg.includes('already exists')) {
        console.warn('Migration users skin column:', msg);
      }
    }
  }
}

async function migrateChatAndFriendshipSchema(): Promise<void> {
  const chatColumns = [
    'recipient_user_id INTEGER',
    'recipient_username TEXT'
  ];
  for (const col of chatColumns) {
    try {
      await dbHelpers.exec(`ALTER TABLE chat_messages ADD COLUMN ${col}`);
    } catch (e: any) {
      const msg = e?.message || String(e);
      if (!msg.includes('duplicate column') && !msg.includes('already exists') && !msg.includes('no such table')) {
        console.warn('Migration chat_messages column:', msg);
      }
    }
  }

  // Bancos antigos / importados podem ter friendships sem timestamps usados pelo repositório.
  const friendshipTsMigrations = usePostgres
    ? [
        'ALTER TABLE friendships ADD COLUMN requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
        'ALTER TABLE friendships ADD COLUMN accepted_at TIMESTAMP'
      ]
    : [
        'ALTER TABLE friendships ADD COLUMN requested_at DATETIME DEFAULT CURRENT_TIMESTAMP',
        'ALTER TABLE friendships ADD COLUMN accepted_at DATETIME'
      ];
  for (const sql of friendshipTsMigrations) {
    try {
      await dbHelpers.exec(sql);
    } catch (e: any) {
      const msg = e?.message || String(e);
      if (
        !msg.includes('duplicate column') &&
        !msg.includes('already exists') &&
        !msg.includes('no such table')
      ) {
        console.warn('Migration friendships timestamp column:', msg);
      }
    }
  }

  if (usePostgres) {
    await dbHelpers.exec(`
      CREATE OR REPLACE FUNCTION cleanup_old_chat_messages()
      RETURNS void AS $$
      BEGIN
        DELETE FROM chat_messages
        WHERE id IN (
          SELECT id FROM (
            SELECT id,
                   ROW_NUMBER() OVER (PARTITION BY channel ORDER BY timestamp DESC, id DESC) AS rn
            FROM chat_messages
          ) ranked
          WHERE ranked.rn > 100
        );
      END;
      $$ LANGUAGE plpgsql;
    `).catch((e: any) => {
      console.warn('Migration cleanup_old_chat_messages function:', e?.message || String(e));
    });
  }
}

/** Bancos importados/legados sem DEFAULT em friendships.id quebram INSERT sem id explícito. */
async function migrateFriendshipsIdDefaultPostgres(): Promise<void> {
  if (!usePostgres) return;
  try {
    await dbHelpers.exec(`
DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'friendships'
  ) THEN
    CREATE SEQUENCE IF NOT EXISTS friendships_id_seq;
    PERFORM setval(
      'friendships_id_seq',
      GREATEST(COALESCE((SELECT MAX(id) FROM friendships), 0), 1)
    );
    ALTER TABLE friendships ALTER COLUMN id SET DEFAULT nextval('friendships_id_seq');
    PERFORM setval(
      'friendships_id_seq',
      (SELECT COALESCE(MAX(id), 1) FROM friendships)
    );
  END IF;
END;
$migration$;
    `);
  } catch (e: any) {
    console.warn('Migration friendships id default:', e?.message || String(e));
  }
}

/** Corrige valores que estouram bigint / INTEGER e quebram queries (chat, EXP, recompensas). */
async function migratePostgresNumericSanity(): Promise<void> {
  if (!usePostgres) return;
  try {
    await dbHelpers.exec(`
DO $sanity$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'users' AND c.column_name = 'experience'
  ) THEN
    UPDATE users SET experience = 2147483647
    WHERE experience IS NOT NULL AND experience::bigint > 2147483647;
    UPDATE users SET experience = 0 WHERE experience IS NOT NULL AND experience < 0;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'quest_rewards' AND c.column_name = 'amount'
  ) THEN
    UPDATE quest_rewards SET amount = 50000 WHERE amount IS NOT NULL AND amount > 50000;
    UPDATE quest_rewards SET amount = 0 WHERE amount IS NOT NULL AND amount < 0;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'chat_messages'
      AND c.column_name = 'timestamp' AND c.data_type = 'bigint'
  ) THEN
    UPDATE chat_messages SET timestamp = 9223372036854775807
    WHERE timestamp > 9223372036854775807;
    UPDATE chat_messages SET timestamp = 0 WHERE timestamp < 0;
  END IF;
END;
$sanity$;
    `);
  } catch (e: any) {
    console.warn('Migration PG numeric sanity:', e?.message || String(e));
  }
}

/** Match IDs do cliente podem exceder INTEGER (Godot usa floats grandes); BIGINT evita overflow em inserts. */
async function migrateMonsterEncountersMatchIdBigintPostgres(): Promise<void> {
  if (!usePostgres) return;
  try {
    await dbHelpers.exec(`
DO $mm$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'monster_encounters'
      AND c.column_name = 'match_id' AND c.data_type = 'integer'
  ) THEN
    ALTER TABLE monster_encounters
      ALTER COLUMN match_id TYPE BIGINT USING match_id::bigint;
  END IF;
END;
$mm$;
    `);
  } catch (e: any) {
    console.warn('Migration monster_encounters match_id bigint:', e?.message || String(e));
  }
}

async function migrateCardsDefaultUnlocked(): Promise<void> {
  try {
    if (usePostgres) {
      await dbHelpers.exec(`ALTER TABLE cards ADD COLUMN default_unlocked INTEGER DEFAULT 1`);
    } else {
      await dbHelpers.exec(`ALTER TABLE cards ADD COLUMN default_unlocked INTEGER DEFAULT 1`);
    }
  } catch (e: any) {
    const msg = e?.message || String(e);
    if (!msg.includes('duplicate column') && !msg.includes('already exists')) {
      console.warn('Migration cards default_unlocked column:', msg);
    }
  }
}

async function migrateCardsVisualAuras(): Promise<void> {
  try {
    await dbHelpers.exec(`ALTER TABLE cards ADD COLUMN visual_auras TEXT`);
  } catch (e: any) {
    const msg = e?.message || String(e);
    if (!msg.includes('duplicate column') && !msg.includes('already exists')) {
      console.warn('Migration cards visual_auras column:', msg);
    }
  }
}

async function migrateCardsCollectionId(): Promise<void> {
  try {
    await dbHelpers.exec(`ALTER TABLE cards ADD COLUMN collection_id TEXT`);
  } catch (e: any) {
    const msg = e?.message || String(e);
    if (!msg.includes('duplicate column') && !msg.includes('already exists')) {
      console.warn('Migration cards collection_id column:', msg);
    }
  }
}

async function migrateCardsCardImageUrl(): Promise<void> {
  try {
    if (usePostgres) {
      await dbHelpers.exec(`ALTER TABLE cards ADD COLUMN card_image_url TEXT`);
    } else {
      await dbHelpers.exec(`ALTER TABLE cards ADD COLUMN card_image_url TEXT`);
    }
  } catch (e: any) {
    const msg = e?.message || String(e);
    if (!msg.includes('duplicate column') && !msg.includes('already exists')) {
      console.warn('Migration cards card_image_url column:', msg);
    }
  }
}

async function migrateCardsRemoveRenderedImageUrls(): Promise<void> {
  // image_url deve apontar para artwork cru. Limpa imagens antigas "rendered" que embutem moldura/texto.
  const pattern = '%_rendered.%';
  try {
    await dbHelpers.run(
      `UPDATE cards
       SET image_url = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE image_url IS NOT NULL AND image_url LIKE ?`,
      [pattern]
    );
  } catch (e: any) {
    if (usePostgres) {
      try {
        await dbHelpers.run(
          `UPDATE cards
           SET image_url = NULL, updated_at = CURRENT_TIMESTAMP
           WHERE image_url IS NOT NULL AND image_url LIKE $1`,
          [pattern]
        );
        return;
      } catch (e2: any) {
        const msg2 = e2?.message || String(e2);
        console.warn('Migration cards remove rendered image_url:', msg2);
        return;
      }
    }
    const msg = e?.message || String(e);
    console.warn('Migration cards remove rendered image_url:', msg);
  }
}

async function migrateMonsterTemplateFields(): Promise<void> {
  const columns = [
    'visual TEXT',
    'collection_id TEXT',
    "deck_mode TEXT DEFAULT 'hybrid'",
    'manual_deck_cards TEXT'
  ];
  for (const col of columns) {
    try {
      if (usePostgres) {
        const colName = col.split(' ')[0];
        const colType = col.split(' ').slice(1).join(' ');
        await dbHelpers.exec(`ALTER TABLE monster_templates ADD COLUMN ${colName} ${colType}`);
      } else {
        await dbHelpers.exec(`ALTER TABLE monster_templates ADD COLUMN ${col}`);
      }
    } catch (e: any) {
      const msg = e?.message || String(e);
      if (!msg.includes('duplicate column') && !msg.includes('already exists')) {
        console.warn('Migration monster_templates column:', msg);
      }
    }
  }
}

async function seedDefaultCollections(): Promise<void> {
  await dbHelpers.run(
    `INSERT INTO card_collections (id, name, description, is_active)
     VALUES (?, ?, ?, 1)
     ON CONFLICT (id) DO NOTHING`,
    ['standard', 'Standard', 'Colecao base inicial']
  ).catch(async () => {
    // SQLite fallback
    const exists = await dbHelpers.query<{ id: string }>(
      'SELECT id FROM card_collections WHERE id = ?',
      ['standard']
    );
    if (!exists) {
      await dbHelpers.run(
        'INSERT INTO card_collections (id, name, description, is_active) VALUES (?, ?, ?, 1)',
        ['standard', 'Standard', 'Colecao base inicial']
      );
    }
  });

  await dbHelpers.run(
    `INSERT INTO card_collections (id, name, description, is_active)
     VALUES (?, ?, ?, 1)
     ON CONFLICT (id) DO NOTHING`,
    ['shadowland_creatures', 'Shadowland Creatures', 'Colecao sombria de criaturas warlock, demonios e reliquias malignas.']
  ).catch(async () => {
    const exists = await dbHelpers.query<{ id: string }>(
      'SELECT id FROM card_collections WHERE id = ?',
      ['shadowland_creatures']
    );
    if (!exists) {
      await dbHelpers.run(
        'INSERT INTO card_collections (id, name, description, is_active) VALUES (?, ?, ?, 1)',
        ['shadowland_creatures', 'Shadowland Creatures', 'Colecao sombria de criaturas warlock, demonios e reliquias malignas.']
      );
    }
  });

  // Legacy cleanup: Monsters 1 collection is deprecated and should not appear in filters.
  await dbHelpers.run(
    `UPDATE card_collections
     SET is_active = 0, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    ['monsters_1']
  );

  await dbHelpers.run(
    `UPDATE cards
     SET collection_id = COALESCE(collection_id, 'standard')
     WHERE collection_id IS NULL`
  );
}

async function migrateCardLayoutsNameDescription(): Promise<void> {
  const columns = [
    'name_offset_left REAL', 'name_offset_top REAL', 'name_width REAL', 'name_height REAL', 'name_font_size REAL',
    'description_offset_left REAL', 'description_offset_top REAL', 'description_width REAL', 'description_height REAL', 'description_font_size REAL'
  ];
  for (const col of columns) {
    try {
      if (usePostgres) {
        const colName = col.split(' ')[0];
        await dbHelpers.exec(`ALTER TABLE card_layouts ADD COLUMN ${colName} ${col.split(' ').slice(1).join(' ')}`);
      } else {
        await dbHelpers.exec(`ALTER TABLE card_layouts ADD COLUMN ${col}`);
      }
    } catch (e: any) {
      const msg = e?.message || String(e);
      if (!msg.includes('duplicate column') && !msg.includes('already exists')) {
        console.warn('Migration card_layouts column:', msg);
      }
    }
  }
}

async function migrateWorldRegions(): Promise<void> {
  await dbHelpers.exec(`
    CREATE TABLE IF NOT EXISTS world_regions (
      id          ${usePostgres ? 'SERIAL' : 'INTEGER'} PRIMARY KEY,
      name        VARCHAR(128) NOT NULL,
      zone        VARCHAR(64)  NOT NULL DEFAULT 'shadowland',
      center_x    REAL         NOT NULL DEFAULT 0,
      center_y    REAL         NOT NULL DEFAULT 0,
      radius      REAL         NOT NULL DEFAULT 800,
      icon_type   VARCHAR(32)  NOT NULL DEFAULT 'location',
      is_active   ${usePostgres ? 'BOOLEAN' : 'INTEGER'} NOT NULL DEFAULT ${usePostgres ? 'true' : '1'},
      created_by  INTEGER,
      created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
      updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function migrateGlobalVfxLayout(): Promise<void> {
  await dbHelpers.exec(`
    CREATE TABLE IF NOT EXISTS card_vfx_layout_global (
      id INTEGER PRIMARY KEY,
      cost_offset_left REAL,
      cost_offset_top REAL,
      attack_offset_left REAL,
      attack_offset_top REAL,
      defense_offset_left REAL,
      defense_offset_top REAL,
      name_offset_left REAL,
      name_offset_top REAL,
      name_width REAL,
      name_height REAL,
      name_font_size REAL,
      description_offset_left REAL,
      description_offset_top REAL,
      description_width REAL,
      description_height REAL,
      description_font_size REAL,
      cardbase_image_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await dbHelpers.run(
    `INSERT INTO card_vfx_layout_global (
      id, cost_offset_left, cost_offset_top, attack_offset_left, attack_offset_top,
      defense_offset_left, defense_offset_top, name_offset_left, name_offset_top,
      name_width, name_height, name_font_size, cardbase_image_url,
      description_offset_left, description_offset_top, description_width, description_height, description_font_size
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (id) DO NOTHING`,
    [1, -8, -30, 20, -20, -40, -20, 10, 30, 160, 20, 14, null, 10, 220, 160, 30, 10]
  ).catch(async () => {
    const existing = await dbHelpers.query<{ id: number }>(
      'SELECT id FROM card_vfx_layout_global WHERE id = ?',
      [1]
    );
    if (!existing) {
      await dbHelpers.run(
        `INSERT INTO card_vfx_layout_global (
          id, cost_offset_left, cost_offset_top, attack_offset_left, attack_offset_top,
          defense_offset_left, defense_offset_top, name_offset_left, name_offset_top,
          name_width, name_height, name_font_size, cardbase_image_url,
          description_offset_left, description_offset_top, description_width, description_height, description_font_size
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [1, -8, -30, 20, -20, -40, -20, 10, 30, 160, 20, 14, null, 10, 220, 160, 30, 10]
      );
    }
  });
}

async function migrateGlobalCardbaseField(): Promise<void> {
  try {
    await dbHelpers.exec(`ALTER TABLE card_vfx_layout_global ADD COLUMN cardbase_image_url TEXT`);
  } catch (e: any) {
    const msg = e?.message || String(e);
    if (!msg.includes('duplicate column') && !msg.includes('already exists')) {
      console.warn('Migration global cardbase field:', msg);
    }
  }
}

// Seed initial data
async function seedDatabase(): Promise<void> {
  const count = await dbHelpers.query<{ count: number }>('SELECT COUNT(*) as count FROM users');

  if (count && count.count === 0) {
    // Create default admin user
    const bcrypt = require('bcrypt');
    const adminPassword = await bcrypt.hash(ENV.ADMIN_PASSWORD, 10);

    await dbHelpers.run(
      `INSERT INTO users (username, password_hash, email, is_admin) VALUES (?, ?, ?, 1)`,
      [ENV.ADMIN_USERNAME, adminPassword, 'admin@kardum.com']
    );

    console.log('✅ Admin user created');
  }
}

async function migrateMonsterSpawnRadius(): Promise<void> {
  try {
    await dbHelpers.run(
      `UPDATE monster_spawns SET move_radius = 600 WHERE move_radius <= 120`
    );
  } catch (e: any) {
    console.warn('migrateMonsterSpawnRadius:', e?.message || e);
  }
}

// Initialize database
let dbInitialized = false;
let dbInitPromise: Promise<void> | null = null;
export async function initializeDatabase(): Promise<void> {
  if (dbInitialized) return;
  if (dbInitPromise) {
    await dbInitPromise;
    return;
  }

  dbInitPromise = (async () => {
    try {
      console.log('🔄 Initializing database...');
      await withPostgresInitLock(async () => {
        if (dbInitialized) return;
        await initDatabase();
        await seedDatabase();
        dbInitialized = true;
      });
      console.log('✅ Database ready');
    } catch (error) {
      console.error('❌ Database initialization error:', error);
      throw error;
    } finally {
      dbInitPromise = null;
    }
  })();

  await dbInitPromise;
}

export { db, dbType, usePostgres };
export default dbHelpers;
