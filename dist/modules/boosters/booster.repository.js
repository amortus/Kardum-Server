"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BoosterRepository = void 0;
const database_1 = __importDefault(require("../../config/database"));
class BoosterRepository {
    async createBooster(booster) {
        await database_1.default.run(`INSERT INTO boosters (id, name, description, card_collection, rarity_weights, cards_per_pack, price, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
            booster.id,
            booster.name,
            booster.description || null,
            JSON.stringify(booster.card_collection),
            JSON.stringify(booster.rarity_weights),
            booster.cards_per_pack,
            booster.price,
            booster.is_active ? 1 : 0
        ]);
    }
    async getAllBoosters() {
        const boosters = await database_1.default.queryAll('SELECT * FROM boosters ORDER BY created_at DESC');
        return boosters.map(this.parseBooster);
    }
    async getBoosterById(id) {
        const booster = await database_1.default.query('SELECT * FROM boosters WHERE id = ?', [id]);
        return booster ? this.parseBooster(booster) : null;
    }
    async updateBooster(id, booster) {
        const updates = [];
        const values = [];
        if (booster.name !== undefined) {
            updates.push('name = ?');
            values.push(booster.name);
        }
        if (booster.description !== undefined) {
            updates.push('description = ?');
            values.push(booster.description || null);
        }
        if (booster.card_collection !== undefined) {
            updates.push('card_collection = ?');
            values.push(JSON.stringify(booster.card_collection));
        }
        if (booster.rarity_weights !== undefined) {
            updates.push('rarity_weights = ?');
            values.push(JSON.stringify(booster.rarity_weights));
        }
        if (booster.cards_per_pack !== undefined) {
            updates.push('cards_per_pack = ?');
            values.push(booster.cards_per_pack);
        }
        if (booster.price !== undefined) {
            updates.push('price = ?');
            values.push(booster.price);
        }
        if (booster.is_active !== undefined) {
            updates.push('is_active = ?');
            values.push(booster.is_active ? 1 : 0);
        }
        if (updates.length === 0) {
            return;
        }
        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);
        await database_1.default.run(`UPDATE boosters SET ${updates.join(', ')} WHERE id = ?`, values);
    }
    async deleteBooster(id) {
        await database_1.default.run('UPDATE boosters SET is_active = 0 WHERE id = ?', [id]);
    }
    parseBooster(dbBooster) {
        return {
            id: dbBooster.id,
            name: dbBooster.name,
            description: dbBooster.description,
            card_collection: dbBooster.card_collection ? JSON.parse(dbBooster.card_collection) : [],
            rarity_weights: dbBooster.rarity_weights ? JSON.parse(dbBooster.rarity_weights) : {
                common: 70,
                rare: 20,
                epic: 8,
                legendary: 2
            },
            cards_per_pack: dbBooster.cards_per_pack || 5,
            price: dbBooster.price || 100,
            is_active: dbBooster.is_active === 1,
            created_at: dbBooster.created_at,
            updated_at: dbBooster.updated_at
        };
    }
}
exports.BoosterRepository = BoosterRepository;
exports.default = new BoosterRepository();
//# sourceMappingURL=booster.repository.js.map