"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../auth/auth.middleware");
const admin_repository_1 = __importDefault(require("./admin.repository"));
const card_repository_1 = __importDefault(require("../cards/card.repository"));
const booster_repository_1 = __importDefault(require("../boosters/booster.repository"));
const deck_repository_1 = __importDefault(require("../decks/deck.repository"));
const monster_service_1 = __importDefault(require("../monsters/monster.service"));
const npc_service_1 = __importDefault(require("../npcs/npc.service"));
const npc_repository_1 = __importDefault(require("../npcs/npc.repository"));
const quest_repository_1 = __importDefault(require("../quests/quest.repository"));
const shadowland_card_catalog_1 = require("../monsters/shadowland-card.catalog");
const admin_command_catalog_1 = require("./admin-command.catalog");
const database_1 = __importDefault(require("../../config/database"));
const https_1 = __importDefault(require("https"));
const http_1 = __importDefault(require("http"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const uploads_path_1 = require("../../utils/uploads-path");
const router = (0, express_1.Router)();
class AdminValidationError extends Error {
}
async function normalizeQuestRewards(rewardsInput) {
    if (!Array.isArray(rewardsInput))
        return [];
    const normalized = [];
    const seenCardUnlocks = new Set();
    for (const raw of rewardsInput) {
        if (!raw || typeof raw !== 'object')
            continue;
        const reward = raw;
        const rewardType = String(reward.reward_type || '').trim().toUpperCase();
        if (!rewardType)
            continue;
        const rewardRefRaw = reward.reward_ref == null ? '' : String(reward.reward_ref).trim();
        const amountRaw = Number(reward.amount ?? 0);
        let metadataJson = null;
        if (reward.metadata_json != null && String(reward.metadata_json).trim() !== '') {
            if (typeof reward.metadata_json === 'string') {
                metadataJson = String(reward.metadata_json);
            }
            else {
                metadataJson = JSON.stringify(reward.metadata_json);
            }
        }
        if (rewardType === 'CARD_UNLOCK') {
            if (!rewardRefRaw) {
                throw new AdminValidationError('CARD_UNLOCK reward_ref is required');
            }
            const card = await card_repository_1.default.getCardById(rewardRefRaw);
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
async function normalizeQuestPrerequisites(prerequisitesInput) {
    if (!Array.isArray(prerequisitesInput))
        return [];
    const normalized = [];
    const uniqueKeys = new Set();
    for (const raw of prerequisitesInput) {
        if (!raw || typeof raw !== 'object')
            continue;
        const prerequisite = raw;
        const prerequisiteType = String(prerequisite.prerequisite_type || prerequisite.type || '')
            .trim()
            .toUpperCase();
        if (!prerequisiteType)
            continue;
        const operator = String(prerequisite.operator || 'eq').trim() || 'eq';
        const requiredCount = Math.max(1, Number(prerequisite.required_count || prerequisite.requiredCount || 1));
        let referenceValue = '';
        if (prerequisite.reference_value != null && String(prerequisite.reference_value).trim() !== '') {
            referenceValue = String(prerequisite.reference_value).trim();
        }
        else if (prerequisite.quest_id != null && String(prerequisite.quest_id).trim() !== '') {
            referenceValue = String(prerequisite.quest_id).trim();
        }
        else if (prerequisite.quest_code != null && String(prerequisite.quest_code).trim() !== '') {
            referenceValue = String(prerequisite.quest_code).trim();
        }
        if (!referenceValue) {
            throw new AdminValidationError(`prerequisite reference is required for type ${prerequisiteType}`);
        }
        if (prerequisiteType === 'QUEST_COMPLETED') {
            const numericQuestId = Number(referenceValue);
            if (Number.isFinite(numericQuestId) && numericQuestId > 0) {
                const byId = await quest_repository_1.default.getQuestDefinitionById(Math.floor(numericQuestId));
                if (!byId) {
                    throw new AdminValidationError(`prerequisite quest not found by id: ${referenceValue}`);
                }
            }
            else {
                const byCode = await quest_repository_1.default.getQuestByCode(referenceValue);
                if (!byCode) {
                    throw new AdminValidationError(`prerequisite quest not found by code: ${referenceValue}`);
                }
            }
        }
        const uniqueKey = `${prerequisiteType}:${referenceValue.toLowerCase()}:${operator.toLowerCase()}:${requiredCount}`;
        if (uniqueKeys.has(uniqueKey))
            continue;
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
router.use(auth_middleware_1.requireAdmin);
// ===== OVERVIEW (dados reais para dashboard) =====
router.get('/overview-stats', async (_req, res) => {
    try {
        const stats = await admin_repository_1.default.getOverviewStats();
        res.json(stats);
    }
    catch (error) {
        console.error('Get overview stats error:', error);
        res.status(500).json({ error: 'Failed to get overview stats' });
    }
});
router.get('/commands', (_req, res) => {
    res.json({ commands: admin_command_catalog_1.ADMIN_COMMANDS_CATALOG });
});
// Proxy para contornar CORS ao carregar imagens externas
router.get('/proxy-image', (req, res) => {
    const imageUrl = req.query.url;
    if (!imageUrl) {
        res.status(400).json({ error: 'URL parameter is required' });
        return;
    }
    try {
        const url = new URL(imageUrl);
        const protocol = url.protocol === 'https:' ? https_1.default : http_1.default;
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
    }
    catch (error) {
        console.error('Invalid URL:', error);
        res.status(400).json({ error: 'Invalid URL' });
    }
});
// ===== USUÁRIOS =====
router.get('/users', async (_req, res) => {
    try {
        const users = await admin_repository_1.default.getAllUsersWithDecks();
        res.json({ users });
    }
    catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to get users' });
    }
});
router.get('/users/:id', async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const user = await admin_repository_1.default.getUserDetails(userId);
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        res.json({ user });
    }
    catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user' });
    }
});
router.get('/users/:id/decks', async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const decks = await admin_repository_1.default.getUserDecks(userId);
        res.json({ decks });
    }
    catch (error) {
        console.error('Get user decks error:', error);
        res.status(500).json({ error: 'Failed to get user decks' });
    }
});
// Apaga TODOS os decks de todos os usuários (operação destrutiva — requer confirmação)
router.delete('/decks/all', async (req, res) => {
    try {
        const { confirm } = req.body;
        if (confirm !== 'DELETE_ALL_DECKS') {
            res.status(400).json({
                error: 'Confirmação necessária',
                hint: 'Envie { "confirm": "DELETE_ALL_DECKS" } no body'
            });
            return;
        }
        const removed = await deck_repository_1.default.deleteAllDecks();
        console.log(`[Admin] All decks deleted by admin. Total removed: ${removed}`);
        res.json({ message: `Todos os decks foram apagados`, decks_removed: removed });
    }
    catch (error) {
        console.error('Delete all decks error:', error);
        res.status(500).json({ error: 'Failed to delete all decks' });
    }
});
// ===== CARTAS =====
router.get('/card-collections', async (_req, res) => {
    try {
        const collections = await database_1.default.queryAll('SELECT * FROM card_collections WHERE is_active = 1 ORDER BY name ASC');
        res.json({ collections });
    }
    catch (error) {
        console.error('Get card collections error:', error);
        res.status(500).json({ error: 'Failed to get card collections' });
    }
});
router.post('/card-collections', async (req, res) => {
    try {
        const payload = req.body || {};
        if (!payload.id || !payload.name) {
            res.status(400).json({ error: 'id and name are required' });
            return;
        }
        await database_1.default.run(`INSERT INTO card_collections (id, name, description, is_active)
       VALUES (?, ?, ?, ?)`, [String(payload.id), String(payload.name), payload.description || null, payload.is_active === false ? 0 : 1]);
        res.status(201).json({ message: 'Collection created' });
    }
    catch (error) {
        console.error('Create card collection error:', error);
        res.status(500).json({ error: error.message || 'Failed to create collection' });
    }
});
router.put('/card-collections/:id', async (req, res) => {
    try {
        const payload = req.body || {};
        const current = await database_1.default.query('SELECT * FROM card_collections WHERE id = ?', [req.params.id]);
        if (!current) {
            res.status(404).json({ error: 'Collection not found' });
            return;
        }
        await database_1.default.run(`UPDATE card_collections
       SET name = ?, description = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`, [
            payload.name ?? current.name,
            payload.description ?? current.description,
            payload.is_active == null ? current.is_active : (payload.is_active ? 1 : 0),
            req.params.id
        ]);
        res.json({ message: 'Collection updated' });
    }
    catch (error) {
        console.error('Update card collection error:', error);
        res.status(500).json({ error: error.message || 'Failed to update collection' });
    }
});
async function upsertCatalogCards(catalog, collectionId) {
    let created = 0;
    let updated = 0;
    for (const rawCard of catalog) {
        const card = {
            ...rawCard,
            collection_id: collectionId,
            default_unlocked: false,
            visual_auras: [],
            abilities: rawCard.abilities || []
        };
        const existing = await card_repository_1.default.getCardById(card.id);
        if (existing) {
            await card_repository_1.default.updateCard(card.id, card);
            await database_1.default.run(`UPDATE cards
         SET is_active = 1, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`, [card.id]);
            updated++;
        }
        else {
            await card_repository_1.default.createCard(card);
            created++;
        }
    }
    return { created, updated, total: catalog.length };
}
async function cleanupCollectionCards(collectionId, validIds) {
    const activeRows = await database_1.default.queryAll(`SELECT id FROM cards WHERE collection_id = ? AND is_active = 1`, [collectionId]);
    const valid = new Set(validIds.map((id) => String(id)));
    const staleIds = activeRows
        .map((row) => String(row.id))
        .filter((id) => !valid.has(id));
    for (const staleId of staleIds) {
        await database_1.default.run(`UPDATE cards
       SET is_active = 0, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`, [staleId]);
    }
    return staleIds.length;
}
// Sync all cards -- re-parses and normalizes effects to array format.
// By default, DOES NOT reapply catalog cards (to avoid recreating deleted cards).
router.post('/cards/sync-all', async (req, res) => {
    try {
        const normalized = await card_repository_1.default.syncAllCards();
        const shouldReapplyCatalog = String(req.query.reapply_catalog || req.body?.reapply_catalog || '').toLowerCase() === 'true';
        let catalogs = {};
        if (shouldReapplyCatalog) {
            await ensureCardCollection(shadowland_card_catalog_1.SHADOWLAND_COLLECTION);
            const shadowlandCatalogResult = await upsertCatalogCards(shadowland_card_catalog_1.SHADOWLAND_CARD_CATALOG, shadowland_card_catalog_1.SHADOWLAND_COLLECTION.id);
            const removedShadowland = await cleanupCollectionCards(shadowland_card_catalog_1.SHADOWLAND_COLLECTION.id, shadowland_card_catalog_1.SHADOWLAND_CARD_CATALOG.map((card) => String(card.id)));
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
    }
    catch (error) {
        console.error('Sync all cards error:', error);
        res.status(500).json({ error: 'Failed to sync cards' });
    }
});
router.post('/cards', async (req, res) => {
    try {
        const card = req.body;
        await card_repository_1.default.createCard(card);
        res.status(201).json({ message: 'Card created successfully' });
    }
    catch (error) {
        console.error('Create card error:', error);
        res.status(500).json({ error: 'Failed to create card' });
    }
});
router.put('/cards/:id', async (req, res) => {
    try {
        const cardId = req.params.id;
        const { layout, ...cardData } = req.body;
        // Buscar carta existente para preencher campos obrigatórios
        const existingCard = await card_repository_1.default.getCardById(cardId);
        if (!existingCard) {
            res.status(404).json({ error: 'Card not found' });
            return;
        }
        // Mesclar com dados existentes para garantir que campos obrigatórios estejam presentes
        const updateData = {
            ...existingCard,
            ...cardData
        };
        // Atualizar dados da carta
        await card_repository_1.default.updateCard(cardId, updateData);
        // Se houver layout, salvar também
        if (layout) {
            await card_repository_1.default.saveCardLayout(cardId, layout);
        }
        res.json({ message: 'Card updated successfully' });
    }
    catch (error) {
        console.error('Update card error:', error);
        res.status(500).json({ error: 'Failed to update card', details: error.message });
    }
});
// Upload de imagem renderizada da carta
router.post('/cards/:id/image', async (req, res) => {
    const cardId = req.params.id;
    try {
        const { image } = req.body; // Base64 data URL
        if (!image) {
            res.status(400).json({ error: 'Image data is required' });
            return;
        }
        const existingCard = await card_repository_1.default.getCardById(cardId);
        if (!existingCard) {
            res.status(404).json({ error: 'Card not found', cardId });
            return;
        }
        const imagesDir = (0, uploads_path_1.resolveCardImagesDir)();
        if (!fs_1.default.existsSync(imagesDir)) {
            fs_1.default.mkdirSync(imagesDir, { recursive: true });
        }
        const base64Data = image.replace(/^data:image\/png;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');
        const imagePath = path_1.default.join(imagesDir, `${cardId}_rendered.png`);
        fs_1.default.writeFileSync(imagePath, imageBuffer);
        const imageUrlBase = `/uploads/card_images/${cardId}_rendered.png`;
        const imageUrl = `${imageUrlBase}?v=${Date.now()}`;
        await card_repository_1.default.updateCard(cardId, { ...existingCard, image_url: imageUrl });
        res.json({ message: 'Card image uploaded successfully', image_url: imageUrl });
    }
    catch (error) {
        console.error('Upload card image error:', { cardId, error: error?.message ?? error });
        res.status(500).json({ error: 'Failed to upload card image', details: error?.message ?? String(error) });
    }
});
router.delete('/cards/:id', async (req, res) => {
    try {
        await card_repository_1.default.deleteCard(req.params.id);
        res.json({ message: 'Card deleted successfully' });
    }
    catch (error) {
        console.error('Delete card error:', error);
        res.status(500).json({ error: 'Failed to delete card' });
    }
});
router.get('/cards/:id/layout', async (req, res) => {
    try {
        const layout = await card_repository_1.default.getCardLayout(req.params.id);
        res.json({ layout });
    }
    catch (error) {
        console.error('Get card layout error:', error);
        res.status(500).json({ error: 'Failed to get card layout' });
    }
});
router.get('/card-layouts/global-vfx', async (_req, res) => {
    try {
        const layout = await card_repository_1.default.getGlobalVfxLayout();
        res.json({ layout });
    }
    catch (error) {
        console.error('Get global VFX layout error:', error);
        res.status(500).json({ error: 'Failed to get global VFX layout' });
    }
});
router.put('/card-layouts/global-vfx', async (req, res) => {
    try {
        await card_repository_1.default.saveGlobalVfxLayout(req.body?.layout || req.body);
        res.json({ message: 'Global VFX layout updated successfully' });
    }
    catch (error) {
        console.error('Update global VFX layout error:', error);
        res.status(500).json({ error: 'Failed to update global VFX layout' });
    }
});
router.post('/card-layouts/global-cardbase', async (req, res) => {
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
        const basesDir = (0, uploads_path_1.resolveCardBasesDir)();
        if (!fs_1.default.existsSync(basesDir)) {
            fs_1.default.mkdirSync(basesDir, { recursive: true });
        }
        const fileName = `global_cardbase.${ext}`;
        const imagePath = path_1.default.join(basesDir, fileName);
        fs_1.default.writeFileSync(imagePath, imageBuffer);
        const imageUrl = `/uploads/card_bases/${fileName}?v=${Date.now()}`;
        const current = await card_repository_1.default.getGlobalVfxLayout();
        await card_repository_1.default.saveGlobalVfxLayout({
            ...current,
            cardbaseImageUrl: imageUrl
        });
        res.json({ message: 'Global cardbase uploaded successfully', cardbaseImageUrl: imageUrl });
    }
    catch (error) {
        console.error('Upload global cardbase error:', error);
        res.status(500).json({ error: 'Failed to upload global cardbase', details: error?.message || String(error) });
    }
});
// ===== BOOSTERS =====
router.post('/boosters', async (req, res) => {
    try {
        const booster = req.body;
        await booster_repository_1.default.createBooster(booster);
        res.status(201).json({ message: 'Booster created successfully' });
    }
    catch (error) {
        console.error('Create booster error:', error);
        res.status(500).json({ error: 'Failed to create booster' });
    }
});
router.get('/boosters', async (_req, res) => {
    try {
        const boosters = await booster_repository_1.default.getAllBoosters();
        res.json({ boosters });
    }
    catch (error) {
        console.error('Get boosters error:', error);
        res.status(500).json({ error: 'Failed to get boosters' });
    }
});
router.get('/boosters/:id', async (req, res) => {
    try {
        const booster = await booster_repository_1.default.getBoosterById(req.params.id);
        if (!booster) {
            res.status(404).json({ error: 'Booster not found' });
            return;
        }
        res.json({ booster });
    }
    catch (error) {
        console.error('Get booster error:', error);
        res.status(500).json({ error: 'Failed to get booster' });
    }
});
router.put('/boosters/:id', async (req, res) => {
    try {
        const boosterId = req.params.id;
        const booster = req.body;
        await booster_repository_1.default.updateBooster(boosterId, booster);
        res.json({ message: 'Booster updated successfully' });
    }
    catch (error) {
        console.error('Update booster error:', error);
        res.status(500).json({ error: 'Failed to update booster' });
    }
});
router.delete('/boosters/:id', async (req, res) => {
    try {
        await booster_repository_1.default.deleteBooster(req.params.id);
        res.json({ message: 'Booster deleted successfully' });
    }
    catch (error) {
        console.error('Delete booster error:', error);
        res.status(500).json({ error: 'Failed to delete booster' });
    }
});
// Listar assets disponíveis
router.get('/assets', async (_req, res) => {
    try {
        const assets = [];
        // Buscar assets do projeto Godot
        const godotAssetsPath = path_1.default.join(__dirname, '../../../tcg-godot/assets');
        if (fs_1.default.existsSync(godotAssetsPath)) {
            const scanDirectory = (dir, basePath = '') => {
                const files = fs_1.default.readdirSync(dir);
                for (const file of files) {
                    const fullPath = path_1.default.join(dir, file);
                    const relativePath = path_1.default.join(basePath, file).replace(/\\/g, '/');
                    const stat = fs_1.default.statSync(fullPath);
                    if (stat.isDirectory()) {
                        scanDirectory(fullPath, relativePath);
                    }
                    else if (/\.(png|jpg|jpeg|gif|webp)$/i.test(file)) {
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
        const clientAssetsPath = path_1.default.join(__dirname, '../../client/assets');
        if (fs_1.default.existsSync(clientAssetsPath)) {
            const scanDirectory = (dir, basePath = '') => {
                const files = fs_1.default.readdirSync(dir);
                for (const file of files) {
                    const fullPath = path_1.default.join(dir, file);
                    const relativePath = path_1.default.join(basePath, file).replace(/\\/g, '/');
                    const stat = fs_1.default.statSync(fullPath);
                    if (stat.isDirectory()) {
                        scanDirectory(fullPath, relativePath);
                    }
                    else if (/\.(png|jpg|jpeg|gif|webp)$/i.test(file)) {
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
        const uploadsDir = (0, uploads_path_1.resolveReadableUploadsDir)();
        if (fs_1.default.existsSync(uploadsDir)) {
            const scanUploads = (dir, basePath = '') => {
                const files = fs_1.default.readdirSync(dir);
                for (const file of files) {
                    const fullPath = path_1.default.join(dir, file);
                    const relativePath = path_1.default.join(basePath, file).replace(/\\/g, '/');
                    const stat = fs_1.default.statSync(fullPath);
                    if (stat.isDirectory()) {
                        scanUploads(fullPath, relativePath);
                    }
                    else if (/\.(png|jpg|jpeg|gif|webp)$/i.test(file)) {
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
    }
    catch (error) {
        console.error('Get assets error:', error);
        res.status(500).json({ error: 'Failed to get assets' });
    }
});
// ===== MONSTERS =====
router.get('/monsters/templates', async (_req, res) => {
    try {
        const templates = await monster_service_1.default.listTemplates();
        res.json({ templates });
    }
    catch (error) {
        console.error('Get monster templates error:', error);
        res.status(500).json({ error: 'Failed to list monster templates' });
    }
});
router.post('/monsters/templates', async (req, res) => {
    try {
        const payload = req.body || {};
        if (!payload.name) {
            res.status(400).json({ error: 'name is required' });
            return;
        }
        const id = await monster_service_1.default.createTemplate({
            user_id: req.userId,
            name: String(payload.name),
            difficulty: payload.difficulty || 'medium',
            sprite_ref: payload.sprite_ref || null,
            visual: payload.visual || null,
            collection_id: payload.collection_id || shadowland_card_catalog_1.SHADOWLAND_COLLECTION.id,
            deck_mode: payload.deck_mode || 'hybrid',
            manual_deck_cards: Array.isArray(payload.manual_deck_cards) ? payload.manual_deck_cards : []
        });
        res.status(201).json({ id });
    }
    catch (error) {
        console.error('Create monster template error:', error);
        res.status(500).json({ error: error.message || 'Failed to create template' });
    }
});
router.put('/monsters/templates/:id', async (req, res) => {
    try {
        const templateId = Number(req.params.id);
        await monster_service_1.default.updateTemplate(templateId, {
            ...(req.body || {}),
            user_id: req.userId
        });
        res.json({ message: 'Template updated' });
    }
    catch (error) {
        console.error('Update monster template error:', error);
        res.status(500).json({ error: error.message || 'Failed to update template' });
    }
});
router.get('/monsters/templates/:id/drops', async (req, res) => {
    try {
        const templateId = Number(req.params.id);
        if (!Number.isFinite(templateId) || templateId <= 0) {
            res.status(400).json({ error: 'Invalid template id' });
            return;
        }
        const drops = await monster_service_1.default.listTemplateDrops(templateId);
        res.json({ drops });
    }
    catch (error) {
        console.error('List template drops error:', error);
        res.status(500).json({ error: error.message || 'Failed to list template drops' });
    }
});
router.post('/monsters/templates/:id/drops', async (req, res) => {
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
        await monster_service_1.default.upsertTemplateDrop(templateId, cardId, chance);
        res.json({ message: 'Drop saved' });
    }
    catch (error) {
        console.error('Upsert template drop error:', error);
        res.status(500).json({ error: error.message || 'Failed to save template drop' });
    }
});
router.delete('/monsters/templates/:id/drops/:cardId', async (req, res) => {
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
        await monster_service_1.default.removeTemplateDrop(templateId, cardId);
        res.json({ message: 'Drop removed' });
    }
    catch (error) {
        console.error('Remove template drop error:', error);
        res.status(500).json({ error: error.message || 'Failed to remove template drop' });
    }
});
router.get('/monsters/spawns', async (req, res) => {
    try {
        const zone = String(req.query.zone || 'shadowland').trim().toLowerCase();
        const spawns = monster_service_1.default.getZoneRuntime(zone);
        res.json({ spawns });
    }
    catch (error) {
        console.error('Get monster spawns error:', error);
        res.status(500).json({ error: 'Failed to list monster spawns' });
    }
});
router.post('/monsters/spawns', async (req, res) => {
    try {
        const payload = req.body || {};
        const spawn = await monster_service_1.default.createSpawn({
            template_id: Number(payload.template_id),
            zone: String(payload.zone || 'shadowland').trim().toLowerCase(),
            spawn_x: Number(payload.spawn_x || 0),
            spawn_y: Number(payload.spawn_y || 0),
            respawn_seconds: Number(payload.respawn_seconds || 60),
            move_radius: Number(payload.move_radius || 120)
        });
        res.status(201).json({ spawn });
    }
    catch (error) {
        console.error('Create monster spawn error:', error);
        res.status(500).json({ error: error.message || 'Failed to create monster spawn' });
    }
});
router.put('/monsters/spawns/:spawnUid', async (req, res) => {
    try {
        const spawn = await monster_service_1.default.updateSpawn(req.params.spawnUid, req.body || {});
        res.json({ spawn });
    }
    catch (error) {
        console.error('Update monster spawn error:', error);
        res.status(500).json({ error: error.message || 'Failed to update monster spawn' });
    }
});
router.delete('/monsters/spawns/:spawnUid', async (req, res) => {
    try {
        await monster_service_1.default.removeSpawn(req.params.spawnUid);
        res.json({ message: 'Spawn removed' });
    }
    catch (error) {
        console.error('Delete monster spawn error:', error);
        res.status(500).json({ error: error.message || 'Failed to delete monster spawn' });
    }
});
async function ensureCardCollection(payload) {
    const existing = await database_1.default.query('SELECT id FROM card_collections WHERE id = ?', [payload.id]);
    if (existing) {
        return;
    }
    await database_1.default.run(`INSERT INTO card_collections (id, name, description, is_active)
     VALUES (?, ?, ?, 1)`, [payload.id, payload.name, payload.description || null]);
}
router.post('/monsters/seed-cards', async (req, res) => {
    try {
        await ensureCardCollection(shadowland_card_catalog_1.SHADOWLAND_COLLECTION);
        const seeded = await upsertCatalogCards(shadowland_card_catalog_1.SHADOWLAND_CARD_CATALOG, shadowland_card_catalog_1.SHADOWLAND_COLLECTION.id);
        const created = seeded.created;
        const updated = seeded.updated;
        const seededIds = shadowland_card_catalog_1.SHADOWLAND_CARD_CATALOG.map((card) => String(card.id));
        const removed = await cleanupCollectionCards(shadowland_card_catalog_1.SHADOWLAND_COLLECTION.id, seededIds);
        const adminId = req.userId;
        const existingDecks = await deck_repository_1.default.getUserDecks(adminId);
        const existingDeck = existingDecks.find((d) => d.name === 'Shadowland Duelist AI Deck');
        const deckPayload = {
            name: 'Shadowland Duelist AI Deck',
            cards: seededIds.slice(0, 35)
        };
        if (existingDeck) {
            await deck_repository_1.default.updateDeck(existingDeck.id, adminId, deckPayload);
        }
        else {
            await deck_repository_1.default.createDeck(adminId, deckPayload);
        }
        res.json({
            message: 'Shadowland duelist cards seeded',
            created,
            updated,
            total: seededIds.length,
            removed
        });
    }
    catch (error) {
        console.error('Seed monster cards error:', error);
        res.status(500).json({ error: error.message || 'Failed to seed monster cards' });
    }
});
router.post('/monsters/seed-shadowland-cards', async (req, res) => {
    try {
        await ensureCardCollection(shadowland_card_catalog_1.SHADOWLAND_COLLECTION);
        const seeded = await upsertCatalogCards(shadowland_card_catalog_1.SHADOWLAND_CARD_CATALOG, shadowland_card_catalog_1.SHADOWLAND_COLLECTION.id);
        const created = seeded.created;
        const updated = seeded.updated;
        const seededIds = shadowland_card_catalog_1.SHADOWLAND_CARD_CATALOG.map((card) => String(card.id));
        const removed = await cleanupCollectionCards(shadowland_card_catalog_1.SHADOWLAND_COLLECTION.id, seededIds);
        const adminId = req.userId;
        const existingDecks = await deck_repository_1.default.getUserDecks(adminId);
        const existingDeck = existingDecks.find((d) => d.name === 'Shadowland Creatures AI Deck');
        const deckPayload = {
            name: 'Shadowland Creatures AI Deck',
            cards: seededIds.slice(0, 35)
        };
        if (existingDeck) {
            await deck_repository_1.default.updateDeck(existingDeck.id, adminId, deckPayload);
        }
        else {
            await deck_repository_1.default.createDeck(adminId, deckPayload);
        }
        res.json({
            message: 'Shadowland cards seeded',
            created,
            updated,
            total: seededIds.length,
            collection_id: shadowland_card_catalog_1.SHADOWLAND_COLLECTION.id,
            removed
        });
    }
    catch (error) {
        console.error('Seed shadowland cards error:', error);
        res.status(500).json({ error: error.message || 'Failed to seed shadowland cards' });
    }
});
// ===== NPCs =====
router.get('/npcs/templates', async (_req, res) => {
    try {
        const templates = await npc_service_1.default.listTemplates();
        res.json({ templates });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to list NPC templates' });
    }
});
router.post('/npcs/templates', async (req, res) => {
    try {
        const payload = req.body || {};
        const code = String(payload.code || '').trim();
        const name = String(payload.name || '').trim();
        const spriteRef = String(payload.sprite_ref || '').trim();
        if (!code || !name || !spriteRef) {
            res.status(400).json({ error: 'code, name and sprite_ref are required' });
            return;
        }
        const id = await npc_service_1.default.createTemplate({
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
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to create NPC template' });
    }
});
router.put('/npcs/templates/:id', async (req, res) => {
    try {
        const templateId = Number(req.params.id);
        if (!Number.isFinite(templateId) || templateId <= 0) {
            res.status(400).json({ error: 'Invalid template id' });
            return;
        }
        const payload = req.body || {};
        await npc_service_1.default.updateTemplate(templateId, {
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
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to update NPC template' });
    }
});
router.get('/npcs/spawns', async (req, res) => {
    try {
        const zone = String(req.query.zone || 'shadowland').trim().toLowerCase();
        const spawns = await npc_service_1.default.listZoneSpawns(zone);
        res.json({ zone, spawns });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to list NPC spawns' });
    }
});
router.post('/npcs/spawns', async (req, res) => {
    try {
        const payload = req.body || {};
        const spawnUid = await npc_service_1.default.createSpawn({
            npc_template_id: Number(payload.npc_template_id),
            zone: String(payload.zone || 'shadowland').trim().toLowerCase(),
            spawn_x: Number(payload.spawn_x || 0),
            spawn_y: Number(payload.spawn_y || 0),
            interaction_radius: Number(payload.interaction_radius || 90)
        });
        res.status(201).json({ spawnUid });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to create NPC spawn' });
    }
});
router.put('/npcs/spawns/:spawnUid', async (req, res) => {
    try {
        const payload = req.body || {};
        await npc_service_1.default.updateSpawn(req.params.spawnUid, {
            npc_template_id: payload.npc_template_id,
            zone: payload.zone,
            spawn_x: payload.spawn_x,
            spawn_y: payload.spawn_y,
            interaction_radius: payload.interaction_radius,
            is_active: payload.is_active
        });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to update NPC spawn' });
    }
});
router.delete('/npcs/spawns/:spawnUid', async (req, res) => {
    try {
        await npc_service_1.default.removeSpawn(req.params.spawnUid);
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to remove NPC spawn' });
    }
});
// ===== Quests =====
router.get('/quests/definitions', async (req, res) => {
    try {
        const page = Math.max(1, Number(req.query.page || 1));
        const limit = Math.max(1, Math.min(200, Number(req.query.limit || 50)));
        const search = String(req.query.search || '').trim();
        const giverNpcTemplateIdRaw = Number(req.query.giver_npc_template_id);
        const includeInactive = String(req.query.include_inactive || '').trim().toLowerCase() === 'true';
        const list = await quest_repository_1.default.listQuestDefinitionsForAdmin({
            page,
            limit,
            search,
            giverNpcTemplateId: Number.isFinite(giverNpcTemplateIdRaw) && giverNpcTemplateIdRaw > 0 ? giverNpcTemplateIdRaw : null,
            includeInactive
        });
        const result = await Promise.all(list.items.map(async (definition) => ({
            ...definition,
            objectives: await quest_repository_1.default.listQuestObjectives(definition.id),
            rewards: await quest_repository_1.default.listQuestRewards(definition.id),
            prerequisites: await quest_repository_1.default.listQuestPrerequisites(definition.id)
        })));
        res.json({
            definitions: result,
            page: list.page,
            limit: list.limit,
            total: list.total
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to list quests' });
    }
});
router.get('/npcs/:id/quests', async (req, res) => {
    try {
        const npcTemplateId = Number(req.params.id);
        if (!Number.isFinite(npcTemplateId) || npcTemplateId <= 0) {
            res.status(400).json({ error: 'Invalid npc template id' });
            return;
        }
        const definitions = await quest_repository_1.default.listQuestDefinitionsByNpcTemplate(npcTemplateId);
        const result = await Promise.all(definitions.map(async (definition) => ({
            ...definition,
            objectives: await quest_repository_1.default.listQuestObjectives(definition.id),
            rewards: await quest_repository_1.default.listQuestRewards(definition.id),
            prerequisites: await quest_repository_1.default.listQuestPrerequisites(definition.id)
        })));
        res.json({ npc_template_id: npcTemplateId, definitions: result });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to list NPC quests' });
    }
});
router.post('/quests/definitions', async (req, res) => {
    try {
        const payload = req.body || {};
        const code = String(payload.code || '').trim();
        const title = String(payload.title || '').trim();
        if (!code || !title) {
            res.status(400).json({ error: 'code and title are required' });
            return;
        }
        const id = await quest_repository_1.default.createQuestDefinition({
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
        await quest_repository_1.default.replaceQuestObjectives(id, Array.isArray(payload.objectives) ? payload.objectives : []);
        const rewards = await normalizeQuestRewards(payload.rewards);
        await quest_repository_1.default.replaceQuestRewards(id, rewards);
        const prerequisites = await normalizeQuestPrerequisites(payload.prerequisites);
        await quest_repository_1.default.replaceQuestPrerequisites(id, prerequisites);
        res.status(201).json({ id });
    }
    catch (error) {
        if (error instanceof AdminValidationError) {
            res.status(400).json({ error: error.message });
            return;
        }
        res.status(500).json({ error: error.message || 'Failed to create quest' });
    }
});
router.put('/quests/definitions/:id', async (req, res) => {
    try {
        const questId = Number(req.params.id);
        if (!Number.isFinite(questId) || questId <= 0) {
            res.status(400).json({ error: 'Invalid quest id' });
            return;
        }
        const payload = req.body || {};
        await quest_repository_1.default.updateQuestDefinition(questId, {
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
            await quest_repository_1.default.replaceQuestObjectives(questId, payload.objectives);
        }
        if (Array.isArray(payload.rewards)) {
            const rewards = await normalizeQuestRewards(payload.rewards);
            await quest_repository_1.default.replaceQuestRewards(questId, rewards);
        }
        if (Array.isArray(payload.prerequisites)) {
            const prerequisites = await normalizeQuestPrerequisites(payload.prerequisites);
            await quest_repository_1.default.replaceQuestPrerequisites(questId, prerequisites);
        }
        res.json({ success: true });
    }
    catch (error) {
        if (error instanceof AdminValidationError) {
            res.status(400).json({ error: error.message });
            return;
        }
        res.status(500).json({ error: error.message || 'Failed to update quest' });
    }
});
router.post('/quests/seed-initial', async (_req, res) => {
    try {
        let trader = await npc_repository_1.default.getTemplateByCode('wandering_trader1');
        if (!trader) {
            const traderId = await npc_service_1.default.createTemplate({
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
            const templates = await npc_service_1.default.listTemplates();
            trader = templates.find((template) => template.id === traderId) || null;
        }
        if (!trader) {
            res.status(500).json({ error: 'Unable to create trader NPC template' });
            return;
        }
        const existingSpawns = await npc_service_1.default.listZoneSpawns('shadowland');
        if (!existingSpawns.some((spawn) => Number(spawn.npc_template_id) === Number(trader.id))) {
            await npc_service_1.default.createSpawn({
                npc_template_id: trader.id,
                zone: 'shadowland',
                spawn_x: 520,
                spawn_y: 420,
                interaction_radius: 100
            });
        }
        let quest = await quest_repository_1.default.getQuestByCode('duelista_iniciante_trial');
        if (!quest) {
            const questId = await quest_repository_1.default.createQuestDefinition({
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
            await quest_repository_1.default.replaceQuestObjectives(questId, [
                {
                    objective_type: 'WIN_DUEL_VS_MONSTER_TEMPLATE',
                    target_ref: 'duelista iniciante',
                    required_count: 3,
                    filters_json: null,
                    order_index: 0
                }
            ]);
            await quest_repository_1.default.replaceQuestRewards(questId, [
                { reward_type: 'EXP', reward_ref: 'ai', amount: 3, metadata_json: JSON.stringify({ match_type: 'ai' }) }
            ]);
            quest = await quest_repository_1.default.getQuestDefinitionById(questId);
        }
        res.json({
            success: true,
            npc_template_id: trader.id,
            quest_id: quest?.id || null
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to seed initial NPC and quest' });
    }
});
exports.default = router;
//# sourceMappingURL=admin.routes.js.map