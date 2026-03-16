import type { MonsterTemplate, MonsterSpawn, MonsterDifficulty, MonsterTemplateDrop } from '../../shared/types';
type MonsterSpawnRow = MonsterSpawn & {
    template_name: string;
    deck_id: number;
    difficulty: MonsterDifficulty;
    sprite_ref?: string | null;
    visual?: string | null;
    collection_id?: string | null;
    deck_mode?: 'auto' | 'manual' | 'hybrid';
    manual_deck_cards?: string[];
};
export declare class MonsterRepository {
    listTemplateDrops(templateId: number): Promise<MonsterTemplateDrop[]>;
    upsertTemplateDrop(templateId: number, cardId: string, dropChancePercent: number): Promise<void>;
    removeTemplateDrop(templateId: number, cardId: string): Promise<void>;
    getTemplates(): Promise<MonsterTemplate[]>;
    getTemplateById(templateId: number): Promise<MonsterTemplate | null>;
    getTemplateByName(name: string): Promise<MonsterTemplate | null>;
    createTemplate(data: {
        name: string;
        deck_id: number;
        difficulty: MonsterDifficulty;
        sprite_ref?: string | null;
        visual?: string | null;
        collection_id?: string | null;
        deck_mode?: 'auto' | 'manual' | 'hybrid';
        manual_deck_cards?: string[];
    }): Promise<number>;
    updateTemplate(templateId: number, data: Partial<{
        name: string;
        deck_id: number;
        difficulty: MonsterDifficulty;
        sprite_ref: string | null;
        visual: string | null;
        collection_id: string | null;
        deck_mode: 'auto' | 'manual' | 'hybrid';
        manual_deck_cards: string[];
        is_active: boolean;
    }>): Promise<void>;
    getSpawns(zone?: string): Promise<MonsterSpawnRow[]>;
    getSpawnByUid(spawnUid: string): Promise<MonsterSpawnRow | null>;
    createSpawn(data: {
        spawn_uid: string;
        template_id: number;
        zone: string;
        spawn_x: number;
        spawn_y: number;
        respawn_seconds: number;
        move_radius: number;
    }): Promise<number>;
    updateSpawn(spawnUid: string, data: Partial<{
        template_id: number;
        zone: string;
        spawn_x: number;
        spawn_y: number;
        respawn_seconds: number;
        move_radius: number;
        is_active: boolean;
    }>): Promise<void>;
    removeSpawn(spawnUid: string): Promise<void>;
    logEncounterStart(data: {
        spawn_uid: string;
        template_id: number;
        user_id: number;
        match_id: number;
    }): Promise<number>;
    logEncounterEnd(encounterId: number, result: 'win' | 'loss' | 'draw'): Promise<void>;
    private parseTemplate;
    private parseSpawnRow;
}
declare const _default: MonsterRepository;
export default _default;
//# sourceMappingURL=monster.repository.d.ts.map