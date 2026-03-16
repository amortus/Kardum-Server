import type { MonsterRuntimeState, MonsterDifficulty, MonsterTemplate } from '../../shared/types';
type EncounterDropResult = {
    mode: 'none' | 'already_owned' | 'unlocked';
    cardId?: string;
    cardName?: string;
    imageUrl?: string;
};
export type EncounterFinishResult = {
    monster: MonsterRuntimeState | null;
    userId: number;
    templateId: number;
    result: 'win' | 'loss' | 'draw';
    drop: EncounterDropResult;
};
declare class MonsterService {
    private runtimeBySpawnUid;
    private encountersByMatchId;
    private initialized;
    private tickInterval;
    private readonly maleBodyVariants;
    private readonly maleHeadVariants;
    initialize(): Promise<void>;
    stop(): void;
    reloadRuntimeFromDatabase(): Promise<void>;
    getZoneSnapshot(zone: string): MonsterRuntimeState[];
    getZoneRuntime(zone: string): MonsterRuntimeState[];
    getMonster(spawnUid: string): MonsterRuntimeState | null;
    createTemplate(data: {
        user_id: number;
        name: string;
        difficulty: MonsterDifficulty;
        sprite_ref?: string | null;
        visual?: string | null;
        collection_id?: string | null;
        deck_mode?: 'auto' | 'manual' | 'hybrid';
        manual_deck_cards?: string[];
    }): Promise<number>;
    updateTemplate(templateId: number, data: Partial<MonsterTemplate> & {
        user_id?: number;
    }): Promise<void>;
    listTemplates(): Promise<MonsterTemplate[]>;
    listTemplateDrops(templateId: number): Promise<import("../../shared/types").MonsterTemplateDrop[]>;
    upsertTemplateDrop(templateId: number, cardId: string, dropChancePercent: number): Promise<void>;
    removeTemplateDrop(templateId: number, cardId: string): Promise<void>;
    createSpawn(data: {
        template_id: number;
        zone: string;
        spawn_x: number;
        spawn_y: number;
        respawn_seconds: number;
        move_radius: number;
    }): Promise<MonsterRuntimeState>;
    updateSpawn(spawnUid: string, data: Partial<{
        template_id: number;
        zone: string;
        spawn_x: number;
        spawn_y: number;
        respawn_seconds: number;
        move_radius: number;
        is_active: boolean;
    }>): Promise<MonsterRuntimeState | null>;
    removeSpawn(spawnUid: string): Promise<void>;
    spawnByTemplateName(name: string, zone: string, x: number, y: number): Promise<MonsterRuntimeState>;
    engageMonster(spawnUid: string, userId: number, matchId: number): Promise<MonsterRuntimeState>;
    finishEncounter(matchId: number, result: 'win' | 'loss' | 'draw'): Promise<EncounterFinishResult | null>;
    private computeRespawn;
    private tickMovement;
    private buildDeckCards;
    private createOrUpdateMonsterDeck;
    private normalizeVisualPath;
    private fixVisualFolderCasing;
    private resolveSpawnVisual;
    private isTextureVisual;
    private randomMaleAvatarVisual;
    private rollTemplateDrop;
    private unlockFallbackFromCollection;
}
declare const _default: MonsterService;
export default _default;
//# sourceMappingURL=monster.service.d.ts.map