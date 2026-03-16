// server/index.js - Servidor principal do Kardum
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));
app.use('/admin', express.static(path.join(__dirname, '../admin')));

// API Routes
const authRoutes = require('./routes/auth');
const deckRoutes = require('./routes/decks');
const userRoutes = require('./routes/users');
app.use('/api/auth', authRoutes);
app.use('/api/decks', deckRoutes);
app.use('/api/users', userRoutes);

// Basic routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../admin/index.html'));
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.IO para multiplayer
const { authenticateToken } = require('./middleware/auth');
const { getUserById } = require('./database');
const matchmaking = require('./services/matchmaking');
const matchManager = require('./game/match-manager');

const MATCHMAKING_TIMEOUT = 5 * 60 * 1000; // 5 minutos

// Mapear userId -> socketId para notificações
const userSockets = new Map();

// Middleware de autenticação para Socket.IO
io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return next(new Error('Authentication token required'));
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        getUserById(decoded.userId).then(user => {
            if (!user) {
                return next(new Error('User not found'));
            }

            socket.userId = user.id;
            socket.user = {
                id: user.id,
                username: user.username,
                email: user.email
            };
            
            next();
        }).catch(err => {
            next(new Error('User not found'));
        });
    } catch (error) {
        next(new Error('Invalid token'));
    }
});

io.on('connection', (socket) => {
    const userId = socket.userId;
    const username = socket.user.username;

    console.log(`[Socket.IO] User ${userId} (${username}) connected. Socket ID: ${socket.id}`);

    // Registrar socket do usuário
    if (!userSockets.has(userId)) {
        userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socket.id);

    // Matchmaking: Entrar na fila
    socket.on('pvp:matchmaking:join', async (data) => {
        try {
            const { deckId, matchType } = data;

            if (!deckId || !matchType) {
                socket.emit('pvp:error', { message: 'deckId e matchType são obrigatórios' });
                return;
            }

            if (matchType !== 'casual' && matchType !== 'ranked') {
                socket.emit('pvp:error', { message: 'matchType deve ser "casual" ou "ranked"' });
                return;
            }

            console.log(`[Matchmaking] User ${userId} joining ${matchType} queue with deck ${deckId}`);

            // Adicionar à fila
            const match = matchmaking.addToQueue(userId, socket.id, matchType, deckId);

            socket.emit('pvp:matchmaking:joined', { matchType });

            // Se encontrou match imediatamente
            if (match) {
                handleMatchFound(match, matchType).catch(err => {
                    console.error('[Matchmaking] Error handling match found:', err);
                });
            }
        } catch (error) {
            console.error('[Matchmaking] Join error:', error);
            socket.emit('pvp:error', { message: error.message || 'Erro ao entrar na fila' });
        }
    });

    // Matchmaking: Sair da fila
    socket.on('pvp:matchmaking:leave', () => {
        try {
            matchmaking.removeFromQueue(userId, 'casual');
            matchmaking.removeFromQueue(userId, 'ranked');
            socket.emit('pvp:matchmaking:left');
            console.log(`[Matchmaking] User ${userId} left queue`);
        } catch (error) {
            console.error('[Matchmaking] Leave error:', error);
        }
    });

    // Partida: Marcar como pronto
    socket.on('pvp:match:ready', (data) => {
        try {
            const { matchId } = data;
            const match = matchManager.getMatch(matchId);

            if (!match) {
                socket.emit('pvp:error', { message: 'Partida não encontrada' });
                return;
            }

            if (match.player1Id !== userId && match.player2Id !== userId) {
                socket.emit('pvp:error', { message: 'Você não está nesta partida' });
                return;
            }

            matchManager.setPlayerReady(matchId, userId);

            // Se ambos estão prontos, iniciar partida
            if (matchManager.areBothPlayersReady(matchId)) {
                io.to(socket.id).emit('pvp:match:start', {
                    matchId,
                    player1Deck: match.player1Deck,
                    player2Deck: match.player2Deck,
                    matchType: match.matchType
                });

                // Notificar oponente
                const opponentId = match.player1Id === userId ? match.player2Id : match.player1Id;
                const opponentSockets = userSockets.get(opponentId);
                if (opponentSockets) {
                    opponentSockets.forEach(socketId => {
                        io.to(socketId).emit('pvp:match:start', {
                            matchId,
                            player1Deck: match.player1Deck,
                            player2Deck: match.player2Deck,
                            matchType: match.matchType
                        });
                    });
                }
            }
        } catch (error) {
            console.error('[Match] Ready error:', error);
            socket.emit('pvp:error', { message: error.message || 'Erro ao marcar como pronto' });
        }
    });

    // Partida: Enviar ação
    socket.on('pvp:match:action', (data) => {
        try {
            const { matchId, action } = data;
            const match = matchManager.getMatch(matchId);

            if (!match) {
                socket.emit('pvp:error', { message: 'Partida não encontrada' });
                return;
            }

            if (match.player1Id !== userId && match.player2Id !== userId) {
                socket.emit('pvp:error', { message: 'Você não está nesta partida' });
                return;
            }

            // Validar e processar ação no servidor
            const result = matchManager.processAction(matchId, userId, action);
            
            if (!result.success) {
                socket.emit('pvp:error', { message: result.error || 'Ação inválida' });
                return;
            }

            // Enviar ação para o oponente
            const opponentId = match.player1Id === userId ? match.player2Id : match.player1Id;
            const opponentSockets = userSockets.get(opponentId);
            if (opponentSockets) {
                opponentSockets.forEach(socketId => {
                    io.to(socketId).emit('pvp:match:action', {
                        matchId,
                        action,
                        fromPlayer: userId
                    });
                });
            }

            // Confirmar ação para o remetente
            socket.emit('pvp:match:action:confirmed', {
                matchId,
                action,
                success: true
            });
        } catch (error) {
            console.error('[Match] Action error:', error);
            socket.emit('pvp:error', { message: error.message || 'Erro ao processar ação' });
        }
    });

    // Partida: Sincronizar estado
    socket.on('pvp:match:sync', (data) => {
        try {
            const { matchId } = data;
            const match = matchManager.getMatch(matchId);

            if (!match) {
                socket.emit('pvp:error', { message: 'Partida não encontrada' });
                return;
            }

            if (match.player1Id !== userId && match.player2Id !== userId) {
                socket.emit('pvp:error', { message: 'Você não está nesta partida' });
                return;
            }

            // Obter estado completo da partida
            const matchState = matchManager.getMatchState(matchId);
            
            socket.emit('pvp:match:state', {
                matchId,
                state: matchState
            });
        } catch (error) {
            console.error('[Match] Sync error:', error);
            socket.emit('pvp:error', { message: error.message || 'Erro ao sincronizar estado' });
        }
    });

    // Partida: Finalizar
    socket.on('pvp:match:end', async (data) => {
        try {
            const { matchId, winnerId } = data;
            const match = matchManager.getMatch(matchId);

            if (!match) {
                socket.emit('pvp:error', { message: 'Partida não encontrada' });
                return;
            }

            if (match.player1Id !== userId && match.player2Id !== userId) {
                socket.emit('pvp:error', { message: 'Você não está nesta partida' });
                return;
            }

            // Finalizar partida
            const result = matchManager.endPvpMatch(matchId, winnerId);

            // Notificar ambos os jogadores
            const player1Sockets = userSockets.get(match.player1Id);
            const player2Sockets = userSockets.get(match.player2Id);

            const endData = {
                matchId,
                winner: winnerId,
                eloUpdate: result.eloUpdate
            };

            if (player1Sockets) {
                player1Sockets.forEach(socketId => {
                    io.to(socketId).emit('pvp:match:end', endData);
                });
            }

            if (player2Sockets) {
                player2Sockets.forEach(socketId => {
                    io.to(socketId).emit('pvp:match:end', endData);
                });
            }
        } catch (error) {
            console.error('[Match] End error:', error);
            socket.emit('pvp:error', { message: error.message || 'Erro ao finalizar partida' });
        }
    });

    // Desconexão
    socket.on('disconnect', () => {
        console.log(`[Socket.IO] User ${userId} (${username}) disconnected`);

        // Remover da fila
        matchmaking.removeFromQueue(userId, 'casual');
        matchmaking.removeFromQueue(userId, 'ranked');

        // Remover socket do mapeamento
        const sockets = userSockets.get(userId);
        if (sockets) {
            sockets.delete(socket.id);
            if (sockets.size === 0) {
                userSockets.delete(userId);
            }
        }
    });
});

