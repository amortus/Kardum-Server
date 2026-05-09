import npcRepository from './npc.repository';
import questService from '../quests/quest.service';
import questRepository from '../quests/quest.repository';
import cardRepository from '../cards/card.repository';

class NpcService {
  async listTemplates() {
    return npcRepository.listTemplates();
  }

  async createTemplate(payload: {
    code: string;
    name: string;
    sprite_ref: string;
    frame_count?: number;
    frame_cols?: number;
    frame_rows?: number;
    idle_start?: number;
    idle_count?: number;
    dialogue_json?: string | null;
  }) {
    return npcRepository.createTemplate(payload);
  }

  async updateTemplate(
    templateId: number,
    payload: Partial<{
      code: string;
      name: string;
      sprite_ref: string;
      frame_count: number;
      frame_cols: number;
      frame_rows: number;
      idle_start: number;
      idle_count: number;
      dialogue_json: string | null;
      is_active: boolean;
    }>
  ) {
    await npcRepository.updateTemplate(templateId, payload);
  }

  async listZoneSpawns(zone: string, userId?: number) {
    const [spawns, templates] = await Promise.all([
      npcRepository.listSpawns(zone),
      npcRepository.listTemplates()
    ]);
    const questDefinitions = await questRepository.listQuestDefinitions();
    let availableQuestIds: Set<number> | null = null;
    if (Number.isFinite(userId as number) && Number(userId) > 0) {
      availableQuestIds = new Set<number>();
      const snapshot = await questService.getSnapshot(Number(userId), zone);
      for (const available of snapshot.availableQuests || []) {
        availableQuestIds.add(Number(available.questId));
      }
    }
    const templateById = new Map<number, (typeof templates)[number]>();
    templates.forEach((template) => templateById.set(template.id, template));
    const rewardCache = new Map<number, Awaited<ReturnType<typeof questRepository.listQuestRewards>>>();
    const cardMetaCache = new Map<string, { name: string; imageUrl: string }>();
    const mapped = await Promise.all(
      spawns.map(async (spawn) => {
        const template = templateById.get(spawn.npc_template_id);
        if (!template) return null;
        const questOffers = await this.buildQuestOffersForTemplate(
          template.id,
          questDefinitions,
          rewardCache,
          cardMetaCache,
          availableQuestIds
        );
        return {
          spawn_uid: spawn.spawn_uid,
          npc_template_id: spawn.npc_template_id,
          zone: spawn.zone,
          x: spawn.spawn_x,
          y: spawn.spawn_y,
          interaction_radius: spawn.interaction_radius,
          template: {
            id: template.id,
            code: template.code,
            name: template.name,
            sprite_ref: template.sprite_ref,
            frame_count: template.frame_count,
            frame_cols: template.frame_cols,
            frame_rows: template.frame_rows,
            idle_start: template.idle_start,
            idle_count: template.idle_count,
            dialogue: this.parseDialogue(template.dialogue_json),
            quest_offers: questOffers
          }
        };
      })
    );
    return mapped.filter((entry) => entry !== null);
  }

  async createSpawn(payload: {
    npc_template_id: number;
    zone: string;
    spawn_x: number;
    spawn_y: number;
    interaction_radius?: number;
  }) {
    return npcRepository.createSpawn(payload);
  }

  async spawnByTemplateName(nameOrCode: string, zone: string, spawnX: number, spawnY: number) {
    const template = await npcRepository.getTemplateByNameOrCode(nameOrCode);
    if (!template || !template.is_active) {
      throw new Error(`NPC template "${nameOrCode}" not found`);
    }
    const spawnUid = await npcRepository.createSpawn({
      npc_template_id: template.id,
      zone,
      spawn_x: spawnX,
      spawn_y: spawnY
    });
    const zoneSpawns = await this.listZoneSpawns(zone);
    const created = zoneSpawns.find((entry: any) => String(entry?.spawn_uid || '') === spawnUid);
    if (!created) {
      throw new Error('NPC spawn created but not found in zone snapshot');
    }
    return created;
  }

  async updateSpawn(
    spawnUid: string,
    payload: Partial<{
      npc_template_id: number;
      zone: string;
      spawn_x: number;
      spawn_y: number;
      interaction_radius: number;
      is_active: boolean;
    }>
  ) {
    await npcRepository.updateSpawn(spawnUid, payload);
  }

  async removeSpawn(spawnUid: string) {
    await npcRepository.removeSpawn(spawnUid);
  }

  async interactWithNpc(userId: number, npcTemplateId: number): Promise<void> {
    await questService.onNpcTalk(userId, npcTemplateId);
  }

  private parseDialogue(value: string | null): string[] {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((line) => String(line));
      }
      return [];
    } catch {
      return [];
    }
  }

  private async buildQuestOffersForTemplate(
    npcTemplateId: number,
    definitions: Awaited<ReturnType<typeof questRepository.listQuestDefinitions>>,
    rewardCache: Map<number, Awaited<ReturnType<typeof questRepository.listQuestRewards>>>,
    cardMetaCache: Map<string, { name: string; imageUrl: string }>,
    availableQuestIds: Set<number> | null
  ): Promise<
    Array<{
      questId: number;
      code: string;
      title: string;
      description: string;
      minLevel: number;
      rewards: Array<{
        type: string;
        ref: string;
        amount: number;
        name: string;
        thumb: string;
      }>;
    }>
  > {
    const related = definitions.filter((quest) => {
      if (Number(quest.giver_npc_template_id || 0) !== npcTemplateId || !Boolean(quest.is_active)) {
        return false;
      }
      if (availableQuestIds == null) {
        return true;
      }
      return availableQuestIds.has(Number(quest.id));
    });
    const offers: Array<{
      questId: number;
      code: string;
      title: string;
      description: string;
      minLevel: number;
      rewards: Array<{
        type: string;
        ref: string;
        amount: number;
        name: string;
        thumb: string;
      }>;
    }> = [];
    for (const quest of related) {
      let rewards = rewardCache.get(quest.id);
      if (!rewards) {
        rewards = await questRepository.listQuestRewards(quest.id);
        rewardCache.set(quest.id, rewards);
      }
      const rewardViews: Array<{
        type: string;
        ref: string;
        amount: number;
        name: string;
        thumb: string;
      }> = [];
      for (const reward of rewards) {
        const type = String(reward.reward_type || '').trim();
        const ref = String(reward.reward_ref || '').trim();
        let rewardName = type;
        let thumb = '';
        if (type === 'EXP') {
          rewardName = 'Experiencia';
        } else if (type === 'CARD_UNLOCK') {
          rewardName = ref != '' ? ref : 'Carta';
          if (ref != '') {
            if (!cardMetaCache.has(ref)) {
              const card = await cardRepository.getCardById(ref);
              cardMetaCache.set(ref, {
                name: String(card?.name || ref),
                imageUrl: String(card?.image_url || '')
              });
            }
            const cached = cardMetaCache.get(ref)!;
            rewardName = cached.name;
            thumb = cached.imageUrl;
          }
        }
        rewardViews.push({
          type,
          ref,
          amount: Number(reward.amount || 0),
          name: rewardName,
          thumb
        });
      }
      offers.push({
        questId: quest.id,
        code: quest.code,
        title: quest.title,
        description: quest.description,
        minLevel: Number(quest.min_level || 1),
        rewards: rewardViews
      });
    }
    return offers;
  }
}

export default new NpcService();
