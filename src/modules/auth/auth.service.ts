import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { ENV } from '../../config/env';
import { GAME_CONSTANTS } from '../../shared/constants';
import { dbHelpers } from '../../config/database';
import userRepository from '../users/user.repository';
import emailService from '../email/email.service';
import type { User } from '../../shared/types';

export interface AuthTokenPayload {
  userId: number;
  username: string;
  email?: string;
}

export interface RegisterData {
  username: string;
  password: string;
  email: string;
  full_name: string;
  birth_date: string;   // YYYY-MM-DD
  phone?: string;
  lgpd_accepted: boolean;
  ip_address: string;
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function sessionExpiresAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + ENV.SESSION_EXPIRES_DAYS);
  return d;
}

export class AuthService {
  // ── Register ──────────────────────────────────────────────────────────────

  async register(data: RegisterData): Promise<{ user: User; token: string; email_verification_required: boolean }> {
    const { username, password, email, full_name, birth_date, phone, lgpd_accepted, ip_address } = data;

    if (!lgpd_accepted) throw Object.assign(new Error('lgpd_required'), { code: 'lgpd_required' });

    // Age check (min 13)
    const birth = new Date(birth_date);
    const ageMs = Date.now() - birth.getTime();
    const ageYears = ageMs / (1000 * 60 * 60 * 24 * 365.25);
    if (isNaN(ageYears) || ageYears < 13) {
      throw Object.assign(new Error('Você precisa ter pelo menos 13 anos para se cadastrar.'), { code: 'age_too_young' });
    }

    // Uniqueness checks with distinct errors
    const existingUsername = await userRepository.getUserByUsername(username);
    if (existingUsername) throw Object.assign(new Error('Este nick já está em uso.'), { code: 'username_taken' });

    const existingEmail = await dbHelpers.query<{ id: number }>(
      `SELECT id FROM users WHERE LOWER(email) = LOWER(?)`, [email]
    );
    if (existingEmail) throw Object.assign(new Error('Este email já está cadastrado.'), { code: 'email_taken' });

    const passwordHash = await bcrypt.hash(password, GAME_CONSTANTS.BCRYPT_ROUNDS);
    const normalizedEmail = email.toLowerCase().trim();

    const userId = await userRepository.createUser(username, passwordHash, normalizedEmail);

    // Save LGPD fields + account status via direct update
    await dbHelpers.run(
      `UPDATE users SET full_name = ?, birth_date = ?, phone = ?,
       lgpd_accepted_at = CURRENT_TIMESTAMP, lgpd_ip = ?,
       account_status = 'pending_verification', email_verified = ?
       WHERE id = ?`,
      [full_name, birth_date, phone || null, ip_address, false, userId]
    );

    const user = await userRepository.getUserById(userId);
    if (!user) throw new Error('Failed to create user');

    // Email verification token (24h)
    const verifyToken = crypto.randomBytes(32).toString('hex');
    await dbHelpers.run(
      `INSERT INTO email_tokens (user_id, token, type, expires_at) VALUES (?, ?, 'verify_email', ?)`,
      [userId, verifyToken, new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()]
    );

    emailService.sendVerificationEmail(normalizedEmail, username, verifyToken).catch((err) =>
      console.error('[Auth] Failed to send verification email:', err)
    );

    const token = this.generateToken({ userId: user.id, username: user.username, email: normalizedEmail });
    await this._createSession(userId, token, ip_address, '');

    return { user, token, email_verification_required: true };
  }

  // ── Login ─────────────────────────────────────────────────────────────────

