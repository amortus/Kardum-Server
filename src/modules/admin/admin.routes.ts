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
import { seedShadowlandNpcsAndQuests } from '../quests/shadowland-quest.seed';
import { seedShadowlandMonsterTemplates } from '../monsters/shadowland-monsters.seed';
import { seedMonsterArchetypes } from '../monsters/archetype-monsters.seed';
import { SHADOWLAND_CARD_CATALOG, SHADOWLAND_COLLECTION } from '../monsters/shadowland-card.catalog';
import { GOBLIN_CARD_CATALOG, GOBLIN_COLLECTION } from '../cards/catalogs/goblin.card.catalog';
import { DWARF_CARD_CATALOG, DWARF_COLLECTION } from '../cards/catalogs/dwarf.card.catalog';
import { ELF_CARD_CATALOG, ELF_COLLECTION } from '../cards/catalogs/elf.card.catalog';
import { ANT_CARD_CATALOG, ANT_COLLECTION } from '../cards/catalogs/ant.card.catalog';
import { NECROMANCER_CARD_CATALOG, NECROMANCER_COLLECTION } from '../cards/catalogs/necromancer.card.catalog';
import { ADMIN_COMMANDS_CATALOG } from './admin-command.catalog';
import dbHelpers from '../../config/database';
import mailAdminService, { normalizeAudience } from '../mail/mail.admin';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { resolveCardArtworksDir, resolveCardBasesDir, resolveCardImagesDir, resolveReadableUploadsDir } from '../../utils/uploads-path';

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

