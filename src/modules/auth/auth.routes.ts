import { Router, Request, Response } from 'express';
import authService from './auth.service';
import userRepository from '../users/user.repository';
import deckRepository from '../decks/deck.repository';
import { authenticateToken, AuthRequest } from './auth.middleware';

const router = Router();

// Register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password, email } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password required' });
      return;
    }

    if (username.length < 3 || username.length > 20) {
      res.status(400).json({ error: 'Username must be between 3 and 20 characters' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    const result = await authService.register(username, password, email);

    // Remove password hash from response
    const { password_hash, ...userWithoutPassword } = result.user;
    const deckCount = await deckRepository.getUserDeckCount(result.user.id);

    res.status(201).json({
      user: userWithoutPassword,
      token: result.token,
      onboarding: {
        requires_character_setup: Number(result.user.character_completed || 0) !== 1,
        requires_profile_avatar_setup:
          Number(result.user.character_completed || 0) === 1 && !result.user.profile_avatar_id,
        requires_deck_setup: deckCount === 0
      }
    });
  } catch (error: any) {
    console.error('Register error:', error);
    res.status(400).json({ error: error.message || 'Registration failed' });
  }
});

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password required' });
      return;
    }

    const result = await authService.login(username, password);

    // Remove password hash from response
    const { password_hash, ...userWithoutPassword } = result.user;
    const deckCount = await deckRepository.getUserDeckCount(result.user.id);

    res.json({
      user: userWithoutPassword,
      token: result.token,
      onboarding: {
        requires_character_setup: Number(result.user.character_completed || 0) !== 1,
        requires_profile_avatar_setup:
          Number(result.user.character_completed || 0) === 1 && !result.user.profile_avatar_id,
        requires_deck_setup: deckCount === 0
      }
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(401).json({ error: error.message || 'Login failed' });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await userRepository.getUserById(req.userId!);
    
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Remove password hash from response
    const { password_hash, ...userWithoutPassword } = user;
    const deckCount = await deckRepository.getUserDeckCount(user.id);

    res.json({
      user: userWithoutPassword,
      onboarding: {
        requires_character_setup: Number(user.character_completed || 0) !== 1,
        requires_profile_avatar_setup:
          Number(user.character_completed || 0) === 1 && !user.profile_avatar_id,
        requires_deck_setup: deckCount === 0
      }
    });
  } catch (error: any) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

export default router;
