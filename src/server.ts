import http from 'http';
import { ENV } from './config/env';
import { initializeDatabase } from './config/database';
import { createApp } from './app';
import { setupSocketIO } from './config/socket';
import chatService from './modules/chat/chat.service';

// Main server initialization
async function startServer() {
  try {
    // Initialize database
    await initializeDatabase();

    // Create Express app
    const app = createApp();
    const server = http.createServer(app);

    // Initialize Socket.IO with full game logic
    await setupSocketIO(server);
    console.log('✅ Socket.IO initialized with game logic');

    // Start server
    server.listen(ENV.PORT, () => {
      console.log(`
╔══════════════════════════════════════════════╗
║                                              ║
║   🎮  Kardum TCG Server - TypeScript         ║
║                                              ║
║   Environment: ${ENV.NODE_ENV.padEnd(31)}║
║   Port: ${ENV.PORT.toString().padEnd(37)}║
║                                              ║
║   🌐  Game: http://localhost:${ENV.PORT}         ║
║   📊  Admin: http://localhost:${ENV.PORT}/admin  ║
║   🔌  WebSocket: ws://localhost:${ENV.PORT}       ║
║                                              ║
╚══════════════════════════════════════════════╝
      `);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully...');
      chatService.stopBackgroundJobs();
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('\nSIGINT received, shutting down gracefully...');
      chatService.stopBackgroundJobs();
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
