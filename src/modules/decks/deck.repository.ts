import dbHelpers from '../../config/database';
import type { Deck } from '../../shared/types';

export class DeckRepository {
  async getUserDecks(userId: number): Promise<Deck[]> {
    try {
      const decks = await dbHelpers.queryAll<any>(
        // Hide internal AI decks from player deck picker.
        // These decks are referenced by monster_templates and should not be user-selectable.
        "SELECT * FROM decks WHERE user_id = ? AND name NOT LIKE 'Monster::%' ORDER BY updated_at DESC",
        [userId]
      );
      
      return decks.map(deck => this.parseDeck(deck));
    } catch (error) {
      console.error('Error getting user decks:', error);
      return [];
    }
  }

  async getDeckById(deckId: number): Promise<Deck | null> {
    try {
      const deck = await dbHelpers.query<any>('SELECT * FROM decks WHERE id = ?', [deckId]);
      return deck ? this.parseDeck(deck) : null;
    } catch (error) {
      console.error('Error getting deck:', error);
      return null;
    }
  }

  async createDeck(userId: number, deckData: { name: string; cards: string[] }): Promise<number> {
    const result = await dbHelpers.run(
      'INSERT INTO decks (user_id, name, general_id, cards) VALUES (?, ?, ?, ?)',
      [
        userId,
        deckData.name,
        '__deprecated_general__',
        JSON.stringify(deckData.cards)
      ]
    );
    return result.lastInsertRowid!;
  }

  async updateDeck(deckId: number, userId: number, deckData: { name: string; cards: string[] }): Promise<void> {
    await dbHelpers.run(
      `UPDATE decks 
       SET name = ?, general_id = ?, cards = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [
        deckData.name,
        '__deprecated_general__',
        JSON.stringify(deckData.cards),
        deckId,
        userId
      ]
    );
  }

  /** Internal/system update without user ownership check (used for AI decks). */
  async updateDeckSystem(deckId: number, deckData: { name: string; cards: string[] }): Promise<void> {
    await dbHelpers.run(
      `UPDATE decks
       SET name = ?, general_id = ?, cards = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        deckData.name,
        '__deprecated_general__',
        JSON.stringify(deckData.cards),
        deckId
      ]
    );
  }

  async deleteDeck(deckId: number, userId: number): Promise<void> {
    await dbHelpers.run('DELETE FROM decks WHERE id = ? AND user_id = ?', [deckId, userId]);
  }

  async deleteAllDecks(): Promise<number> {
    try {
      const count = await dbHelpers.query<{ total: number }>(
        'SELECT COUNT(*) as total FROM decks'
      );
      const total = count?.total ?? 0;
      await dbHelpers.run('DELETE FROM decks');
      console.log(`[DeckRepository] Deleted all decks: ${total} removed`);
      return total;
    } catch (error) {
      console.error('Error deleting all decks:', error);
      throw error;
    }
  }

  async getUserDeckCount(userId: number): Promise<number> {
    const row = await dbHelpers.query<{ count: number }>(
      'SELECT COUNT(*) AS count FROM decks WHERE user_id = ?',
      [userId]
    );
    return row?.count ?? 0;
  }

  private parseDeck(dbDeck: any): Deck {
    let cards: string[] = [];
    try {
      if (Array.isArray(dbDeck.cards)) {
        cards = dbDeck.cards;
      } else if (typeof dbDeck.cards === 'string') {
        cards = JSON.parse(dbDeck.cards || '[]');
      }
    } catch (e) {
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

export default new DeckRepository();
