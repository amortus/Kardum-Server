import crypto from 'crypto';
import monsterRepository from './monster.repository';
import type {
  MonsterRuntimeState,
  MonsterDifficulty,
  MonsterTemplate
} from '../../shared/types';
import cardRepository from '../cards/card.repository';
import deckRepository from '../decks/deck.repository';

type EncounterRuntime = {
  encounterId: number;
  spawnUid: string;
  userId: number;
  matchId: number;
  templateId: number;
};

type EncounterDropResult = {
  mode: 'none' | 'already_owned' | 'unlocked';
  cardId?: string;
  cardName?: string;
  imageUrl?: string;
};

export type EncounterFinishResult = {
  monster: MonsterRuntimeState | null;
  userId: number;
  templateId: number;
  result: 'win' | 'loss' | 'draw';
  drop: EncounterDropResult;
};

type SpawnMovementState = {
  cooldown: number;  // ticks restantes em idle antes do próximo movimento
  stepMin: number;   // distância mínima por passo (px)
  stepMax: number;   // distância máxima por passo (px)
};

class MonsterService {
  private runtimeBySpawnUid = new Map<string, MonsterRuntimeState>();
  private encountersByMatchId = new Map<number, EncounterRuntime>();
  private movementState = new Map<string, SpawnMovementState>();
  private initialized = false;
  private tickInterval: NodeJS.Timeout | null = null;
  private readonly maleBodyVariants = ['clothes', 'leather_armor', 'steel_armor'] as const;
  private readonly maleHeadVariants = ['male_head1', 'male_head2', 'male_head3'] as const;

  // Hash determinístico do spawn_uid para derivar personalidade individual.
  private spawnHash(spawn_uid: string): number {
    let h = 5381;
    for (let i = 0; i < spawn_uid.length; i++) {
      h = (((h << 5) + h) ^ spawn_uid.charCodeAt(i)) >>> 0;
    }
    return h;
  }

  // Retorna cooldown mín/máx (em ticks) e faixa de passo (stepMin–stepMax em px)
  // individualizada por spawn. Cada monstro tem sua própria "personalidade de
  // caminhada": alguns dão passos curtos e frequentes, outros passos longos.
  private getMovementPersonality(monster: MonsterRuntimeState): {
    cooldownMin: number;
    cooldownMax: number;
    stepMin: number;
    stepMax: number;
  } {
    const h = this.spawnHash(monster.spawn_uid);
    // Centro da faixa de passo (15–50 px) e spread (8–23 px) derivados do hash.
    // Faixa global resultante: ~6–73 px. Cada spawn tem janela própria dentro disso.
    const stepCenter = 15 + (h % 1000) / 1000.0 * 35;
    const stepSpread = 8 + ((h >>> 10) % 1000) / 1000.0 * 15;
    const stepMin = Math.max(6, stepCenter - stepSpread);
    const stepMax = stepCenter + stepSpread;
    const name = (monster.template_name ?? '').toLowerCase();
    const ref  = (monster.sprite_ref  ?? '').toLowerCase();
    const key  = name + ref;
    if (key.includes('zombie'))   return { cooldownMin: 4, cooldownMax: 10, stepMin, stepMax };
    if (key.includes('lich'))     return { cooldownMin: 3, cooldownMax: 9,  stepMin, stepMax };
    if (key.includes('troll'))    return { cooldownMin: 2, cooldownMax: 8,  stepMin, stepMax };
    if (key.includes('skeleton')) return { cooldownMin: 2, cooldownMax: 7,  stepMin, stepMax };
    if (key.includes('demon'))    return { cooldownMin: 1, cooldownMax: 6,  stepMin, stepMax };
    if (key.includes('wyvern'))   return { cooldownMin: 1, cooldownMax: 6,  stepMin, stepMax };
    if (key.includes('ant'))      return { cooldownMin: 1, cooldownMax: 5,  stepMin, stepMax };
    if (key.includes('goblin'))   return { cooldownMin: 1, cooldownMax: 4,  stepMin, stepMax };
    return { cooldownMin: 1, cooldownMax: 5, stepMin, stepMax };
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.reloadRuntimeFromDatabase();
    this.tickInterval = setInterval(() => {
      this.tickMovement();
    }, 1500);
    this.initialized = true;
  }

