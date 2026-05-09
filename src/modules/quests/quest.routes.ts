import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../auth/auth.middleware';
import questService from './quest.service';

const router = Router();

router.use(authenticateToken);

router.get('/snapshot', async (req: AuthRequest, res: Response) => {
  try {
    const zone = String(req.query.zone || 'shadowland');
    const snapshot = await questService.getSnapshot(req.userId!, zone);
    res.json(snapshot);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load quest snapshot' });
  }
});

router.post('/:questId/accept', async (req: AuthRequest, res: Response) => {
  try {
    const questId = Number(req.params.questId);
    if (!Number.isFinite(questId) || questId <= 0) {
      res.status(400).json({ error: 'Invalid questId' });
      return;
    }
    await questService.acceptQuest(req.userId!, questId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to accept quest' });
  }
});

router.post('/:questId/abandon', async (req: AuthRequest, res: Response) => {
  try {
    const questId = Number(req.params.questId);
    if (!Number.isFinite(questId) || questId <= 0) {
      res.status(400).json({ error: 'Invalid questId' });
      return;
    }
    await questService.abandonQuest(req.userId!, questId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to abandon quest' });
  }
});

router.post('/:questId/track', async (req: AuthRequest, res: Response) => {
  try {
    const questId = Number(req.params.questId);
    const tracked = req.body?.tracked !== false;
    if (!Number.isFinite(questId) || questId <= 0) {
      res.status(400).json({ error: 'Invalid questId' });
      return;
    }
    await questService.trackQuest(req.userId!, questId, tracked);
    res.json({ success: true, tracked });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to update tracking' });
  }
});

router.post('/:questId/turnin', async (req: AuthRequest, res: Response) => {
  try {
    const questId = Number(req.params.questId);
    if (!Number.isFinite(questId) || questId <= 0) {
      res.status(400).json({ error: 'Invalid questId' });
      return;
    }
    await questService.turnInQuest(req.userId!, questId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to turn in quest' });
  }
});

export default router;
