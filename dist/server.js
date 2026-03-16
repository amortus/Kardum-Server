"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const env_1 = require("./config/env");
const database_1 = require("./config/database");
const app_1 = require("./app");
const socket_1 = require("./config/socket");
const chat_service_1 = __importDefault(require("./modules/chat/chat.service"));
// Main server initialization
async function startServer() {
    try {
        // Initialize database
        await (0, database_1.initializeDatabase)();
        // Create Express app
        const app = (0, app_1.createApp)();
        const server = http_1.default.createServer(app);
        // Initialize Socket.IO with full game logic
        await (0, socket_1.setupSocketIO)(server);
        console.log('✅ Socket.IO initialized with game logic');
        // Start server
        server.listen(env_1.ENV.PORT, () => {
            console.log(`
╔══════════════════════════════════════════════╗
║                                              ║
║   🎮  Kardum TCG Server - TypeScript         ║
║                                              ║
║   Environment: ${env_1.ENV.NODE_ENV.padEnd(31)}║
║   Port: ${env_1.ENV.PORT.toString().padEnd(37)}║
║                                              ║
║   🌐  Game: http://localhost:${env_1.ENV.PORT}         ║
║   📊  Admin: http://localhost:${env_1.ENV.PORT}/admin  ║
║   🔌  WebSocket: ws://localhost:${env_1.ENV.PORT}       ║
║                                              ║
╚══════════════════════════════════════════════╝
      `);
        });
        // Graceful shutdown
        process.on('SIGTERM', () => {
            console.log('SIGTERM received, shutting down gracefully...');
            chat_service_1.default.stopBackgroundJobs();
            server.close(() => {
                console.log('Server closed');
                process.exit(0);
            });
        });
        process.on('SIGINT', () => {
            console.log('\nSIGINT received, shutting down gracefully...');
            chat_service_1.default.stopBackgroundJobs();
            server.close(() => {
                console.log('Server closed');
                process.exit(0);
            });
        });
    }
    catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}
// Start the server
startServer();
//# sourceMappingURL=server.js.map