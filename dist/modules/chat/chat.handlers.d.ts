import type { Server as SocketIOServer, Socket } from 'socket.io';
interface AuthedSocket extends Socket {
    userId?: number;
    user?: {
        id: number;
        username: string;
        email?: string;
        isAdmin?: boolean;
    };
}
export declare function registerChatHandlers(io: SocketIOServer, socket: AuthedSocket, deps: {
    getUserSocketIds: (userId: number) => string[];
}): void;
export {};
//# sourceMappingURL=chat.handlers.d.ts.map