import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { ENV } from '../../config/env';
import { GAME_CONSTANTS } from '../../shared/constants';
import userRepository from '../users/user.repository';
import type { User } from '../../shared/types';

export interface AuthTokenPayload {
  userId: number;
  username: string;
  email?: string;
}

export class AuthService {
  async register(username: string, password: string, email?: string): Promise<{ user: User; token: string }> {
    // Check if user exists
    const existingUser = await userRepository.getUserByUsername(username);
    if (existingUser) {
      throw new Error('Username already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, GAME_CONSTANTS.BCRYPT_ROUNDS);

    // Create user
    const userId = await userRepository.createUser(username, passwordHash, email);
    const user = await userRepository.getUserById(userId);
    
    if (!user) {
      throw new Error('Failed to create user');
    }

    // Generate token
    const token = this.generateToken({
      userId: user.id,
      username: user.username,
      email: user.email
    });

    return { user, token };
  }

  async login(username: string, password: string): Promise<{ user: User; token: string }> {
    // Get user
    const user = await userRepository.getUserByUsername(username);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    // Update last login
    await userRepository.updateLastLogin(user.id);

    // Generate token
    const token = this.generateToken({
      userId: user.id,
      username: user.username,
      email: user.email
    });

    return { user, token };
  }

  generateToken(payload: AuthTokenPayload): string {
    return jwt.sign(payload as any, ENV.JWT_SECRET, {
      expiresIn: ENV.JWT_EXPIRES_IN as string
    } as any);
  }

  verifyToken(token: string): AuthTokenPayload {
    try {
      return jwt.verify(token, ENV.JWT_SECRET) as AuthTokenPayload;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }
}

export default new AuthService();
