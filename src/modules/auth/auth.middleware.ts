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

  try {
    const payload = authService.verifyToken(token);
    req.userId = payload.userId;
    req.user = payload;
    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid or expired token' });
  }
}

export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const payload = authService.verifyToken(token);
      req.userId = payload.userId;
      req.user = payload;
    } catch (error) {
      // Token inválido, mas é opcional então continua
    }
  }

  next();
}

export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  // Primeiro verificar autenticação
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  try {
    const payload = authService.verifyToken(token);
    req.userId = payload.userId;
    req.user = payload;

    // Verificar se o usuário é admin no banco de dados
    const user = await userRepository.getUserById(payload.userId);
    if (!user || !user.is_admin) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid or expired token' });
  }
}