/**
 * Handler quando match é encontrado
 */
async function handleMatchFound(match, matchType) {
    console.log(`[Matchmaking] Match found: ${match.player1.userId} vs ${match.player2.userId}`);

    // Criar partida
    const matchState = await matchManager.createPvpMatch(
        match.player1.userId,
        match.player2.userId,
        match.player1.deckId,
        match.player2.deckId,
        matchType
    );

    // Notificar ambos os jogadores
    const player1Sockets = userSockets.get(match.player1.userId);
    const player2Sockets = userSockets.get(match.player2.userId);

    // Buscar usernames dos jogadores
    const player1User = await getUserById(match.player1.userId);
    const player2User = await getUserById(match.player2.userId);

    const matchData = {
        matchId: matchState.matchId,
        opponent: {
            userId: match.player2.userId,
            username: player2User?.username || 'Unknown'
        },
        matchType
    };

    if (player1Sockets) {
        player1Sockets.forEach(socketId => {
            io.to(socketId).emit('pvp:matchmaking:found', matchData);
        });
    }

    const matchData2 = {
        matchId: matchState.matchId,
        opponent: {
            userId: match.player1.userId,
            username: player1User?.username || 'Unknown'
        },
        matchType
    };

    if (player2Sockets) {
        player2Sockets.forEach(socketId => {
            io.to(socketId).emit('pvp:matchmaking:found', matchData2);
        });
    }
}

// Tentar encontrar matches periodicamente (a cada 5 segundos)
// Isso é feito automaticamente quando jogadores entram na fila

// Start server
server.listen(PORT, () => {
    console.log(`🎮 Kardum Server rodando em http://localhost:${PORT}`);
    console.log(`📊 Admin Dashboard: http://localhost:${PORT}/admin`);
    console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
