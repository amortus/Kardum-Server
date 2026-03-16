export type FriendRow = {
    id: number;
    user_id: number;
    friend_id: number;
    status: 'pending' | 'accepted' | 'blocked';
    requested_at?: string;
    accepted_at?: string | null;
};
export type FriendListItem = {
    userId: number;
    username: string;
    status: 'pending' | 'accepted' | 'blocked';
    direction: 'outgoing' | 'incoming';
};
declare class FriendsRepository {
    createRequest(userId: number, friendId: number): Promise<void>;
    getRelationship(userId: number, friendId: number): Promise<FriendRow | null>;
    acceptRequest(requestId: number): Promise<void>;
    removeRelationship(userId: number, friendId: number): Promise<void>;
    listUserFriends(userId: number): Promise<FriendListItem[]>;
    getAcceptedFriendIds(userId: number): Promise<number[]>;
}
declare const _default: FriendsRepository;
export default _default;
//# sourceMappingURL=friends.repository.d.ts.map