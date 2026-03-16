import type { UserQuestSnapshotItem } from './quest.types';
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
declare class QuestService {
    getSnapshot(userId: number, zoneHint?: string): Promise<QuestSnapshot>;
    acceptQuest(userId: number, questId: number): Promise<void>;
    abandonQuest(userId: number, questId: number): Promise<void>;
    trackQuest(userId: number, questId: number, tracked: boolean): Promise<void>;
    turnInQuest(userId: number, questId: number): Promise<void>;
    onNpcTalk(userId: number, npcTemplateId: number): Promise<void>;
    onMonsterEncounterResult(userId: number, templateId: number, result: 'win' | 'loss' | 'draw'): Promise<void>;
    onPvpMatchResult(userId: number, won: boolean, matchId: number): Promise<void>;
    onPlayerPosition(userId: number, zone: string, x: number, y: number): Promise<void>;
    private applyProgressEvent;
    private objectiveMatchesEvent;
    private computeQuestCompletion;
    private buildObjectiveProgress;
    private parseMarkerFromObjective;
    private parseFilters;
    private buildRewards;
    private parseRewardMetadata;
    private applyRewards;
}
declare const _default: QuestService;
export default _default;
//# sourceMappingURL=quest.service.d.ts.map