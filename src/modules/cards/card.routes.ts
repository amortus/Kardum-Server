import { Router, Response } from 'express';
import cardRepository from './card.repository';
import { optionalAuth, AuthRequest } from '../auth/auth.middleware';
import userRepository from '../users/user.repository';

const router = Router();

// Get all cards (public or authenticated)
router.get('/', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    let canIncludeLocked = false;
    if (req.userId) {
      const user = await userRepository.getUserById(req.userId);
      // Admin sempre enxerga todas as cartas ativas, mesmo sem include_locked=true.
      canIncludeLocked = Boolean(user?.is_admin);
    }

    const cards = await cardRepository.getAllCards({
      type: req.query.type as string | undefined,
      race: req.query.race as string | undefined,
      collection_id: req.query.collection_id as string | undefined,
      default_unlocked: req.query.default_unlocked as 'true' | 'false' | undefined,
      search: req.query.search as string | undefined,
      user_id: canIncludeLocked ? undefined : req.userId
    });
    res.json({ cards });
  } catch (error: any) {
    console.error('Get cards error:', error);
    res.status(500).json({ error: 'Failed to get cards' });
  }
});

// Get card layouts used by runtime renderers
router.get('/layouts', optionalAuth, async (_req: AuthRequest, res: Response) => {
  try {
    const [globalVfxLayout, artworkLayouts] = await Promise.all([
      cardRepository.getGlobalVfxLayout(),
      cardRepository.getAllCardArtworkLayouts()
    ]);
    res.json({ globalVfxLayout, artworkLayouts });
  } catch (error: any) {
    console.error('Get card layouts error:', error);
    res.status(500).json({ error: 'Failed to get card layouts' });
  }
});

// Get card by ID
router.get('/:id', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const card = await cardRepository.getCardById(req.params.id);
    
    if (!card) {
      res.status(404).json({ error: 'Card not found' });
      return;
    }

    res.json({ card });
  } catch (error: any) {
    console.error('Get card error:', error);
    res.status(500).json({ error: 'Failed to get card' });
  }
});

// Get cards by type
router.get('/type/:type', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const cards = await cardRepository.getCardsByType(req.params.type);
    res.json({ cards });
  } catch (error: any) {
    console.error('Get cards by type error:', error);
    res.status(500).json({ error: 'Failed to get cards' });
  }
});

// Get cards by race
router.get('/race/:race', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const cards = await cardRepository.getCardsByRace(req.params.race);
    res.json({ cards });
  } catch (error: any) {
    console.error('Get cards by race error:', error);
    res.status(500).json({ error: 'Failed to get cards' });
  }
});

// Note: Admin routes moved to /api/admin/cards

export default router;
