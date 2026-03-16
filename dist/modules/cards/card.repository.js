"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CardRepository = void 0;
const database_1 = __importDefault(require("../../config/database"));
class CardRepository {
    getDefaultGlobalVfxLayout() {
        return {
            cost: { offsetLeft: -8, offsetTop: -30 },
            attack: { offsetLeft: 20, offsetTop: -20 },
            defense: { offsetLeft: -40, offsetTop: -20 },
            name: { offsetLeft: 10, offsetTop: 30, width: 160, height: 20, fontSize: 14 },
            description: { offsetLeft: 10, offsetTop: 220, width: 160, height: 30, fontSize: 10 },
            cardbaseImageUrl: null
        };
    }
    parseGlobalVfxLayout(row) {
        const defaults = this.getDefaultGlobalVfxLayout();
        if (!row)
            return defaults;
        return {
            cost: {
                offsetLeft: row.cost_offset_left ?? defaults.cost.offsetLeft,
                offsetTop: row.cost_offset_top ?? defaults.cost.offsetTop
            },
            attack: {
                offsetLeft: row.attack_offset_left ?? defaults.attack.offsetLeft,
                offsetTop: row.attack_offset_top ?? defaults.attack.offsetTop
            },
            defense: {
                offsetLeft: row.defense_offset_left ?? defaults.defense.offsetLeft,
                offsetTop: row.defense_offset_top ?? defaults.defense.offsetTop
            },
            name: {
                offsetLeft: row.name_offset_left ?? defaults.name.offsetLeft,
                offsetTop: row.name_offset_top ?? defaults.name.offsetTop,
                width: row.name_width ?? defaults.name.width,
                height: row.name_height ?? defaults.name.height,
                fontSize: row.name_font_size ?? defaults.name.fontSize
            },
            description: {
                offsetLeft: row.description_offset_left ?? defaults.description.offsetLeft,
                offsetTop: row.description_offset_top ?? defaults.description.offsetTop,
                width: row.description_width ?? defaults.description.width,
                height: row.description_height ?? defaults.description.height,
                fontSize: row.description_font_size ?? defaults.description.fontSize
            },
            cardbaseImageUrl: row.cardbase_image_url ?? defaults.cardbaseImageUrl
        };
    }
    async getAllCards(filters = {}) {
        const where = ['is_active = 1'];
        const params = [];
        if (filters.type) {
            where.push('type = ?');
            params.push(filters.type);
        }
        if (filters.race) {
            where.push('race = ?');
            params.push(filters.race);
        }
        if (filters.collection_id) {
            where.push('collection_id = ?');
            params.push(filters.collection_id);
        }
        if (filters.default_unlocked === 'true' || filters.default_unlocked === 'false') {
            where.push('default_unlocked = ?');
            params.push(filters.default_unlocked === 'true' ? 1 : 0);
        }
        else if (filters.user_id && Number(filters.user_id) > 0) {
            where.push('(default_unlocked = 1 OR id IN (SELECT card_id FROM user_card_unlocks WHERE user_id = ?))');
            params.push(Number(filters.user_id));
        }
        if (filters.search) {
            where.push('(LOWER(name) LIKE ? OR LOWER(id) LIKE ?)');
            const q = `%${String(filters.search).toLowerCase()}%`;
            params.push(q, q);
        }
        const cards = await database_1.default.queryAll(`SELECT * FROM cards WHERE ${where.join(' AND ')} ORDER BY name ASC`, params);
        return cards.map(this.parseCard);
    }
    async getCardById(id) {
        const card = await database_1.default.query('SELECT * FROM cards WHERE id = ?', [id]);
        return card ? this.parseCard(card) : null;
    }
    async getUnlockedCardIdsForUser(userId) {
        const rows = await database_1.default.queryAll('SELECT card_id FROM user_card_unlocks WHERE user_id = ?', [userId]);
        return rows.map((row) => String(row.card_id));
    }
    async unlockCardForUser(userId, cardId, source = 'monster_drop') {
        const existing = await database_1.default.query('SELECT id FROM user_card_unlocks WHERE user_id = ? AND card_id = ?', [userId, cardId]);
        if (existing) {
            return false;
        }
        await database_1.default.run('INSERT INTO user_card_unlocks (user_id, card_id, source) VALUES (?, ?, ?)', [userId, cardId, source]);
        return true;
    }
    async getLockedCardsByCollectionForUser(collectionId, userId) {
        const rows = await database_1.default.queryAll(`SELECT *
       FROM cards
       WHERE is_active = 1
         AND collection_id = ?
         AND default_unlocked = 0
         AND id NOT IN (
           SELECT card_id FROM user_card_unlocks WHERE user_id = ?
         )
       ORDER BY RANDOM()`, [collectionId, userId]);
        return rows.map(this.parseCard);
    }
    async areCardsAvailableForUser(userId, cardIds) {
        if (!cardIds || cardIds.length === 0)
            return true;
        const placeholders = cardIds.map(() => '?').join(',');
        const rows = await database_1.default.queryAll(`SELECT id
       FROM cards
       WHERE id IN (${placeholders})
         AND is_active = 1
         AND (
           default_unlocked = 1
           OR id IN (SELECT card_id FROM user_card_unlocks WHERE user_id = ?)
         )`, [...cardIds, userId]);
        return rows.length === cardIds.length;
    }
    async getCardsByType(type) {
        const cards = await database_1.default.queryAll('SELECT * FROM cards WHERE type = ? AND is_active = 1', [type]);
        return cards.map(this.parseCard);
    }
    async getCardsByRace(race) {
        const cards = await database_1.default.queryAll('SELECT * FROM cards WHERE race = ? AND is_active = 1', [race]);
        return cards.map(this.parseCard);
    }
    async createCard(card) {
        await database_1.default.run(`INSERT INTO cards (id, name, type, race, class, cost, attack, defense, abilities, text, rarity, image_url, effects, hero_power_text, hero_power_cost, hero_power_effect, passive_effect, default_unlocked, visual_auras, collection_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            card.id,
            card.name,
            card.type,
            card.race || null,
            card.class || null,
            card.cost,
            card.attack || null,
            card.defense || null,
            card.abilities ? JSON.stringify(card.abilities) : null,
            card.text,
            card.rarity,
            card.image_url || null,
            this.serializeEffects(card),
            card.hero_power_text || null,
            card.hero_power_cost ?? null,
            card.hero_power_effect ? JSON.stringify(card.hero_power_effect) : null,
            card.passive_effect ? JSON.stringify(card.passive_effect) : null,
            card.default_unlocked !== false ? 1 : 0,
            card.visual_auras && card.visual_auras.length > 0 ? JSON.stringify(card.visual_auras) : null,
            card.collection_id || 'standard'
        ]);
    }
    async updateCard(id, card) {
        await database_1.default.run(`UPDATE cards 
       SET name = ?, type = ?, race = ?, class = ?, 
           cost = ?, attack = ?, defense = ?, 
           abilities = ?, text = ?, rarity = ?, 
           image_url = ?, effects = ?, 
           hero_power_text = ?, hero_power_cost = ?, hero_power_effect = ?, passive_effect = ?,
           default_unlocked = ?, visual_auras = ?, collection_id = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`, [
            card.name,
            card.type,
            card.race || null,
            card.class || null,
            card.cost,
            card.attack || null,
            card.defense || null,
            card.abilities ? JSON.stringify(card.abilities) : null,
            card.text,
            card.rarity,
            card.image_url || null,
            this.serializeEffects(card),
            card.hero_power_text ?? null,
            card.hero_power_cost ?? null,
            card.hero_power_effect ? JSON.stringify(card.hero_power_effect) : null,
            card.passive_effect ? JSON.stringify(card.passive_effect) : null,
            card.default_unlocked !== false ? 1 : 0,
            card.visual_auras && card.visual_auras.length > 0 ? JSON.stringify(card.visual_auras) : null,
            card.collection_id || 'standard',
            id
        ]);
    }
    serializeEffects(card) {
        if (card.effects && card.effects.length > 0) {
            return JSON.stringify(card.effects);
        }
        if (card.effect) {
            return JSON.stringify([card.effect]);
        }
        return null;
    }
    async deleteCard(id) {
        await database_1.default.run('UPDATE cards SET is_active = 0 WHERE id = ?', [id]);
    }
    async getCardLayout(cardId) {
        const layout = await database_1.default.query('SELECT * FROM card_layouts WHERE card_id = ?', [cardId]);
        return layout || null;
    }
    async getAllCardArtworkLayouts() {
        const rows = await database_1.default.queryAll(`SELECT card_id, artwork_offset_left, artwork_offset_top, artwork_offset_right, artwork_offset_bottom,
              artwork_expand_mode, artwork_stretch_mode
       FROM card_layouts`);
        return rows.map((row) => ({
            cardId: row.card_id,
            artwork: {
                offsetLeft: row.artwork_offset_left ?? null,
                offsetTop: row.artwork_offset_top ?? null,
                offsetRight: row.artwork_offset_right ?? null,
                offsetBottom: row.artwork_offset_bottom ?? null,
                expandMode: row.artwork_expand_mode ?? null,
                stretchMode: row.artwork_stretch_mode ?? null
            }
        }));
    }
    async getGlobalVfxLayout() {
        const row = await database_1.default.query('SELECT * FROM card_vfx_layout_global WHERE id = ?', [1]);
        return this.parseGlobalVfxLayout(row);
    }
    async saveGlobalVfxLayout(layout) {
        const parsed = this.parseGlobalVfxLayout({
            cost_offset_left: layout?.cost?.offsetLeft,
            cost_offset_top: layout?.cost?.offsetTop,
            attack_offset_left: layout?.attack?.offsetLeft,
            attack_offset_top: layout?.attack?.offsetTop,
            defense_offset_left: layout?.defense?.offsetLeft,
            defense_offset_top: layout?.defense?.offsetTop,
            name_offset_left: layout?.name?.offsetLeft,
            name_offset_top: layout?.name?.offsetTop,
            name_width: layout?.name?.width,
            name_height: layout?.name?.height,
            name_font_size: layout?.name?.fontSize,
            description_offset_left: layout?.description?.offsetLeft,
            description_offset_top: layout?.description?.offsetTop,
            description_width: layout?.description?.width,
            description_height: layout?.description?.height,
            description_font_size: layout?.description?.fontSize,
            cardbase_image_url: layout?.cardbaseImageUrl ?? null
        });
        await database_1.default.run(`INSERT INTO card_vfx_layout_global (
        id, cost_offset_left, cost_offset_top, attack_offset_left, attack_offset_top,
        defense_offset_left, defense_offset_top, name_offset_left, name_offset_top,
        name_width, name_height, name_font_size, cardbase_image_url,
        description_offset_left, description_offset_top, description_width, description_height, description_font_size,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        cost_offset_left = excluded.cost_offset_left,
        cost_offset_top = excluded.cost_offset_top,
        attack_offset_left = excluded.attack_offset_left,
        attack_offset_top = excluded.attack_offset_top,
        defense_offset_left = excluded.defense_offset_left,
        defense_offset_top = excluded.defense_offset_top,
        name_offset_left = excluded.name_offset_left,
        name_offset_top = excluded.name_offset_top,
        name_width = excluded.name_width,
        name_height = excluded.name_height,
        name_font_size = excluded.name_font_size,
        cardbase_image_url = excluded.cardbase_image_url,
        description_offset_left = excluded.description_offset_left,
        description_offset_top = excluded.description_offset_top,
        description_width = excluded.description_width,
        description_height = excluded.description_height,
        description_font_size = excluded.description_font_size,
        updated_at = CURRENT_TIMESTAMP`, [
            1,
            parsed.cost.offsetLeft,
            parsed.cost.offsetTop,
            parsed.attack.offsetLeft,
            parsed.attack.offsetTop,
            parsed.defense.offsetLeft,
            parsed.defense.offsetTop,
            parsed.name.offsetLeft,
            parsed.name.offsetTop,
            parsed.name.width,
            parsed.name.height,
            parsed.name.fontSize,
            parsed.cardbaseImageUrl,
            parsed.description.offsetLeft,
            parsed.description.offsetTop,
            parsed.description.width,
            parsed.description.height,
            parsed.description.fontSize
        ]);
    }
    async saveCardLayout(cardId, layout) {
        const existing = await this.getCardLayout(cardId);
        const name = layout.name;
        const description = layout.description;
        if (existing) {
            await database_1.default.run(`UPDATE card_layouts 
         SET artwork_offset_left = ?, artwork_offset_top = ?, artwork_offset_right = ?, artwork_offset_bottom = ?,
             artwork_expand_mode = ?, artwork_stretch_mode = ?,
             cost_offset_left = ?, cost_offset_top = ?,
             attack_offset_left = ?, attack_offset_top = ?,
             defense_offset_left = ?, defense_offset_top = ?,
             name_offset_left = ?, name_offset_top = ?, name_width = ?, name_height = ?, name_font_size = ?,
             description_offset_left = ?, description_offset_top = ?, description_width = ?, description_height = ?, description_font_size = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE card_id = ?`, [
                layout.artwork?.offsetLeft ?? null,
                layout.artwork?.offsetTop ?? null,
                layout.artwork?.offsetRight ?? null,
                layout.artwork?.offsetBottom ?? null,
                layout.artwork?.expandMode ?? 1,
                layout.artwork?.stretchMode ?? 5,
                layout.cost?.offsetLeft ?? null,
                layout.cost?.offsetTop ?? null,
                layout.attack?.offsetLeft ?? null,
                layout.attack?.offsetTop ?? null,
                layout.defense?.offsetLeft ?? null,
                layout.defense?.offsetTop ?? null,
                name?.offsetLeft ?? null,
                name?.offsetTop ?? null,
                name?.width ?? null,
                name?.height ?? null,
                name?.fontSize ?? null,
                description?.offsetLeft ?? null,
                description?.offsetTop ?? null,
                description?.width ?? null,
                description?.height ?? null,
                description?.fontSize ?? null,
                cardId
            ]);
        }
        else {
            await database_1.default.run(`INSERT INTO card_layouts 
         (card_id, artwork_offset_left, artwork_offset_top, artwork_offset_right, artwork_offset_bottom,
          artwork_expand_mode, artwork_stretch_mode,
          cost_offset_left, cost_offset_top,
          attack_offset_left, attack_offset_top,
          defense_offset_left, defense_offset_top,
          name_offset_left, name_offset_top, name_width, name_height, name_font_size,
          description_offset_left, description_offset_top, description_width, description_height, description_font_size)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                cardId,
                layout.artwork?.offsetLeft ?? null,
                layout.artwork?.offsetTop ?? null,
                layout.artwork?.offsetRight ?? null,
                layout.artwork?.offsetBottom ?? null,
                layout.artwork?.expandMode ?? 1,
                layout.artwork?.stretchMode ?? 5,
                layout.cost?.offsetLeft ?? null,
                layout.cost?.offsetTop ?? null,
                layout.attack?.offsetLeft ?? null,
                layout.attack?.offsetTop ?? null,
                layout.defense?.offsetLeft ?? null,
                layout.defense?.offsetTop ?? null,
                name?.offsetLeft ?? null,
                name?.offsetTop ?? null,
                name?.width ?? null,
                name?.height ?? null,
                name?.fontSize ?? null,
                description?.offsetLeft ?? null,
                description?.offsetTop ?? null,
                description?.width ?? null,
                description?.height ?? null,
                description?.fontSize ?? null
            ]);
        }
    }
    async syncAllCards() {
        const allCards = await database_1.default.queryAll('SELECT * FROM cards');
        let synced = 0;
        const errors = [];
        for (const dbCard of allCards) {
            try {
                const card = this.parseCard(dbCard);
                const effectsJson = card.effects && card.effects.length > 0
                    ? JSON.stringify(card.effects) : null;
                await database_1.default.run('UPDATE cards SET effects = ? WHERE id = ?', [effectsJson, card.id]);
                synced++;
            }
            catch (err) {
                errors.push(`${dbCard.id}: ${err.message}`);
            }
        }
        return { synced, errors };
    }
    async getCardsByDeck(deckId) {
        const deck = await database_1.default.query('SELECT cards FROM decks WHERE id = ?', [deckId]);
        if (!deck || !deck.cards) {
            return [];
        }
        const cardIds = JSON.parse(deck.cards);
        if (cardIds.length === 0) {
            return [];
        }
        const placeholders = cardIds.map(() => '?').join(',');
        const cards = await database_1.default.queryAll(`SELECT * FROM cards WHERE id IN (${placeholders}) AND is_active = 1`, cardIds);
        return cards.map(this.parseCard);
    }
    parseCard(dbCard) {
        let effects;
        if (dbCard.effects) {
            const parsed = JSON.parse(dbCard.effects);
            if (Array.isArray(parsed)) {
                effects = parsed;
            }
            else if (parsed && typeof parsed === 'object') {
                effects = [parsed];
            }
        }
        return {
            id: dbCard.id,
            name: dbCard.name,
            type: dbCard.type,
            race: dbCard.race,
            class: dbCard.class,
            cost: dbCard.cost,
            attack: dbCard.attack,
            defense: dbCard.defense,
            abilities: dbCard.abilities ? JSON.parse(dbCard.abilities) : [],
            text: dbCard.text,
            rarity: dbCard.rarity,
            image_url: dbCard.image_url,
            visual_auras: dbCard.visual_auras ? JSON.parse(dbCard.visual_auras) : [],
            collection_id: dbCard.collection_id ?? 'standard',
            effects: effects,
            effect: effects && effects.length > 0 ? effects[0] : undefined,
            hero_power_text: dbCard.hero_power_text ?? undefined,
            hero_power_cost: dbCard.hero_power_cost != null ? dbCard.hero_power_cost : undefined,
            hero_power_effect: dbCard.hero_power_effect ? JSON.parse(dbCard.hero_power_effect) : undefined,
            passive_effect: dbCard.passive_effect ? JSON.parse(dbCard.passive_effect) : undefined,
            default_unlocked: dbCard.default_unlocked === 1 || dbCard.default_unlocked === true,
            is_active: dbCard.is_active === 1,
            created_at: dbCard.created_at,
            updated_at: dbCard.updated_at
        };
    }
}
exports.CardRepository = CardRepository;
exports.default = new CardRepository();
//# sourceMappingURL=card.repository.js.map