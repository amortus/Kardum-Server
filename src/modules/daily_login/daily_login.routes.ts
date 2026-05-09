import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../auth/auth.middleware';
import dailyLoginService from './daily_login.service';

const router = Router();
router.use(authenticateToken);

router.get('/status', async (req: AuthRequest, res: Response) => {
  try {
    const month = String(req.query.month || '').trim();
    const status = await dailyLoginService.getStatus(req.userId!, month || undefined);
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load daily login status' });
  }
});

router.post('/claim', async (req: AuthRequest, res: Response) => {
  try {
    const payload = req.body || {};
    const month = String(payload.month || '').trim();
    const dayIndex = Number(payload.dayIndex);
    if (!month) {
      res.status(400).json({ error: 'month is required (YYYY-MM)' });
      return;
    }
    const result = await dailyLoginService.claimDay(req.userId!, month, dayIndex);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to claim day' });
  }
});

export default router;

