"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminRepository = void 0;
const database_1 = __importDefault(require("../../config/database"));
class AdminRepository {
    async getOverviewStats() {
        const totalUsersRow = await database_1.default.query('SELECT COUNT(*) AS count FROM users', []);
        const totalMatchesRow = await database_1.default.query('SELECT COUNT(*) AS count FROM matches', []);
        const totalCardsRow = await database_1.default.query('SELECT COUNT(*) AS count FROM cards WHERE is_active = 1', []);
        const activePlayersRow = await database_1.default.query('SELECT COUNT(DISTINCT id) AS count FROM (SELECT player1_id AS id FROM matches UNION SELECT player2_id AS id FROM matches WHERE player2_id IS NOT NULL) AS sub', []);
        return {
            total_users: totalUsersRow?.count ?? 0,
            total_matches: totalMatchesRow?.count ?? 0,
            total_cards: totalCardsRow?.count ?? 0,
            active_players: activePlayersRow?.count ?? 0
        };
    }
    async getAllUsersWithDecks() {
        const users = await database_1.default.queryAll('SELECT * FROM users ORDER BY created_at DESC');
        const usersWithDecks = [];
        for (const user of users) {
            const decks = await this.getUserDecks(user.id);
            usersWithDecks.push({
                ...user,
                decks
            });
        }
        return usersWithDecks;
    }
    async getUserDetails(userId) {
        const user = await database_1.default.query('SELECT * FROM users WHERE id = ?', [userId]);
        if (!user) {
            return null;
        }
        const decks = await this.getUserDecks(userId);
        return {
            ...user,
            decks
        };
    }
    async getUserDecks(userId) {
        const decks = await database_1.default.queryAll('SELECT * FROM decks WHERE user_id = ? ORDER BY created_at DESC', [userId]);
        return decks.map(deck => ({
            id: deck.id,
            user_id: deck.user_id,
            name: deck.name,
            cards: deck.cards ? JSON.parse(deck.cards) : [],
            created_at: deck.created_at,
            updated_at: deck.updated_at
        }));
    }
}
exports.AdminRepository = AdminRepository;
exports.default = new AdminRepository();
//# sourceMappingURL=admin.repository.js.map