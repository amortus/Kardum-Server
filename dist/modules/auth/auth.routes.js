"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_service_1 = __importDefault(require("./auth.service"));
const user_repository_1 = __importDefault(require("../users/user.repository"));
const deck_repository_1 = __importDefault(require("../decks/deck.repository"));
const auth_middleware_1 = require("./auth.middleware");
const router = (0, express_1.Router)();
// Register
router.post('/register', async (req, res) => {
    try {
        const { username, password, email } = req.body;
        if (!username || !password) {
            res.status(400).json({ error: 'Username and password required' });
            return;
        }
        if (username.length < 3 || username.length > 20) {
            res.status(400).json({ error: 'Username must be between 3 and 20 characters' });
            return;
        }
        if (password.length < 6) {
            res.status(400).json({ error: 'Password must be at least 6 characters' });
            return;
        }
        const result = await auth_service_1.default.register(username, password, email);
        // Remove password hash from response
        const { password_hash, ...userWithoutPassword } = result.user;
        const deckCount = await deck_repository_1.default.getUserDeckCount(result.user.id);
        res.status(201).json({
            user: userWithoutPassword,
            token: result.token,
            onboarding: {
                requires_character_setup: Number(result.user.character_completed || 0) !== 1,
                requires_profile_avatar_setup: Number(result.user.character_completed || 0) === 1 && !result.user.profile_avatar_id,
                requires_deck_setup: deckCount === 0
            }
        });
    }
    catch (error) {
        console.error('Register error:', error);
        res.status(400).json({ error: error.message || 'Registration failed' });
    }
});
// Login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            res.status(400).json({ error: 'Username and password required' });
            return;
        }
        const result = await auth_service_1.default.login(username, password);
        // Remove password hash from response
        const { password_hash, ...userWithoutPassword } = result.user;
        const deckCount = await deck_repository_1.default.getUserDeckCount(result.user.id);
        res.json({
            user: userWithoutPassword,
            token: result.token,
            onboarding: {
                requires_character_setup: Number(result.user.character_completed || 0) !== 1,
                requires_profile_avatar_setup: Number(result.user.character_completed || 0) === 1 && !result.user.profile_avatar_id,
                requires_deck_setup: deckCount === 0
            }
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(401).json({ error: error.message || 'Login failed' });
    }
});
// Get current user
router.get('/me', auth_middleware_1.authenticateToken, async (req, res) => {
    try {
        const user = await user_repository_1.default.getUserById(req.userId);
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        // Remove password hash from response
        const { password_hash, ...userWithoutPassword } = user;
        const deckCount = await deck_repository_1.default.getUserDeckCount(user.id);
        res.json({
            user: userWithoutPassword,
            onboarding: {
                requires_character_setup: Number(user.character_completed || 0) !== 1,
                requires_profile_avatar_setup: Number(user.character_completed || 0) === 1 && !user.profile_avatar_id,
                requires_deck_setup: deckCount === 0
            }
        });
    }
    catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user' });
    }
});
exports.default = router;
//# sourceMappingURL=auth.routes.js.map