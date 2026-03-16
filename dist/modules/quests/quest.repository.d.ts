import type { QuestDefinitionRow, QuestObjectiveProgressRow, QuestObjectiveRow, QuestRewardRow, UserQuestRow } from './quest.types';
type NpcSpawnRow = {
    id: number;
    spawn_uid: string;
    npc_template_id: number;
    zone: string;
    spawn_x: number;
    spawn_y: number;
    interaction_radius: number;
    is_active: number | boolean;
};
declare class QuestRepository {
    listQuestDefinitions(): Promise<QuestDefinitionRow[]>;
    getQuestDefinitionById(questId: number): Promise<QuestDefinitionRow | null>;
    getQuestByCode(code: string): Promise<QuestDefinitionRow | null>;
    createQuestDefinition(payload: {
        code: string;
        title: string;
        description: string;
        giver_npc_template_id?: number | null;
        turnin_npc_template_id?: number | null;
        min_level?: number;
        recurrence_type?: string;
        auto_track?: boolean;
        objective_logic?: 'all' | 'any';
        metadata_json?: string | null;
        is_active?: boolean;
    }): Promise<number>;
    updateQuestDefinition(questId: number, payload: Partial<{
        code: string;
        title: string;
        description: string;
        giver_npc_template_id: number | null;
        turnin_npc_template_id: number | null;
        min_level: number;
        recurrence_type: string;
        auto_track: boolean;
        objective_logic: 'all' | 'any';
        metadata_json: string | null;
        is_active: boolean;
    }>): Promise<void>;
    replaceQuestObjectives(questId: number, objectives: Array<{
        objective_type: string;
        target_ref: string;
        required_count: number;
        filters_json?: string | null;
        order_index?: number;
    }>): Promise<void>;
    replaceQuestRewards(questId: number, rewards: Array<{
        reward_type: string;
        reward_ref?: string | null;
        amount?: number;
        metadata_json?: string | null;
    }>): Promise<void>;
    listQuestObjectives(questId: number): Promise<QuestObjectiveRow[]>;
    listQuestRewards(questId: number): Promise<QuestRewardRow[]>;
    listUserQuests(userId: number): Promise<UserQuestRow[]>;
    getUserQuestByUserAndQuest(userId: number, questId: number): Promise<UserQuestRow | null>;
    createUserQuest(userId: number, questId: number, initialState?: string): Promise<number>;
    updateUserQuestState(userQuestId: number, state: string): Promise<void>;
    listObjectiveProgressByUserQuest(userQuestId: number): Promise<QuestObjectiveProgressRow[]>;
    upsertObjectiveProgress(userQuestId: number, objectiveId: number, currentCount: number, completed: boolean, lastEventKey: string): Promise<void>;
    listTrackedQuestIds(userId: number): Promise<number[]>;
    trackQuest(userId: number, questId: number): Promise<void>;
    untrackQuest(userId: number, questId: number): Promise<void>;
    clearTrackingForQuest(userId: number, questId: number): Promise<void>;
    markEventIfNew(userId: number, questId: number, eventKey: string, eventType: string): Promise<boolean>;
    listNpcSpawns(zone: string): Promise<NpcSpawnRow[]>;
    getMonsterTemplateNameById(templateId: number): Promise<string>;
}
declare const _default: QuestRepository;
export default _default;
//# sourceMappingURL=quest.repository.d.ts.map