import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
export declare function setupSocketIO(server: HTTPServer): Promise<SocketIOServer>;
export declare function getUserSocketIds(userId: number): string[];
export declare function getOnlineUserIds(candidates: number[]): number[];
export declare function emitFriendUpdate(userId: number, payload: {
    type: string;
    data?: unknown;
}): void;
//# sourceMappingURL=socket.d.ts.map