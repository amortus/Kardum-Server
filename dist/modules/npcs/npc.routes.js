"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../auth/auth.middleware");
const npc_service_1 = __importDefault(require("./npc.service"));
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticateToken);
router.get('/zone/:zone', async (req, res) => {
    try {
        const zone = String(req.params.zone || 'shadowland').trim().toLowerCase();
        const npcs = await npc_service_1.default.listZoneSpawns(zone);
        res.json({ zone, npcs });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Failed to fetch NPCs' });
    }
});
router.post('/interact', async (req, res) => {
    try {
        const npcTemplateId = Number(req.body?.npcTemplateId || req.body?.npc_template_id || 0);
        if (!Number.isFinite(npcTemplateId) || npcTemplateId <= 0) {
            res.status(400).json({ error: 'npcTemplateId is required' });
            return;
        }
        await npc_service_1.default.interactWithNpc(req.userId, npcTemplateId);
        res.json({ success: true });
    }
    catch (error) {
        res.status(400).json({ error: error.message || 'Failed to interact with NPC' });
    }
});
exports.default = router;
//# sourceMappingURL=npc.routes.js.map