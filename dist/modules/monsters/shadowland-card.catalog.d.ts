import { CardType, Rarity, Race } from '../../shared/types';
export declare const SHADOWLAND_CARD_CATALOG: ({
    id: string;
    name: string;
    type: CardType;
    race: Race;
    cost: number;
    attack: number;
    defense: number;
    abilities: string[];
    text: string;
    rarity: Rarity;
    image_url: string;
} | {
    id: string;
    name: string;
    type: CardType;
    race: null;
    cost: number;
    text: string;
    rarity: Rarity;
    effects: Record<string, unknown>[];
    image_url: string;
} | {
    id: string;
    name: string;
    type: CardType;
    race: null;
    cost: number;
    attack: number;
    defense: number;
    text: string;
    rarity: Rarity;
    image_url: string;
} | {
    id: string;
    name: string;
    type: CardType;
    race: Race;
    cost: number;
    attack: number;
    defense: number;
    text: string;
    rarity: Rarity;
    image_url: string;
    effects: {
        type: string;
        amount: number;
        trigger: string;
        target: string;
    }[];
    abilities?: undefined;
} | {
    id: string;
    name: string;
    type: CardType;
    race: Race;
    cost: number;
    attack: number;
    defense: number;
    text: string;
    rarity: Rarity;
    image_url: string;
    abilities?: undefined;
    effects?: undefined;
})[];
export declare const SHADOWLAND_COLLECTION: {
    id: string;
    name: string;
    description: string;
};
//# sourceMappingURL=shadowland-card.catalog.d.ts.map