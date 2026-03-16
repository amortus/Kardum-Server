"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../auth/auth.middleware");
const user_repository_1 = __importDefault(require("./user.repository"));
const rank_service_1 = __importDefault(require("./rank.service"));
const router = (0, express_1.Router)();
const ALLOWED_GENDERS = new Set(['male', 'female']);
const ALLOWED_BODY_IDS = new Set(['clothes', 'leather_armor', 'steel_armor']);
const ALLOWED_HEAD_IDS_BY_GENDER = {
    male: new Set(['male_head1', 'male_head2', 'male_head3']),
    female: new Set(['head_long', 'female_head1'])
};
const VISUAL_ID_REGEX = /^[a-z0-9_:-]{1,64}$/i;
const ALLOWED_PROFILE_AVATAR_IDS = new Set([
    'griven_belafonte',
    'ivin_melfor',
    'thorin_martelo_de_pedra',
    'lysandra_luz_celestial',
    'gurak_shieldheart'
]);
// GET /api/users/leaderboard — top ranked players (must be before /:id routes)
router.get('/leaderboard', async (_req, res) => {
    try {
        const users = await user_repository_1.default.getLeaderboard(50);
        const leaderboard = users.map((u, index) => ({
            rank_position: index + 1,
            ...rank_service_1.default.buildProfile(u)
        }));
        res.json({ leaderboard });
    }
    catch (error) {
        console.error('Leaderboard error:', error);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});
// GET /api/users/me/profile — own full profile
router.get('/me/profile', auth_middleware_1.authenticateToken, async (req, res) => {
    try {
        const user = await user_repository_1.default.getUserById(req.userId);
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        res.json({ profile: rank_service_1.default.buildProfile(user) });
    }
    catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});
// GET /api/users/me/match-history — own recent matches
router.get('/me/match-history', auth_middleware_1.authenticateToken, async (req, res) => {
    try {
        const matches = await user_repository_1.default.getRecentMatches(req.userId, 20);
        res.json({ matches });
    }
    catch (error) {
        console.error('Match history error:', error);
        res.status(500).json({ error: 'Failed to fetch match history' });
    }
});
// PATCH /api/users/me/character — save character customization
router.patch('/me/character', auth_middleware_1.authenticateToken, async (req, res) => {
    try {
        const gender = String(req.body.gender || '').toLowerCase();
        const bodyId = String(req.body.body_id || '');
        const headId = String(req.body.head_id || '');
        const rawSkinBodyId = req.body.skin_body_id;
        const rawSkinHeadId = req.body.skin_head_id;
        const skinBodyId = rawSkinBodyId == null ? null : String(rawSkinBodyId).trim();
        const skinHeadId = rawSkinHeadId == null ? null : String(rawSkinHeadId).trim();
        if (!ALLOWED_GENDERS.has(gender)) {
            res.status(400).json({ error: 'Invalid gender for current phase' });
            return;
        }
        if (!ALLOWED_BODY_IDS.has(bodyId)) {
            res.status(400).json({ error: 'Invalid body_id' });
            return;
        }
        const allowedHeads = ALLOWED_HEAD_IDS_BY_GENDER[gender] || new Set();
        if (!allowedHeads.has(headId)) {
            res.status(400).json({ error: 'Invalid head_id' });
            return;
        }
        if (skinBodyId !== null && skinBodyId !== '' && !VISUAL_ID_REGEX.test(skinBodyId)) {
            res.status(400).json({ error: 'Invalid skin_body_id' });
            return;
        }
        if (skinHeadId !== null && skinHeadId !== '' && !VISUAL_ID_REGEX.test(skinHeadId)) {
            res.status(400).json({ error: 'Invalid skin_head_id' });
            return;
        }
        await user_repository_1.default.updateUserCharacter(req.userId, {
            gender,
            body_id: bodyId,
            head_id: headId,
            skin_body_id: skinBodyId && skinBodyId !== '' ? skinBodyId : null,
            skin_head_id: skinHeadId && skinHeadId !== '' ? skinHeadId : null,
            character_completed: 1
        });
        const updated = await user_repository_1.default.getUserById(req.userId);
        if (!updated) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        res.json({ profile: rank_service_1.default.buildProfile(updated) });
    }
    catch (error) {
        console.error('Save character error:', error);
        res.status(500).json({ error: 'Failed to save character' });
    }
});
// PATCH /api/users/me/profile-avatar — save profile avatar (general portrait)
router.patch('/me/profile-avatar', auth_middleware_1.authenticateToken, async (req, res) => {
    try {
        const profileAvatarId = String(req.body.profile_avatar_id || '').trim().toLowerCase();
        if (!ALLOWED_PROFILE_AVATAR_IDS.has(profileAvatarId)) {
            res.status(400).json({ error: 'Invalid profile_avatar_id' });
            return;
        }
        await user_repository_1.default.updateUserProfileAvatar(req.userId, profileAvatarId);
        const updated = await user_repository_1.default.getUserById(req.userId);
        if (!updated) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        res.json({ profile: rank_service_1.default.buildProfile(updated) });
    }
    catch (error) {
        console.error('Save profile avatar error:', error);
        res.status(500).json({ error: 'Failed to save profile avatar' });
    }
});
// GET /api/users/:id/profile — public profile by user ID
router.get('/:id/profile', auth_middleware_1.optionalAuth, async (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);
        if (isNaN(userId)) {
            res.status(400).json({ error: 'Invalid user ID' });
            return;
        }
        const user = await user_repository_1.default.getUserById(userId);
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        res.json({ profile: rank_service_1.default.buildProfile(user) });
    }
    catch (error) {
        console.error('Public profile error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});
exports.default = router;
//# sourceMappingURL=user.routes.js.map