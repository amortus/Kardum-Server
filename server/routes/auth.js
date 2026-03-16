// server/routes/auth.js - Rotas de autenticação
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { createUser, getUserByUsername, getUserById, dbHelpers } = require('../database');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function mapUserPayload(user) {
    const gender = (user.gender || 'male').toLowerCase();
    const defaultHead = gender === 'female' ? 'head_long' : 'male_head1';
    return {
        id: user.id,
        username: user.username,
        email: user.email,
        elo_casual: user.elo_casual,
        elo_ranked: user.elo_ranked,
        total_matches: user.total_matches,
        wins: user.wins,
        losses: user.losses,
        created_at: user.created_at,
        last_login: user.last_login,
        character: {
            gender,
            body_id: user.body_id || 'clothes',
            head_id: user.head_id || defaultHead,
            character_completed: user.character_completed === 1
        },
        character_completed: user.character_completed === 1
    };
}

/**
 * POST /api/auth/register
 * Criar nova conta
 */
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Validação
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: 'Username e senha são obrigatórios'
            });
        }

        if (username.length < 3 || username.length > 20) {
            return res.status(400).json({
                success: false,
                error: 'Username deve ter entre 3 e 20 caracteres'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                error: 'Senha deve ter no mínimo 6 caracteres'
            });
        }

        // Verificar se username já existe
        const existingUser = await getUserByUsername(username);
        if (existingUser) {
            return res.status(409).json({
                success: false,
                error: 'Username já está em uso'
            });
        }

        // Verificar email se fornecido
        if (email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({
                    success: false,
                    error: 'Email inválido'
                });
            }
        }

        // Hash da senha
        const passwordHash = await bcrypt.hash(password, 10);

        // Criar usuário
        const result = await createUser(username, passwordHash, email || null);
        const userId = result.lastInsertRowid || result.rows?.[0]?.id;

        // Buscar usuário criado
        const user = await getUserById(userId);

        // Gerar token JWT
        const token = jwt.sign(
            { userId: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        // Retornar resposta (sem senha)
        res.status(201).json({
            success: true,
            data: {
                token,
                user: mapUserPayload(user),
                onboarding: {
                    requires_character_setup: user.character_completed !== 1
                }
            }
        });
    } catch (error) {
        console.error('[Auth] Register error:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao criar conta'
        });
    }
});

/**
 * POST /api/auth/login
 * Fazer login
 */
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validação
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: 'Username e senha são obrigatórios'
            });
        }

        // Buscar usuário
        const user = await getUserByUsername(username);
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Credenciais inválidas'
            });
        }

        // Verificar senha
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({
                success: false,
                error: 'Credenciais inválidas'
            });
        }

        // Atualizar último login
        await dbHelpers.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

        // Gerar token JWT
        const token = jwt.sign(
            { userId: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        // Retornar resposta (sem senha)
        res.json({
            success: true,
            data: {
                token,
                user: mapUserPayload(user),
                onboarding: {
                    requires_character_setup: user.character_completed !== 1
                }
            }
        });
    } catch (error) {
        console.error('[Auth] Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao fazer login'
        });
    }
});

/**
 * GET /api/auth/me
 * Obter dados do usuário logado
 */
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const user = await getUserById(req.user.id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Usuário não encontrado'
            });
        }

        res.json({
            success: true,
            data: mapUserPayload(user)
        });
    } catch (error) {
        console.error('[Auth] Get me error:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao obter dados do usuário'
        });
    }
});

module.exports = router;

