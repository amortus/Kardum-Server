import type { User } from '../../shared/types';
export interface AuthTokenPayload {
    userId: number;
    username: string;
    email?: string;
}
export declare class AuthService {
    register(username: string, password: string, email?: string): Promise<{
        user: User;
        token: string;
    }>;
    login(username: string, password: string): Promise<{
        user: User;
        token: string;
    }>;
    generateToken(payload: AuthTokenPayload): string;
    verifyToken(token: string): AuthTokenPayload;
}
declare const _default: AuthService;
export default _default;
//# sourceMappingURL=auth.service.d.ts.map