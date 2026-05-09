import dbHelpers from '../../config/database';
import type { User, Deck } from '../../shared/types';

export interface UserWithDecks extends User {
  decks: Deck[];
}

export interface OverviewStats {
  total_users: number;
  total_matches: number;
  total_cards: number;
  active_players: number;
}

export class AdminRepository {
  async getOverviewStats(): Promise<OverviewStats> {
    const totalUsersRow = await dbHelpers.query<{ count: number }>('SELECT COUNT(*) AS count FROM users', []);
    const totalMatchesRow = await dbHelpers.query<{ count: number }>('SELECT COUNT(*) AS count FROM matches', []);
    const totalCardsRow = await dbHelpers.query<{ count: number }>('SELECT COUNT(*) AS count FROM cards WHERE is_active = 1', []);
    const activePlayersRow = await dbHelpers.query<{ count: number }>(
      'SELECT COUNT(DISTINCT id) AS count FROM (SELECT player1_id AS id FROM matches UNION SELECT player2_id AS id FROM matches WHERE player2_id IS NOT NULL) AS sub',
      []
    );
    return {
      total_users: totalUsersRow?.count ?? 0,
      total_matches: totalMatchesRow?.count ?? 0,
      total_cards: totalCardsRow?.count ?? 0,
      active_players: activePlayersRow?.count ?? 0
    };
  }

  async getAllUsersWithDecks(): Promise<UserWithDecks[]> {
    const users = await dbHelpers.queryAll<User>('SELECT * FROM users ORDER BY created_at DESC');
    
    const usersWithDecks: UserWithDecks[] = [];
    for (const user of users) {
      const decks = await this.getUserDecks(user.id);
      usersWithDecks.push({
        ...user,
        decks
      });
    }
    
    return usersWithDecks;
  }

  async getUserDetails(userId: number): Promise<UserWithDecks | null> {
    const user = await dbHelpers.query<User>('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) {
      return null;
    }

    const decks = await this.getUserDecks(userId);
    return {
      ...user,
      decks
    };
  }

  async getUserDecks(userId: number): Promise<Deck[]> {
    const decks = await dbHelpers.queryAll<any>(
      'SELECT * FROM decks WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );

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

export default new AdminRepository();
