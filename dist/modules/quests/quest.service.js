"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const card_repository_1 = __importDefault(require("../cards/card.repository"));
const experience_service_1 = __importDefault(require("../users/experience.service"));
const constants_1 = require("../../shared/constants");
const user_repository_1 = __importDefault(require("../users/user.repository"));
const quest_repository_1 = __importDefault(require("./quest.repository"));
class QuestService {
    async getSnapshot(userId, zoneHint = 'shadowland') {
        const [definitions, userQuests, trackedIds, profile] = await Promise.all([
            quest_repository_1.default.listQuestDefinitions(),
            quest_repository_1.default.listUserQuests(userId),
            quest_repository_1.default.listTrackedQuestIds(userId),
            user_repository_1.default.getUserById(userId)
        ]);
        const playerLevel = Math.max(1, Number(profile?.level || 1));
        const trackedSet = new Set(trackedIds.map((id) => Number(id)));
        const userQuestByQuestId = new Map();
        userQuests.forEach((uq) => userQuestByQuestId.set(Number(uq.quest_id), uq));
        const definitionByCode = new Map();
        definitions.forEach((definition) => {
            definitionByCode.set(String(definition.code || '').trim().toLowerCase(), definition);
        });
        const prerequisitesRows = await quest_repository_1.default.listQuestPrerequisitesByQuestIds(definitions.map((definition) => definition.id));
        const prerequisitesByQuestId = new Map();
        for (const row of prerequisitesRows) {
            const current = prerequisitesByQuestId.get(row.quest_id) || [];
            current.push(row);
            prerequisitesByQuestId.set(row.quest_id, current);
        }
        const prerequisiteResolveCache = new Map();
        const activeQuests = [];
        const availableQuests = [];
        const worldMarkers = [];
        for (const definition of definitions) {
            const userQuest = userQuestByQuestId.get(definition.id);
            if (!userQuest || ['abandoned', 'failed', 'expired'].includes(userQuest.state)) {
                if (playerLevel < Number(definition.min_level || 1)) {
                    continue;
                }
                const prerequisites = prerequisitesByQuestId.get(definition.id) || [];
                const prerequisitesMet = await this.areQuestPrerequisitesMet(userQuestByQuestId, prerequisites, definitionByCode, prerequisiteResolveCache);
                if (!prerequisitesMet) {
                    continue;
                }
                availableQuests.push({
                    questId: definition.id,
                    code: definition.code,
                    title: definition.title,
                    description: definition.description,
                    giverNpcTemplateId: definition.giver_npc_template_id,
                    turnInNpcTemplateId: definition.turnin_npc_template_id,
                    minLevel: definition.min_level
                });
                continue;
            }
            if (!['accepted', 'in_progress', 'ready_to_turn_in', 'completed'].includes(userQuest.state)) {
                continue;
            }
            const objectives = await this.buildObjectiveProgress(userQuest.id, definition, zoneHint);
            const rewards = await this.buildRewards(definition.id);
            const item = {
                userQuestId: userQuest.id,
                questId: definition.id,
                code: definition.code,
                title: definition.title,
                description: definition.description,
                giverNpcTemplateId: definition.giver_npc_template_id,
                turnInNpcTemplateId: definition.turnin_npc_template_id,
                state: userQuest.state,
                tracked: trackedSet.has(definition.id),
                objectives,
                rewards
            };
            activeQuests.push(item);
            if (trackedSet.has(definition.id) && item.state !== 'completed') {
                const firstOpen = objectives.find((objective) => !objective.isComplete && objective.marker);
                if (firstOpen && firstOpen.marker) {
                    worldMarkers.push({
                        questId: definition.id,
                        objectiveId: firstOpen.objectiveId,
                        kind: firstOpen.marker.kind,
                        zone: firstOpen.marker.zone,
                        x: firstOpen.marker.x,
                        y: firstOpen.marker.y,
                        ref: firstOpen.marker.ref,
                        label: firstOpen.marker.label
                    });
                }
            }
        }
        return {
            activeQuests,
            availableQuests,
            trackedQuestIds: trackedIds,
            worldMarkers,
            version: Date.now()
        };
    }
    async acceptQuest(userId, questId) {
        const definition = await quest_repository_1.default.getQuestDefinitionById(questId);
        if (!definition || !definition.is_active) {
            throw new Error('Quest not found');
        }
        const profile = await user_repository_1.default.getUserById(userId);
        if (!profile)
            throw new Error('User not found');
        if ((profile.level || 1) < definition.min_level) {
            throw new Error('Player level is too low for this quest');
        }
        const [userQuests, prerequisites] = await Promise.all([
            quest_repository_1.default.listUserQuests(userId),
            quest_repository_1.default.listQuestPrerequisites(questId)
        ]);
        const userQuestByQuestId = new Map();
        userQuests.forEach((uq) => userQuestByQuestId.set(Number(uq.quest_id), uq));
        const definitions = await quest_repository_1.default.listQuestDefinitions();
        const definitionByCode = new Map();
        definitions.forEach((entry) => {
            definitionByCode.set(String(entry.code || '').trim().toLowerCase(), entry);
        });
        const prerequisitesMet = await this.areQuestPrerequisitesMet(userQuestByQuestId, prerequisites, definitionByCode, new Map());
        if (!prerequisitesMet) {
            throw new Error('Quest prerequisites are not met');
        }
        const existing = await quest_repository_1.default.getUserQuestByUserAndQuest(userId, questId);
        if (!existing) {
            await quest_repository_1.default.createUserQuest(userId, questId, 'accepted');
        }
        else if (existing.state === 'completed') {
            throw new Error('Quest already completed');
        }
        else if (existing.state === 'abandoned' || existing.state === 'failed' || existing.state === 'expired') {
            await quest_repository_1.default.clearUserQuestProgressAndLedger(existing.id, userId, questId);
            await quest_repository_1.default.resetUserQuestRowToFreshAccepted(existing.id);
        }
        if (definition.auto_track) {
            await quest_repository_1.default.trackQuest(userId, questId);
        }
    }
    async abandonQuest(userId, questId) {
        const existing = await quest_repository_1.default.getUserQuestByUserAndQuest(userId, questId);
        if (!existing)
            throw new Error('Quest not found in player log');
        if (existing.state === 'completed')
            throw new Error('Cannot abandon a completed quest');
        await quest_repository_1.default.clearUserQuestProgressAndLedger(existing.id, userId, questId);
        await quest_repository_1.default.updateUserQuestState(existing.id, 'abandoned');
        await quest_repository_1.default.clearTrackingForQuest(userId, questId);
    }
    async trackQuest(userId, questId, tracked) {
        const existing = await quest_repository_1.default.getUserQuestByUserAndQuest(userId, questId);
        if (!existing || ['abandoned', 'failed', 'expired'].includes(existing.state)) {
            throw new Error('Quest is not active for this player');
        }
        if (tracked) {
            await quest_repository_1.default.trackQuest(userId, questId);
        }
        else {
            await quest_repository_1.default.untrackQuest(userId, questId);
        }
    }
    async turnInQuest(userId, questId) {
        const existing = await quest_repository_1.default.getUserQuestByUserAndQuest(userId, questId);
        if (!existing)
            throw new Error('Quest not accepted');
        if (existing.state !== 'ready_to_turn_in' && existing.state !== 'completed') {
            throw new Error('Quest is not ready to turn in');
        }
        if (existing.state === 'completed')
            return;
        await this.applyRewards(userId, questId);
        await quest_repository_1.default.updateUserQuestState(existing.id, 'completed');
        await quest_repository_1.default.untrackQuest(userId, questId);
    }
    async onNpcTalk(userId, npcTemplateId) {
        await this.applyProgressEvent(userId, {
            type: 'TALK_TO_NPC',
            targetRef: String(npcTemplateId),
            eventKey: `talk_npc:${npcTemplateId}:${Date.now()}`
        });
    }
    async onMonsterEncounterResult(userId, templateId, result) {
        if (result !== 'win')
            return;
        const templateIdentity = await quest_repository_1.default.getMonsterTemplateIdentityById(templateId);
        const targetTokens = [String(templateId)];
        if (templateIdentity) {
            if (templateIdentity.code)
                targetTokens.push(templateIdentity.code);
            if (templateIdentity.name)
                targetTokens.push(templateIdentity.name);
        }
        else {
            const templateName = await quest_repository_1.default.getMonsterTemplateNameById(templateId);
            if (templateName)
                targetTokens.push(templateName);
        }
        await this.applyProgressEvent(userId, {
            type: 'WIN_DUEL_VS_MONSTER_TEMPLATE',
            targetRef: targetTokens.join('|'),
            eventKey: `monster_win:${templateId}:${Date.now()}`
        });
    }
    async onPvpMatchResult(userId, won, matchId) {
        if (!won)
            return;
        await this.applyProgressEvent(userId, {
            type: 'WIN_PVP_MATCH',
            targetRef: 'pvp',
            eventKey: `pvp_win:${matchId}`
        });
    }
    async onPlayerPosition(userId, zone, x, y) {
        await this.applyProgressEvent(userId, {
            type: 'VISIT_LOCATION',
            zone,
            x,
            y,
            eventKey: `visit:${zone}:${Math.round(x)}:${Math.round(y)}:${Math.floor(Date.now() / 2500)}`
        });
    }
    async applyProgressEvent(userId, event) {
        const userQuests = await quest_repository_1.default.listUserQuests(userId);
        const activeQuests = userQuests.filter((quest) => ['accepted', 'in_progress'].includes(quest.state));
        for (const userQuest of activeQuests) {
            const definition = await quest_repository_1.default.getQuestDefinitionById(userQuest.quest_id);
            if (!definition)
                continue;
            const objectives = await quest_repository_1.default.listQuestObjectives(definition.id);
            const objectiveProgress = await quest_repository_1.default.listObjectiveProgressByUserQuest(userQuest.id);
            const progressByObjectiveId = new Map();
            objectiveProgress.forEach((progress) => progressByObjectiveId.set(progress.objective_id, Number(progress.current_count || 0)));
            let changed = false;
            for (const objective of objectives) {
                if (objective.objective_type !== event.type)
                    continue;
                const matches = this.objectiveMatchesEvent(objective, event);
                if (!matches)
                    continue;
                const eventApplied = await quest_repository_1.default.markEventIfNew(userId, definition.id, `${event.eventKey}:objective:${objective.id}`, event.type);
                if (!eventApplied)
                    continue;
                const currentCount = progressByObjectiveId.get(objective.id) || 0;
                const nextCount = Math.min(objective.required_count, currentCount + Math.max(1, Number(event.amount || 1)));
                progressByObjectiveId.set(objective.id, nextCount);
                await quest_repository_1.default.upsertObjectiveProgress(userQuest.id, objective.id, nextCount, nextCount >= objective.required_count, event.eventKey);
                changed = true;
            }
            const talkAuto = await this.fillTurninNpcTalkIfOthersComplete(definition, objectives, progressByObjectiveId, userQuest.id);
            if (talkAuto)
                changed = true;
            if (!changed)
                continue;
            const completion = this.computeQuestCompletion(objectives, progressByObjectiveId, definition.objective_logic);
            if (completion.allComplete) {
                await quest_repository_1.default.updateUserQuestState(userQuest.id, 'ready_to_turn_in');
            }
            else {
                await quest_repository_1.default.updateUserQuestState(userQuest.id, 'in_progress');
            }
        }
    }
    normObjectiveRef(value) {
        return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
    }
    /** Completa objetivo "falar com NPC" do mesmo template de entrega quando os demais já estão OK (evita segunda ida ao NPC só para marcar o objetivo). */
    async fillTurninNpcTalkIfOthersComplete(definition, objectives, progressByObjectiveId, userQuestId) {
        const turninId = definition.turnin_npc_template_id;
        if (turninId == null || turninId <= 0)
            return false;
        const talkObjectives = objectives.filter((o) => o.objective_type === 'TALK_TO_NPC' && this.refMatchesNpcTemplateId(String(o.target_ref || ''), turninId));
        if (talkObjectives.length === 0)
            return false;
        const talkIds = new Set(talkObjectives.map((o) => o.id));
        const others = objectives.filter((o) => !talkIds.has(o.id));
        const othersDone = others.every((o) => (progressByObjectiveId.get(o.id) || 0) >= o.required_count);
        if (!othersDone)
            return false;
        let any = false;
        for (const o of talkObjectives) {
            const cur = progressByObjectiveId.get(o.id) || 0;
            if (cur >= o.required_count)
                continue;
            progressByObjectiveId.set(o.id, o.required_count);
            await quest_repository_1.default.upsertObjectiveProgress(userQuestId, o.id, o.required_count, true, 'auto_turnin_npc_talk');
            any = true;
        }
        return any;
    }
    refMatchesNpcTemplateId(targetRef, npcTemplateId) {
        const tr = this.normObjectiveRef(targetRef);
        const idStr = String(npcTemplateId);
        if (tr === this.normObjectiveRef(idStr))
            return true;
        const tn = Number(tr);
        const idn = Number(idStr);
        return Number.isFinite(tn) && Number.isFinite(idn) && tn === idn;
    }
    objectiveMatchesEvent(objective, event) {
        const normRef = (value) => this.normObjectiveRef(value);
        const targetRef = normRef(String(objective.target_ref || ''));
        if (event.type === 'VISIT_LOCATION') {
            if (!event.zone || event.x == null || event.y == null)
                return false;
            const marker = this.parseMarkerFromObjective(objective);
            if (!marker || marker.kind !== 'location')
                return false;
            if (marker.zone && marker.zone.toLowerCase() !== String(event.zone).toLowerCase())
                return false;
            if (marker.x == null || marker.y == null)
                return false;
            const dx = Number(event.x) - marker.x;
            const dy = Number(event.y) - marker.y;
            const distanceSq = dx * dx + dy * dy;
            const filters = this.parseFilters(objective);
            const radius = Number(filters.radius || 90);
            return distanceSq <= radius * radius;
        }
        const incomingRef = normRef(String(event.targetRef || ''));
        if (targetRef === '')
            return true;
        if (targetRef === incomingRef)
            return true;
        const targetNumeric = Number(targetRef);
        const incomingNumeric = Number(incomingRef);
        if (Number.isFinite(targetNumeric) && Number.isFinite(incomingNumeric) && targetNumeric === incomingNumeric) {
            return true;
        }
        return incomingRef.includes(targetRef) || targetRef.includes(incomingRef);
    }
    computeQuestCompletion(objectives, progressByObjectiveId, logic) {
        if (objectives.length === 0)
            return { allComplete: true };
        if (logic === 'any') {
            return {
                allComplete: objectives.some((objective) => (progressByObjectiveId.get(objective.id) || 0) >= objective.required_count)
            };
        }
        return {
            allComplete: objectives.every((objective) => (progressByObjectiveId.get(objective.id) || 0) >= objective.required_count)
        };
    }
    async buildObjectiveProgress(userQuestId, definition, zoneHint) {
        const objectives = await quest_repository_1.default.listQuestObjectives(definition.id);
        const progress = await quest_repository_1.default.listObjectiveProgressByUserQuest(userQuestId);
        const progressByObjective = new Map();
        progress.forEach((row) => progressByObjective.set(row.objective_id, Number(row.current_count || 0)));
        return objectives.map((objective) => {
            const current = progressByObjective.get(objective.id) || 0;
            const marker = this.parseMarkerFromObjective(objective, zoneHint);
            return {
                objectiveId: objective.id,
                objectiveType: objective.objective_type,
                targetRef: objective.target_ref,
                requiredCount: objective.required_count,
                currentCount: current,
                isComplete: current >= objective.required_count,
                orderIndex: objective.order_index,
                marker
            };
        });
    }
    parseMarkerFromObjective(objective, zoneHint = 'shadowland') {
        if (objective.objective_type === 'VISIT_LOCATION') {
            const [zoneRaw, xRaw, yRaw] = String(objective.target_ref || '').split(':');
            const x = Number(xRaw);
            const y = Number(yRaw);
            if (!Number.isFinite(x) || !Number.isFinite(y))
                return null;
            return {
                kind: 'location',
                zone: String(zoneRaw || zoneHint || 'shadowland'),
                x: Number(x),
                y: Number(y),
                label: 'Local da quest'
            };
        }
        if (objective.objective_type === 'TALK_TO_NPC') {
            return {
                kind: 'npc',
                ref: String(objective.target_ref || ''),
                label: 'Falar com NPC'
            };
        }
        if (objective.objective_type === 'WIN_DUEL_VS_MONSTER_TEMPLATE') {
            return {
                kind: 'monster',
                ref: String(objective.target_ref || ''),
                label: 'Vencer duelo'
            };
        }
        return null;
    }
    parseFilters(objective) {
        if (!objective.filters_json)
            return {};
        try {
            const parsed = JSON.parse(objective.filters_json);
            if (parsed && typeof parsed === 'object')
                return parsed;
            return {};
        }
        catch {
            return {};
        }
    }
    async buildRewards(questId) {
        const rewards = await quest_repository_1.default.listQuestRewards(questId);
        const result = [];
        for (const reward of rewards) {
            const item = {
                type: reward.reward_type,
                ref: reward.reward_ref,
                amount: reward.amount,
                metadata: this.parseRewardMetadata(reward.metadata_json)
            };
            if (reward.reward_type === 'CARD_UNLOCK') {
                const cardId = String(reward.reward_ref || '').trim();
                item.name = cardId === '' ? 'Carta' : cardId;
                item.thumb = '';
                if (cardId !== '') {
                    const card = await card_repository_1.default.getCardById(cardId);
                    if (card) {
                        item.name = String(card.name || cardId);
                        item.thumb = String(card.image_url || '');
                    }
                }
            }
            result.push(item);
        }
        return result;
    }
    parseRewardMetadata(value) {
        if (!value)
            return {};
        try {
            const parsed = JSON.parse(value);
            if (parsed && typeof parsed === 'object')
                return parsed;
            return {};
        }
        catch {
            return {};
        }
    }
    safeRewardIterations(amount, fallback = 1) {
        let n = typeof amount === 'bigint' ? Number(amount) : Number(amount);
        if (!Number.isFinite(n) || n < 1)
            n = fallback;
        return Math.min(50000, Math.max(1, Math.floor(n)));
    }
    async applyRewards(userId, questId) {
        const rewards = await quest_repository_1.default.listQuestRewards(questId);
        for (const reward of rewards) {
            if (reward.reward_type === 'EXP') {
                const matchTypeRaw = String(this.parseRewardMetadata(reward.metadata_json).match_type || 'ai');
                const matchType = (matchTypeRaw === 'casual' || matchTypeRaw === 'ranked' || matchTypeRaw === 'ai') ? matchTypeRaw : 'ai';
                const iterations = this.safeRewardIterations(reward.amount, 1);
                const rewardTable = constants_1.EXP_REWARDS[matchType] ?? constants_1.EXP_REWARDS.ai;
                const expPerWin = rewardTable.win;
                await experience_service_1.default.addExpPoints(userId, iterations * expPerWin);
            }
            else if (reward.reward_type === 'CARD_UNLOCK') {
                const cardId = String(reward.reward_ref || '').trim();
                if (cardId) {
                    await card_repository_1.default.unlockCardForUser(userId, cardId, 'quest_reward');
                }
            }
        }
    }
    async areQuestPrerequisitesMet(userQuestByQuestId, prerequisites, definitionByCode, prerequisiteResolveCache) {
        if (!Array.isArray(prerequisites) || prerequisites.length <= 0) {
            return true;
        }
        for (const prerequisite of prerequisites) {
            const prerequisiteType = String(prerequisite.prerequisite_type || '').trim().toUpperCase();
            if (prerequisiteType !== 'QUEST_COMPLETED') {
                continue;
            }
            const questId = await this.resolveQuestIdFromPrerequisiteReference(String(prerequisite.reference_value || ''), definitionByCode, prerequisiteResolveCache);
            if (!questId || questId <= 0) {
                return false;
            }
            const userQuest = userQuestByQuestId.get(questId);
            if (!userQuest || String(userQuest.state || '').toLowerCase() !== 'completed') {
                return false;
            }
        }
        return true;
    }
    async resolveQuestIdFromPrerequisiteReference(referenceValue, definitionByCode, prerequisiteResolveCache) {
        const raw = String(referenceValue || '').trim();
        const cacheKey = raw.toLowerCase();
        if (cacheKey === '')
            return null;
        if (prerequisiteResolveCache.has(cacheKey)) {
            return prerequisiteResolveCache.get(cacheKey) || null;
        }
        const numeric = Number(raw);
        if (Number.isFinite(numeric) && numeric > 0) {
            const questId = Math.floor(numeric);
            prerequisiteResolveCache.set(cacheKey, questId);
            return questId;
        }
        const fromDefinitions = definitionByCode.get(cacheKey);
        if (fromDefinitions) {
            prerequisiteResolveCache.set(cacheKey, fromDefinitions.id);
            return fromDefinitions.id;
        }
        const fromRepository = await quest_repository_1.default.getQuestByCode(raw);
        const resolved = fromRepository ? Number(fromRepository.id) : null;
        prerequisiteResolveCache.set(cacheKey, resolved);
        return resolved;
    }
}
exports.default = new QuestService();
//# sourceMappingURL=quest.service.js.map