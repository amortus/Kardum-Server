import type { QuestDefinitionRow, QuestPrerequisiteRow, QuestObjectiveProgressRow, QuestObjectiveRow, QuestRewardRow, UserQuestRow } from './quest.types';
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
    listQuestDefinitionsForAdmin(options?: {
        page?: number;
        limit?: number;
        search?: string;
        giverNpcTemplateId?: number | null;
        includeInactive?: boolean;
    }): Promise<{
        items: QuestDefinitionRow[];
        total: number;
        page: number;
        limit: number;
    }>;
    listQuestDefinitionsByNpcTemplate(npcTemplateId: number): Promise<QuestDefinitionRow[]>;
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
    listQuestPrerequisites(questId: number): Promise<QuestPrerequisiteRow[]>;
    listQuestPrerequisitesByQuestIds(questIds: number[]): Promise<QuestPrerequisiteRow[]>;
    replaceQuestPrerequisites(questId: number, prerequisites: Array<{
        prerequisite_type: string;
        reference_value: string;
        operator?: string;
        required_count?: number;
    }>): Promise<void>;
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
    /** Remove progresso de objetivos e histórico de eventos (abandonar / reaceitar). */
    clearUserQuestProgressAndLedger(userQuestId: number, userId: number, questId: number): Promise<void>;
    /** Volta a `accepted` limpando datas de abandono/conclusão (reabrir quest). */
    resetUserQuestRowToFreshAccepted(userQuestId: number): Promise<void>;
    markEventIfNew(userId: number, questId: number, eventKey: string, eventType: string): Promise<boolean>;
    listNpcSpawns(zone: string): Promise<NpcSpawnRow[]>;
    getMonsterTemplateNameById(templateId: number): Promise<string>;
    getMonsterTemplateIdentityById(templateId: number): Promise<{
        id: number;
        code: string;
        name: string;
    } | null>;
}
declare const _default: QuestRepository;
export default _default;
//# sourceMappingURL=quest.repository.d.ts.map