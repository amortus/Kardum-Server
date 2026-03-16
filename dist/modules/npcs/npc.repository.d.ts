export type NpcTemplate = {
    id: number;
    code: string;
    name: string;
    sprite_ref: string | null;
    frame_count: number;
    frame_cols: number;
    frame_rows: number;
    idle_start: number;
    idle_count: number;
    dialogue_json: string | null;
    is_active: boolean;
};
export type NpcSpawn = {
    id: number;
    spawn_uid: string;
    npc_template_id: number;
    zone: string;
    spawn_x: number;
    spawn_y: number;
    interaction_radius: number;
    is_active: boolean;
};
declare class NpcRepository {
    listTemplates(): Promise<NpcTemplate[]>;
    getTemplateByCode(code: string): Promise<NpcTemplate | null>;
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
    listSpawns(zone: string): Promise<NpcSpawn[]>;
    createSpawn(payload: {
        npc_template_id: number;
        zone: string;
        spawn_x: number;
        spawn_y: number;
        interaction_radius?: number;
    }): Promise<string>;
    updateSpawn(spawnUid: string, payload: Partial<{
        npc_template_id: number;
        zone: string;
        spawn_x: number;
        spawn_y: number;
        interaction_radius: number;
        is_active: boolean;
    }>): Promise<void>;
    removeSpawn(spawnUid: string): Promise<void>;
}
declare const _default: NpcRepository;
export default _default;
//# sourceMappingURL=npc.repository.d.ts.map