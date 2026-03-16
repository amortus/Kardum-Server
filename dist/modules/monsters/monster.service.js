"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = __importDefault(require("crypto"));
const monster_repository_1 = __importDefault(require("./monster.repository"));
const card_repository_1 = __importDefault(require("../cards/card.repository"));
const deck_repository_1 = __importDefault(require("../decks/deck.repository"));
class MonsterService {
    constructor() {
        this.runtimeBySpawnUid = new Map();
        this.encountersByMatchId = new Map();
        this.initialized = false;
        this.tickInterval = null;
        this.maleBodyVariants = ['clothes', 'leather_armor', 'steel_armor'];
        this.maleHeadVariants = ['male_head1', 'male_head2', 'male_head3'];
    }
    async initialize() {
        if (this.initialized)
            return;
        await this.reloadRuntimeFromDatabase();
        this.tickInterval = setInterval(() => {
            this.tickMovement();
        }, 1500);
        this.initialized = true;
    }
    stop() {
        if (this.tickInterval) {
            clearInterval(this.tickInterval);
            this.tickInterval = null;
        }
        this.initialized = false;
    }
    async reloadRuntimeFromDatabase() {
        const rows = await monster_repository_1.default.getSpawns();
        this.runtimeBySpawnUid.clear();
        for (const row of rows) {
            const runtimeVisual = this.resolveSpawnVisual(row.visual || row.sprite_ref || '');
            this.runtimeBySpawnUid.set(row.spawn_uid, {
                spawn_uid: row.spawn_uid,
                template_id: row.template_id,
                template_name: row.template_name,
                zone: row.zone,
                x: row.spawn_x,
                y: row.spawn_y,
                spawn_x: row.spawn_x,
                spawn_y: row.spawn_y,
                move_radius: row.move_radius,
                respawn_seconds: row.respawn_seconds,
                status: 'alive',
                engaged_by_user_id: null,
                next_respawn_at: null,
                difficulty: row.difficulty,
                deck_id: row.deck_id,
                sprite_ref: runtimeVisual,
                visual: runtimeVisual
            });
        }
    }
    getZoneSnapshot(zone) {
        const now = Date.now();
        const monsters = Array.from(this.runtimeBySpawnUid.values())
            .filter((m) => m.zone === zone)
            .map((monster) => this.computeRespawn(monster, now));
        return monsters.filter((m) => m.status !== 'cooldown');
    }
    getZoneRuntime(zone) {
        const now = Date.now();
        return Array.from(this.runtimeBySpawnUid.values())
            .filter((m) => m.zone === zone)
            .map((monster) => this.computeRespawn(monster, now));
    }
    getMonster(spawnUid) {
        const monster = this.runtimeBySpawnUid.get(spawnUid);
        if (!monster)
            return null;
        return this.computeRespawn(monster, Date.now());
    }
    async createTemplate(data) {
        const collectionId = data.collection_id || 'shadowland_creatures';
        const deckCards = await this.buildDeckCards(collectionId, data.manual_deck_cards || []);
        const deckId = await this.createOrUpdateMonsterDeck(data.user_id, data.name, deckCards);
        return monster_repository_1.default.createTemplate({
            name: data.name,
            deck_id: deckId,
            difficulty: data.difficulty,
            sprite_ref: data.sprite_ref || null,
            visual: this.normalizeVisualPath(data.visual || data.sprite_ref || ''),
            collection_id: collectionId,
            deck_mode: data.deck_mode || 'hybrid',
            manual_deck_cards: data.manual_deck_cards || []
        });
    }
    async updateTemplate(templateId, data) {
        const current = await monster_repository_1.default.getTemplateById(templateId);
        if (!current)
            throw new Error('Template not found');
        const collectionId = data.collection_id || current.collection_id || 'shadowland_creatures';
        const manualDeck = data.manual_deck_cards || current.manual_deck_cards || [];
        const deckCards = await this.buildDeckCards(collectionId, manualDeck);
        const deckOwner = data.user_id || 1;
        const deckId = await this.createOrUpdateMonsterDeck(deckOwner, data.name || current.name, deckCards, current.deck_id);
        await monster_repository_1.default.updateTemplate(templateId, {
            name: data.name,
            deck_id: deckId,
            difficulty: data.difficulty,
            sprite_ref: data.sprite_ref || null,
            visual: this.normalizeVisualPath(data.visual || current.visual || data.sprite_ref || ''),
            collection_id: collectionId,
            deck_mode: data.deck_mode || current.deck_mode || 'hybrid',
            manual_deck_cards: manualDeck,
            is_active: data.is_active
        });
    }
    async listTemplates() {
        return monster_repository_1.default.getTemplates();
    }
    async listTemplateDrops(templateId) {
        return monster_repository_1.default.listTemplateDrops(templateId);
    }
    async upsertTemplateDrop(templateId, cardId, dropChancePercent) {
        await monster_repository_1.default.upsertTemplateDrop(templateId, cardId, dropChancePercent);
    }
    async removeTemplateDrop(templateId, cardId) {
        await monster_repository_1.default.removeTemplateDrop(templateId, cardId);
    }
    async createSpawn(data) {
        const spawn_uid = `spawn_${crypto_1.default.randomUUID().replace(/-/g, '').slice(0, 16)}`;
        await monster_repository_1.default.createSpawn({ ...data, spawn_uid });
        await this.reloadRuntimeFromDatabase();
        const runtime = this.runtimeBySpawnUid.get(spawn_uid);
        if (!runtime)
            throw new Error('Spawn runtime not found after creation');
        return runtime;
    }
    async updateSpawn(spawnUid, data) {
        await monster_repository_1.default.updateSpawn(spawnUid, data);
        await this.reloadRuntimeFromDatabase();
        return this.runtimeBySpawnUid.get(spawnUid) || null;
    }
    async removeSpawn(spawnUid) {
        await monster_repository_1.default.removeSpawn(spawnUid);
        this.runtimeBySpawnUid.delete(spawnUid);
    }
    async spawnByTemplateName(name, zone, x, y) {
        const template = await monster_repository_1.default.getTemplateByName(name);
        if (!template) {
            throw new Error(`Template "${name}" not found`);
        }
        return this.createSpawn({
            template_id: template.id,
            zone,
            spawn_x: x,
            spawn_y: y,
            respawn_seconds: 60,
            move_radius: 120
        });
    }
    async engageMonster(spawnUid, userId, matchId) {
        const monster = this.getMonster(spawnUid);
        if (!monster)
            throw new Error('Monster not found');
        if (monster.status !== 'alive')
            throw new Error('Monster is not available');
        monster.status = 'engaged';
        monster.engaged_by_user_id = userId;
        const encounterId = await monster_repository_1.default.logEncounterStart({
            spawn_uid: monster.spawn_uid,
            template_id: monster.template_id,
            user_id: userId,
            match_id: matchId
        });
        this.encountersByMatchId.set(matchId, {
            encounterId,
            spawnUid,
            userId,
            matchId,
            templateId: monster.template_id
        });
        return monster;
    }
    async finishEncounter(matchId, result) {
        const encounter = this.encountersByMatchId.get(matchId);
        if (!encounter)
            return null;
        this.encountersByMatchId.delete(matchId);
        await monster_repository_1.default.logEncounterEnd(encounter.encounterId, result);
        const monster = this.runtimeBySpawnUid.get(encounter.spawnUid);
        let drop = { mode: 'none' };
        if (result === 'win') {
            drop = await this.rollTemplateDrop(encounter.userId, encounter.templateId);
        }
        if (!monster) {
            return {
                monster: null,
                userId: encounter.userId,
                templateId: encounter.templateId,
                result,
                drop
            };
        }
        monster.status = 'cooldown';
        monster.engaged_by_user_id = null;
        monster.next_respawn_at = Date.now() + monster.respawn_seconds * 1000;
        return {
            monster,
            userId: encounter.userId,
            templateId: encounter.templateId,
            result,
            drop
        };
    }
    computeRespawn(monster, nowMs) {
        if (monster.status === 'cooldown' && monster.next_respawn_at && nowMs >= monster.next_respawn_at) {
            monster.status = 'alive';
            monster.x = monster.spawn_x;
            monster.y = monster.spawn_y;
            monster.next_respawn_at = null;
        }
        return monster;
    }
    tickMovement() {
        const now = Date.now();
        for (const monster of this.runtimeBySpawnUid.values()) {
            this.computeRespawn(monster, now);
            if (monster.status !== 'alive' || monster.move_radius <= 0)
                continue;
            const angle = Math.random() * Math.PI * 2;
            const step = 12 + Math.random() * 20;
            const nextX = monster.x + Math.cos(angle) * step;
            const nextY = monster.y + Math.sin(angle) * step;
            const dx = nextX - monster.spawn_x;
            const dy = nextY - monster.spawn_y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance <= monster.move_radius) {
                monster.x = Math.round(nextX);
                monster.y = Math.round(nextY);
            }
            else {
                monster.x = monster.spawn_x;
                monster.y = monster.spawn_y;
            }
        }
    }
    async buildDeckCards(collectionId, manualDeckCards) {
        const fromCollection = await card_repository_1.default.getAllCards({
            collection_id: collectionId
        });
        if (fromCollection.length === 0) {
            throw new Error(`No cards found for collection "${collectionId}"`);
        }
        const collectionIds = new Set(fromCollection.map((c) => c.id));
        const validManual = manualDeckCards.filter((id) => collectionIds.has(id));
        const deck = [];
        const pool = fromCollection
            .sort((a, b) => a.cost - b.cost);
        for (const cardId of validManual) {
            if (deck.length < 40) {
                deck.push(cardId);
            }
        }
        for (const card of pool) {
            if (deck.length >= 35)
                break;
            deck.push(card.id);
        }
        if (deck.length < 30) {
            let idx = 0;
            while (deck.length < 30 && pool.length > 0) {
                deck.push(pool[idx % pool.length].id);
                idx++;
            }
        }
        return deck.slice(0, 35);
    }
    async createOrUpdateMonsterDeck(userId, templateName, cards, existingDeckId) {
        const deckName = `Monster::${templateName}`;
        if (existingDeckId) {
            await deck_repository_1.default.updateDeck(existingDeckId, userId, {
                name: deckName,
                cards: cards
            });
            return existingDeckId;
        }
        return deck_repository_1.default.createDeck(userId, {
            name: deckName,
            cards: cards
        });
    }
    normalizeVisualPath(value) {
        const trimmed = value.trim();
        if (!trimmed)
            return null;
        const normalizedPreset = trimmed.toLowerCase();
        if (normalizedPreset === 'monstro1' || normalizedPreset === 'monster1' || normalizedPreset === 'preset:monstro1') {
            return 'Monstro1';
        }
        if (normalizedPreset === 'monstro2' || normalizedPreset === 'monster2' || normalizedPreset === 'preset:monstro2') {
            return 'Monstro2';
        }
        if (normalizedPreset === 'monstro3' || normalizedPreset === 'monster3' || normalizedPreset === 'preset:monstro3') {
            return 'Monstro3';
        }
        if (trimmed.startsWith('res://')) {
            return this.fixVisualFolderCasing(trimmed);
        }
        if (trimmed.startsWith('/assets/')) {
            return this.fixVisualFolderCasing(`res://${trimmed.slice(1)}`);
        }
        if (trimmed.startsWith('assets/')) {
            return this.fixVisualFolderCasing(`res://${trimmed}`);
        }
        return this.fixVisualFolderCasing(`res://assets/cards/${trimmed}`);
    }
    fixVisualFolderCasing(path) {
        return path
            .replace('/cards/deva/', '/cards/Devas/')
            .replace('/cards/Deva/', '/cards/Devas/')
            .replace('/cards/Dwarf/', '/cards/dwarf/');
    }
    resolveSpawnVisual(sourceVisual) {
        const raw = String(sourceVisual || '').trim();
        if (!raw) {
            return this.randomMaleAvatarVisual();
        }
        if (this.isTextureVisual(raw)) {
            return this.normalizeVisualPath(raw) || this.randomMaleAvatarVisual();
        }
        // Any non-texture visual (presets or generic labels) now uses randomized modular avatar.
        return this.randomMaleAvatarVisual();
    }
    isTextureVisual(value) {
        return value.startsWith('res://') || value.startsWith('/assets/') || value.startsWith('assets/');
    }
    randomMaleAvatarVisual() {
        const body = this.maleBodyVariants[Math.floor(Math.random() * this.maleBodyVariants.length)];
        const head = this.maleHeadVariants[Math.floor(Math.random() * this.maleHeadVariants.length)];
        return `avatar:male:${body}:${head}`;
    }
    async rollTemplateDrop(userId, templateId) {
        const template = await monster_repository_1.default.getTemplateById(templateId);
        const fallbackCollection = template?.collection_id || 'shadowland_creatures';
        const drops = await monster_repository_1.default.listTemplateDrops(templateId);
        if (drops.length === 0) {
            return this.unlockFallbackFromCollection(userId, fallbackCollection);
        }
        const shuffled = [...drops];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        let selectedCardId = '';
        for (const drop of shuffled) {
            const chance = Math.max(0, Math.min(100, Number(drop.drop_chance_percent || 0)));
            if (Math.random() * 100 < chance) {
                selectedCardId = drop.card_id;
                break;
            }
        }
        if (!selectedCardId) {
            return this.unlockFallbackFromCollection(userId, fallbackCollection);
        }
        const unlocked = await card_repository_1.default.unlockCardForUser(userId, selectedCardId, 'monster_drop');
        if (!unlocked) {
            const fallback = await this.unlockFallbackFromCollection(userId, fallbackCollection, selectedCardId);
            if (fallback.mode === 'unlocked') {
                return fallback;
            }
            const card = await card_repository_1.default.getCardById(selectedCardId);
            return {
                mode: 'already_owned',
                cardId: selectedCardId,
                cardName: card?.name,
                imageUrl: card?.image_url
            };
        }
        const card = await card_repository_1.default.getCardById(selectedCardId);
        return {
            mode: 'unlocked',
            cardId: selectedCardId,
            cardName: card?.name,
            imageUrl: card?.image_url
        };
    }
    async unlockFallbackFromCollection(userId, collectionId, excludeCardId = '') {
        const locked = await card_repository_1.default.getLockedCardsByCollectionForUser(collectionId, userId);
        const pool = excludeCardId
            ? locked.filter((card) => String(card.id) !== String(excludeCardId))
            : locked;
        if (pool.length === 0) {
            return { mode: 'none' };
        }
        const picked = pool[Math.floor(Math.random() * pool.length)];
        const unlocked = await card_repository_1.default.unlockCardForUser(userId, picked.id, 'monster_drop_fallback');
        if (!unlocked) {
            return { mode: 'none' };
        }
        return {
            mode: 'unlocked',
            cardId: picked.id,
            cardName: picked.name,
            imageUrl: picked.image_url
        };
    }
}
exports.default = new MonsterService();
//# sourceMappingURL=monster.service.js.map