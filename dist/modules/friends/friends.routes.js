"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../auth/auth.middleware");
const friends_repository_1 = __importDefault(require("./friends.repository"));
const user_repository_1 = __importDefault(require("../users/user.repository"));
const socket_1 = require("../../config/socket");
const router = (0, express_1.Router)();
function safeEmitFriendUpdate(userId, payload) {
    try {
        (0, socket_1.emitFriendUpdate)(userId, payload);
    }
    catch (error) {
        console.warn('Friend update emit failed:', error);
    }
}
router.get('/', auth_middleware_1.authenticateToken, async (req, res) => {
    try {
        const items = await friends_repository_1.default.listUserFriends(req.userId);
        res.json({ friends: items });
    }
    catch (error) {
        console.error('Friends list error:', error);
        res.status(500).json({ error: 'Failed to load friends' });
    }
});
router.get('/online', auth_middleware_1.authenticateToken, async (req, res) => {
    try {
        const friendIds = await friends_repository_1.default.getAcceptedFriendIds(req.userId);
        const onlineIds = (0, socket_1.getOnlineUserIds)(friendIds);
        res.json({ online_user_ids: onlineIds });
    }
    catch (error) {
        console.error('Friends online error:', error);
        res.status(500).json({ error: 'Failed to load online friends' });
    }
});
router.post('/request', auth_middleware_1.authenticateToken, async (req, res) => {
    try {
        const username = String(req.body.username || '').trim();
        if (!username) {
            res.status(400).json({ error: 'username is required' });
            return;
        }
        const selfId = Number(req.userId);
        if (!Number.isFinite(selfId) || selfId <= 0) {
            res.status(401).json({ error: 'Invalid session' });
            return;
        }
        const me = await user_repository_1.default.getUserById(selfId);
        if (!me) {
            res.status(401).json({ error: 'User no longer exists; please log in again' });
            return;
        }
        const friend = await user_repository_1.default.getUserByUsername(username);
        if (!friend) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        const friendId = Number(friend.id);
        if (!Number.isFinite(friendId) || friendId <= 0) {
            res.status(400).json({ error: 'Invalid target user' });
            return;
        }
        if (friendId === selfId) {
            res.status(400).json({ error: 'Cannot add yourself' });
            return;
        }
        const existing = await friends_repository_1.default.getRelationship(selfId, friendId);
        if (existing) {
            res.status(400).json({ error: 'Relationship already exists' });
            return;
        }
        await friends_repository_1.default.createRequest(selfId, friendId);
        safeEmitFriendUpdate(friendId, {
            type: 'friend_request',
            data: { fromUserId: selfId, fromUsername: req.user?.username || 'Unknown' }
        });
        res.json({ ok: true });
    }
    catch (error) {
        console.error('Friends request error:', error);
        const message = String(error?.message || '');
        const code = String(error?.code || '');
        if (code === '23505' ||
            message.includes('UNIQUE constraint failed') ||
            message.includes('duplicate key value violates unique constraint')) {
            res.status(400).json({ error: 'Relationship already exists' });
            return;
        }
        if (code === '23503' ||
            code === 'SQLITE_CONSTRAINT_FOREIGNKEY' ||
            message.includes('FOREIGN KEY constraint failed') ||
            message.includes('violates foreign key constraint')) {
            res.status(400).json({
                error: 'Não foi possível criar o pedido (conta inválida ou sessão desatualizada). Faça login de novo.'
            });
            return;
        }
        res.status(500).json({
            error: 'Failed to create friend request',
            detail: message || code || 'unknown_error'
        });
    }
});
router.post('/accept', auth_middleware_1.authenticateToken, async (req, res) => {
    try {
        const friendId = Number(req.body.friend_id);
        if (!Number.isFinite(friendId) || friendId <= 0) {
            res.status(400).json({ error: 'friend_id is required' });
            return;
        }
        const relation = await friends_repository_1.default.getRelationship(req.userId, friendId);
        if (!relation || relation.status !== 'pending' || relation.friend_id !== req.userId) {
            res.status(404).json({ error: 'Pending request not found' });
            return;
        }
        await friends_repository_1.default.acceptRequest(relation.id);
        safeEmitFriendUpdate(friendId, {
            type: 'friend_request_accepted',
            data: { byUserId: req.userId, byUsername: req.user?.username || 'Unknown' }
        });
        safeEmitFriendUpdate(req.userId, {
            type: 'friend_request_accepted',
            data: { byUserId: req.userId, byUsername: req.user?.username || 'Unknown' }
        });
        res.json({ ok: true });
    }
    catch (error) {
        console.error('Friends accept error:', error);
        res.status(500).json({ error: 'Failed to accept friend request' });
    }
});
router.delete('/:friendId', auth_middleware_1.authenticateToken, async (req, res) => {
    try {
        const friendId = Number(req.params.friendId);
        if (!Number.isFinite(friendId) || friendId <= 0) {
            res.status(400).json({ error: 'Invalid friend id' });
            return;
        }
        await friends_repository_1.default.removeRelationship(req.userId, friendId);
        safeEmitFriendUpdate(friendId, {
            type: 'friend_removed',
            data: { byUserId: req.userId, byUsername: req.user?.username || 'Unknown' }
        });
        res.json({ ok: true });
    }
    catch (error) {
        console.error('Friends delete error:', error);
        res.status(500).json({ error: 'Failed to remove friend' });
    }
});
exports.default = router;
//# sourceMappingURL=friends.routes.js.map