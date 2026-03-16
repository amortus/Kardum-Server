import cardRepository from '../cards/card.repository';
import experienceService from '../users/experience.service';
import userRepository from '../users/user.repository';
import questRepository from './quest.repository';
import type {
  ObjectiveProgressView,
  QuestDefinitionRow,
  QuestObjectiveRow,
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
    const [definitions, userQuests, trackedIds] = await Promise.all([
      questRepository.listQuestDefinitions(),
      questRepository.listUserQuests(userId),
      questRepository.listTrackedQuestIds(userId)
    ]);
    const trackedSet = new Set<number>(trackedIds.map((id) => Number(id)));
    const userQuestByQuestId = new Map<number, (typeof userQuests)[number]>();
    userQuests.forEach((uq) => userQuestByQuestId.set(Number(uq.quest_id), uq));

    const activeQuests: UserQuestSnapshotItem[] = [];
    const availableQuests: QuestSnapshot['availableQuests'] = [];
    const worldMarkers: QuestSnapshot['worldMarkers'] = [];

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
      const item: UserQuestSnapshotItem = {
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

    const existing = await questRepository.getUserQuestByUserAndQuest(userId, questId);
    if (!existing) {
      await questRepository.createUserQuest(userId, questId, 'accepted');
    } else if (existing.state === 'completed') {
      throw new Error('Quest already completed');
    } else if (existing.state === 'abandoned' || existing.state === 'failed' || existing.state === 'expired') {
      await questRepository.updateUserQuestState(existing.id, 'accepted');
    }

    if (definition.auto_track) {
      await questRepository.trackQuest(userId, questId);
    }
  }

  async abandonQuest(userId: number, questId: number): Promise<void> {
    const existing = await questRepository.getUserQuestByUserAndQuest(userId, questId);
    if (!existing) throw new Error('Quest not found in player log');
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
    const templateName = await questRepository.getMonsterTemplateNameById(templateId);
    await this.applyProgressEvent(userId, {
      type: 'WIN_DUEL_VS_MONSTER_TEMPLATE',
      targetRef: templateName || String(templateId),
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

      if (!changed) continue;

      const completion = this.computeQuestCompletion(objectives, progressByObjectiveId, definition.objective_logic);
      if (completion.allComplete) {
        await questRepository.updateUserQuestState(userQuest.id, 'ready_to_turn_in');
      } else {
        await questRepository.updateUserQuestState(userQuest.id, 'in_progress');
      }
    }
  }

  private objectiveMatchesEvent(objective: QuestObjectiveRow, event: ProgressEvent): boolean {
    const targetRef = String(objective.target_ref || '').trim().toLowerCase();
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

    const incomingRef = String(event.targetRef || '').trim().toLowerCase();
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
    return rewards.map((reward) => ({
      type: reward.reward_type,
      ref: reward.reward_ref,
      amount: reward.amount,
      metadata: this.parseRewardMetadata(reward.metadata_json)
    }));
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

  private async applyRewards(userId: number, questId: number): Promise<void> {
    const rewards = await questRepository.listQuestRewards(questId);
    for (const reward of rewards) {
      if (reward.reward_type === 'EXP') {
        const matchTypeRaw = String(this.parseRewardMetadata(reward.metadata_json).match_type || 'ai');
        const matchType = (matchTypeRaw === 'casual' || matchTypeRaw === 'ranked' || matchTypeRaw === 'ai') ? matchTypeRaw : 'ai';
        const amount = Math.max(1, Number(reward.amount || 1));
        for (let i = 0; i < amount; i += 1) {
          await experienceService.awardExp(userId, matchType, true);
        }
      } else if (reward.reward_type === 'CARD_UNLOCK') {
        const cardId = String(reward.reward_ref || '').trim();
        if (cardId) {
          await cardRepository.unlockCardForUser(userId, cardId, 'quest_reward');
        }
      }
    }
  }
}

export default new QuestService();
