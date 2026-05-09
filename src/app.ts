import express, { Express, Request, Response } from 'express';
import cors from 'cors';
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

  // Middleware
  app.use(cors({
    origin: ENV.CORS_ORIGINS,
    credentials: true
  }));
  // Uploads no admin usam data URL (base64) e podem ser bem grandes.
  // Nginx/proxy também precisa permitir (ver deploy/aws/nginx.conf).
  app.use(express.json({ limit: '256mb' }));
  app.use(express.urlencoded({ extended: true, limit: '256mb' }));

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
