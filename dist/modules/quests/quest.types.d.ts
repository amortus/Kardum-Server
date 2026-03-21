export type QuestState = 'available' | 'accepted' | 'in_progress' | 'ready_to_turn_in' | 'completed' | 'abandoned' | 'failed' | 'expired';
export type QuestObjectiveType = 'COLLECT_ITEM' | 'WIN_DUEL_VS_MONSTER_TEMPLATE' | 'TALK_TO_NPC' | 'VISIT_LOCATION' | 'WIN_PVP_MATCH' | 'REACH_LEVEL' | 'CUSTOM_FLAG';
export type QuestRewardType = 'EXP' | 'GOLD' | 'CARD_UNLOCK' | 'ITEM' | 'CUSTOM_FLAG';
export type QuestPrerequisiteType = 'QUEST_COMPLETED' | 'CUSTOM_FLAG' | 'REACH_LEVEL';
export interface QuestDefinitionRow {
    id: number;
    code: string;
    title: string;
    description: string;
    giver_npc_template_id: number | null;
    turnin_npc_template_id: number | null;
    min_level: number;
    recurrence_type: string;
    auto_track: boolean;
    is_active: boolean;
    objective_logic: 'all' | 'any';
    metadata_json: string | null;
}
export interface QuestObjectiveRow {
    id: number;
    quest_id: number;
    objective_type: QuestObjectiveType;
    target_ref: string;
    required_count: number;
    filters_json: string | null;
    order_index: number;
}
export interface QuestRewardRow {
    id: number;
    quest_id: number;
    reward_type: QuestRewardType;
    reward_ref: string | null;
    amount: number;
    metadata_json: string | null;
}
export interface QuestPrerequisiteRow {
    id: number;
    quest_id: number;
    prerequisite_type: QuestPrerequisiteType;
    reference_value: string;
    operator: string;
    required_count: number;
}
export interface UserQuestRow {
    id: number;
    user_id: number;
    quest_id: number;
    state: QuestState;
    accepted_at: string | null;
    completed_at: string | null;
    abandoned_at: string | null;
    expires_at: string | null;
    last_updated_at: string | null;
}
export interface QuestObjectiveProgressRow {
    id: number;
    user_quest_id: number;
    objective_id: number;
    current_count: number;
    completed_at: string | null;
    last_event_key: string | null;
}
export interface ObjectiveProgressView {
    objectiveId: number;
    objectiveType: QuestObjectiveType;
    targetRef: string;
    requiredCount: number;
    currentCount: number;
    isComplete: boolean;
    orderIndex: number;
    marker: {
        kind: 'npc' | 'location' | 'monster' | 'custom';
        zone?: string;
        x?: number;
        y?: number;
        ref?: string;
        label?: string;
    } | null;
}
export interface UserQuestSnapshotItem {
    userQuestId: number;
    questId: number;
    code: string;
    title: string;
    description: string;
    giverNpcTemplateId: number | null;
    turnInNpcTemplateId: number | null;
    state: QuestState;
    tracked: boolean;
    objectives: ObjectiveProgressView[];
    rewards: Array<{
        type: QuestRewardType;
        ref: string | null;
        amount: number;
        metadata: Record<string, unknown>;
        name?: string;
        thumb?: string;
    }>;
}
//# sourceMappingURL=quest.types.d.ts.map