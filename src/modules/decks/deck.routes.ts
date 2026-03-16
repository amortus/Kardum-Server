import { Router, Response } from 'express';
import deckRepository from './deck.repository';
import cardRepository from '../cards/card.repository';
import { authenticateToken, AuthRequest } from '../auth/auth.middleware';
import userRepository from '../users/user.repository';

const router = Router();

async function validateCardsUnlockedForUser(userId: number, cards: string[]): Promise<string | null> {
  const user = await userRepository.getUserById(userId);
  if (user?.is_admin) {
    return null;
  }
  const ok = await cardRepository.areCardsAvailableForUser(userId, cards);
  if (ok) return null;
  return 'Deck contains cards not unlocked for this user';
}

// All deck routes require authentication
router.use(authenticateToken);

// Get user's decks
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const decks = await deckRepository.getUserDecks(req.userId!);
    res.json({ decks });
  } catch (error: any) {
    console.error('Get decks error:', error);
    res.status(500).json({ error: 'Failed to get decks' });
  }
});

// Get deck by ID
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const deck = await deckRepository.getDeckById(parseInt(req.params.id));
    
    if (!deck) {
      res.status(404).json({ error: 'Deck not found' });
      return;
    }

    // Check if deck belongs to user
    if (deck.user_id !== req.userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.json({ deck });
  } catch (error: any) {
    console.error('Get deck error:', error);
    res.status(500).json({ error: 'Failed to get deck' });
  }
});

// Create deck
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, cards } = req.body;

    if (!name || !cards || !Array.isArray(cards)) {
      res.status(400).json({ error: 'Invalid deck data' });
      return;
    }

    // Validate deck size
    if (cards.length < 30 || cards.length > 40) {
      res.status(400).json({ error: 'Deck must have between 30 and 40 cards' });
      return;
    }
    const accessError = await validateCardsUnlockedForUser(req.userId!, cards);
    if (accessError) {
      res.status(400).json({ error: accessError });
      return;
    }

    const deckId = await deckRepository.createDeck(req.userId!, {
      name,
      cards
    });

    res.status(201).json({ 
      message: 'Deck created successfully',
      deckId 
    });
  } catch (error: any) {
    console.error('Create deck error:', error);
    res.status(500).json({ error: 'Failed to create deck' });
  }
});

// Create a starter deck automatically (no General card)
router.post('/generate-random', async (req: AuthRequest, res: Response) => {
  try {
    const payload = req.body || {};
    const deckName = String(payload.name || 'Deck Inicial').trim();
    const collectionId = payload.collection_id ? String(payload.collection_id) : undefined;

    const cards = await cardRepository.getAllCards({
      collection_id: collectionId,
      user_id: req.userId
    });
    const pool = cards.filter((card) => card.type !== 'general').map((card) => card.id);
    if (pool.length < 30) {
      res.status(400).json({ error: 'Not enough cards to generate a deck' });
      return;
    }

    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const deckCards = shuffled.slice(0, 35);
    const deckId = await deckRepository.createDeck(req.userId!, {
      name: deckName,
      cards: deckCards
    });
    res.status(201).json({
      message: 'Random deck generated successfully',
      deckId
    });
  } catch (error: any) {
    console.error('Generate random deck error:', error);
    res.status(500).json({ error: 'Failed to generate random deck' });
  }
});

// Update deck
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const deckId = parseInt(req.params.id);
    const { name, cards } = req.body;

    if (!name || !cards || !Array.isArray(cards)) {
      res.status(400).json({ error: 'Invalid deck data' });
      return;
    }

    // Validate deck size
    if (cards.length < 30 || cards.length > 40) {
      res.status(400).json({ error: 'Deck must have between 30 and 40 cards' });
      return;
    }
    const accessError = await validateCardsUnlockedForUser(req.userId!, cards);
    if (accessError) {
      res.status(400).json({ error: accessError });
      return;
    }

    // Check if deck belongs to user
    const existingDeck = await deckRepository.getDeckById(deckId);
    if (!existingDeck || existingDeck.user_id !== req.userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    await deckRepository.updateDeck(deckId, req.userId!, {
      name,
      cards
    });

    res.json({ message: 'Deck updated successfully' });
  } catch (error: any) {
    console.error('Update deck error:', error);
    res.status(500).json({ error: 'Failed to update deck' });
  }
});

// Delete deck
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const deckId = parseInt(req.params.id);

    // Check if deck belongs to user
    const existingDeck = await deckRepository.getDeckById(deckId);
    if (!existingDeck || existingDeck.user_id !== req.userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    await deckRepository.deleteDeck(deckId, req.userId!);

    res.json({ message: 'Deck deleted successfully' });
  } catch (error: any) {
    console.error('Delete deck error:', error);
    res.status(500).json({ error: 'Failed to delete deck' });
  }
});

export default router;
