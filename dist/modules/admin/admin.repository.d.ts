import type { User, Deck } from '../../shared/types';
export interface UserWithDecks extends User {
    decks: Deck[];
}
export interface OverviewStats {
    total_users: number;
    total_matches: number;
    total_cards: number;
    active_players: number;
}
export declare class AdminRepository {
    getOverviewStats(): Promise<OverviewStats>;
    getAllUsersWithDecks(): Promise<UserWithDecks[]>;
    getUserDetails(userId: number): Promise<UserWithDecks | null>;
    getUserDecks(userId: number): Promise<Deck[]>;
}
declare const _default: AdminRepository;
export default _default;
//# sourceMappingURL=admin.repository.d.ts.map