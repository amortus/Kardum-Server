import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { ENV } from './config/env';
import { getUploadsCandidates, resolveReadableUploadsDir } from './utils/uploads-path';

// Routes
import authRoutes from './modules/auth/auth.routes';
import cardRoutes from './modules/cards/card.routes';
import deckRoutes from './modules/decks/deck.routes';
import adminRoutes from './modules/admin/admin.routes';
import userRoutes from './modules/users/user.routes';
import friendsRoutes from './modules/friends/friends.routes';
import questRoutes from './modules/quests/quest.routes';
import npcRoutes from './modules/npcs/npc.routes';
import mailRoutes from './modules/mail/mail.routes';
import dailyLoginRoutes from './modules/daily_login/daily_login.routes';
import worldRegionRoutes from './modules/world/world_region.routes';

export function createApp(): Express {
  const app = express();

  // Security headers
  app.use(helmet({ contentSecurityPolicy: false }));
  app.set('trust proxy', 1);

  // CORS
  app.use(cors({ origin: ENV.CORS_ORIGINS, credentials: true }));

  // Global anti-DoS rate limit
  app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false }));

  // Auth-specific rate limits (applied before routes)
  const authLoginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false, message: { error: 'Muitas tentativas. Aguarde 15 minutos.', code: 'too_many_requests' } });
  const authRegisterLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false, message: { error: 'Limite de cadastros atingido. Tente mais tarde.', code: 'too_many_requests' } });
  const resendLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 3, standardHeaders: true, legacyHeaders: false, message: { error: 'Limite de reenvio atingido. Aguarde 1 hora.', code: 'too_many_requests' } });

  app.use('/api/auth/login', authLoginLimiter);
  app.use('/api/auth/register', authRegisterLimiter);
  app.use('/api/auth/resend-verification', resendLimiter);

  // Body parsers — admin usa base64 (data URLs), mas limitamos uploads binários
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // Serve static files (admin dashboard only - game client is in Godot)
  app.use('/admin', express.static(path.join(__dirname, '../admin')));
  
  // Servir imagens de cartas renderizadas.
  // Em produção, o processo pode iniciar com cwd diferente (pm2/systemd/docker),
  // então resolvemos a pasta de uploads por candidatos + variável UPLOADS_DIR.
  const uploadsPath = resolveReadableUploadsDir();
  app.use('/uploads', express.static(uploadsPath));
  console.log('📦 Serving uploads from:', uploadsPath);
  console.log('📦 Upload candidates:', getUploadsCandidates());
  
  // Serve assets from Godot project if available (for card editor)
  const fs = require('fs');
  const godotAssetsPath = path.join(__dirname, '../../tcg-godot/assets');
  if (fs.existsSync(godotAssetsPath)) {
    app.use('/assets', express.static(godotAssetsPath));
    console.log('✅ Serving Godot assets from:', godotAssetsPath);
  } else {
    console.warn('⚠️  Godot assets path not found:', godotAssetsPath);
  }

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/cards', cardRoutes);
  app.use('/api/decks', deckRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/friends', friendsRoutes);
  app.use('/api/quests', questRoutes);
  app.use('/api/npcs', npcRoutes);
  app.use('/api/mail', mailRoutes);
  app.use('/api/daily-login', dailyLoginRoutes);
  app.use('/api/world', worldRegionRoutes);

  // Basic routes
  app.get('/', (_req: Request, res: Response) => {
    res.redirect('/admin');
  });

  app.get('/admin', (_req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, '../admin/index.html'));
  });

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      environment: ENV.NODE_ENV
    });
  });

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Error handler
  app.use((err: Error, _req: Request, res: Response, _next: any) => {
    console.error('Error:', err);
    res.status(500).json({ 
      error: 'Internal server error',
      message: ENV.NODE_ENV === 'development' ? err.message : undefined
    });
  });

  return app;
}
