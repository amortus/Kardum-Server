import { Router, Request, Response } from 'express';
import { requireAdmin } from '../auth/auth.middleware';
import adminRepository from './admin.repository';
import cardRepository from '../cards/card.repository';
import boosterRepository from '../boosters/booster.repository';
import deckRepository from '../decks/deck.repository';
import monsterService from '../monsters/monster.service';
import npcService from '../npcs/npc.service';
import npcRepository from '../npcs/npc.repository';
import questRepository from '../quests/quest.repository';
import { SHADOWLAND_CARD_CATALOG, SHADOWLAND_COLLECTION } from '../monsters/shadowland-card.catalog';
import { ADMIN_COMMANDS_CATALOG } from './admin-command.catalog';
import dbHelpers from '../../config/database';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { resolveCardBasesDir, resolveCardImagesDir, resolveReadableUploadsDir } from '../../utils/uploads-path';

const router = Router();

class AdminValidationError extends Error {}

async function normalizeQuestRewards(
  rewardsInput: unknown
): Promise<Array<{ reward_type: string; reward_ref?: string | null; amount?: number; metadata_json?: string | null }>> {
  if (!Array.isArray(rewardsInput)) return [];
  const normalized: Array<{ reward_type: string; reward_ref?: string | null; amount?: number; metadata_json?: string | null }> = [];
  const seenCardUnlocks = new Set<string>();
  for (const raw of rewardsInput) {
    if (!raw || typeof raw !== 'object') continue;
    const reward = raw as Record<string, unknown>;
    const rewardType = String(reward.reward_type || '').trim().toUpperCase();
    if (!rewardType) continue;
    const rewardRefRaw = reward.reward_ref == null ? '' : String(reward.reward_ref).trim();
    const amountRaw = Number(reward.amount ?? 0);
    let metadataJson: string | null = null;
    if (reward.metadata_json != null && String(reward.metadata_json).trim() !== '') {
      if (typeof reward.metadata_json === 'string') {
        metadataJson = String(reward.metadata_json);
      } else {
        metadataJson = JSON.stringify(reward.metadata_json);
      }
    }

    if (rewardType === 'CARD_UNLOCK') {
      if (!rewardRefRaw) {
        throw new AdminValidationError('CARD_UNLOCK reward_ref is required');
      }
      const card = await cardRepository.getCardById(rewardRefRaw);
      if (!card) {
        throw new AdminValidationError(`CARD_UNLOCK card not found: ${rewardRefRaw}`);
      }
      if (seenCardUnlocks.has(rewardRefRaw)) {
        continue;
      }
      seenCardUnlocks.add(rewardRefRaw);
      normalized.push({
        reward_type: 'CARD_UNLOCK',
        reward_ref: rewardRefRaw,
        amount: 1,
        metadata_json: metadataJson
      });
      continue;
    }

    if (rewardType === 'EXP') {
      normalized.push({
        reward_type: 'EXP',
        reward_ref: rewardRefRaw || 'ai',
        amount: Math.max(1, Number.isFinite(amountRaw) ? Math.floor(amountRaw) : 1),
        metadata_json: metadataJson
      });
      continue;
    }

    normalized.push({
      reward_type: rewardType,
      reward_ref: rewardRefRaw || null,
      amount: Number.isFinite(amountRaw) ? amountRaw : 0,
      metadata_json: metadataJson
    });
  }
  return normalized;
}

// Todas as rotas requerem admin
router.use(requireAdmin);

// ===== OVERVIEW (dados reais para dashboard) =====
router.get('/overview-stats', async (_req: Request, res: Response) => {
  try {
    const stats = await adminRepository.getOverviewStats();
    res.json(stats);
  } catch (error: any) {
    console.error('Get overview stats error:', error);
    res.status(500).json({ error: 'Failed to get overview stats' });
  }
});

router.get('/commands', (_req: Request, res: Response) => {
  res.json({ commands: ADMIN_COMMANDS_CATALOG });
});

// Proxy para contornar CORS ao carregar imagens externas
router.get('/proxy-image', (req: Request, res: Response) => {
  const imageUrl = req.query.url as string;
  
  if (!imageUrl) {
    res.status(400).json({ error: 'URL parameter is required' });
    return;
  }
  
  try {
    const url = new URL(imageUrl);
    const protocol = url.protocol === 'https:' ? https : http;
    
    protocol.get(imageUrl, (proxyRes) => {
      if (proxyRes.statusCode !== 200) {
        res.status(proxyRes.statusCode || 500).json({ error: 'Failed to fetch image' });
        return;
      }
      
      // Set CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'image/jpeg');
      
      proxyRes.pipe(res);
    }).on('error', (err) => {
      console.error('Proxy error:', err);
      res.status(500).json({ error: 'Failed to proxy image' });
    });
  } catch (error) {
    console.error('Invalid URL:', error);
    res.status(400).json({ error: 'Invalid URL' });
  }
});

