import dbHelpers, { usePostgres } from '../../config/database';

export type FriendRow = {
  id: number;
  user_id: number;
  friend_id: number;
  status: 'pending' | 'accepted' | 'blocked';
  requested_at?: string;
  accepted_at?: string | null;
};

export type FriendListItem = {
  userId: number;
  username: string;
  status: 'pending' | 'accepted' | 'blocked';
  direction: 'outgoing' | 'incoming';
};

class FriendsRepository {
  async createRequest(userId: number, friendId: number): Promise<void> {
    const insert = () =>
      dbHelpers.run(
        `INSERT INTO friendships (user_id, friend_id, status)
         VALUES (?, ?, 'pending')`,
        [userId, friendId]
      );
    try {
      await insert();
    } catch (e: any) {
      const msg = String(e?.message || '');
      const code = String(e?.code || '');
      const idBroken =
        usePostgres &&
        (code === '23502' || (msg.includes('null value') && msg.includes('"id"') && msg.includes('friendships')));
      if (!idBroken) throw e;
      await dbHelpers
        .exec(`
DO $fix$
BEGIN
  CREATE SEQUENCE IF NOT EXISTS friendships_id_seq;
  PERFORM setval(
    'friendships_id_seq',
    GREATEST(COALESCE((SELECT MAX(id) FROM friendships), 0), 1)
  );
  ALTER TABLE friendships ALTER COLUMN id SET DEFAULT nextval('friendships_id_seq');
END;
$fix$;
        `)
        .catch(() => {});
      await insert();
    }
  }

  async getRelationship(userId: number, friendId: number): Promise<FriendRow | null> {
    return dbHelpers.query<FriendRow>(
      `SELECT id, user_id, friend_id, status, requested_at, accepted_at
       FROM friendships
       WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)
       LIMIT 1`,
      [userId, friendId, friendId, userId]
    );
  }

  async acceptRequest(requestId: number): Promise<void> {
    await dbHelpers.run(
      `UPDATE friendships
       SET status = 'accepted', accepted_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [requestId]
    );
  }

  async removeRelationship(userId: number, friendId: number): Promise<void> {
    await dbHelpers.run(
      `DELETE FROM friendships
       WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)`,
      [userId, friendId, friendId, userId]
    );
  }

  async listUserFriends(userId: number): Promise<FriendListItem[]> {
    return dbHelpers.queryAll<FriendListItem>(
      `SELECT
         CASE WHEN f.user_id = ? THEN f.friend_id ELSE f.user_id END AS "userId",
         u.username AS username,
         f.status AS status,
         CASE WHEN f.user_id = ? THEN 'outgoing' ELSE 'incoming' END AS direction
       FROM friendships f
       INNER JOIN users u ON u.id = CASE WHEN f.user_id = ? THEN f.friend_id ELSE f.user_id END
       WHERE f.user_id = ? OR f.friend_id = ?
       ORDER BY u.username ASC`,
      [userId, userId, userId, userId, userId]
    );
  }

  async getAcceptedFriendIds(userId: number): Promise<number[]> {
    const rows = await dbHelpers.queryAll<{ friend_id: number }>(
      `SELECT CASE WHEN user_id = ? THEN friend_id ELSE user_id END AS friend_id
       FROM friendships
       WHERE status = 'accepted' AND (user_id = ? OR friend_id = ?)`,
      [userId, userId, userId]
    );
    return rows.map((r) => r.friend_id);
  }
}

export default new FriendsRepository();