  async login(
    identifier: string,
    password: string,
    ip_address: string,
    user_agent: string
  ): Promise<{ user: User; token: string; email_verification_required?: boolean }> {
    // Brute-force check
    await this._checkLoginAttempts(identifier, ip_address);

    // Accept username or email
    let user = await userRepository.getUserByUsername(identifier);
    if (!user) {
      user = await dbHelpers.query<User>(
        `SELECT * FROM users WHERE LOWER(email) = LOWER(?)`, [identifier]
      ) as User | null;
    }

    const recordAttempt = async (success: boolean) => {
      await dbHelpers.run(
        `INSERT INTO login_attempts (identifier, ip_address, success) VALUES (?, ?, ?)`,
        [identifier.toLowerCase(), ip_address, success ? 1 : 0]
      ).catch(() => {});
    };

    if (!user) {
      await recordAttempt(false);
      throw Object.assign(new Error('Usuário ou senha inválidos.'), { code: 'invalid_credentials' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      await recordAttempt(false);
      throw Object.assign(new Error('Usuário ou senha inválidos.'), { code: 'invalid_credentials' });
    }

    // Freeze check: pending_verification past 24h window
    if ((user as any).account_status === 'pending_verification') {
      const createdAt = new Date((user as any).created_at || 0).getTime();
      if (Date.now() - createdAt > 24 * 60 * 60 * 1000) {
        await dbHelpers.run(`UPDATE users SET account_status = 'frozen' WHERE id = ?`, [user.id]);
        await recordAttempt(false);
        throw Object.assign(
          new Error('Conta congelada. Verifique seu email para reativar.'),
          { code: 'account_frozen', reason: 'email_not_verified' }
        );
      }
    }

    if ((user as any).account_status === 'frozen') {
      await recordAttempt(false);
      throw Object.assign(
        new Error('Conta congelada. Verifique seu email para reativar.'),
        { code: 'account_frozen', reason: 'email_not_verified' }
      );
    }

    if ((user as any).account_status === 'banned') {
      await recordAttempt(false);
      throw Object.assign(new Error('Conta banida.'), { code: 'account_banned' });
    }

    await recordAttempt(true);

    // Invalidate all previous sessions (force single-session)
    await this._invalidateAllSessions(user.id);

    // Notify socket to force-logout previous connection (handled in socket.ts via io reference)
    AuthService._pendingForceLogout.add(user.id);

    await userRepository.updateLastLogin(user.id);

    const token = this.generateToken({ userId: user.id, username: user.username, email: user.email });
    await this._createSession(user.id, token, ip_address, user_agent);

    const emailVerificationRequired = (user as any).email_verified === false || (user as any).email_verified === 0;

    return { user, token, ...(emailVerificationRequired ? { email_verification_required: true } : {}) };
  }

  // ── Verify Email ──────────────────────────────────────────────────────────

  async verifyEmail(token: string): Promise<{ username: string }> {
    const row = await dbHelpers.query<{ id: number; user_id: number; expires_at: string }>(
      `SELECT id, user_id, expires_at FROM email_tokens
       WHERE token = ? AND type = 'verify_email' AND used_at IS NULL`,
      [token]
    );
    if (!row) throw Object.assign(new Error('Token inválido ou expirado.'), { code: 'invalid_token' });

    if (new Date(row.expires_at) < new Date()) {
      throw Object.assign(new Error('Token expirado. Solicite um novo.'), { code: 'token_expired' });
    }

    await dbHelpers.run(
      `UPDATE users SET email_verified = ?, email_verified_at = CURRENT_TIMESTAMP, account_status = 'active' WHERE id = ?`,
      [true, row.user_id]
    );
    await dbHelpers.run(`UPDATE email_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?`, [row.id]);

    const user = await userRepository.getUserById(row.user_id);
    if (!user) throw new Error('User not found');

    emailService.sendWelcomeEmail(user.email || '', user.username).catch(() => {});

    return { username: user.username };
  }

  // ── Logout ────────────────────────────────────────────────────────────────

  async logout(token: string, userId: number): Promise<void> {
    const tokenHash = hashToken(token);
    await dbHelpers.run(
      `UPDATE active_sessions SET invalidated_at = CURRENT_TIMESTAMP WHERE token_hash = ? AND user_id = ?`,
      [tokenHash, userId]
    );
  }

  // ── Resend Verification ───────────────────────────────────────────────────

  async resendVerification(userId: number): Promise<void> {
    const user = await userRepository.getUserById(userId);
    if (!user) throw new Error('User not found');
    if ((user as any).email_verified) throw Object.assign(new Error('Email já verificado.'), { code: 'already_verified' });

    // Invalidate old tokens
    await dbHelpers.run(
      `UPDATE email_tokens SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND type = 'verify_email' AND used_at IS NULL`,
      [userId]
    );

    const verifyToken = crypto.randomBytes(32).toString('hex');
    await dbHelpers.run(
      `INSERT INTO email_tokens (user_id, token, type, expires_at) VALUES (?, ?, 'verify_email', ?)`,
      [userId, verifyToken, new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()]
    );

    await emailService.sendVerificationEmail(user.email || '', user.username, verifyToken);
  }

  // ── Validate Session (for middleware) ────────────────────────────────────

  async validateSession(token: string): Promise<AuthTokenPayload> {
    const payload = this.verifyToken(token);
    const tokenHash = hashToken(token);

    const session = await dbHelpers.query<{ id: number }>(
      `SELECT id FROM active_sessions
       WHERE token_hash = ? AND invalidated_at IS NULL AND expires_at > CURRENT_TIMESTAMP`,
      [tokenHash]
    );
    if (!session) throw new Error('Session revoked');

    // Update last_seen_at (fire-and-forget)
    dbHelpers.run(`UPDATE active_sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?`, [session.id]).catch(() => {});

    return payload;
  }

  // ── Token helpers ─────────────────────────────────────────────────────────

  generateToken(payload: AuthTokenPayload): string {
    return jwt.sign(payload as any, ENV.JWT_SECRET, {
      expiresIn: `${ENV.SESSION_EXPIRES_DAYS}d`
    } as any);
  }

  verifyToken(token: string): AuthTokenPayload {
    try {
      return jwt.verify(token, ENV.JWT_SECRET) as AuthTokenPayload;
    } catch {
      throw new Error('Invalid token');
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async _checkLoginAttempts(identifier: string, ip: string): Promise<void> {
    const windowMs = ENV.LOGIN_WINDOW_MINUTES * 60 * 1000;
    const since = new Date(Date.now() - windowMs).toISOString();
    const maxAttempts = ENV.LOGIN_MAX_ATTEMPTS;

    const byIdentifier = await dbHelpers.query<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM login_attempts
       WHERE LOWER(identifier) = LOWER(?) AND success = ? AND attempted_at > ?`,
      [identifier, false, since]
    );
    if ((byIdentifier?.cnt || 0) >= maxAttempts) {
      throw Object.assign(
        new Error(`Muitas tentativas. Aguarde ${ENV.LOGIN_WINDOW_MINUTES} minutos.`),
        { code: 'too_many_attempts' }
      );
    }

    const byIp = await dbHelpers.query<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM login_attempts
       WHERE ip_address = ? AND success = ? AND attempted_at > ?`,
      [ip, false, since]
    );
    if ((byIp?.cnt || 0) >= maxAttempts * 3) {
      throw Object.assign(
        new Error(`Muitas tentativas. Aguarde ${ENV.LOGIN_WINDOW_MINUTES} minutos.`),
        { code: 'too_many_attempts' }
      );
    }
  }

  private async _createSession(userId: number, token: string, ip: string, userAgent: string): Promise<void> {
    const tokenHash = hashToken(token);
    await dbHelpers.run(
      `INSERT INTO active_sessions (user_id, token_hash, ip_address, user_agent, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, tokenHash, ip || null, userAgent || null, sessionExpiresAt().toISOString()]
    );
  }

  private async _invalidateAllSessions(userId: number): Promise<void> {
    await dbHelpers.run(
      `UPDATE active_sessions SET invalidated_at = CURRENT_TIMESTAMP
       WHERE user_id = ? AND invalidated_at IS NULL`,
      [userId]
    );
  }

  // Set populated by login(), consumed by socket.ts on next connect
  static _pendingForceLogout: Set<number> = new Set();
}

export default new AuthService();