// ===== USUÁRIOS =====
router.get('/users', async (_req: Request, res: Response) => {
  try {
    const users = await adminRepository.getAllUsersWithDecks();
    res.json({ users });
  } catch (error: any) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

router.get('/users/:id', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    const user = await adminRepository.getUserDetails(userId);
    
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (error: any) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

router.get('/users/:id/decks', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    const decks = await adminRepository.getUserDecks(userId);
    res.json({ decks });
  } catch (error: any) {
    console.error('Get user decks error:', error);
    res.status(500).json({ error: 'Failed to get user decks' });
  }
});

// Apaga TODOS os decks de todos os usuários (operação destrutiva — requer confirmação)
router.delete('/decks/all', async (req: Request, res: Response) => {
  try {
    const { confirm } = req.body;
    if (confirm !== 'DELETE_ALL_DECKS') {
      res.status(400).json({
        error: 'Confirmação necessária',
        hint: 'Envie { "confirm": "DELETE_ALL_DECKS" } no body'
      });
      return;
    }
    const removed = await deckRepository.deleteAllDecks();
    console.log(`[Admin] All decks deleted by admin. Total removed: ${removed}`);
    res.json({ message: `Todos os decks foram apagados`, decks_removed: removed });
  } catch (error: any) {
    console.error('Delete all decks error:', error);
    res.status(500).json({ error: 'Failed to delete all decks' });
  }
});

// ===== CARTAS =====
router.get('/card-collections', async (_req: Request, res: Response) => {
  try {
    const collections = await dbHelpers.queryAll<any>(
      'SELECT * FROM card_collections WHERE is_active = 1 ORDER BY name ASC'
    );
    res.json({ collections });
  } catch (error: any) {
    console.error('Get card collections error:', error);
    res.status(500).json({ error: 'Failed to get card collections' });
  }
});

router.post('/card-collections', async (req: Request, res: Response) => {
  try {
    const payload = req.body || {};
    if (!payload.id || !payload.name) {
      res.status(400).json({ error: 'id and name are required' });
      return;
    }
    await dbHelpers.run(
      `INSERT INTO card_collections (id, name, description, is_active)
       VALUES (?, ?, ?, ?)`,
      [String(payload.id), String(payload.name), payload.description || null, payload.is_active === false ? 0 : 1]
    );
    res.status(201).json({ message: 'Collection created' });
  } catch (error: any) {
    console.error('Create card collection error:', error);
    res.status(500).json({ error: error.message || 'Failed to create collection' });
  }
});

router.put('/card-collections/:id', async (req: Request, res: Response) => {
  try {
    const payload = req.body || {};
    const current = await dbHelpers.query<any>(
      'SELECT * FROM card_collections WHERE id = ?',
      [req.params.id]
    );
    if (!current) {
      res.status(404).json({ error: 'Collection not found' });
      return;
    }
    await dbHelpers.run(
      `UPDATE card_collections
       SET name = ?, description = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        payload.name ?? current.name,
        payload.description ?? current.description,
        payload.is_active == null ? current.is_active : (payload.is_active ? 1 : 0),
        req.params.id
      ]
    );
    res.json({ message: 'Collection updated' });
  } catch (error: any) {
    console.error('Update card collection error:', error);
    res.status(500).json({ error: error.message || 'Failed to update collection' });
  }
});

async function upsertCatalogCards(
  catalog: any[],
  collectionId: string
): Promise<{ created: number; updated: number; total: number }> {
  let created = 0;
  let updated = 0;
  for (const rawCard of catalog) {
    const card = {
      ...rawCard,
      collection_id: collectionId,
      default_unlocked: false,
      visual_auras: [],
      abilities: (rawCard as any).abilities || []
    } as any;
    const existing = await cardRepository.getCardById(card.id);
    if (existing) {
      await cardRepository.updateCard(card.id, card);
      await dbHelpers.run(
        `UPDATE cards
         SET is_active = 1, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [card.id]
      );
      updated++;
    } else {
      await cardRepository.createCard(card);
      created++;
    }
  }
  return { created, updated, total: catalog.length };
}

async function cleanupCollectionCards(collectionId: string, validIds: string[]): Promise<number> {
  const activeRows = await dbHelpers.queryAll<{ id: string }>(
    `SELECT id FROM cards WHERE collection_id = ? AND is_active = 1`,
    [collectionId]
  );
  const valid = new Set(validIds.map((id) => String(id)));
  const staleIds = activeRows
    .map((row) => String(row.id))
    .filter((id) => !valid.has(id));
  for (const staleId of staleIds) {
    await dbHelpers.run(
      `UPDATE cards
       SET is_active = 0, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [staleId]
    );
  }
  return staleIds.length;
}

// Sync all cards -- re-parses and normalizes effects to array format.
// By default, DOES NOT reapply catalog cards (to avoid recreating deleted cards).
router.post('/cards/sync-all', async (req: Request, res: Response) => {
  try {
    const normalized = await cardRepository.syncAllCards();
    const shouldReapplyCatalog =
      String(req.query.reapply_catalog || req.body?.reapply_catalog || '').toLowerCase() === 'true';

    let catalogs: any = {};
    if (shouldReapplyCatalog) {
      await ensureCardCollection(SHADOWLAND_COLLECTION);
      const shadowlandCatalogResult = await upsertCatalogCards(
        SHADOWLAND_CARD_CATALOG as any[],
        SHADOWLAND_COLLECTION.id
      );
      const removedShadowland = await cleanupCollectionCards(
        SHADOWLAND_COLLECTION.id,
        (SHADOWLAND_CARD_CATALOG as any[]).map((card) => String(card.id))
      );
      catalogs = {
        shadowland_creatures: { ...shadowlandCatalogResult, removed: removedShadowland }
      };
    }

    res.json({
      synced: normalized.synced,
      errors: normalized.errors,
      catalogs,
      reapply_catalog: shouldReapplyCatalog
    });
  } catch (error: any) {
    console.error('Sync all cards error:', error);
    res.status(500).json({ error: 'Failed to sync cards' });
  }
});

router.post('/cards', async (req: Request, res: Response) => {
  try {
    const card = req.body;
    await cardRepository.createCard(card);
    res.status(201).json({ message: 'Card created successfully' });
  } catch (error: any) {
    console.error('Create card error:', error);
    res.status(500).json({ error: 'Failed to create card' });
  }
});

router.put('/cards/:id', async (req: Request, res: Response) => {
  try {
    const cardId = req.params.id;
    const { layout, ...cardData } = req.body;
    
    // Buscar carta existente para preencher campos obrigatórios
    const existingCard = await cardRepository.getCardById(cardId);
    if (!existingCard) {
      res.status(404).json({ error: 'Card not found' });
      return;
    }
    
    // Mesclar com dados existentes para garantir que campos obrigatórios estejam presentes
    const updateData: any = {
      ...existingCard,
      ...cardData
    };
    
    // Atualizar dados da carta
    await cardRepository.updateCard(cardId, updateData);
    
    // Se houver layout, salvar também
    if (layout) {
      await cardRepository.saveCardLayout(cardId, layout);
    }
    
    res.json({ message: 'Card updated successfully' });
  } catch (error: any) {
    console.error('Update card error:', error);
    res.status(500).json({ error: 'Failed to update card', details: error.message });
  }
});

// Upload de imagem renderizada da carta
router.post('/cards/:id/image', async (req: Request, res: Response) => {
  const cardId = req.params.id;
  try {
    const { image } = req.body; // Base64 data URL

    if (!image) {
      res.status(400).json({ error: 'Image data is required' });
      return;
    }

    const existingCard = await cardRepository.getCardById(cardId);
    if (!existingCard) {
      res.status(404).json({ error: 'Card not found', cardId });
      return;
    }

    const imagesDir = resolveCardImagesDir();
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    const base64Data = image.replace(/^data:image\/png;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    const imagePath = path.join(imagesDir, `${cardId}_rendered.png`);
    fs.writeFileSync(imagePath, imageBuffer);

    const imageUrlBase = `/uploads/card_images/${cardId}_rendered.png`;
    const imageUrl = `${imageUrlBase}?v=${Date.now()}`;

    await cardRepository.updateCard(cardId, { ...existingCard, image_url: imageUrl });

    res.json({ message: 'Card image uploaded successfully', image_url: imageUrl });
  } catch (error: any) {
    console.error('Upload card image error:', { cardId, error: error?.message ?? error });
    res.status(500).json({ error: 'Failed to upload card image', details: error?.message ?? String(error) });
  }
});

router.delete('/cards/:id', async (req: Request, res: Response) => {
  try {
    await cardRepository.deleteCard(req.params.id);
    res.json({ message: 'Card deleted successfully' });
  } catch (error: any) {
    console.error('Delete card error:', error);
    res.status(500).json({ error: 'Failed to delete card' });
  }
});

router.get('/cards/:id/layout', async (req: Request, res: Response) => {
  try {
    const layout = await cardRepository.getCardLayout(req.params.id);
    res.json({ layout });
  } catch (error: any) {
    console.error('Get card layout error:', error);
    res.status(500).json({ error: 'Failed to get card layout' });
  }
});

router.get('/card-layouts/global-vfx', async (_req: Request, res: Response) => {
  try {
    const layout = await cardRepository.getGlobalVfxLayout();
    res.json({ layout });
  } catch (error: any) {
    console.error('Get global VFX layout error:', error);
    res.status(500).json({ error: 'Failed to get global VFX layout' });
  }
});

router.put('/card-layouts/global-vfx', async (req: Request, res: Response) => {
  try {
    await cardRepository.saveGlobalVfxLayout(req.body?.layout || req.body);
    res.json({ message: 'Global VFX layout updated successfully' });
  } catch (error: any) {
    console.error('Update global VFX layout error:', error);
    res.status(500).json({ error: 'Failed to update global VFX layout' });
  }
});

router.post('/card-layouts/global-cardbase', async (req: Request, res: Response) => {
  try {
    const { image } = req.body || {};
    if (!image || typeof image !== 'string') {
      res.status(400).json({ error: 'Image data is required' });
      return;
    }
    if (!image.startsWith('data:image/')) {
      res.status(400).json({ error: 'Only data URL images are supported' });
      return;
    }

    const ext = image.includes('image/webp') ? 'webp' : image.includes('image/jpeg') ? 'jpg' : 'png';
    const base64Data = image.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    const basesDir = resolveCardBasesDir();
    if (!fs.existsSync(basesDir)) {
      fs.mkdirSync(basesDir, { recursive: true });
    }

    const fileName = `global_cardbase.${ext}`;
    const imagePath = path.join(basesDir, fileName);
    fs.writeFileSync(imagePath, imageBuffer);

    const imageUrl = `/uploads/card_bases/${fileName}?v=${Date.now()}`;
    const current = await cardRepository.getGlobalVfxLayout();
    await cardRepository.saveGlobalVfxLayout({
      ...current,
      cardbaseImageUrl: imageUrl
    });

    res.json({ message: 'Global cardbase uploaded successfully', cardbaseImageUrl: imageUrl });
  } catch (error: any) {
    console.error('Upload global cardbase error:', error);
    res.status(500).json({ error: 'Failed to upload global cardbase', details: error?.message || String(error) });
  }
});

// ===== BOOSTERS =====
router.post('/boosters', async (req: Request, res: Response) => {
  try {
    const booster = req.body;
    await boosterRepository.createBooster(booster);
    res.status(201).json({ message: 'Booster created successfully' });
  } catch (error: any) {
    console.error('Create booster error:', error);
    res.status(500).json({ error: 'Failed to create booster' });
  }
});

router.get('/boosters', async (_req: Request, res: Response) => {
  try {
    const boosters = await boosterRepository.getAllBoosters();
    res.json({ boosters });
  } catch (error: any) {
    console.error('Get boosters error:', error);
    res.status(500).json({ error: 'Failed to get boosters' });
  }
});

router.get('/boosters/:id', async (req: Request, res: Response) => {
  try {
    const booster = await boosterRepository.getBoosterById(req.params.id);
    
    if (!booster) {
      res.status(404).json({ error: 'Booster not found' });
      return;
    }

    res.json({ booster });
  } catch (error: any) {
    console.error('Get booster error:', error);
    res.status(500).json({ error: 'Failed to get booster' });
  }
});

router.put('/boosters/:id', async (req: Request, res: Response) => {
  try {
    const boosterId = req.params.id;
    const booster = req.body;
    await boosterRepository.updateBooster(boosterId, booster);
    res.json({ message: 'Booster updated successfully' });
  } catch (error: any) {
    console.error('Update booster error:', error);
    res.status(500).json({ error: 'Failed to update booster' });
  }
});

router.delete('/boosters/:id', async (req: Request, res: Response) => {
  try {
    await boosterRepository.deleteBooster(req.params.id);
    res.json({ message: 'Booster deleted successfully' });
  } catch (error: any) {
    console.error('Delete booster error:', error);
    res.status(500).json({ error: 'Failed to delete booster' });
  }
});

// Listar assets disponíveis
router.get('/assets', async (_req: Request, res: Response) => {
  try {
    const assets: { name: string; path: string }[] = [];
    
    // Buscar assets do projeto Godot
    const godotAssetsPath = path.join(__dirname, '../../../tcg-godot/assets');
    if (fs.existsSync(godotAssetsPath)) {
      const scanDirectory = (dir: string, basePath: string = '') => {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const fullPath = path.join(dir, file);
          const relativePath = path.join(basePath, file).replace(/\\/g, '/');
          const stat = fs.statSync(fullPath);
          
          if (stat.isDirectory()) {
            scanDirectory(fullPath, relativePath);
          } else if (/\.(png|jpg|jpeg|gif|webp)$/i.test(file)) {
            assets.push({
              name: file,
              path: `/assets/${relativePath}`
            });
          }
        }
      };
      
      scanDirectory(godotAssetsPath);
    }
    
    // Buscar assets do client também
    const clientAssetsPath = path.join(__dirname, '../../client/assets');
    if (fs.existsSync(clientAssetsPath)) {
      const scanDirectory = (dir: string, basePath: string = '') => {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const fullPath = path.join(dir, file);
          const relativePath = path.join(basePath, file).replace(/\\/g, '/');
          const stat = fs.statSync(fullPath);
          
          if (stat.isDirectory()) {
            scanDirectory(fullPath, relativePath);
          } else if (/\.(png|jpg|jpeg|gif|webp)$/i.test(file)) {
            assets.push({
              name: file,
              path: `/assets/${relativePath}`
            });
          }
        }
      };
      
      scanDirectory(clientAssetsPath);
    }
    
    // Buscar assets enviados via uploads (card_images/card_bases)
    const uploadsDir = resolveReadableUploadsDir();
    if (fs.existsSync(uploadsDir)) {
      const scanUploads = (dir: string, basePath: string = '') => {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const fullPath = path.join(dir, file);
          const relativePath = path.join(basePath, file).replace(/\\/g, '/');
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            scanUploads(fullPath, relativePath);
          } else if (/\.(png|jpg|jpeg|gif|webp)$/i.test(file)) {
            assets.push({
              name: `[uploads] ${file}`,
              path: `/uploads/${relativePath}`
            });
          }
        }
      };
      scanUploads(uploadsDir);
    }

    res.json({ assets });
  } catch (error: any) {
    console.error('Get assets error:', error);
    res.status(500).json({ error: 'Failed to get assets' });
  }
});

// ===== MONSTERS =====
router.get('/monsters/templates', async (_req: Request, res: Response) => {
  try {
    const templates = await monsterService.listTemplates();
    res.json({ templates });
  } catch (error: any) {
    console.error('Get monster templates error:', error);
    res.status(500).json({ error: 'Failed to list monster templates' });
  }
});

router.post('/monsters/templates', async (req: Request, res: Response) => {
  try {
    const payload = req.body || {};
    if (!payload.name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    const id = await monsterService.createTemplate({
      user_id: (req as any).userId as number,
      name: String(payload.name),
      difficulty: payload.difficulty || 'medium',
      sprite_ref: payload.sprite_ref || null,
      visual: payload.visual || null,
      collection_id: payload.collection_id || SHADOWLAND_COLLECTION.id,
      deck_mode: payload.deck_mode || 'hybrid',
      manual_deck_cards: Array.isArray(payload.manual_deck_cards) ? payload.manual_deck_cards : []
    });
    res.status(201).json({ id });
  } catch (error: any) {
    console.error('Create monster template error:', error);
    res.status(500).json({ error: error.message || 'Failed to create template' });
  }
});

router.put('/monsters/templates/:id', async (req: Request, res: Response) => {
  try {
    const templateId = Number(req.params.id);
    await monsterService.updateTemplate(templateId, {
      ...(req.body || {}),
      user_id: (req as any).userId as number
    });
    res.json({ message: 'Template updated' });
  } catch (error: any) {
    console.error('Update monster template error:', error);
    res.status(500).json({ error: error.message || 'Failed to update template' });
  }
});

router.get('/monsters/templates/:id/drops', async (req: Request, res: Response) => {
  try {
    const templateId = Number(req.params.id);
    if (!Number.isFinite(templateId) || templateId <= 0) {
      res.status(400).json({ error: 'Invalid template id' });
      return;
    }
    const drops = await monsterService.listTemplateDrops(templateId);
    res.json({ drops });
  } catch (error: any) {
    console.error('List template drops error:', error);
    res.status(500).json({ error: error.message || 'Failed to list template drops' });
  }
});

router.post('/monsters/templates/:id/drops', async (req: Request, res: Response) => {
  try {
    const templateId = Number(req.params.id);
    const payload = req.body || {};
    const cardId = String(payload.card_id || '').trim();
    const chance = Number(payload.drop_chance_percent);
    if (!Number.isFinite(templateId) || templateId <= 0) {
      res.status(400).json({ error: 'Invalid template id' });
      return;
    }
    if (!cardId) {
      res.status(400).json({ error: 'card_id is required' });
      return;
    }
    if (!Number.isFinite(chance) || chance < 0 || chance > 100) {
      res.status(400).json({ error: 'drop_chance_percent must be between 0 and 100' });
      return;
    }
    await monsterService.upsertTemplateDrop(templateId, cardId, chance);
    res.json({ message: 'Drop saved' });
  } catch (error: any) {
    console.error('Upsert template drop error:', error);
    res.status(500).json({ error: error.message || 'Failed to save template drop' });
  }
});

router.delete('/monsters/templates/:id/drops/:cardId', async (req: Request, res: Response) => {
  try {
    const templateId = Number(req.params.id);
    const cardId = String(req.params.cardId || '').trim();
    if (!Number.isFinite(templateId) || templateId <= 0) {
      res.status(400).json({ error: 'Invalid template id' });
      return;
    }
    if (!cardId) {
      res.status(400).json({ error: 'cardId is required' });
      return;
    }
    await monsterService.removeTemplateDrop(templateId, cardId);
    res.json({ message: 'Drop removed' });
  } catch (error: any) {
    console.error('Remove template drop error:', error);
    res.status(500).json({ error: error.message || 'Failed to remove template drop' });
  }
});

router.get('/monsters/spawns', async (req: Request, res: Response) => {
  try {
    const zone = String(req.query.zone || 'shadowland').trim().toLowerCase();
    const spawns = monsterService.getZoneRuntime(zone);
    res.json({ spawns });
  } catch (error: any) {
    console.error('Get monster spawns error:', error);
    res.status(500).json({ error: 'Failed to list monster spawns' });
  }
});

router.post('/monsters/spawns', async (req: Request, res: Response) => {
  try {
    const payload = req.body || {};
    const spawn = await monsterService.createSpawn({
      template_id: Number(payload.template_id),
      zone: String(payload.zone || 'shadowland').trim().toLowerCase(),
      spawn_x: Number(payload.spawn_x || 0),
      spawn_y: Number(payload.spawn_y || 0),
      respawn_seconds: Number(payload.respawn_seconds || 60),
      move_radius: Number(payload.move_radius || 120)
    });
    res.status(201).json({ spawn });
  } catch (error: any) {
    console.error('Create monster spawn error:', error);
    res.status(500).json({ error: error.message || 'Failed to create monster spawn' });
  }
});

router.put('/monsters/spawns/:spawnUid', async (req: Request, res: Response) => {
  try {
    const spawn = await monsterService.updateSpawn(req.params.spawnUid, req.body || {});
    res.json({ spawn });
  } catch (error: any) {
    console.error('Update monster spawn error:', error);
    res.status(500).json({ error: error.message || 'Failed to update monster spawn' });
  }
});

router.delete('/monsters/spawns/:spawnUid', async (req: Request, res: Response) => {
  try {
    await monsterService.removeSpawn(req.params.spawnUid);
    res.json({ message: 'Spawn removed' });
  } catch (error: any) {
    console.error('Delete monster spawn error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete monster spawn' });
  }
});

async function ensureCardCollection(payload: { id: string; name: string; description?: string }): Promise<void> {
  const existing = await dbHelpers.query<any>(
    'SELECT id FROM card_collections WHERE id = ?',
    [payload.id]
  );
  if (existing) {
    return;
  }
  await dbHelpers.run(
    `INSERT INTO card_collections (id, name, description, is_active)
     VALUES (?, ?, ?, 1)`,
    [payload.id, payload.name, payload.description || null]
  );
}

router.post('/monsters/seed-cards', async (req: Request, res: Response) => {
  try {
    await ensureCardCollection(SHADOWLAND_COLLECTION);
    const seeded = await upsertCatalogCards(SHADOWLAND_CARD_CATALOG as any[], SHADOWLAND_COLLECTION.id);
    const created = seeded.created;
    const updated = seeded.updated;
    const seededIds: string[] = (SHADOWLAND_CARD_CATALOG as any[]).map((card) => String(card.id));
    const removed = await cleanupCollectionCards(SHADOWLAND_COLLECTION.id, seededIds);

    const adminId = (req as any).userId as number;
    const existingDecks = await deckRepository.getUserDecks(adminId);
    const existingDeck = existingDecks.find((d) => d.name === 'Shadowland Duelist AI Deck');
    const deckPayload = {
      name: 'Shadowland Duelist AI Deck',
      cards: seededIds.slice(0, 35)
    };
    if (existingDeck) {
      await deckRepository.updateDeck(existingDeck.id, adminId, deckPayload);
    } else {
      await deckRepository.createDeck(adminId, deckPayload);
    }

    res.json({
      message: 'Shadowland duelist cards seeded',
      created,
      updated,
      total: seededIds.length,
      removed
    });
  } catch (error: any) {
    console.error('Seed monster cards error:', error);
    res.status(500).json({ error: error.message || 'Failed to seed monster cards' });
  }
});

router.post('/monsters/seed-shadowland-cards', async (req: Request, res: Response) => {
  try {
    await ensureCardCollection(SHADOWLAND_COLLECTION);

    const seeded = await upsertCatalogCards(SHADOWLAND_CARD_CATALOG as any[], SHADOWLAND_COLLECTION.id);
    const created = seeded.created;
    const updated = seeded.updated;
    const seededIds: string[] = (SHADOWLAND_CARD_CATALOG as any[]).map((card) => String(card.id));
    const removed = await cleanupCollectionCards(SHADOWLAND_COLLECTION.id, seededIds);

    const adminId = (req as any).userId as number;
    const existingDecks = await deckRepository.getUserDecks(adminId);
    const existingDeck = existingDecks.find((d) => d.name === 'Shadowland Creatures AI Deck');
    const deckPayload = {
      name: 'Shadowland Creatures AI Deck',
      cards: seededIds.slice(0, 35)
    };
    if (existingDeck) {
      await deckRepository.updateDeck(existingDeck.id, adminId, deckPayload);
    } else {
      await deckRepository.createDeck(adminId, deckPayload);
    }

    res.json({
      message: 'Shadowland cards seeded',
      created,
      updated,
      total: seededIds.length,
      collection_id: SHADOWLAND_COLLECTION.id,
      removed
    });
  } catch (error: any) {
    console.error('Seed shadowland cards error:', error);
    res.status(500).json({ error: error.message || 'Failed to seed shadowland cards' });
  }
});

// ===== NPCs =====
router.get('/npcs/templates', async (_req: Request, res: Response) => {
  try {
    const templates = await npcService.listTemplates();
    res.json({ templates });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to list NPC templates' });
  }
});

router.post('/npcs/templates', async (req: Request, res: Response) => {
  try {
    const payload = req.body || {};
    const code = String(payload.code || '').trim();
    const name = String(payload.name || '').trim();
    const spriteRef = String(payload.sprite_ref || '').trim();
    if (!code || !name || !spriteRef) {
      res.status(400).json({ error: 'code, name and sprite_ref are required' });
      return;
    }
    const id = await npcService.createTemplate({
      code,
      name,
      sprite_ref: spriteRef,
      frame_count: Number(payload.frame_count || 6),
      frame_cols: Number(payload.frame_cols || 6),
      frame_rows: Number(payload.frame_rows || 1),
      idle_start: Number(payload.idle_start || 0),
      idle_count: Number(payload.idle_count || 6),
      dialogue_json: payload.dialogue_json == null ? null : JSON.stringify(payload.dialogue_json)
    });
    res.status(201).json({ id });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create NPC template' });
  }
});

router.put('/npcs/templates/:id', async (req: Request, res: Response) => {
  try {
    const templateId = Number(req.params.id);
    if (!Number.isFinite(templateId) || templateId <= 0) {
      res.status(400).json({ error: 'Invalid template id' });
      return;
    }
    const payload = req.body || {};
    await npcService.updateTemplate(templateId, {
      code: payload.code,
      name: payload.name,
      sprite_ref: payload.sprite_ref,
      frame_count: payload.frame_count,
      frame_cols: payload.frame_cols,
      frame_rows: payload.frame_rows,
      idle_start: payload.idle_start,
      idle_count: payload.idle_count,
      dialogue_json: payload.dialogue_json == null ? null : JSON.stringify(payload.dialogue_json),
      is_active: payload.is_active
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update NPC template' });
  }
});

router.get('/npcs/spawns', async (req: Request, res: Response) => {
  try {
    const zone = String(req.query.zone || 'shadowland').trim().toLowerCase();
    const spawns = await npcService.listZoneSpawns(zone);
    res.json({ zone, spawns });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to list NPC spawns' });
  }
});

router.post('/npcs/spawns', async (req: Request, res: Response) => {
  try {
    const payload = req.body || {};
    const spawnUid = await npcService.createSpawn({
      npc_template_id: Number(payload.npc_template_id),
      zone: String(payload.zone || 'shadowland').trim().toLowerCase(),
      spawn_x: Number(payload.spawn_x || 0),
      spawn_y: Number(payload.spawn_y || 0),
      interaction_radius: Number(payload.interaction_radius || 90)
    });
    res.status(201).json({ spawnUid });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create NPC spawn' });
  }
});

router.put('/npcs/spawns/:spawnUid', async (req: Request, res: Response) => {
  try {
    const payload = req.body || {};
    await npcService.updateSpawn(req.params.spawnUid, {
      npc_template_id: payload.npc_template_id,
      zone: payload.zone,
      spawn_x: payload.spawn_x,
      spawn_y: payload.spawn_y,
      interaction_radius: payload.interaction_radius,
      is_active: payload.is_active
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update NPC spawn' });
  }
});

router.delete('/npcs/spawns/:spawnUid', async (req: Request, res: Response) => {
  try {
    await npcService.removeSpawn(req.params.spawnUid);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to remove NPC spawn' });
  }
});

// ===== Quests =====
router.get('/quests/definitions', async (_req: Request, res: Response) => {
  try {
    const definitions = await questRepository.listQuestDefinitions();
    const result = await Promise.all(definitions.map(async (definition) => ({
      ...definition,
      objectives: await questRepository.listQuestObjectives(definition.id),
      rewards: await questRepository.listQuestRewards(definition.id)
    })));
    res.json({ definitions: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to list quests' });
  }
});

router.post('/quests/definitions', async (req: Request, res: Response) => {
  try {
    const payload = req.body || {};
    const code = String(payload.code || '').trim();
    const title = String(payload.title || '').trim();
    if (!code || !title) {
      res.status(400).json({ error: 'code and title are required' });
      return;
    }
    const id = await questRepository.createQuestDefinition({
      code,
      title,
      description: String(payload.description || ''),
      giver_npc_template_id: payload.giver_npc_template_id == null ? null : Number(payload.giver_npc_template_id),
      turnin_npc_template_id: payload.turnin_npc_template_id == null ? null : Number(payload.turnin_npc_template_id),
      min_level: Number(payload.min_level || 1),
      recurrence_type: String(payload.recurrence_type || 'none'),
      auto_track: payload.auto_track !== false,
      objective_logic: payload.objective_logic === 'any' ? 'any' : 'all',
      metadata_json: payload.metadata_json == null ? null : JSON.stringify(payload.metadata_json),
      is_active: payload.is_active !== false
    });
    await questRepository.replaceQuestObjectives(id, Array.isArray(payload.objectives) ? payload.objectives : []);
    const rewards = await normalizeQuestRewards(payload.rewards);
    await questRepository.replaceQuestRewards(id, rewards);
    res.status(201).json({ id });
  } catch (error: any) {
    if (error instanceof AdminValidationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to create quest' });
  }
});

router.put('/quests/definitions/:id', async (req: Request, res: Response) => {
  try {
    const questId = Number(req.params.id);
    if (!Number.isFinite(questId) || questId <= 0) {
      res.status(400).json({ error: 'Invalid quest id' });
      return;
    }
    const payload = req.body || {};
    await questRepository.updateQuestDefinition(questId, {
      code: payload.code,
      title: payload.title,
      description: payload.description,
      giver_npc_template_id: payload.giver_npc_template_id,
      turnin_npc_template_id: payload.turnin_npc_template_id,
      min_level: payload.min_level,
      recurrence_type: payload.recurrence_type,
      auto_track: payload.auto_track,
      objective_logic: payload.objective_logic,
      metadata_json: payload.metadata_json == null ? null : JSON.stringify(payload.metadata_json),
      is_active: payload.is_active
    });
    if (Array.isArray(payload.objectives)) {
      await questRepository.replaceQuestObjectives(questId, payload.objectives);
    }
    if (Array.isArray(payload.rewards)) {
      const rewards = await normalizeQuestRewards(payload.rewards);
      await questRepository.replaceQuestRewards(questId, rewards);
    }
    res.json({ success: true });
  } catch (error: any) {
    if (error instanceof AdminValidationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to update quest' });
  }
});

router.post('/quests/seed-initial', async (_req: Request, res: Response) => {
  try {
    let trader = await npcRepository.getTemplateByCode('wandering_trader1');
    if (!trader) {
      const traderId = await npcService.createTemplate({
        code: 'wandering_trader1',
        name: 'Wandering Trader',
        sprite_ref: 'res://assets/NPC/wandering_trader1.png',
        frame_count: 6,
        frame_cols: 6,
        frame_rows: 1,
        idle_start: 0,
        idle_count: 6,
        dialogue_json: JSON.stringify([
          'Saudacoes, duelista.',
          'Preciso que voce prove seu valor contra o Duelista Iniciante.',
          'Venca 3 duelos e volte para receber sua recompensa.'
        ])
      });
      const templates = await npcService.listTemplates();
      trader = templates.find((template) => template.id === traderId) || null;
    }
    if (!trader) {
      res.status(500).json({ error: 'Unable to create trader NPC template' });
      return;
    }

    const existingSpawns = await npcService.listZoneSpawns('shadowland');
    if (!existingSpawns.some((spawn) => Number(spawn.npc_template_id) === Number(trader!.id))) {
      await npcService.createSpawn({
        npc_template_id: trader.id,
        zone: 'shadowland',
        spawn_x: 520,
        spawn_y: 420,
        interaction_radius: 100
      });
    }

    let quest = await questRepository.getQuestByCode('duelista_iniciante_trial');
    if (!quest) {
      const questId = await questRepository.createQuestDefinition({
        code: 'duelista_iniciante_trial',
        title: 'Prove seu Valor',
        description: 'Derrote 3 vezes o Duelista Iniciante e volte ao comerciante.',
        giver_npc_template_id: trader.id,
        turnin_npc_template_id: trader.id,
        min_level: 1,
        recurrence_type: 'none',
        auto_track: true,
        objective_logic: 'all',
        is_active: true
      });
      await questRepository.replaceQuestObjectives(questId, [
        {
          objective_type: 'WIN_DUEL_VS_MONSTER_TEMPLATE',
          target_ref: 'duelista iniciante',
          required_count: 3,
          filters_json: null,
          order_index: 0
        },
        {
          objective_type: 'TALK_TO_NPC',
          target_ref: String(trader.id),
          required_count: 1,
          filters_json: null,
          order_index: 1
        }
      ]);
      await questRepository.replaceQuestRewards(questId, [
        { reward_type: 'EXP', reward_ref: 'ai', amount: 3, metadata_json: JSON.stringify({ match_type: 'ai' }) }
      ]);
      quest = await questRepository.getQuestDefinitionById(questId);
    }

    res.json({
      success: true,
      npc_template_id: trader.id,
      quest_id: quest?.id || null
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to seed initial NPC and quest' });
  }
});

export default router;
