import dbHelpers from '../../config/database';
import type { User } from '../../shared/types';

export class UserRepository {
  async getUserById(id: number): Promise<User | null> {
    return await dbHelpers.query<User>('SELECT * FROM users WHERE id = ?', [id]);
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const normalizedUsername = username.trim().toLowerCase();
    return await dbHelpers.query<User>(
      'SELECT * FROM users WHERE LOWER(username) = ?',
      [normalizedUsername]
    );
  }

  async createUser(username: string, passwordHash: string, email?: string): Promise<number> {
    const result = await dbHelpers.run(
      'INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)',
      [username, passwordHash, email || null]
    );
    return result.lastInsertRowid!;
  }

  async updateUserElo(userId: number, type: 'casual' | 'ranked', newElo: number): Promise<void> {
    const column = type === 'casual' ? 'elo_casual' : 'elo_ranked';
    await dbHelpers.run(
      `UPDATE users SET ${column} = ? WHERE id = ?`,
      [newElo, userId]
    );
  }

  async updateUserStats(userId: number, won: boolean): Promise<void> {
    const winCol = won ? 'wins = wins + 1,' : 'losses = losses + 1,';
    await dbHelpers.run(
      `UPDATE users SET ${winCol} total_matches = total_matches + 1 WHERE id = ?`,
      [userId]
    );
  }

  async updateUserLevelExp(userId: number, level: number, experience: number): Promise<void> {
    await dbHelpers.run(
      'UPDATE users SET level = ?, experience = ? WHERE id = ?',
      [level, experience, userId]
    );
  }

  async updateLastLogin(userId: number): Promise<void> {
    await dbHelpers.run(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
      [userId]
    );
  }

  async updateUserCharacter(
    userId: number,
    character: {
      gender: string;
      body_id: string;
      head_id: string;
      skin_body_id?: string | null;
      skin_head_id?: string | null;
      character_completed: number;
    }
  ): Promise<void> {
    await dbHelpers.run(
      `UPDATE users
       SET gender = ?, body_id = ?, head_id = ?, skin_body_id = ?, skin_head_id = ?, character_completed = ?
       WHERE id = ?`,
      [
        character.gender,
        character.body_id,
        character.head_id,
        character.skin_body_id ?? null,
        character.skin_head_id ?? null,
        character.character_completed,
        userId
      ]
    );
  }

  async updateUserProfileAvatar(userId: number, profileAvatarId: string): Promise<void> {
    await dbHelpers.run(
      `UPDATE users
       SET profile_avatar_id = ?
       WHERE id = ?`,
      [profileAvatarId, userId]
    );
  }

  async getAllUsers(): Promise<User[]> {
    return await dbHelpers.queryAll<User>('SELECT * FROM users ORDER BY elo_ranked DESC');
  }

  async getLeaderboard(limit: number = 50): Promise<User[]> {
    return await dbHelpers.queryAll<User>(
      'SELECT * FROM users WHERE elo_ranked >= 1000 ORDER BY elo_ranked DESC LIMIT ?',
      [limit]
    );
  }

  async getRecentMatches(userId: number, limit: number = 20): Promise<any[]> {
    return await dbHelpers.queryAll(
      `SELECT m.*, 
        u1.username AS player1_username, u1.level AS player1_level,
        u2.username AS player2_username, u2.level AS player2_level
       FROM matches m
       LEFT JOIN users u1 ON m.player1_id = u1.id
       LEFT JOIN users u2 ON m.player2_id = u2.id
       WHERE m.player1_id = ? OR m.player2_id = ?
       ORDER BY m.created_at DESC LIMIT ?`,
      [userId, userId, limit]
    );
  }
}

export default new UserRepository();
