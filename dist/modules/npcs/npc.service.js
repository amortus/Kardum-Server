"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const npc_repository_1 = __importDefault(require("./npc.repository"));
const quest_service_1 = __importDefault(require("../quests/quest.service"));
const quest_repository_1 = __importDefault(require("../quests/quest.repository"));
const card_repository_1 = __importDefault(require("../cards/card.repository"));
class NpcService {
    async listTemplates() {
        return npc_repository_1.default.listTemplates();
    }
    async createTemplate(payload) {
        return npc_repository_1.default.createTemplate(payload);
    }
    async updateTemplate(templateId, payload) {
        await npc_repository_1.default.updateTemplate(templateId, payload);
    }
    async listZoneSpawns(zone, userId) {
        const [spawns, templates] = await Promise.all([
            npc_repository_1.default.listSpawns(zone),
            npc_repository_1.default.listTemplates()
        ]);
        const questDefinitions = await quest_repository_1.default.listQuestDefinitions();
        let availableQuestIds = null;
        if (Number.isFinite(userId) && Number(userId) > 0) {
            availableQuestIds = new Set();
            const snapshot = await quest_service_1.default.getSnapshot(Number(userId), zone);
            for (const available of snapshot.availableQuests || []) {
                availableQuestIds.add(Number(available.questId));
            }
        }
        const templateById = new Map();
        templates.forEach((template) => templateById.set(template.id, template));
        const rewardCache = new Map();
        const cardMetaCache = new Map();
        const mapped = await Promise.all(spawns.map(async (spawn) => {
            const template = templateById.get(spawn.npc_template_id);
            if (!template)
                return null;
            const questOffers = await this.buildQuestOffersForTemplate(template.id, questDefinitions, rewardCache, cardMetaCache, availableQuestIds);
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
        }));
        return mapped.filter((entry) => entry !== null);
    }
    async createSpawn(payload) {
        return npc_repository_1.default.createSpawn(payload);
    }
    async spawnByTemplateName(nameOrCode, zone, spawnX, spawnY) {
        const template = await npc_repository_1.default.getTemplateByNameOrCode(nameOrCode);
        if (!template || !template.is_active) {
            throw new Error(`NPC template "${nameOrCode}" not found`);
        }
        const spawnUid = await npc_repository_1.default.createSpawn({
            npc_template_id: template.id,
            zone,
            spawn_x: spawnX,
            spawn_y: spawnY
        });
        const zoneSpawns = await this.listZoneSpawns(zone);
        const created = zoneSpawns.find((entry) => String(entry?.spawn_uid || '') === spawnUid);
        if (!created) {
            throw new Error('NPC spawn created but not found in zone snapshot');
        }
        return created;
    }
    async updateSpawn(spawnUid, payload) {
        await npc_repository_1.default.updateSpawn(spawnUid, payload);
    }
    async removeSpawn(spawnUid) {
        await npc_repository_1.default.removeSpawn(spawnUid);
    }
    async interactWithNpc(userId, npcTemplateId) {
        await quest_service_1.default.onNpcTalk(userId, npcTemplateId);
    }
    parseDialogue(value) {
        if (!value)
            return [];
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
                return parsed.map((line) => String(line));
            }
            return [];
        }
        catch {
            return [];
        }
    }
    async buildQuestOffersForTemplate(npcTemplateId, definitions, rewardCache, cardMetaCache, availableQuestIds) {
        const related = definitions.filter((quest) => {
            if (Number(quest.giver_npc_template_id || 0) !== npcTemplateId || !Boolean(quest.is_active)) {
                return false;
            }
            if (availableQuestIds == null) {
                return true;
            }
            return availableQuestIds.has(Number(quest.id));
        });
        const offers = [];
        for (const quest of related) {
            let rewards = rewardCache.get(quest.id);
            if (!rewards) {
                rewards = await quest_repository_1.default.listQuestRewards(quest.id);
                rewardCache.set(quest.id, rewards);
            }
            const rewardViews = [];
            for (const reward of rewards) {
                const type = String(reward.reward_type || '').trim();
                const ref = String(reward.reward_ref || '').trim();
                let rewardName = type;
                let thumb = '';
                if (type === 'EXP') {
                    rewardName = 'Experiencia';
                }
                else if (type === 'CARD_UNLOCK') {
                    rewardName = ref != '' ? ref : 'Carta';
                    if (ref != '') {
                        if (!cardMetaCache.has(ref)) {
                            const card = await card_repository_1.default.getCardById(ref);
                            cardMetaCache.set(ref, {
                                name: String(card?.name || ref),
                                imageUrl: String(card?.image_url || '')
                            });
                        }
                        const cached = cardMetaCache.get(ref);
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
exports.default = new NpcService();
//# sourceMappingURL=npc.service.js.map