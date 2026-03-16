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
        const friend = await user_repository_1.default.getUserByUsername(username);
        if (!friend) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        if (friend.id === req.userId) {
            res.status(400).json({ error: 'Cannot add yourself' });
            return;
        }
        const existing = await friends_repository_1.default.getRelationship(req.userId, friend.id);
        if (existing) {
            res.status(400).json({ error: 'Relationship already exists' });
            return;
        }
        await friends_repository_1.default.createRequest(req.userId, friend.id);
        (0, socket_1.emitFriendUpdate)(friend.id, {
            type: 'friend_request',
            data: { fromUserId: req.userId, fromUsername: req.user?.username || 'Unknown' }
        });
        res.json({ ok: true });
    }
    catch (error) {
        console.error('Friends request error:', error);
        res.status(500).json({ error: 'Failed to create friend request' });
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
        (0, socket_1.emitFriendUpdate)(friendId, {
            type: 'friend_request_accepted',
            data: { byUserId: req.userId, byUsername: req.user?.username || 'Unknown' }
        });
        (0, socket_1.emitFriendUpdate)(req.userId, {
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
        (0, socket_1.emitFriendUpdate)(friendId, {
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