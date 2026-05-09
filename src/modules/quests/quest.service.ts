import cardRepository from '../cards/card.repository';
import experienceService from '../users/experience.service';
import { EXP_REWARDS } from '../../shared/constants';
import userRepository from '../users/user.repository';
import questRepository from './quest.repository';
import type {
  ObjectiveProgressView,
  QuestDefinitionRow,
  QuestObjectiveRow,
  QuestPrerequisiteRow,
  UserQuestSnapshotItem
} from './quest.types';

type ProgressEvent = {
  type:
    | 'COLLECT_ITEM'
    | 'WIN_DUEL_VS_MONSTER_TEMPLATE'
    | 'TALK_TO_NPC'
    | 'VISIT_LOCATION'
    | 'WIN_PVP_MATCH'
    | 'REACH_LEVEL'
    | 'CUSTOM_FLAG';
  targetRef?: string;
  zone?: string;
  x?: number;
  y?: number;
  amount?: number;
  eventKey: string;
};

type QuestSnapshot = {
  activeQuests: UserQuestSnapshotItem[];
  availableQuests: Array<{
    questId: number;
    code: string;
    title: string;
    description: string;
    giverNpcTemplateId: number | null;
    turnInNpcTemplateId: number | null;
    minLevel: number;
  }>;
  trackedQuestIds: number[];
  worldMarkers: Array<{
    questId: number;
    objectiveId: number;
    kind: 'npc' | 'location' | 'monster' | 'custom';
    zone?: string;
    x?: number;
    y?: number;
    ref?: string;
    label?: string;
  }>;
  version: number;
};

