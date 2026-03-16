import type { Card } from '../../shared/types';
export declare class CardRepository {
    private getDefaultGlobalVfxLayout;
    private parseGlobalVfxLayout;
    getAllCards(filters?: {
        type?: string;
        race?: string;
        collection_id?: string;
        default_unlocked?: 'true' | 'false';
        search?: string;
        user_id?: number;
    }): Promise<Card[]>;
    getCardById(id: string): Promise<Card | null>;
    getUnlockedCardIdsForUser(userId: number): Promise<string[]>;
    unlockCardForUser(userId: number, cardId: string, source?: string): Promise<boolean>;
    getLockedCardsByCollectionForUser(collectionId: string, userId: number): Promise<Card[]>;
    areCardsAvailableForUser(userId: number, cardIds: string[]): Promise<boolean>;
    getCardsByType(type: string): Promise<Card[]>;
    getCardsByRace(race: string): Promise<Card[]>;
    createCard(card: Omit<Card, 'created_at' | 'updated_at'>): Promise<void>;
    updateCard(id: string, card: Partial<Card>): Promise<void>;
    private serializeEffects;
    deleteCard(id: string): Promise<void>;
    getCardLayout(cardId: string): Promise<any | null>;
    getAllCardArtworkLayouts(): Promise<Array<{
        cardId: string;
        artwork: {
            offsetLeft: number | null;
            offsetTop: number | null;
            offsetRight: number | null;
            offsetBottom: number | null;
            expandMode: number | null;
            stretchMode: number | null;
        };
    }>>;
    getGlobalVfxLayout(): Promise<any>;
    saveGlobalVfxLayout(layout: any): Promise<void>;
    saveCardLayout(cardId: string, layout: any): Promise<void>;
    syncAllCards(): Promise<{
        synced: number;
        errors: string[];
    }>;
    getCardsByDeck(deckId: number): Promise<Card[]>;
    private parseCard;
}
declare const _default: CardRepository;
export default _default;
//# sourceMappingURL=card.repository.d.ts.map