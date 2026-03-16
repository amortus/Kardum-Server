"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const card_repository_1 = __importDefault(require("../cards/card.repository"));
const experience_service_1 = __importDefault(require("../users/experience.service"));
const user_repository_1 = __importDefault(require("../users/user.repository"));
const quest_repository_1 = __importDefault(require("./quest.repository"));
class QuestService {
    async getSnapshot(userId, zoneHint = 'shadowland') {
        const [definitions, userQuests, trackedIds] = await Promise.all([
            quest_repository_1.default.listQuestDefinitions(),
            quest_repository_1.default.listUserQuests(userId),
            quest_repository_1.default.listTrackedQuestIds(userId)
        ]);
        const trackedSet = new Set(trackedIds.map((id) => Number(id)));
        const userQuestByQuestId = new Map();
        userQuests.forEach((uq) => userQuestByQuestId.set(Number(uq.quest_id), uq));
        const activeQuests = [];
        const availableQuests = [];
        const worldMarkers = [];
        for (const definition of definitions) {
            const userQuest = userQuestByQuestId.get(definition.id);
            if (!userQuest || ['abandoned', 'failed', 'expired'].includes(userQuest.state)) {
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
        const existing = await quest_repository_1.default.getUserQuestByUserAndQuest(userId, questId);
        if (!existing) {
            await quest_repository_1.default.createUserQuest(userId, questId, 'accepted');
        }
        else if (existing.state === 'completed') {
            throw new Error('Quest already completed');
        }
        else if (existing.state === 'abandoned' || existing.state === 'failed' || existing.state === 'expired') {
            await quest_repository_1.default.updateUserQuestState(existing.id, 'accepted');
        }
        if (definition.auto_track) {
            await quest_repository_1.default.trackQuest(userId, questId);
        }
    }
    async abandonQuest(userId, questId) {
        const existing = await quest_repository_1.default.getUserQuestByUserAndQuest(userId, questId);
        if (!existing)
            throw new Error('Quest not found in player log');
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
        const templateName = await quest_repository_1.default.getMonsterTemplateNameById(templateId);
        await this.applyProgressEvent(userId, {
            type: 'WIN_DUEL_VS_MONSTER_TEMPLATE',
            targetRef: templateName || String(templateId),
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
    objectiveMatchesEvent(objective, event) {
        const targetRef = String(objective.target_ref || '').trim().toLowerCase();
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
        const incomingRef = String(event.targetRef || '').trim().toLowerCase();
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
        return rewards.map((reward) => ({
            type: reward.reward_type,
            ref: reward.reward_ref,
            amount: reward.amount,
            metadata: this.parseRewardMetadata(reward.metadata_json)
        }));
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
    async applyRewards(userId, questId) {
        const rewards = await quest_repository_1.default.listQuestRewards(questId);
        for (const reward of rewards) {
            if (reward.reward_type === 'EXP') {
                const matchTypeRaw = String(this.parseRewardMetadata(reward.metadata_json).match_type || 'ai');
                const matchType = (matchTypeRaw === 'casual' || matchTypeRaw === 'ranked' || matchTypeRaw === 'ai') ? matchTypeRaw : 'ai';
                const amount = Math.max(1, Number(reward.amount || 1));
                for (let i = 0; i < amount; i += 1) {
                    await experience_service_1.default.awardExp(userId, matchType, true);
                }
            }
            else if (reward.reward_type === 'CARD_UNLOCK') {
                const cardId = String(reward.reward_ref || '').trim();
                if (cardId) {
                    await card_repository_1.default.unlockCardForUser(userId, cardId, 'quest_reward');
                }
            }
        }
    }
}
exports.default = new QuestService();
//# sourceMappingURL=quest.service.js.map