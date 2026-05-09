// server/middleware/auth.js - Middleware de autenticação JWT
const jwt = require('jsonwebtoken');
const { getUserById } = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * Middleware para verificar token JWT
 */
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ 
            success: false, 
            error: 'Token de acesso requerido' 
        });
    }

    jwt.verify(token, JWT_SECRET, async (err, decoded) => {
        if (err) {
            return res.status(403).json({ 
                success: false, 
                error: 'Token inválido ou expirado' 
            });
        }

        // Verificar se usuário ainda existe
        const user = await getUserById(decoded.userId);
        if (!user) {
            return res.status(403).json({ 
                success: false, 
                error: 'Usuário não encontrado' 
            });
        }

        req.user = {
            id: user.id,
            username: user.username,
            email: user.email,
            isAdmin: user.is_admin === 1
        };

        next();
    });
}

/**
 * Middleware opcional - não retorna erro se não tiver token
 */
function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
        jwt.verify(token, JWT_SECRET, async (err, decoded) => {
            if (!err) {
                const user = await getUserById(decoded.userId);
                if (user) {
                    req.user = {
                        id: user.id,
                        username: user.username,
                        email: user.email,
                        isAdmin: user.is_admin === 1
                    };
                }
            }
            next();
        });
    } else {
        next();
    }
}

module.exports = {
    authenticateToken,
    optionalAuth,
    JWT_SECRET
};

