import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../auth/auth.middleware';
import mailRepository from './mail.repository';
import cardRepository from '../cards/card.repository';

const router = Router();
router.use(authenticateToken);

router.get('/inbox', async (req: AuthRequest, res: Response) => {
  try {
    const limitRaw = Number(req.query.limit);
    const cursorRaw = Number(req.query.cursor);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, Math.floor(limitRaw))) : 50;
    const cursor = Number.isFinite(cursorRaw) && cursorRaw > 0 ? Math.floor(cursorRaw) : undefined;
    const items = await mailRepository.listInbox(req.userId!, limit, cursor);
    const nextCursor = items.length > 0 ? items[items.length - 1].id : null;
    res.json({ items, nextCursor });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load inbox' });
  }
});

router.post('/:id/read', async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid id' });
      return;
    }
    await mailRepository.markRead(req.userId!, id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to mark read' });
  }
});

router.post('/:id/claim', async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid id' });
      return;
    }
    const msg = await mailRepository.getMessageForClaim(req.userId!, id);
    if (!msg) {
      res.status(404).json({ error: 'Mail not found' });
      return;
    }
    const status = String((msg as any).status || 'unread');
    if (status === 'claimed') {
      res.json({ success: true, alreadyClaimed: true, rewards: [] });
      return;
    }
    const deliverAt = new Date(String((msg as any).deliver_at || ''));
    if (Number.isFinite(deliverAt.getTime()) && deliverAt.getTime() > Date.now()) {
      res.status(400).json({ error: 'Mail not delivered yet' });
      return;
    }

    // Idempotency: unique(mail_id) in mail_claims.
    const already = await mailRepository.hasClaim(id);
    if (already) {
      await mailRepository.markClaimed(req.userId!, id);
      res.json({ success: true, alreadyClaimed: true, rewards: [] });
      return;
    }

    // Create claim first (locks the message for concurrent claims)
    try {
      await mailRepository.createClaim(req.userId!, id);
    } catch (e: any) {
      // Race: someone claimed just now
      await mailRepository.markClaimed(req.userId!, id);
      res.json({ success: true, alreadyClaimed: true, rewards: [] });
      return;
    }

    const rewards: any[] = [];
    const attachments = (msg as any).attachments || [];
    for (const a of attachments) {
      if (a && a.type === 'card_unlock') {
        const cardId = String(a.cardId || '').trim();
        if (!cardId) continue;
        const unlocked = await cardRepository.unlockCardForUser(req.userId!, cardId, 'mail_reward');
        rewards.push({ type: 'card_unlock', cardId, unlocked });
      }
    }

    await mailRepository.markClaimed(req.userId!, id);
    res.json({ success: true, rewards });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to claim mail' });
  }
});

export default router;