async function normalizeQuestPrerequisites(
  prerequisitesInput: unknown
): Promise<Array<{ prerequisite_type: string; reference_value: string; operator: string; required_count: number }>> {
  if (!Array.isArray(prerequisitesInput)) return [];
  const normalized: Array<{ prerequisite_type: string; reference_value: string; operator: string; required_count: number }> = [];
  const uniqueKeys = new Set<string>();
  for (const raw of prerequisitesInput) {
    if (!raw || typeof raw !== 'object') continue;
    const prerequisite = raw as Record<string, unknown>;
    const prerequisiteType = String(prerequisite.prerequisite_type || prerequisite.type || '')
      .trim()
      .toUpperCase();
    if (!prerequisiteType) continue;
    const operator = String(prerequisite.operator || 'eq').trim() || 'eq';
    const requiredCount = Math.max(1, Number(prerequisite.required_count || prerequisite.requiredCount || 1));

    let referenceValue = '';
    if (prerequisite.reference_value != null && String(prerequisite.reference_value).trim() !== '') {
      referenceValue = String(prerequisite.reference_value).trim();
    } else if (prerequisite.quest_id != null && String(prerequisite.quest_id).trim() !== '') {
      referenceValue = String(prerequisite.quest_id).trim();
    } else if (prerequisite.quest_code != null && String(prerequisite.quest_code).trim() !== '') {
      referenceValue = String(prerequisite.quest_code).trim();
    }
    if (!referenceValue) {
      throw new AdminValidationError(`prerequisite reference is required for type ${prerequisiteType}`);
    }

    if (prerequisiteType === 'QUEST_COMPLETED') {
      const numericQuestId = Number(referenceValue);
      if (Number.isFinite(numericQuestId) && numericQuestId > 0) {
        const byId = await questRepository.getQuestDefinitionById(Math.floor(numericQuestId));
        if (!byId) {
          throw new AdminValidationError(`prerequisite quest not found by id: ${referenceValue}`);
        }
      } else {
        const byCode = await questRepository.getQuestByCode(referenceValue);
        if (!byCode) {
          throw new AdminValidationError(`prerequisite quest not found by code: ${referenceValue}`);
        }
      }
    }

    const uniqueKey = `${prerequisiteType}:${referenceValue.toLowerCase()}:${operator.toLowerCase()}:${requiredCount}`;
    if (uniqueKeys.has(uniqueKey)) continue;
    uniqueKeys.add(uniqueKey);
    normalized.push({
      prerequisite_type: prerequisiteType,
      reference_value: referenceValue,
      operator,
      required_count: requiredCount
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

// Upload de ARTWORK cru da carta (sem moldura / sem HUD) — salva em image_url
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

    if (!image.startsWith('data:image/')) {
      res.status(400).json({ error: 'Only data URL images are supported' });
      return;
    }

    const artworksDir = resolveCardArtworksDir();
    if (!fs.existsSync(artworksDir)) {
      fs.mkdirSync(artworksDir, { recursive: true });
    }

    const ext = image.includes('image/webp') ? 'webp' : image.includes('image/jpeg') ? 'jpg' : 'png';
    const base64Data = image.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    const fileName = `${cardId}.${ext}`;
    const imagePath = path.join(artworksDir, fileName);
    fs.writeFileSync(imagePath, imageBuffer);

    const imageUrlBase = `/uploads/card_artworks/${fileName}`;
    const imageUrl = `${imageUrlBase}?v=${Date.now()}`;

    await cardRepository.updateCard(cardId, { ...existingCard, image_url: imageUrl });

    res.json({ message: 'Card artwork uploaded successfully', image_url: imageUrl });
  } catch (error: any) {
    console.error('Upload card image error:', { cardId, error: error?.message ?? error });
    res.status(500).json({ error: 'Failed to upload card image', details: error?.message ?? String(error) });
  }
});

/** Upload imagem completa da carta (full-bleed); HUD é desenhada no cliente. Salva em card_image_url. */
router.post('/cards/:id/card-image', async (req: Request, res: Response) => {
  const cardId = req.params.id;
  try {
    const { image } = req.body;

    if (!image || typeof image !== 'string') {
      res.status(400).json({ error: 'Image data is required' });
      return;
    }

    const existingCard = await cardRepository.getCardById(cardId);
    if (!existingCard) {
      res.status(404).json({ error: 'Card not found', cardId });
      return;
    }

    if (!image.startsWith('data:image/')) {
      res.status(400).json({ error: 'Only data URL images are supported' });
      return;
    }

    const imagesDir = resolveCardImagesDir();
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    const ext = image.includes('image/webp') ? 'webp' : image.includes('image/jpeg') ? 'jpg' : 'png';
    const base64Data = image.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    const fileName = `${cardId}_full.${ext}`;
    const imagePath = path.join(imagesDir, fileName);
    fs.writeFileSync(imagePath, imageBuffer);

    const imageUrlBase = `/uploads/card_images/${fileName}`;
    const cardImageUrl = `${imageUrlBase}?v=${Date.now()}`;

    await cardRepository.updateCard(cardId, { ...existingCard, card_image_url: cardImageUrl });

    res.json({ message: 'Full card image uploaded successfully', card_image_url: cardImageUrl });
  } catch (error: any) {
    console.error('Upload full card image error:', { cardId, error: error?.message ?? error });
    res.status(500).json({ error: 'Failed to upload full card image', details: error?.message ?? String(error) });
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
    const msg = String(error?.message || '');
    if (msg.toLowerCase().includes('spawn not found')) {
      res.status(404).json({ error: 'Spawn not found' });
      return;
    }
    res.status(500).json({ error: msg || 'Failed to delete monster spawn' });
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

router.post('/goblins/seed-cards', async (_req: Request, res: Response) => {
  try {
    await ensureCardCollection(GOBLIN_COLLECTION);
    const seeded = await upsertCatalogCards(GOBLIN_CARD_CATALOG as any[], GOBLIN_COLLECTION.id);
    const seededIds: string[] = (GOBLIN_CARD_CATALOG as any[]).map((card) => String(card.id));
    const removed = await cleanupCollectionCards(GOBLIN_COLLECTION.id, seededIds);
    res.json({
      message: 'Goblin cards seeded',
      collection_id: GOBLIN_COLLECTION.id,
      created: seeded.created,
      updated: seeded.updated,
      total: seeded.total,
      removed
    });
  } catch (error: any) {
    console.error('Seed goblin cards error:', error);
    res.status(500).json({ error: error.message || 'Failed to seed goblin cards' });
  }
});

router.post('/dwarves/seed-cards', async (_req: Request, res: Response) => {
  try {
    await ensureCardCollection(DWARF_COLLECTION);
    const seeded = await upsertCatalogCards(DWARF_CARD_CATALOG as any[], DWARF_COLLECTION.id);
    const seededIds: string[] = (DWARF_CARD_CATALOG as any[]).map((card) => String(card.id));
    const removed = await cleanupCollectionCards(DWARF_COLLECTION.id, seededIds);
    res.json({
      message: 'Dwarf cards seeded',
      collection_id: DWARF_COLLECTION.id,
      created: seeded.created,
      updated: seeded.updated,
      total: seeded.total,
      removed
    });
  } catch (error: any) {
    console.error('Seed dwarf cards error:', error);
    res.status(500).json({ error: error.message || 'Failed to seed dwarf cards' });
  }
});

router.post('/elves/seed-cards', async (_req: Request, res: Response) => {
  try {
    await ensureCardCollection(ELF_COLLECTION);
    const seeded = await upsertCatalogCards(ELF_CARD_CATALOG as any[], ELF_COLLECTION.id);
    const seededIds: string[] = (ELF_CARD_CATALOG as any[]).map((card) => String(card.id));
    const removed = await cleanupCollectionCards(ELF_COLLECTION.id, seededIds);
    res.json({
      message: 'Elf cards seeded',
      collection_id: ELF_COLLECTION.id,
      created: seeded.created,
      updated: seeded.updated,
      total: seeded.total,
      removed
    });
  } catch (error: any) {
    console.error('Seed elf cards error:', error);
    res.status(500).json({ error: error.message || 'Failed to seed elf cards' });
  }
});

// ===== Regiões do mundo (spawnpoints nomeados) =====

router.get('/world/regions', async (req: Request, res: Response) => {
  try {
    const zone = String(req.query.zone || 'shadowland').trim().toLowerCase();
    const rows = await dbHelpers.queryAll<any>(
      `SELECT id, name, zone, center_x, center_y, radius, icon_type, is_active
       FROM world_regions WHERE zone = ? ORDER BY name ASC`,
      [zone]
    );
    res.json({ regions: rows.map(r => ({
      id: Number(r.id), name: String(r.name), zone: String(r.zone),
      x: Number(r.center_x), y: Number(r.center_y),
      radius: Number(r.radius), icon_type: String(r.icon_type || 'location'),
      is_active: r.is_active === true || r.is_active === 1
    })) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/world/regions', async (req: Request, res: Response) => {
  try {
    const { name, zone, x, y, radius, icon_type } = req.body || {};
    if (!name || !String(name).trim()) { res.status(400).json({ error: 'name obrigatório' }); return; }
    await dbHelpers.run(
      `INSERT INTO world_regions (name, zone, center_x, center_y, radius, icon_type, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [String(name).trim(), String(zone || 'shadowland').trim(), Number(x) || 0,
       Number(y) || 0, Number(radius) || 800, String(icon_type || 'location').trim(),
       (req as any).userId]
    );
    res.status(201).json({ message: 'Região criada' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/world/regions/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { name, radius, icon_type } = req.body || {};
    const updates: string[] = [];
    const params: any[] = [];
    if (name !== undefined)      { updates.push('name = ?');      params.push(String(name).trim()); }
    if (radius !== undefined)    { updates.push('radius = ?');    params.push(Number(radius)); }
    if (icon_type !== undefined) { updates.push('icon_type = ?'); params.push(String(icon_type).trim()); }
    if (!updates.length) { res.status(400).json({ error: 'Nada para atualizar' }); return; }
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    await dbHelpers.run(`UPDATE world_regions SET ${updates.join(', ')} WHERE id = ?`, params);
    res.json({ message: 'Região atualizada' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/world/regions/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    await dbHelpers.run(
      `UPDATE world_regions SET is_active = ${false}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [id]
    );
    res.json({ message: 'Região removida' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/ants/seed-cards', async (_req: Request, res: Response) => {
  try {
    await ensureCardCollection(ANT_COLLECTION);
    const seeded = await upsertCatalogCards(ANT_CARD_CATALOG as any[], ANT_COLLECTION.id);
    const seededIds: string[] = (ANT_CARD_CATALOG as any[]).map((card) => String(card.id));
    const removed = await cleanupCollectionCards(ANT_COLLECTION.id, seededIds);
    res.json({
      message: 'Ant cards seeded',
      collection_id: ANT_COLLECTION.id,
      created: seeded.created,
      updated: seeded.updated,
      total: seeded.total,
      removed
    });
  } catch (error: any) {
    console.error('Seed ant cards error:', error);
    res.status(500).json({ error: error.message || 'Failed to seed ant cards' });
  }
});

router.post('/monsters/seed-archetypes', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number;
    const results = await seedMonsterArchetypes({ userId });
    res.json({ message: 'Monster archetypes seeded', results });
  } catch (error: any) {
    console.error('Seed monster archetypes error:', error);
    res.status(500).json({ error: error.message || 'Failed to seed monster archetypes' });
  }
});

router.post('/necromancers/seed-cards', async (_req: Request, res: Response) => {
  try {
    await ensureCardCollection(NECROMANCER_COLLECTION);
    const seeded = await upsertCatalogCards(NECROMANCER_CARD_CATALOG as any[], NECROMANCER_COLLECTION.id);
    const seededIds: string[] = (NECROMANCER_CARD_CATALOG as any[]).map((card) => String(card.id));
    const removed = await cleanupCollectionCards(NECROMANCER_COLLECTION.id, seededIds);
    res.json({
      message: 'Necromancer cards seeded',
      collection_id: NECROMANCER_COLLECTION.id,
      created: seeded.created,
      updated: seeded.updated,
      total: seeded.total,
      removed
    });
  } catch (error: any) {
    console.error('Seed necromancer cards error:', error);
    res.status(500).json({ error: error.message || 'Failed to seed necromancer cards' });
  }
});

// ===== MAIL (admin) =====
router.post('/mail/send-user', async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).userId as number;
    const payload = req.body || {};
    const userId = Number(payload.userId);
    const subject = String(payload.subject || '').trim();
    const body = String(payload.body || '').trim();
    const deliverAt = String(payload.deliverAt || new Date().toISOString());
    const attachments = Array.isArray(payload.attachments) ? payload.attachments : [];
    if (!Number.isFinite(userId) || userId <= 0) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }
    if (!subject || !body) {
      res.status(400).json({ error: 'subject and body are required' });
      return;
    }
    const msg = await mailAdminService.sendUserMail({
      userId,
      adminId,
      subject,
      body,
      deliverAt,
      attachments
    });
    res.status(201).json({ message: 'Mail queued', mailId: msg.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to send mail' });
  }
});

router.post('/mail/campaigns', async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).userId as number;
    const payload = req.body || {};
    const name = String(payload.name || '').trim();
    const subject = String(payload.subject || '').trim();
    const body = String(payload.body || '').trim();
    const deliverAt = String(payload.deliverAt || '').trim();
    const audience = normalizeAudience(payload.audience);
    const attachments = Array.isArray(payload.attachments) ? payload.attachments : [];
    if (!name || !subject || !body || !deliverAt) {
      res.status(400).json({ error: 'name, subject, body, deliverAt are required' });
      return;
    }
    const created = await mailAdminService.createCampaign({
      name,
      subject,
      body,
      deliverAt,
      audience,
      attachments,
      adminId
    });
    res.status(201).json({ campaignId: created.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create campaign' });
  }
});

router.get('/mail/campaigns', async (_req: Request, res: Response) => {
  try {
    const campaigns = await mailAdminService.listCampaigns(200);
    res.json({ campaigns });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to list campaigns' });
  }
});

router.post('/mail/campaigns/:id/cancel', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid id' });
      return;
    }
    await mailAdminService.cancelCampaign(id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to cancel campaign' });
  }
});

// ===== DAILY LOGIN CALENDAR (admin) =====
router.get('/daily-login/config', async (req: Request, res: Response) => {
  try {
    const month = String(req.query.month || '').trim();
    if (!month) {
      res.status(400).json({ error: 'month is required (YYYY-MM)' });
      return;
    }
    const cfg = await dbHelpers.query<any>(
      `SELECT * FROM daily_login_calendar_configs WHERE month_key = ?`,
      [month]
    );
    res.json({ config: cfg || null });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load daily login config' });
  }
});

router.post('/daily-login/config', async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).userId as number;
    const payload = req.body || {};
    const month = String(payload.month || payload.month_key || '').trim();
    const daysTotal = Number(payload.days_total || payload.daysTotal || 20);
    const rewards = payload.rewards;
    const isActive = payload.is_active === false ? 0 : 1;
    if (!month) {
      res.status(400).json({ error: 'month is required (YYYY-MM)' });
      return;
    }
    if (!Number.isFinite(daysTotal) || daysTotal <= 0 || daysTotal > 31) {
      res.status(400).json({ error: 'days_total invalid' });
      return;
    }
    const rewardsJson = JSON.stringify(Array.isArray(rewards) ? rewards : []);

    await dbHelpers.run(
      `INSERT INTO daily_login_calendar_configs (month_key, days_total, rewards_json, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT(month_key) DO UPDATE SET
         days_total=excluded.days_total,
         rewards_json=excluded.rewards_json,
         is_active=excluded.is_active,
         updated_at=CURRENT_TIMESTAMP`,
      [month, Math.floor(daysTotal), rewardsJson, isActive]
    );

    // no-op: keep import used; adminId reserved for future logs/audit
    void adminId;
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to upsert daily login config' });
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
router.get('/quests/definitions', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.max(1, Math.min(200, Number(req.query.limit || 50)));
    const search = String(req.query.search || '').trim();
    const giverNpcTemplateIdRaw = Number(req.query.giver_npc_template_id);
    const includeInactive = String(req.query.include_inactive || '').trim().toLowerCase() === 'true';
    const list = await questRepository.listQuestDefinitionsForAdmin({
      page,
      limit,
      search,
      giverNpcTemplateId: Number.isFinite(giverNpcTemplateIdRaw) && giverNpcTemplateIdRaw > 0 ? giverNpcTemplateIdRaw : null,
      includeInactive
    });
    const result = await Promise.all(list.items.map(async (definition) => ({
      ...definition,
      objectives: await questRepository.listQuestObjectives(definition.id),
      rewards: await questRepository.listQuestRewards(definition.id),
      prerequisites: await questRepository.listQuestPrerequisites(definition.id)
    })));
    res.json({
      definitions: result,
      page: list.page,
      limit: list.limit,
      total: list.total
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to list quests' });
  }
});

router.get('/npcs/:id/quests', async (req: Request, res: Response) => {
  try {
    const npcTemplateId = Number(req.params.id);
    if (!Number.isFinite(npcTemplateId) || npcTemplateId <= 0) {
      res.status(400).json({ error: 'Invalid npc template id' });
      return;
    }
    const definitions = await questRepository.listQuestDefinitionsByNpcTemplate(npcTemplateId);
    const result = await Promise.all(definitions.map(async (definition) => ({
      ...definition,
      objectives: await questRepository.listQuestObjectives(definition.id),
      rewards: await questRepository.listQuestRewards(definition.id),
      prerequisites: await questRepository.listQuestPrerequisites(definition.id)
    })));
    res.json({ npc_template_id: npcTemplateId, definitions: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to list NPC quests' });
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
    const prerequisites = await normalizeQuestPrerequisites(payload.prerequisites);
    await questRepository.replaceQuestPrerequisites(id, prerequisites);
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
    if (Array.isArray(payload.prerequisites)) {
      const prerequisites = await normalizeQuestPrerequisites(payload.prerequisites);
      await questRepository.replaceQuestPrerequisites(questId, prerequisites);
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

router.post('/quests/seed-shadowland-chain', async (_req: Request, res: Response) => {
  try {
    const result = await seedShadowlandNpcsAndQuests();
    res.json({
      success: true,
      npcs: result.npcs,
      quests: result.quests
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to seed Shadowland quest chain' });
  }
});

router.post('/monsters/seed-shadowland-templates', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number;
    const result = await seedShadowlandMonsterTemplates({ userId });
    // Make runtime reflect any DB updates (spawns may use visuals).
    await monsterService.reloadRuntimeFromDatabase();
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to seed Shadowland monster templates' });
  }
});

export default router;
