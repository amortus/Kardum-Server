import { Router, Request, Response } from 'express';
import authService from './auth.service';
import userRepository from '../users/user.repository';
import deckRepository from '../decks/deck.repository';
import { authenticateToken, AuthRequest } from './auth.middleware';

const router = Router();

// ── Validation helpers ────────────────────────────────────────────────────

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+\-() ]{7,20}$/;
const PASSWORD_SPECIAL_RE = /[^a-zA-Z0-9]/;

function validatePassword(p: string): string | null {
  if (p.length < 8) return 'Senha deve ter pelo menos 8 caracteres.';
  if (!/[A-Z]/.test(p)) return 'Senha deve ter pelo menos uma letra maiúscula.';
  if (!/[0-9]/.test(p)) return 'Senha deve ter pelo menos um número.';
  if (!PASSWORD_SPECIAL_RE.test(p)) return 'Senha deve ter pelo menos um caractere especial.';
  return null;
}

function onboardingFlags(user: any, deckCount: number) {
  return {
    requires_character_setup: Number(user.character_completed || 0) !== 1,
    requires_profile_avatar_setup:
      Number(user.character_completed || 0) === 1 && !user.profile_avatar_id,
    requires_deck_setup: deckCount === 0
  };
}

function safeUser(user: any) {
  const { password_hash, ...u } = user;
  return u;
}

function clientIp(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    ''
  );
}

// ── POST /register ────────────────────────────────────────────────────────

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password, email, full_name, birth_date, phone, lgpd_accepted } = req.body;

    // Required fields
    if (!username || !password || !email || !full_name || !birth_date) {
      res.status(400).json({ error: 'Campos obrigatórios: username, password, email, full_name, birth_date.' });
      return;
    }

    if (!USERNAME_RE.test(username)) {
      res.status(400).json({ error: 'Nick deve ter 3–20 caracteres e conter apenas letras, números ou _.' });
      return;
    }

    const pwErr = validatePassword(password);
    if (pwErr) { res.status(400).json({ error: pwErr }); return; }

    if (!EMAIL_RE.test(email)) {
      res.status(400).json({ error: 'Email inválido.' });
      return;
    }

    if (typeof full_name !== 'string' || full_name.trim().length < 2 || full_name.length > 100) {
      res.status(400).json({ error: 'Nome completo deve ter entre 2 e 100 caracteres.' });
      return;
    }

    if (!birth_date || isNaN(Date.parse(birth_date))) {
      res.status(400).json({ error: 'Data de nascimento inválida. Use o formato YYYY-MM-DD.' });
      return;
    }

    if (phone && !PHONE_RE.test(phone)) {
      res.status(400).json({ error: 'Telefone inválido.' });
      return;
    }

    if (lgpd_accepted !== true && lgpd_accepted !== 'true') {
      res.status(400).json({ error: 'Você deve aceitar os termos de uso e política de privacidade (LGPD).' });
      return;
    }

    const result = await authService.register({
      username,
      password,
      email,
      full_name: full_name.trim(),
      birth_date,
      phone: phone || undefined,
      lgpd_accepted: true,
      ip_address: clientIp(req)
    });

    const deckCount = await deckRepository.getUserDeckCount(result.user.id);

    res.status(201).json({
      user: safeUser(result.user),
      token: result.token,
      email_verification_required: result.email_verification_required,
      onboarding: onboardingFlags(result.user, deckCount)
    });
  } catch (error: any) {
    console.error('Register error:', error);
    res.status(400).json({ error: error.message || 'Erro ao cadastrar.', code: error.code });
  }
});

// ── POST /login ───────────────────────────────────────────────────────────

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Usuário/email e senha são obrigatórios.' });
      return;
    }

    const result = await authService.login(
      username,
      password,
      clientIp(req),
      req.headers['user-agent'] || ''
    );

    const deckCount = await deckRepository.getUserDeckCount(result.user.id);

    res.json({
      user: safeUser(result.user),
      token: result.token,
      ...(result.email_verification_required ? { email_verification_required: true } : {}),
      onboarding: onboardingFlags(result.user, deckCount)
    });
  } catch (error: any) {
    console.error('Login error:', error);
    const status = error.code === 'too_many_attempts' ? 429
      : error.code === 'account_frozen' || error.code === 'account_banned' ? 403
      : 401;
    res.status(status).json({ error: error.message || 'Erro ao fazer login.', code: error.code });
  }
});

// ── POST /logout ──────────────────────────────────────────────────────────

router.post('/logout', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1] || '';
    await authService.logout(token, req.userId!);
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao fazer logout.' });
  }
});

// ── GET /verify-email ─────────────────────────────────────────────────────

router.get('/verify-email', async (req: Request, res: Response) => {
  try {
    const token = req.query.token as string;
    if (!token) { res.status(400).json({ error: 'Token ausente.' }); return; }
    const result = await authService.verifyEmail(token);
    res.json({ ok: true, message: `Email verificado com sucesso. Bem-vindo, ${result.username}!` });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Token inválido.', code: error.code });
  }
});

// ── POST /resend-verification ─────────────────────────────────────────────

router.post('/resend-verification', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await authService.resendVerification(req.userId!);
    res.json({ ok: true, message: 'Email de verificação reenviado.' });
  } catch (error: any) {
    const status = error.code === 'already_verified' ? 400 : 500;
    res.status(status).json({ error: error.message || 'Erro ao reenviar.', code: error.code });
  }
});

// ── GET /me ───────────────────────────────────────────────────────────────

router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await userRepository.getUserById(req.userId!);
    if (!user) { res.status(404).json({ error: 'Usuário não encontrado.' }); return; }
    const deckCount = await deckRepository.getUserDeckCount(user.id);
    res.json({
      user: safeUser(user),
      onboarding: onboardingFlags(user, deckCount)
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao buscar usuário.' });
  }
});

export default router;
