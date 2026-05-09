import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../auth/auth.middleware';
import friendsRepository from './friends.repository';
import userRepository from '../users/user.repository';
import { emitFriendUpdate, getOnlineUserIds } from '../../config/socket';

const router = Router();

function safeEmitFriendUpdate(
  userId: number,
  payload: { type: string; data?: unknown }
): void {
  try {
    emitFriendUpdate(userId, payload);
  } catch (error) {
    console.warn('Friend update emit failed:', error);
  }
}

router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const items = await friendsRepository.listUserFriends(req.userId!);
    res.json({ friends: items });
  } catch (error: any) {
    console.error('Friends list error:', error);
    res.status(500).json({ error: 'Failed to load friends' });
  }
});

router.get('/online', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const friendIds = await friendsRepository.getAcceptedFriendIds(req.userId!);
    const onlineIds = getOnlineUserIds(friendIds);
    res.json({ online_user_ids: onlineIds });
  } catch (error: any) {
    console.error('Friends online error:', error);
    res.status(500).json({ error: 'Failed to load online friends' });
  }
});

router.post('/request', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const username = String(req.body.username || '').trim();
    if (!username) {
      res.status(400).json({ error: 'username is required' });
      return;
    }
    const selfId = Number(req.userId);
    if (!Number.isFinite(selfId) || selfId <= 0) {
      res.status(401).json({ error: 'Invalid session' });
      return;
    }
    const me = await userRepository.getUserById(selfId);
    if (!me) {
      res.status(401).json({ error: 'User no longer exists; please log in again' });
      return;
    }

    const friend = await userRepository.getUserByUsername(username);
    if (!friend) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const friendId = Number(friend.id);
    if (!Number.isFinite(friendId) || friendId <= 0) {
      res.status(400).json({ error: 'Invalid target user' });
      return;
    }
    if (friendId === selfId) {
      res.status(400).json({ error: 'Cannot add yourself' });
      return;
    }

    const existing = await friendsRepository.getRelationship(selfId, friendId);
    if (existing) {
      res.status(400).json({ error: 'Relationship already exists' });
      return;
    }

    await friendsRepository.createRequest(selfId, friendId);
    safeEmitFriendUpdate(friendId, {
      type: 'friend_request',
      data: { fromUserId: selfId, fromUsername: req.user?.username || 'Unknown' }
    });
    res.json({ ok: true });
  } catch (error: any) {
    console.error('Friends request error:', error);
    const message = String(error?.message || '');
    const code = String(error?.code || '');
    if (
      code === '23505' ||
      message.includes('UNIQUE constraint failed') ||
      message.includes('duplicate key value violates unique constraint')
    ) {
      res.status(400).json({ error: 'Relationship already exists' });
      return;
    }
    if (
      code === '23503' ||
      code === 'SQLITE_CONSTRAINT_FOREIGNKEY' ||
      message.includes('FOREIGN KEY constraint failed') ||
      message.includes('violates foreign key constraint')
    ) {
      res.status(400).json({
        error: 'Não foi possível criar o pedido (conta inválida ou sessão desatualizada). Faça login de novo.'
      });
      return;
    }
    res.status(500).json({
      error: 'Failed to create friend request',
      detail: message || code || 'unknown_error'
    });
  }
});

router.post('/accept', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const friendId = Number(req.body.friend_id);
    if (!Number.isFinite(friendId) || friendId <= 0) {
      res.status(400).json({ error: 'friend_id is required' });
      return;
    }

    const relation = await friendsRepository.getRelationship(req.userId!, friendId);
    if (!relation || relation.status !== 'pending' || relation.friend_id !== req.userId) {
      res.status(404).json({ error: 'Pending request not found' });
      return;
    }

    await friendsRepository.acceptRequest(relation.id);
    safeEmitFriendUpdate(friendId, {
      type: 'friend_request_accepted',
      data: { byUserId: req.userId, byUsername: req.user?.username || 'Unknown' }
    });
    safeEmitFriendUpdate(req.userId!, {
      type: 'friend_request_accepted',
      data: { byUserId: req.userId, byUsername: req.user?.username || 'Unknown' }
    });
    res.json({ ok: true });
  } catch (error: any) {
    console.error('Friends accept error:', error);
    res.status(500).json({ error: 'Failed to accept friend request' });
  }
});

router.delete('/:friendId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const friendId = Number(req.params.friendId);
    if (!Number.isFinite(friendId) || friendId <= 0) {
      res.status(400).json({ error: 'Invalid friend id' });
      return;
    }
    await friendsRepository.removeRelationship(req.userId!, friendId);
    safeEmitFriendUpdate(friendId, {
      type: 'friend_removed',
      data: { byUserId: req.userId, byUsername: req.user?.username || 'Unknown' }
    });
    res.json({ ok: true });
  } catch (error: any) {
    console.error('Friends delete error:', error);
    res.status(500).json({ error: 'Failed to remove friend' });
  }
});

export default router;
