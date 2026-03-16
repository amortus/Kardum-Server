"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateToken = authenticateToken;
exports.optionalAuth = optionalAuth;
exports.requireAdmin = requireAdmin;
const auth_service_1 = __importDefault(require("./auth.service"));
const user_repository_1 = __importDefault(require("../users/user.repository"));
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        res.status(401).json({ error: 'Access token required' });
        return;
    }
    try {
        const payload = auth_service_1.default.verifyToken(token);
        req.userId = payload.userId;
        req.user = payload;
        next();
    }
    catch (error) {
        res.status(403).json({ error: 'Invalid or expired token' });
    }
}
function optionalAuth(req, _res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token) {
        try {
            const payload = auth_service_1.default.verifyToken(token);
            req.userId = payload.userId;
            req.user = payload;
        }
        catch (error) {
            // Token inválido, mas é opcional então continua
        }
    }
    next();
}
async function requireAdmin(req, res, next) {
    // Primeiro verificar autenticação
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        res.status(401).json({ error: 'Access token required' });
        return;
    }
    try {
        const payload = auth_service_1.default.verifyToken(token);
        req.userId = payload.userId;
        req.user = payload;
        // Verificar se o usuário é admin no banco de dados
        const user = await user_repository_1.default.getUserById(payload.userId);
        if (!user || !user.is_admin) {
            res.status(403).json({ error: 'Admin access required' });
            return;
        }
        next();
    }
    catch (error) {
        res.status(403).json({ error: 'Invalid or expired token' });
    }
}
//# sourceMappingURL=auth.middleware.js.map