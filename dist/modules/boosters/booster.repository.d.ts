export interface Booster {
    id: string;
    name: string;
    description?: string;
    card_collection: string[];
    rarity_weights: {
        common: number;
        rare: number;
        epic: number;
        legendary: number;
    };
    cards_per_pack: number;
    price: number;
    is_active: boolean;
    created_at?: Date;
    updated_at?: Date;
}
export declare class BoosterRepository {
    createBooster(booster: Omit<Booster, 'created_at' | 'updated_at'>): Promise<void>;
    getAllBoosters(): Promise<Booster[]>;
    getBoosterById(id: string): Promise<Booster | null>;
    updateBooster(id: string, booster: Partial<Booster>): Promise<void>;
    deleteBooster(id: string): Promise<void>;
    private parseBooster;
}
declare const _default: BoosterRepository;
export default _default;
//# sourceMappingURL=booster.repository.d.ts.map