  stop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    this.initialized = false;
  }

  async reloadRuntimeFromDatabase(): Promise<void> {
    const rows = await monsterRepository.getSpawns();
    const next = new Map<string, MonsterRuntimeState>();
    for (const row of rows) {
      const runtimeVisual = this.resolveSpawnVisual(row.visual || row.sprite_ref || '');
      const existing = this.runtimeBySpawnUid.get(row.spawn_uid);
      // Preserva posição e estado em memória quando o spawn já existia.
      // reloadRuntimeFromDatabase() é chamada ao criar/editar qualquer spawn — sem
      // preservação, TODOS os monstros teleportavam para spawn_x/spawn_y.
      const keepRuntime = existing && existing.status !== 'cooldown';
      next.set(row.spawn_uid, {
        spawn_uid: row.spawn_uid,
        template_id: row.template_id,
        template_name: row.template_name,
        zone: row.zone,
        x: keepRuntime ? existing!.x : row.spawn_x,
        y: keepRuntime ? existing!.y : row.spawn_y,
        spawn_x: row.spawn_x,
        spawn_y: row.spawn_y,
        move_radius: row.move_radius,
        respawn_seconds: row.respawn_seconds,
        status: keepRuntime ? existing!.status : 'alive',
        engaged_by_user_id: keepRuntime ? existing!.engaged_by_user_id : null,
        next_respawn_at: keepRuntime ? existing!.next_respawn_at : null,
        difficulty: row.difficulty,
        deck_id: row.deck_id,
        sprite_ref: runtimeVisual,
        visual: runtimeVisual
      });
    }
    this.runtimeBySpawnUid.clear();
    for (const [k, v] of next) this.runtimeBySpawnUid.set(k, v);
  }

  getZoneSnapshot(zone: string): MonsterRuntimeState[] {
    const now = Date.now();
    const monsters = Array.from(this.runtimeBySpawnUid.values())
      .filter((m) => m.zone === zone)
      .map((monster) => this.computeRespawn(monster, now));
    return monsters.filter((m) => m.status !== 'cooldown');
  }

  getZoneRuntime(zone: string): MonsterRuntimeState[] {
    const now = Date.now();
    return Array.from(this.runtimeBySpawnUid.values())
      .filter((m) => m.zone === zone)
      .map((monster) => this.computeRespawn(monster, now));
  }

  getMonster(spawnUid: string): MonsterRuntimeState | null {
    const monster = this.runtimeBySpawnUid.get(spawnUid);
    if (!monster) return null;
    return this.computeRespawn(monster, Date.now());
  }

  async createTemplate(data: {
    user_id: number;
    name: string;
    difficulty: MonsterDifficulty;
    sprite_ref?: string | null;
    visual?: string | null;
    collection_id?: string | null;
    deck_mode?: 'auto' | 'manual' | 'hybrid';
    manual_deck_cards?: string[];
  }): Promise<number> {
    const collectionId = data.collection_id || 'shadowland_creatures';
    const deckCards = await this.buildDeckCards(collectionId, data.manual_deck_cards || []);
    const deckId = await this.createOrUpdateMonsterDeck(data.name, deckCards);
    return monsterRepository.createTemplate({
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

  async updateTemplate(templateId: number, data: Partial<MonsterTemplate> & { user_id?: number }): Promise<void> {
    const current = await monsterRepository.getTemplateById(templateId);
    if (!current) throw new Error('Template not found');
    const collectionId = data.collection_id || current.collection_id || 'shadowland_creatures';
    const manualDeck = data.manual_deck_cards || current.manual_deck_cards || [];
    const deckCards = await this.buildDeckCards(collectionId, manualDeck);
    const deckId = await this.createOrUpdateMonsterDeck(data.name || current.name, deckCards, current.deck_id);

    await monsterRepository.updateTemplate(templateId, {
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

  async listTemplates(): Promise<MonsterTemplate[]> {
    return monsterRepository.getTemplates();
  }

  async listTemplateDrops(templateId: number) {
    return monsterRepository.listTemplateDrops(templateId);
  }

  async upsertTemplateDrop(templateId: number, cardId: string, dropChancePercent: number): Promise<void> {
    await monsterRepository.upsertTemplateDrop(templateId, cardId, dropChancePercent);
  }

  async removeTemplateDrop(templateId: number, cardId: string): Promise<void> {
    await monsterRepository.removeTemplateDrop(templateId, cardId);
  }

  async createSpawn(data: {
    template_id: number;
    zone: string;
    spawn_x: number;
    spawn_y: number;
    respawn_seconds: number;
    move_radius: number;
  }): Promise<MonsterRuntimeState> {
    const spawn_uid = `spawn_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    await monsterRepository.createSpawn({ ...data, spawn_uid });
    await this.reloadRuntimeFromDatabase();
    const runtime = this.runtimeBySpawnUid.get(spawn_uid);
    if (!runtime) throw new Error('Spawn runtime not found after creation');
    return runtime;
  }

  async updateSpawn(
    spawnUid: string,
    data: Partial<{
      template_id: number;
      zone: string;
      spawn_x: number;
      spawn_y: number;
      respawn_seconds: number;
      move_radius: number;
      is_active: boolean;
    }>
  ): Promise<MonsterRuntimeState | null> {
    await monsterRepository.updateSpawn(spawnUid, data);
    await this.reloadRuntimeFromDatabase();
    return this.runtimeBySpawnUid.get(spawnUid) || null;
  }

  async removeSpawn(spawnUid: string): Promise<void> {
    const changes = await monsterRepository.removeSpawn(spawnUid);
    if (!changes) {
      throw new Error('Spawn not found');
    }
    this.movementState.delete(spawnUid);
    await this.reloadRuntimeFromDatabase();
  }

  async spawnByTemplateName(
    name: string,
    zone: string,
    x: number,
    y: number
  ): Promise<MonsterRuntimeState> {
    const template = await monsterRepository.getTemplateByName(name);
    if (!template) {
      throw new Error(`Template "${name}" not found`);
    }
    return this.createSpawn({
      template_id: template.id,
      zone,
      spawn_x: x,
      spawn_y: y,
      respawn_seconds: 300,
      move_radius: 600
    });
  }

  async engageMonster(spawnUid: string, userId: number, matchId: number): Promise<MonsterRuntimeState> {
    const monster = this.getMonster(spawnUid);
    if (!monster) throw new Error('Monster not found');
    if (monster.status !== 'alive') throw new Error('Monster is not available');

    monster.status = 'engaged';
    monster.engaged_by_user_id = userId;

    const encounterId = await monsterRepository.logEncounterStart({
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

  async finishEncounter(matchId: number, result: 'win' | 'loss' | 'draw'): Promise<EncounterFinishResult | null> {
    const encounter = this.encountersByMatchId.get(matchId);
    if (!encounter) return null;
    this.encountersByMatchId.delete(matchId);
    await monsterRepository.logEncounterEnd(encounter.encounterId, result);

    const monster = this.runtimeBySpawnUid.get(encounter.spawnUid);
    let drop: EncounterDropResult = { mode: 'none' };
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

  private computeRespawn(monster: MonsterRuntimeState, nowMs: number): MonsterRuntimeState {
    if (monster.status === 'cooldown' && monster.next_respawn_at && nowMs >= monster.next_respawn_at) {
      monster.status = 'alive';
      monster.x = monster.spawn_x;
      monster.y = monster.spawn_y;
      monster.next_respawn_at = null;
    }
    return monster;
  }

  private tickMovement(): void {
    const now = Date.now();
    for (const monster of this.runtimeBySpawnUid.values()) {
      this.computeRespawn(monster, now);
      if (monster.status !== 'alive' || monster.move_radius <= 0) continue;

      const personality = this.getMovementPersonality(monster);
      let state = this.movementState.get(monster.spawn_uid);

      // Inicialização lazy: distribui cooldowns iniciais aleatórios para que
      // spawns do mesmo tipo não comecem a mover todos no primeiro tick.
      if (!state) {
        const h = this.spawnHash(monster.spawn_uid);
        const initRange = personality.cooldownMax - personality.cooldownMin;
        const initCooldown = personality.cooldownMin + (h % (initRange + 1));
        state = {
          cooldown: initCooldown,
          stepMin: personality.stepMin,
          stepMax: personality.stepMax
        };
        this.movementState.set(monster.spawn_uid, state);
      }

      // Idle: decrementa e pula — monstro fica parado este tick.
      if (state.cooldown > 0) {
        state.cooldown--;
        continue;
      }

      // Rola distância aleatória dentro da faixa individual do spawn.
      const rollStep = (): number =>
        state!.stepMin + Math.random() * (state!.stepMax - state!.stepMin);

      const angle = Math.random() * Math.PI * 2;
      const step = rollStep();
      const nextX = monster.x + Math.cos(angle) * step;
      const nextY = monster.y + Math.sin(angle) * step;
      const dx = nextX - monster.spawn_x;
      const dy = nextY - monster.spawn_y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= monster.move_radius) {
        monster.x = Math.round(nextX);
        monster.y = Math.round(nextY);
      } else {
        // Fora do raio: caminha de volta ao spawn em passos pequenos — sem teleporte.
        // Preserva o fix original (commit 73f5018): atan2 + returnStep gradual.
        const backAngle = Math.atan2(monster.spawn_y - monster.y, monster.spawn_x - monster.x);
        const returnStep = state!.stepMin + Math.random() * (state!.stepMax - state!.stepMin);
        monster.x = Math.round(monster.x + Math.cos(backAngle) * returnStep);
        monster.y = Math.round(monster.y + Math.sin(backAngle) * returnStep);
      }

      // Novo cooldown aleatório para o próximo ciclo de idle.
      const cdRange = personality.cooldownMax - personality.cooldownMin;
      state.cooldown = personality.cooldownMin + Math.floor(Math.random() * (cdRange + 1));
    }
  }

  private async buildDeckCards(collectionId: string, manualDeckCards: string[]): Promise<string[]> {
    const fromCollection = await cardRepository.getAllCards({
      collection_id: collectionId
    });
    if (fromCollection.length === 0) {
      throw new Error(`No cards found for collection "${collectionId}"`);
    }

    const collectionIds = new Set(fromCollection.map((c) => c.id));
    const validManual = manualDeckCards.filter((id) => collectionIds.has(id));
    const deck: string[] = [];

    const pool = fromCollection
      .sort((a, b) => a.cost - b.cost);

    for (const cardId of validManual) {
      if (deck.length < 40) {
        deck.push(cardId);
      }
    }
    for (const card of pool) {
      if (deck.length >= 35) break;
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

  private async createOrUpdateMonsterDeck(
    templateName: string,
    cards: string[],
    existingDeckId?: number
  ): Promise<number> {
    // Always keep AI decks owned by the system user to avoid polluting player deck lists.
    const userId = 1;
    const deckName = `Monster::${templateName}`;
    if (existingDeckId) {
      await deckRepository.updateDeckSystem(existingDeckId, {
        name: deckName,
        cards: cards
      });
      return existingDeckId;
    }
    return deckRepository.createDeck(userId, {
      name: deckName,
      cards: cards
    });
  }

  private normalizeVisualPath(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
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

  private fixVisualFolderCasing(path: string): string {
    return path
      .replace('/cards/deva/', '/cards/Devas/')
      .replace('/cards/Deva/', '/cards/Devas/')
      .replace('/cards/Dwarf/', '/cards/dwarf/');
  }

  private resolveSpawnVisual(sourceVisual: string): string {
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

  private isTextureVisual(value: string): boolean {
    return value.startsWith('res://') || value.startsWith('/assets/') || value.startsWith('assets/');
  }

  private randomMaleAvatarVisual(): string {
    const body = this.maleBodyVariants[Math.floor(Math.random() * this.maleBodyVariants.length)];
    const head = this.maleHeadVariants[Math.floor(Math.random() * this.maleHeadVariants.length)];
    return `avatar:male:${body}:${head}`;
  }

  private async rollTemplateDrop(userId: number, templateId: number): Promise<EncounterDropResult> {
    const template = await monsterRepository.getTemplateById(templateId);
    const fallbackCollection = template?.collection_id || 'shadowland_creatures';
    const drops = await monsterRepository.listTemplateDrops(templateId);
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

    const unlocked = await cardRepository.unlockCardForUser(userId, selectedCardId, 'monster_drop');
    if (!unlocked) {
      const fallback = await this.unlockFallbackFromCollection(userId, fallbackCollection, selectedCardId);
      if (fallback.mode === 'unlocked') {
        return fallback;
      }
      const card = await cardRepository.getCardById(selectedCardId);
      return {
        mode: 'already_owned',
        cardId: selectedCardId,
        cardName: card?.name,
        imageUrl: card?.image_url
      };
    }
    const card = await cardRepository.getCardById(selectedCardId);
    return {
      mode: 'unlocked',
      cardId: selectedCardId,
      cardName: card?.name,
      imageUrl: card?.image_url
    };
  }

  private async unlockFallbackFromCollection(
    userId: number,
    collectionId: string,
    excludeCardId: string = ''
  ): Promise<EncounterDropResult> {
    const locked = await cardRepository.getLockedCardsByCollectionForUser(collectionId, userId);
    const pool = excludeCardId
      ? locked.filter((card) => String(card.id) !== String(excludeCardId))
      : locked;
    if (pool.length === 0) {
      return { mode: 'none' };
    }
    const picked = pool[Math.floor(Math.random() * pool.length)];
    const unlocked = await cardRepository.unlockCardForUser(userId, picked.id, 'monster_drop_fallback');
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

export default new MonsterService();
