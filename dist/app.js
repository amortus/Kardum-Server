"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const env_1 = require("./config/env");
const uploads_path_1 = require("./utils/uploads-path");
// Routes
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const card_routes_1 = __importDefault(require("./modules/cards/card.routes"));
const deck_routes_1 = __importDefault(require("./modules/decks/deck.routes"));
const admin_routes_1 = __importDefault(require("./modules/admin/admin.routes"));
const user_routes_1 = __importDefault(require("./modules/users/user.routes"));
const friends_routes_1 = __importDefault(require("./modules/friends/friends.routes"));
const quest_routes_1 = __importDefault(require("./modules/quests/quest.routes"));
const npc_routes_1 = __importDefault(require("./modules/npcs/npc.routes"));
function createApp() {
    const app = (0, express_1.default)();
    // Middleware
    app.use((0, cors_1.default)({
        origin: env_1.ENV.CORS_ORIGINS,
        credentials: true
    }));
    app.use(express_1.default.json({ limit: '5mb' }));
    app.use(express_1.default.urlencoded({ extended: true, limit: '5mb' }));
    // Serve static files (admin dashboard only - game client is in Godot)
    app.use('/admin', express_1.default.static(path_1.default.join(__dirname, '../admin')));
    // Servir imagens de cartas renderizadas.
    // Em produção, o processo pode iniciar com cwd diferente (pm2/systemd/docker),
    // então resolvemos a pasta de uploads por candidatos + variável UPLOADS_DIR.
    const uploadsPath = (0, uploads_path_1.resolveReadableUploadsDir)();
    app.use('/uploads', express_1.default.static(uploadsPath));
    console.log('📦 Serving uploads from:', uploadsPath);
    console.log('📦 Upload candidates:', (0, uploads_path_1.getUploadsCandidates)());
    // Serve assets from Godot project if available (for card editor)
    const fs = require('fs');
    const godotAssetsPath = path_1.default.join(__dirname, '../../tcg-godot/assets');
    if (fs.existsSync(godotAssetsPath)) {
        app.use('/assets', express_1.default.static(godotAssetsPath));
        console.log('✅ Serving Godot assets from:', godotAssetsPath);
    }
    else {
        console.warn('⚠️  Godot assets path not found:', godotAssetsPath);
    }
    // API Routes
    app.use('/api/auth', auth_routes_1.default);
    app.use('/api/cards', card_routes_1.default);
    app.use('/api/decks', deck_routes_1.default);
    app.use('/api/admin', admin_routes_1.default);
    app.use('/api/users', user_routes_1.default);
    app.use('/api/friends', friends_routes_1.default);
    app.use('/api/quests', quest_routes_1.default);
    app.use('/api/npcs', npc_routes_1.default);
    // Basic routes
    app.get('/', (_req, res) => {
        res.redirect('/admin');
    });
    app.get('/admin', (_req, res) => {
        res.sendFile(path_1.default.join(__dirname, '../admin/index.html'));
    });
    app.get('/health', (_req, res) => {
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            environment: env_1.ENV.NODE_ENV
        });
    });
    // 404 handler
    app.use((_req, res) => {
        res.status(404).json({ error: 'Not found' });
    });
    // Error handler
    app.use((err, _req, res, _next) => {
        console.error('Error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: env_1.ENV.NODE_ENV === 'development' ? err.message : undefined
        });
    });
    return app;
}
//# sourceMappingURL=app.js.map