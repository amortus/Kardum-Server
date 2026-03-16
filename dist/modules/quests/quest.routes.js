"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../auth/auth.middleware");
const quest_service_1 = __importDefault(require("./quest.service"));
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticateToken);
router.get('/snapshot', async (req, res) => {
    try {
        const zone = String(req.query.zone || 'shadowland');
        const snapshot = await quest_service_1.default.getSnapshot(req.userId, zone);
        res.json(snapshot);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to load quest snapshot' });
    }
});
router.post('/:questId/accept', async (req, res) => {
    try {
        const questId = Number(req.params.questId);
        if (!Number.isFinite(questId) || questId <= 0) {
            res.status(400).json({ error: 'Invalid questId' });
            return;
        }
        await quest_service_1.default.acceptQuest(req.userId, questId);
        res.json({ success: true });
    }
    catch (error) {
        res.status(400).json({ error: error.message || 'Failed to accept quest' });
    }
});
router.post('/:questId/abandon', async (req, res) => {
    try {
        const questId = Number(req.params.questId);
        if (!Number.isFinite(questId) || questId <= 0) {
            res.status(400).json({ error: 'Invalid questId' });
            return;
        }
        await quest_service_1.default.abandonQuest(req.userId, questId);
        res.json({ success: true });
    }
    catch (error) {
        res.status(400).json({ error: error.message || 'Failed to abandon quest' });
    }
});
router.post('/:questId/track', async (req, res) => {
    try {
        const questId = Number(req.params.questId);
        const tracked = req.body?.tracked !== false;
        if (!Number.isFinite(questId) || questId <= 0) {
            res.status(400).json({ error: 'Invalid questId' });
            return;
        }
        await quest_service_1.default.trackQuest(req.userId, questId, tracked);
        res.json({ success: true, tracked });
    }
    catch (error) {
        res.status(400).json({ error: error.message || 'Failed to update tracking' });
    }
});
router.post('/:questId/turnin', async (req, res) => {
    try {
        const questId = Number(req.params.questId);
        if (!Number.isFinite(questId) || questId <= 0) {
            res.status(400).json({ error: 'Invalid questId' });
            return;
        }
        await quest_service_1.default.turnInQuest(req.userId, questId);
        res.json({ success: true });
    }
    catch (error) {
        res.status(400).json({ error: error.message || 'Failed to turn in quest' });
    }
});
exports.default = router;
//# sourceMappingURL=quest.routes.js.map