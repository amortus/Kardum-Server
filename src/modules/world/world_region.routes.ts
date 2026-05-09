import { Router, Request, Response } from 'express';
import dbHelpers from '../../config/database';

const router = Router();

// GET /api/world/regions?zone=shadowland — público, sem auth
// Retorna todas as regiões ativas de uma zona (usado pelo cliente Godot ao entrar)
router.get('/regions', async (req: Request, res: Response) => {
  try {
    const zone = String(req.query.zone || 'shadowland').trim().toLowerCase();
    const rows = await dbHelpers.queryAll<any>(
      `SELECT id, name, zone, center_x, center_y, radius, icon_type
       FROM world_regions
       WHERE zone = ? AND is_active IS NOT FALSE
       ORDER BY name ASC`,
      [zone]
    );
    const regions = rows.map((r) => ({
      id: Number(r.id),
      name: String(r.name),
      zone: String(r.zone),
      x: Number(r.center_x),
      y: Number(r.center_y),
      radius: Number(r.radius),
      icon_type: String(r.icon_type || 'location')
    }));
    res.json({ regions });
  } catch (error: any) {
    console.error('GET /api/world/regions error:', error);
    res.status(500).json({ error: 'Failed to load regions' });
  }
});

export default router;
