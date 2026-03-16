"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../../config/env");
const constants_1 = require("../../shared/constants");
const user_repository_1 = __importDefault(require("../users/user.repository"));
class AuthService {
    async register(username, password, email) {
        // Check if user exists
        const existingUser = await user_repository_1.default.getUserByUsername(username);
        if (existingUser) {
            throw new Error('Username already exists');
        }
        // Hash password
        const passwordHash = await bcrypt_1.default.hash(password, constants_1.GAME_CONSTANTS.BCRYPT_ROUNDS);
        // Create user
        const userId = await user_repository_1.default.createUser(username, passwordHash, email);
        const user = await user_repository_1.default.getUserById(userId);
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
    async login(username, password) {
        // Get user
        const user = await user_repository_1.default.getUserByUsername(username);
        if (!user) {
            throw new Error('Invalid credentials');
        }
        // Verify password
        const isValid = await bcrypt_1.default.compare(password, user.password_hash);
        if (!isValid) {
            throw new Error('Invalid credentials');
        }
        // Update last login
        await user_repository_1.default.updateLastLogin(user.id);
        // Generate token
        const token = this.generateToken({
            userId: user.id,
            username: user.username,
            email: user.email
        });
        return { user, token };
    }
    generateToken(payload) {
        return jsonwebtoken_1.default.sign(payload, env_1.ENV.JWT_SECRET, {
            expiresIn: env_1.ENV.JWT_EXPIRES_IN
        });
    }
    verifyToken(token) {
        try {
            return jsonwebtoken_1.default.verify(token, env_1.ENV.JWT_SECRET);
        }
        catch (error) {
            throw new Error('Invalid token');
        }
    }
}
exports.AuthService = AuthService;
exports.default = new AuthService();
//# sourceMappingURL=auth.service.js.map