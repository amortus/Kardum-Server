import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../auth/auth.middleware';
import npcService from './npc.service';

const router = Router();

router.use(authenticateToken);

router.get('/zone/:zone', async (req: AuthRequest, res: Response) => {
  try {
    const zone = String(req.params.zone || 'shadowland').trim().toLowerCase();
    const npcs = await npcService.listZoneSpawns(zone);
    res.json({ zone, npcs });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch NPCs' });
  }
});

router.post('/interact', async (req: AuthRequest, res: Response) => {
  try {
    const npcTemplateId = Number(req.body?.npcTemplateId || req.body?.npc_template_id || 0);
    if (!Number.isFinite(npcTemplateId) || npcTemplateId <= 0) {
      res.status(400).json({ error: 'npcTemplateId is required' });
      return;
    }
    await npcService.interactWithNpc(req.userId!, npcTemplateId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to interact with NPC' });
  }
});

export default router;
