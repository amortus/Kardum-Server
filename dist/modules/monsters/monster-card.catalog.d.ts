import { CardType, Rarity, Race } from '../../shared/types';
export declare const MONSTER_CARD_CATALOG: ({
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
    effects: {
        type: string;
        amount: number;
        target: string;
        trigger: string;
        duration: number;
    }[];
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
    race: null;
    cost: number;
    text: string;
    rarity: Rarity;
    effects: {
        type: string;
        ability: string;
        target: string;
        trigger: string;
        duration: number;
    }[];
    image_url: string;
})[];
//# sourceMappingURL=monster-card.catalog.d.ts.map