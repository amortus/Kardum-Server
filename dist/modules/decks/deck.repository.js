"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeckRepository = void 0;
const database_1 = __importDefault(require("../../config/database"));
class DeckRepository {
    async getUserDecks(userId) {
        try {
            const decks = await database_1.default.queryAll('SELECT * FROM decks WHERE user_id = ? ORDER BY updated_at DESC', [userId]);
            return decks.map(deck => this.parseDeck(deck));
        }
        catch (error) {
            console.error('Error getting user decks:', error);
            return [];
        }
    }
    async getDeckById(deckId) {
        try {
            const deck = await database_1.default.query('SELECT * FROM decks WHERE id = ?', [deckId]);
            return deck ? this.parseDeck(deck) : null;
        }
        catch (error) {
            console.error('Error getting deck:', error);
            return null;
        }
    }
    async createDeck(userId, deckData) {
        const result = await database_1.default.run('INSERT INTO decks (user_id, name, general_id, cards) VALUES (?, ?, ?, ?)', [
            userId,
            deckData.name,
            '__deprecated_general__',
            JSON.stringify(deckData.cards)
        ]);
        return result.lastInsertRowid;
    }
    async updateDeck(deckId, userId, deckData) {
        await database_1.default.run(`UPDATE decks 
       SET name = ?, general_id = ?, cards = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`, [
            deckData.name,
            '__deprecated_general__',
            JSON.stringify(deckData.cards),
            deckId,
            userId
        ]);
    }
    async deleteDeck(deckId, userId) {
        await database_1.default.run('DELETE FROM decks WHERE id = ? AND user_id = ?', [deckId, userId]);
    }
    async deleteAllDecks() {
        try {
            const count = await database_1.default.query('SELECT COUNT(*) as total FROM decks');
            const total = count?.total ?? 0;
            await database_1.default.run('DELETE FROM decks');
            console.log(`[DeckRepository] Deleted all decks: ${total} removed`);
            return total;
        }
        catch (error) {
            console.error('Error deleting all decks:', error);
            throw error;
        }
    }
    async getUserDeckCount(userId) {
        const row = await database_1.default.query('SELECT COUNT(*) AS count FROM decks WHERE user_id = ?', [userId]);
        return row?.count ?? 0;
    }
    parseDeck(dbDeck) {
        let cards = [];
        try {
            if (Array.isArray(dbDeck.cards)) {
                cards = dbDeck.cards;
            }
            else if (typeof dbDeck.cards === 'string') {
                cards = JSON.parse(dbDeck.cards || '[]');
            }
        }
        catch (e) {
            console.error('Error parsing deck cards:', e);
            cards = [];
        }
        return {
            id: dbDeck.id,
            user_id: dbDeck.user_id,
            name: dbDeck.name,
            cards: cards,
            created_at: dbDeck.created_at,
            updated_at: dbDeck.updated_at
        };
    }
}
exports.DeckRepository = DeckRepository;
exports.default = new DeckRepository();
//# sourceMappingURL=deck.repository.js.map