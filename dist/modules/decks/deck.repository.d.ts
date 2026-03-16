import type { Deck } from '../../shared/types';
export declare class DeckRepository {
    getUserDecks(userId: number): Promise<Deck[]>;
    getDeckById(deckId: number): Promise<Deck | null>;
    createDeck(userId: number, deckData: {
        name: string;
        cards: string[];
    }): Promise<number>;
    updateDeck(deckId: number, userId: number, deckData: {
        name: string;
        cards: string[];
    }): Promise<void>;
    deleteDeck(deckId: number, userId: number): Promise<void>;
    deleteAllDecks(): Promise<number>;
    getUserDeckCount(userId: number): Promise<number>;
    private parseDeck;
}
declare const _default: DeckRepository;
export default _default;
//# sourceMappingURL=deck.repository.d.ts.map