import { Request, Response, NextFunction } from 'express';
export interface AuthRequest extends Request {
    userId?: number;
    user?: {
        userId: number;
        username: string;
        email?: string;
    };
}
export declare function authenticateToken(req: AuthRequest, res: Response, next: NextFunction): void;
export declare function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): void;
export declare function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=auth.middleware.d.ts.map