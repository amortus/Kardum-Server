"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const card_repository_1 = __importDefault(require("./card.repository"));
const auth_middleware_1 = require("../auth/auth.middleware");
const user_repository_1 = __importDefault(require("../users/user.repository"));
const router = (0, express_1.Router)();
// Get all cards (public or authenticated)
router.get('/', auth_middleware_1.optionalAuth, async (req, res) => {
    try {
        let canIncludeLocked = false;
        if (req.userId) {
            const user = await user_repository_1.default.getUserById(req.userId);
            // Admin sempre enxerga todas as cartas ativas, mesmo sem include_locked=true.
            canIncludeLocked = Boolean(user?.is_admin);
        }
        const cards = await card_repository_1.default.getAllCards({
            type: req.query.type,
            race: req.query.race,
            collection_id: req.query.collection_id,
            default_unlocked: req.query.default_unlocked,
            search: req.query.search,
            user_id: canIncludeLocked ? undefined : req.userId
        });
        res.json({ cards });
    }
    catch (error) {
        console.error('Get cards error:', error);
        res.status(500).json({ error: 'Failed to get cards' });
    }
});
// Get card layouts used by runtime renderers
router.get('/layouts', auth_middleware_1.optionalAuth, async (_req, res) => {
    try {
        const [globalVfxLayout, artworkLayouts] = await Promise.all([
            card_repository_1.default.getGlobalVfxLayout(),
            card_repository_1.default.getAllCardArtworkLayouts()
        ]);
        res.json({ globalVfxLayout, artworkLayouts });
    }
    catch (error) {
        console.error('Get card layouts error:', error);
        res.status(500).json({ error: 'Failed to get card layouts' });
    }
});
// Get card by ID
router.get('/:id', auth_middleware_1.optionalAuth, async (req, res) => {
    try {
        const card = await card_repository_1.default.getCardById(req.params.id);
        if (!card) {
            res.status(404).json({ error: 'Card not found' });
            return;
        }
        res.json({ card });
    }
    catch (error) {
        console.error('Get card error:', error);
        res.status(500).json({ error: 'Failed to get card' });
    }
});
// Get cards by type
router.get('/type/:type', auth_middleware_1.optionalAuth, async (req, res) => {
    try {
        const cards = await card_repository_1.default.getCardsByType(req.params.type);
        res.json({ cards });
    }
    catch (error) {
        console.error('Get cards by type error:', error);
        res.status(500).json({ error: 'Failed to get cards' });
    }
});
// Get cards by race
router.get('/race/:race', auth_middleware_1.optionalAuth, async (req, res) => {
    try {
        const cards = await card_repository_1.default.getCardsByRace(req.params.race);
        res.json({ cards });
    }
    catch (error) {
        console.error('Get cards by race error:', error);
        res.status(500).json({ error: 'Failed to get cards' });
    }
});
// Note: Admin routes moved to /api/admin/cards
exports.default = router;
//# sourceMappingURL=card.routes.js.map