"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const deck_repository_1 = __importDefault(require("./deck.repository"));
const card_repository_1 = __importDefault(require("../cards/card.repository"));
const auth_middleware_1 = require("../auth/auth.middleware");
const user_repository_1 = __importDefault(require("../users/user.repository"));
const router = (0, express_1.Router)();
async function validateCardsUnlockedForUser(userId, cards) {
    const user = await user_repository_1.default.getUserById(userId);
    if (user?.is_admin) {
        return null;
    }
    const ok = await card_repository_1.default.areCardsAvailableForUser(userId, cards);
    if (ok)
        return null;
    return 'Deck contains cards not unlocked for this user';
}
// All deck routes require authentication
router.use(auth_middleware_1.authenticateToken);
// Get user's decks
router.get('/', async (req, res) => {
    try {
        const decks = await deck_repository_1.default.getUserDecks(req.userId);
        res.json({ decks });
    }
    catch (error) {
        console.error('Get decks error:', error);
        res.status(500).json({ error: 'Failed to get decks' });
    }
});
// Get deck by ID
router.get('/:id', async (req, res) => {
    try {
        const deck = await deck_repository_1.default.getDeckById(parseInt(req.params.id));
        if (!deck) {
            res.status(404).json({ error: 'Deck not found' });
            return;
        }
        // Check if deck belongs to user
        if (deck.user_id !== req.userId) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
        res.json({ deck });
    }
    catch (error) {
        console.error('Get deck error:', error);
        res.status(500).json({ error: 'Failed to get deck' });
    }
});
// Create deck
router.post('/', async (req, res) => {
    try {
        const { name, cards } = req.body;
        if (!name || !cards || !Array.isArray(cards)) {
            res.status(400).json({ error: 'Invalid deck data' });
            return;
        }
        // Validate deck size
        if (cards.length < 30 || cards.length > 40) {
            res.status(400).json({ error: 'Deck must have between 30 and 40 cards' });
            return;
        }
        const accessError = await validateCardsUnlockedForUser(req.userId, cards);
        if (accessError) {
            res.status(400).json({ error: accessError });
            return;
        }
        const deckId = await deck_repository_1.default.createDeck(req.userId, {
            name,
            cards
        });
        res.status(201).json({
            message: 'Deck created successfully',
            deckId
        });
    }
    catch (error) {
        console.error('Create deck error:', error);
        res.status(500).json({ error: 'Failed to create deck' });
    }
});
// Create a starter deck automatically (no General card)
router.post('/generate-random', async (req, res) => {
    try {
        const payload = req.body || {};
        const deckName = String(payload.name || 'Deck Inicial').trim();
        const collectionId = payload.collection_id ? String(payload.collection_id) : undefined;
        const cards = await card_repository_1.default.getAllCards({
            collection_id: collectionId,
            user_id: req.userId
        });
        const pool = cards.filter((card) => card.type !== 'general').map((card) => card.id);
        if (pool.length < 30) {
            res.status(400).json({ error: 'Not enough cards to generate a deck' });
            return;
        }
        const shuffled = [...pool];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        const deckCards = shuffled.slice(0, 35);
        const deckId = await deck_repository_1.default.createDeck(req.userId, {
            name: deckName,
            cards: deckCards
        });
        res.status(201).json({
            message: 'Random deck generated successfully',
            deckId
        });
    }
    catch (error) {
        console.error('Generate random deck error:', error);
        res.status(500).json({ error: 'Failed to generate random deck' });
    }
});
// Update deck
router.put('/:id', async (req, res) => {
    try {
        const deckId = parseInt(req.params.id);
        const { name, cards } = req.body;
        if (!name || !cards || !Array.isArray(cards)) {
            res.status(400).json({ error: 'Invalid deck data' });
            return;
        }
        // Validate deck size
        if (cards.length < 30 || cards.length > 40) {
            res.status(400).json({ error: 'Deck must have between 30 and 40 cards' });
            return;
        }
        const accessError = await validateCardsUnlockedForUser(req.userId, cards);
        if (accessError) {
            res.status(400).json({ error: accessError });
            return;
        }
        // Check if deck belongs to user
        const existingDeck = await deck_repository_1.default.getDeckById(deckId);
        if (!existingDeck || existingDeck.user_id !== req.userId) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
        await deck_repository_1.default.updateDeck(deckId, req.userId, {
            name,
            cards
        });
        res.json({ message: 'Deck updated successfully' });
    }
    catch (error) {
        console.error('Update deck error:', error);
        res.status(500).json({ error: 'Failed to update deck' });
    }
});
// Delete deck
router.delete('/:id', async (req, res) => {
    try {
        const deckId = parseInt(req.params.id);
        // Check if deck belongs to user
        const existingDeck = await deck_repository_1.default.getDeckById(deckId);
        if (!existingDeck || existingDeck.user_id !== req.userId) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
        await deck_repository_1.default.deleteDeck(deckId, req.userId);
        res.json({ message: 'Deck deleted successfully' });
    }
    catch (error) {
        console.error('Delete deck error:', error);
        res.status(500).json({ error: 'Failed to delete deck' });
    }
});
exports.default = router;
//# sourceMappingURL=deck.routes.js.map