class QuestService {
  async getSnapshot(userId: number, zoneHint: string = 'shadowland'): Promise<QuestSnapshot> {
    const [definitions, userQuests, trackedIds, profile] = await Promise.all([
      questRepository.listQuestDefinitions(),
      questRepository.listUserQuests(userId),
      questRepository.listTrackedQuestIds(userId),
      userRepository.getUserById(userId)
    ]);
    const playerLevel = Math.max(1, Number(profile?.level || 1));
    const trackedSet = new Set<number>(trackedIds.map((id) => Number(id)));
    const userQuestByQuestId = new Map<number, (typeof userQuests)[number]>();
    userQuests.forEach((uq) => userQuestByQuestId.set(Number(uq.quest_id), uq));
    const definitionByCode = new Map<string, QuestDefinitionRow>();
    definitions.forEach((definition) => {
      definitionByCode.set(String(definition.code || '').trim().toLowerCase(), definition);
    });
    const prerequisitesRows = await questRepository.listQuestPrerequisitesByQuestIds(
      definitions.map((definition) => definition.id)
    );
    const prerequisitesByQuestId = new Map<number, QuestPrerequisiteRow[]>();
    for (const row of prerequisitesRows) {
      const current = prerequisitesByQuestId.get(row.quest_id) || [];
      current.push(row);
      prerequisitesByQuestId.set(row.quest_id, current);
    }
    const prerequisiteResolveCache = new Map<string, number | null>();

    const activeQuests: UserQuestSnapshotItem[] = [];
    const availableQuests: QuestSnapshot['availableQuests'] = [];
    const worldMarkers: QuestSnapshot['worldMarkers'] = [];

    for (const definition of definitions) {
      const userQuest = userQuestByQuestId.get(definition.id);
      if (!userQuest || ['abandoned', 'failed', 'expired'].includes(userQuest.state)) {
        if (playerLevel < Number(definition.min_level || 1)) {
          continue;
        }
        const prerequisites = prerequisitesByQuestId.get(definition.id) || [];
        const prerequisitesMet = await this.areQuestPrerequisitesMet(
          userQuestByQuestId,
          prerequisites,
          definitionByCode,
          prerequisiteResolveCache
        );
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
      const item: UserQuestSnapshotItem = {
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

  async acceptQuest(userId: number, questId: number): Promise<void> {
    const definition = await questRepository.getQuestDefinitionById(questId);
    if (!definition || !definition.is_active) {
      throw new Error('Quest not found');
    }
    const profile = await userRepository.getUserById(userId);
    if (!profile) throw new Error('User not found');
    if ((profile.level || 1) < definition.min_level) {
      throw new Error('Player level is too low for this quest');
    }
    const [userQuests, prerequisites] = await Promise.all([
      questRepository.listUserQuests(userId),
      questRepository.listQuestPrerequisites(questId)
    ]);
    const userQuestByQuestId = new Map<number, (typeof userQuests)[number]>();
    userQuests.forEach((uq) => userQuestByQuestId.set(Number(uq.quest_id), uq));
    const definitions = await questRepository.listQuestDefinitions();
    const definitionByCode = new Map<string, QuestDefinitionRow>();
    definitions.forEach((entry) => {
      definitionByCode.set(String(entry.code || '').trim().toLowerCase(), entry);
    });
    const prerequisitesMet = await this.areQuestPrerequisitesMet(
      userQuestByQuestId,
      prerequisites,
      definitionByCode,
      new Map<string, number | null>()
    );
    if (!prerequisitesMet) {
      throw new Error('Quest prerequisites are not met');
    }

    const existing = await questRepository.getUserQuestByUserAndQuest(userId, questId);
    if (!existing) {
      await questRepository.createUserQuest(userId, questId, 'accepted');
    } else if (existing.state === 'completed') {
      throw new Error('Quest already completed');
    } else if (existing.state === 'abandoned' || existing.state === 'failed' || existing.state === 'expired') {
      await questRepository.clearUserQuestProgressAndLedger(existing.id, userId, questId);
      await questRepository.resetUserQuestRowToFreshAccepted(existing.id);
    }

    if (definition.auto_track) {
      await questRepository.trackQuest(userId, questId);
    }
  }

  async abandonQuest(userId: number, questId: number): Promise<void> {
    const existing = await questRepository.getUserQuestByUserAndQuest(userId, questId);
    if (!existing) throw new Error('Quest not found in player log');
    if (existing.state === 'completed') throw new Error('Cannot abandon a completed quest');
    await questRepository.clearUserQuestProgressAndLedger(existing.id, userId, questId);
    await questRepository.updateUserQuestState(existing.id, 'abandoned');
    await questRepository.clearTrackingForQuest(userId, questId);
  }

  async trackQuest(userId: number, questId: number, tracked: boolean): Promise<void> {
    const existing = await questRepository.getUserQuestByUserAndQuest(userId, questId);
    if (!existing || ['abandoned', 'failed', 'expired'].includes(existing.state)) {
      throw new Error('Quest is not active for this player');
    }
    if (tracked) {
      await questRepository.trackQuest(userId, questId);
    } else {
      await questRepository.untrackQuest(userId, questId);
    }
  }

  async turnInQuest(userId: number, questId: number): Promise<void> {
    const existing = await questRepository.getUserQuestByUserAndQuest(userId, questId);
    if (!existing) throw new Error('Quest not accepted');
    if (existing.state !== 'ready_to_turn_in' && existing.state !== 'completed') {
      throw new Error('Quest is not ready to turn in');
    }
    if (existing.state === 'completed') return;

    await this.applyRewards(userId, questId);
    await questRepository.updateUserQuestState(existing.id, 'completed');
    await questRepository.untrackQuest(userId, questId);
  }

  async onNpcTalk(userId: number, npcTemplateId: number): Promise<void> {
    await this.applyProgressEvent(userId, {
      type: 'TALK_TO_NPC',
      targetRef: String(npcTemplateId),
      eventKey: `talk_npc:${npcTemplateId}:${Date.now()}`
    });
  }

  async onMonsterEncounterResult(userId: number, templateId: number, result: 'win' | 'loss' | 'draw'): Promise<void> {
    if (result !== 'win') return;
    const templateIdentity = await questRepository.getMonsterTemplateIdentityById(templateId);
    const targetTokens: string[] = [String(templateId)];
    if (templateIdentity) {
      if (templateIdentity.code) targetTokens.push(templateIdentity.code);
      if (templateIdentity.name) targetTokens.push(templateIdentity.name);
    } else {
      const templateName = await questRepository.getMonsterTemplateNameById(templateId);
      if (templateName) targetTokens.push(templateName);
    }
    await this.applyProgressEvent(userId, {
      type: 'WIN_DUEL_VS_MONSTER_TEMPLATE',
      targetRef: targetTokens.join('|'),
      eventKey: `monster_win:${templateId}:${Date.now()}`
    });
  }

  async onPvpMatchResult(userId: number, won: boolean, matchId: number): Promise<void> {
    if (!won) return;
    await this.applyProgressEvent(userId, {
      type: 'WIN_PVP_MATCH',
      targetRef: 'pvp',
      eventKey: `pvp_win:${matchId}`
    });
  }

  async onPlayerPosition(userId: number, zone: string, x: number, y: number): Promise<void> {
    await this.applyProgressEvent(userId, {
      type: 'VISIT_LOCATION',
      zone,
      x,
      y,
      eventKey: `visit:${zone}:${Math.round(x)}:${Math.round(y)}:${Math.floor(Date.now() / 2500)}`
    });
  }

  private async applyProgressEvent(userId: number, event: ProgressEvent): Promise<void> {
    const userQuests = await questRepository.listUserQuests(userId);
    const activeQuests = userQuests.filter((quest) => ['accepted', 'in_progress'].includes(quest.state));
    for (const userQuest of activeQuests) {
      const definition = await questRepository.getQuestDefinitionById(userQuest.quest_id);
      if (!definition) continue;
      const objectives = await questRepository.listQuestObjectives(definition.id);
      const objectiveProgress = await questRepository.listObjectiveProgressByUserQuest(userQuest.id);
      const progressByObjectiveId = new Map<number, number>();
      objectiveProgress.forEach((progress) => progressByObjectiveId.set(progress.objective_id, Number(progress.current_count || 0)));

      let changed = false;
      for (const objective of objectives) {
        if (objective.objective_type !== event.type) continue;
        const matches = this.objectiveMatchesEvent(objective, event);
        if (!matches) continue;

        const eventApplied = await questRepository.markEventIfNew(
          userId,
          definition.id,
          `${event.eventKey}:objective:${objective.id}`,
          event.type
        );
        if (!eventApplied) continue;

        const currentCount = progressByObjectiveId.get(objective.id) || 0;
        const nextCount = Math.min(
          objective.required_count,
          currentCount + Math.max(1, Number(event.amount || 1))
        );
        progressByObjectiveId.set(objective.id, nextCount);
        await questRepository.upsertObjectiveProgress(
          userQuest.id,
          objective.id,
          nextCount,
          nextCount >= objective.required_count,
          event.eventKey
        );
        changed = true;
      }

      const talkAuto = await this.fillTurninNpcTalkIfOthersComplete(
        definition,
        objectives,
        progressByObjectiveId,
        userQuest.id
      );
      if (talkAuto) changed = true;

      if (!changed) continue;

      const completion = this.computeQuestCompletion(objectives, progressByObjectiveId, definition.objective_logic);
      if (completion.allComplete) {
        await questRepository.updateUserQuestState(userQuest.id, 'ready_to_turn_in');
      } else {
        await questRepository.updateUserQuestState(userQuest.id, 'in_progress');
      }
    }
  }

  private normObjectiveRef(value: string): string {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  /** Completa objetivo "falar com NPC" do mesmo template de entrega quando os demais já estão OK (evita segunda ida ao NPC só para marcar o objetivo). */
  private async fillTurninNpcTalkIfOthersComplete(
    definition: QuestDefinitionRow,
    objectives: QuestObjectiveRow[],
    progressByObjectiveId: Map<number, number>,
    userQuestId: number
  ): Promise<boolean> {
    const turninId = definition.turnin_npc_template_id;
    if (turninId == null || turninId <= 0) return false;

    const talkObjectives = objectives.filter(
      (o) => o.objective_type === 'TALK_TO_NPC' && this.refMatchesNpcTemplateId(String(o.target_ref || ''), turninId)
    );
    if (talkObjectives.length === 0) return false;

    const talkIds = new Set(talkObjectives.map((o) => o.id));
    const others = objectives.filter((o) => !talkIds.has(o.id));
    const othersDone = others.every((o) => (progressByObjectiveId.get(o.id) || 0) >= o.required_count);
    if (!othersDone) return false;

    let any = false;
    for (const o of talkObjectives) {
      const cur = progressByObjectiveId.get(o.id) || 0;
      if (cur >= o.required_count) continue;
      progressByObjectiveId.set(o.id, o.required_count);
      await questRepository.upsertObjectiveProgress(
        userQuestId,
        o.id,
        o.required_count,
        true,
        'auto_turnin_npc_talk'
      );
      any = true;
    }
    return any;
  }

  private refMatchesNpcTemplateId(targetRef: string, npcTemplateId: number): boolean {
    const tr = this.normObjectiveRef(targetRef);
    const idStr = String(npcTemplateId);
    if (tr === this.normObjectiveRef(idStr)) return true;
    const tn = Number(tr);
    const idn = Number(idStr);
    return Number.isFinite(tn) && Number.isFinite(idn) && tn === idn;
  }

  private objectiveMatchesEvent(objective: QuestObjectiveRow, event: ProgressEvent): boolean {
    const normRef = (value: string) => this.normObjectiveRef(value);
    const targetRef = normRef(String(objective.target_ref || ''));
    if (event.type === 'VISIT_LOCATION') {
      if (!event.zone || event.x == null || event.y == null) return false;
      const marker = this.parseMarkerFromObjective(objective);
      if (!marker || marker.kind !== 'location') return false;
      if (marker.zone && marker.zone.toLowerCase() !== String(event.zone).toLowerCase()) return false;
      if (marker.x == null || marker.y == null) return false;
      const dx = Number(event.x) - marker.x;
      const dy = Number(event.y) - marker.y;
      const distanceSq = dx * dx + dy * dy;
      const filters = this.parseFilters(objective);
      const radius = Number(filters.radius || 90);
      return distanceSq <= radius * radius;
    }

    const incomingRef = normRef(String(event.targetRef || ''));
    if (targetRef === '') return true;
    if (targetRef === incomingRef) return true;

    const targetNumeric = Number(targetRef);
    const incomingNumeric = Number(incomingRef);
    if (Number.isFinite(targetNumeric) && Number.isFinite(incomingNumeric) && targetNumeric === incomingNumeric) {
      return true;
    }
    return incomingRef.includes(targetRef) || targetRef.includes(incomingRef);
  }

  private computeQuestCompletion(
    objectives: QuestObjectiveRow[],
    progressByObjectiveId: Map<number, number>,
    logic: 'all' | 'any'
  ): { allComplete: boolean } {
    if (objectives.length === 0) return { allComplete: true };
    if (logic === 'any') {
      return {
        allComplete: objectives.some((objective) => (progressByObjectiveId.get(objective.id) || 0) >= objective.required_count)
      };
    }
    return {
      allComplete: objectives.every((objective) => (progressByObjectiveId.get(objective.id) || 0) >= objective.required_count)
    };
  }

  private async buildObjectiveProgress(
    userQuestId: number,
    definition: QuestDefinitionRow,
    zoneHint: string
  ): Promise<ObjectiveProgressView[]> {
    const objectives = await questRepository.listQuestObjectives(definition.id);
    const progress = await questRepository.listObjectiveProgressByUserQuest(userQuestId);
    const progressByObjective = new Map<number, number>();
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

  private parseMarkerFromObjective(
    objective: QuestObjectiveRow,
    zoneHint: string = 'shadowland'
  ): ObjectiveProgressView['marker'] {
    if (objective.objective_type === 'VISIT_LOCATION') {
      const [zoneRaw, xRaw, yRaw] = String(objective.target_ref || '').split(':');
      const x = Number(xRaw);
      const y = Number(yRaw);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
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

  private parseFilters(objective: QuestObjectiveRow): Record<string, unknown> {
    if (!objective.filters_json) return {};
    try {
      const parsed = JSON.parse(objective.filters_json);
      if (parsed && typeof parsed === 'object') return parsed;
      return {};
    } catch {
      return {};
    }
  }

  private async buildRewards(questId: number): Promise<UserQuestSnapshotItem['rewards']> {
    const rewards = await questRepository.listQuestRewards(questId);
    const result: UserQuestSnapshotItem['rewards'] = [];
    for (const reward of rewards) {
      const item: UserQuestSnapshotItem['rewards'][number] = {
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
          const card = await cardRepository.getCardById(cardId);
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

  private parseRewardMetadata(value: string | null): Record<string, unknown> {
    if (!value) return {};
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
      return {};
    } catch {
      return {};
    }
  }

  private safeRewardIterations(amount: unknown, fallback: number = 1): number {
    let n = typeof amount === 'bigint' ? Number(amount) : Number(amount);
    if (!Number.isFinite(n) || n < 1) n = fallback;
    return Math.min(50_000, Math.max(1, Math.floor(n)));
  }

  private async applyRewards(userId: number, questId: number): Promise<void> {
    const rewards = await questRepository.listQuestRewards(questId);
    for (const reward of rewards) {
      if (reward.reward_type === 'EXP') {
        const matchTypeRaw = String(this.parseRewardMetadata(reward.metadata_json).match_type || 'ai');
        const matchType = (matchTypeRaw === 'casual' || matchTypeRaw === 'ranked' || matchTypeRaw === 'ai') ? matchTypeRaw : 'ai';
        const iterations = this.safeRewardIterations(reward.amount, 1);
        const rewardTable = EXP_REWARDS[matchType] ?? EXP_REWARDS.ai;
        const expPerWin = rewardTable.win;
        await experienceService.addExpPoints(userId, iterations * expPerWin);
      } else if (reward.reward_type === 'CARD_UNLOCK') {
        const cardId = String(reward.reward_ref || '').trim();
        if (cardId) {
          await cardRepository.unlockCardForUser(userId, cardId, 'quest_reward');
        }
      }
    }
  }

  private async areQuestPrerequisitesMet(
    userQuestByQuestId: Map<number, { state: string }>,
    prerequisites: QuestPrerequisiteRow[],
    definitionByCode: Map<string, QuestDefinitionRow>,
    prerequisiteResolveCache: Map<string, number | null>
  ): Promise<boolean> {
    if (!Array.isArray(prerequisites) || prerequisites.length <= 0) {
      return true;
    }
    for (const prerequisite of prerequisites) {
      const prerequisiteType = String(prerequisite.prerequisite_type || '').trim().toUpperCase();
      if (prerequisiteType !== 'QUEST_COMPLETED') {
        continue;
      }
      const questId = await this.resolveQuestIdFromPrerequisiteReference(
        String(prerequisite.reference_value || ''),
        definitionByCode,
        prerequisiteResolveCache
      );
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

  private async resolveQuestIdFromPrerequisiteReference(
    referenceValue: string,
    definitionByCode: Map<string, QuestDefinitionRow>,
    prerequisiteResolveCache: Map<string, number | null>
  ): Promise<number | null> {
    const raw = String(referenceValue || '').trim();
    const cacheKey = raw.toLowerCase();
    if (cacheKey === '') return null;
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
    const fromRepository = await questRepository.getQuestByCode(raw);
    const resolved = fromRepository ? Number(fromRepository.id) : null;
    prerequisiteResolveCache.set(cacheKey, resolved);
    return resolved;
  }
}

export default new QuestService();
