import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../auth/auth.middleware';
import friendsRepository from './friends.repository';
import userRepository from '../users/user.repository';
import { emitFriendUpdate, getOnlineUserIds } from '../../config/socket';

const router = Router();

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
    const friend = await userRepository.getUserByUsername(username);
    if (!friend) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (friend.id === req.userId) {
      res.status(400).json({ error: 'Cannot add yourself' });
      return;
    }

    const existing = await friendsRepository.getRelationship(req.userId!, friend.id);
    if (existing) {
      res.status(400).json({ error: 'Relationship already exists' });
      return;
    }

    await friendsRepository.createRequest(req.userId!, friend.id);
    emitFriendUpdate(friend.id, {
      type: 'friend_request',
      data: { fromUserId: req.userId, fromUsername: req.user?.username || 'Unknown' }
    });
    res.json({ ok: true });
  } catch (error: any) {
    console.error('Friends request error:', error);
    res.status(500).json({ error: 'Failed to create friend request' });
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
    emitFriendUpdate(friendId, {
      type: 'friend_request_accepted',
      data: { byUserId: req.userId, byUsername: req.user?.username || 'Unknown' }
    });
    emitFriendUpdate(req.userId!, {
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
    emitFriendUpdate(friendId, {
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
