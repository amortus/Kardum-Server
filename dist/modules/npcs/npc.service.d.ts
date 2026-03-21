declare class NpcService {
    listTemplates(): Promise<import("./npc.repository").NpcTemplate[]>;
    createTemplate(payload: {
        code: string;
        name: string;
        sprite_ref: string;
        frame_count?: number;
        frame_cols?: number;
        frame_rows?: number;
        idle_start?: number;
        idle_count?: number;
        dialogue_json?: string | null;
    }): Promise<number>;
    updateTemplate(templateId: number, payload: Partial<{
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
    }>): Promise<void>;
    listZoneSpawns(zone: string, userId?: number): Promise<{
        spawn_uid: string;
        npc_template_id: number;
        zone: string;
        x: number;
        y: number;
        interaction_radius: number;
        template: {
            id: number;
            code: string;
            name: string;
            sprite_ref: string | null;
            frame_count: number;
            frame_cols: number;
            frame_rows: number;
            idle_start: number;
            idle_count: number;
            dialogue: string[];
            quest_offers: {
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
            }[];
        };
    }[]>;
    createSpawn(payload: {
        npc_template_id: number;
        zone: string;
        spawn_x: number;
        spawn_y: number;
        interaction_radius?: number;
    }): Promise<string>;
    spawnByTemplateName(nameOrCode: string, zone: string, spawnX: number, spawnY: number): Promise<{
        spawn_uid: string;
        npc_template_id: number;
        zone: string;
        x: number;
        y: number;
        interaction_radius: number;
        template: {
            id: number;
            code: string;
            name: string;
            sprite_ref: string | null;
            frame_count: number;
            frame_cols: number;
            frame_rows: number;
            idle_start: number;
            idle_count: number;
            dialogue: string[];
            quest_offers: {
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
            }[];
        };
    }>;
    updateSpawn(spawnUid: string, payload: Partial<{
        npc_template_id: number;
        zone: string;
        spawn_x: number;
        spawn_y: number;
        interaction_radius: number;
        is_active: boolean;
    }>): Promise<void>;
    removeSpawn(spawnUid: string): Promise<void>;
    interactWithNpc(userId: number, npcTemplateId: number): Promise<void>;
    private parseDialogue;
    private buildQuestOffersForTemplate;
}
declare const _default: NpcService;
export default _default;
//# sourceMappingURL=npc.service.d.ts.map