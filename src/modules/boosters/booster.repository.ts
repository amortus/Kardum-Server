import dbHelpers from '../../config/database';

export interface Booster {
  id: string;
  name: string;
  description?: string;
  card_collection: string[]; // Array de card IDs
  rarity_weights: {
    common: number;
    rare: number;
    epic: number;
    legendary: number;
  };
  cards_per_pack: number;
  price: number;
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export class BoosterRepository {
  async createBooster(booster: Omit<Booster, 'created_at' | 'updated_at'>): Promise<void> {
    await dbHelpers.run(
      `INSERT INTO boosters (id, name, description, card_collection, rarity_weights, cards_per_pack, price, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        booster.id,
        booster.name,
        booster.description || null,
        JSON.stringify(booster.card_collection),
        JSON.stringify(booster.rarity_weights),
        booster.cards_per_pack,
        booster.price,
        booster.is_active ? 1 : 0
      ]
    );
  }

  async getAllBoosters(): Promise<Booster[]> {
    const boosters = await dbHelpers.queryAll<any>('SELECT * FROM boosters ORDER BY created_at DESC');
    return boosters.map(this.parseBooster);
  }

  async getBoosterById(id: string): Promise<Booster | null> {
    const booster = await dbHelpers.query<any>('SELECT * FROM boosters WHERE id = ?', [id]);
    return booster ? this.parseBooster(booster) : null;
  }

  async updateBooster(id: string, booster: Partial<Booster>): Promise<void> {
    const updates: string[] = [];
    const values: any[] = [];

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

    await dbHelpers.run(
      `UPDATE boosters SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
  }

  async deleteBooster(id: string): Promise<void> {
    await dbHelpers.run('UPDATE boosters SET is_active = 0 WHERE id = ?', [id]);
  }

  private parseBooster(dbBooster: any): Booster {
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

export default new BoosterRepository();
