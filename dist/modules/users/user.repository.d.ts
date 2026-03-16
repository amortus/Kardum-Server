import type { User } from '../../shared/types';
export declare class UserRepository {
    getUserById(id: number): Promise<User | null>;
    getUserByUsername(username: string): Promise<User | null>;
    createUser(username: string, passwordHash: string, email?: string): Promise<number>;
    updateUserElo(userId: number, type: 'casual' | 'ranked', newElo: number): Promise<void>;
    updateUserStats(userId: number, won: boolean): Promise<void>;
    updateUserLevelExp(userId: number, level: number, experience: number): Promise<void>;
    updateLastLogin(userId: number): Promise<void>;
    updateUserCharacter(userId: number, character: {
        gender: string;
        body_id: string;
        head_id: string;
        skin_body_id?: string | null;
        skin_head_id?: string | null;
        character_completed: number;
    }): Promise<void>;
    updateUserProfileAvatar(userId: number, profileAvatarId: string): Promise<void>;
    getAllUsers(): Promise<User[]>;
    getLeaderboard(limit?: number): Promise<User[]>;
    getRecentMatches(userId: number, limit?: number): Promise<any[]>;
}
declare const _default: UserRepository;
export default _default;
//# sourceMappingURL=user.repository.d.ts.map