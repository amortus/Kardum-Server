// server/routes/decks.js - Rotas de decks
const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { getUserDecks, getDeckById, createDeck, updateDeck, deleteDeck } = require('../database');

const router = express.Router();

// Todas as rotas requerem autenticação
router.use(authenticateToken);

/**
 * GET /api/decks
 * Listar todos os decks do usuário
 */
router.get('/', async (req, res) => {
    try {
        const userId = req.user.id;
        console.log(`[Decks] Loading decks for user ${userId}`);
        const startTime = Date.now();
        
        const decks = await getUserDecks(userId);
        
        const loadTime = Date.now() - startTime;
        console.log(`[Decks] Loaded ${decks.length} decks in ${loadTime}ms`);

        res.json({
            success: true,
            data: decks
        });
    } catch (error) {
        console.error('[Decks] Get decks error:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao listar decks'
        });
    }
});

/**
 * GET /api/decks/:id
 * Obter deck específico
 */
router.get('/:id', async (req, res) => {
    try {
        const userId = req.user.id;
        const deckId = parseInt(req.params.id);

        const deck = await getDeckById(deckId);

        if (!deck) {
            return res.status(404).json({
                success: false,
                error: 'Deck não encontrado'
            });
        }

        // Verificar se o deck pertence ao usuário
        if (deck.user_id !== userId) {
            return res.status(403).json({
                success: false,
                error: 'Acesso negado'
            });
        }

        res.json({
            success: true,
            data: deck
        });
    } catch (error) {
        console.error('[Decks] Get deck error:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao obter deck'
        });
    }
});

/**
 * POST /api/decks
 * Criar novo deck
 */
router.post('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, generalId, cards } = req.body;

        // Validação
        if (!name || !generalId || !cards) {
            return res.status(400).json({
                success: false,
                error: 'Nome, General e cartas são obrigatórios'
            });
        }

        if (!Array.isArray(cards)) {
            return res.status(400).json({
                success: false,
                error: 'Cartas deve ser um array'
            });
        }

        // Validar regras de deck
        if (cards.length < 30 || cards.length > 40) {
            return res.status(400).json({
                success: false,
                error: 'Deck deve ter entre 30 e 40 cartas'
            });
        }

        // Verificar se tem General nas cartas (não deve estar no array de cards)
        // O generalId é separado

        // Criar deck
        const deckData = {
            name,
            generalId,
            cards: JSON.stringify(cards)
        };

        const result = await createDeck(userId, deckData);

        res.status(201).json({
            success: true,
            data: {
                id: result.lastInsertRowid || result.rows?.[0]?.id,
                name,
                generalId,
                cards,
                user_id: userId
            }
        });
    } catch (error) {
        console.error('[Decks] Create deck error:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao criar deck'
        });
    }
});

/**
 * PUT /api/decks/:id
 * Atualizar deck existente
 */
router.put('/:id', async (req, res) => {
    try {
        const userId = req.user.id;
        const deckId = parseInt(req.params.id);
        const { name, generalId, cards } = req.body;

        // Verificar se deck existe e pertence ao usuário
        const existingDeck = await getDeckById(deckId);
        if (!existingDeck) {
            return res.status(404).json({
                success: false,
                error: 'Deck não encontrado'
            });
        }

        if (existingDeck.user_id !== userId) {
            return res.status(403).json({
                success: false,
                error: 'Acesso negado'
            });
        }

        // Validação
        if (cards && (!Array.isArray(cards) || cards.length < 30 || cards.length > 40)) {
            return res.status(400).json({
                success: false,
                error: 'Deck deve ter entre 30 e 40 cartas'
            });
        }

        // Atualizar deck
        const deckData = {
            name: name || existingDeck.name,
            generalId: generalId || existingDeck.general_id,
            cards: cards ? JSON.stringify(cards) : existingDeck.cards
        };

        await updateDeck(deckId, userId, deckData);

        res.json({
            success: true,
            data: {
                id: deckId,
                ...deckData,
                cards: cards || JSON.parse(existingDeck.cards)
            }
        });
    } catch (error) {
        console.error('[Decks] Update deck error:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao atualizar deck'
        });
    }
});

/**
 * DELETE /api/decks/:id
 * Deletar deck
 */
router.delete('/:id', async (req, res) => {
    try {
        const userId = req.user.id;
        const deckId = parseInt(req.params.id);

        // Verificar se deck existe e pertence ao usuário
        const deck = await getDeckById(deckId);
        if (!deck) {
            return res.status(404).json({
                success: false,
                error: 'Deck não encontrado'
            });
        }

        if (deck.user_id !== userId) {
            return res.status(403).json({
                success: false,
                error: 'Acesso negado'
            });
        }

        await deleteDeck(deckId, userId);

        res.json({
            success: true,
            message: 'Deck deletado com sucesso'
        });
    } catch (error) {
        console.error('[Decks] Delete deck error:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao deletar deck'
        });
    }
});

module.exports = router;

