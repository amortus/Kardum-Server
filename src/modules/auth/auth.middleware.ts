import { Request, Response, NextFunction } from 'express';
import authService from './auth.service';
import userRepository from '../users/user.repository';

export interface AuthRequest extends Request {
  userId?: number;
  user?: {
    userId: number;
    username: string;
    email?: string;
  };
}

export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  authService.validateSession(token)
    .then((payload) => {
      req.userId = payload.userId;
      req.user = payload;
      next();
    })
    .catch(() => {
      res.status(403).json({ error: 'Invalid or expired token' });
    });
}

export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    authService.validateSession(token)
      .then((payload) => {
        req.userId = payload.userId;
        req.user = payload;
      })
      .catch(() => {})
      .finally(() => next());
  } else {
    next();
  }
}

export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  try {
    const payload = await authService.validateSession(token);
    req.userId = payload.userId;
    req.user = payload;

    const user = await userRepository.getUserById(payload.userId);
    if (!user || !user.is_admin) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    next();
  } catch {
    res.status(403).json({ error: 'Invalid or expired token' });
  }
}
