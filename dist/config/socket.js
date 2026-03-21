"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSocketIO = setupSocketIO;
exports.getUserSocketIds = getUserSocketIds;
exports.getOnlineUserIds = getOnlineUserIds;
exports.emitFriendUpdate = emitFriendUpdate;
const socket_io_1 = require("socket.io");
const redis_adapter_1 = require("@socket.io/redis-adapter");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("./env");
const redis_1 = require("./redis");
const constants_1 = require("../shared/constants");
const user_repository_1 = __importDefault(require("../modules/users/user.repository"));
const matchmaking_service_1 = __importDefault(require("../modules/matchmaking/matchmaking.service"));
const match_manager_1 = __importDefault(require("../modules/match/match.manager"));
const elo_service_1 = __importDefault(require("../modules/matchmaking/elo.service"));
const monster_service_1 = __importDefault(require("../modules/monsters/monster.service"));
const deck_repository_1 = __importDefault(require("../modules/decks/deck.repository"));
const card_repository_1 = __importDefault(require("../modules/cards/card.repository"));
const chat_handlers_1 = require("../modules/chat/chat.handlers");
const chat_service_1 = __importDefault(require("../modules/chat/chat.service"));
const friends_repository_1 = __importDefault(require("../modules/friends/friends.repository"));
const admin_command_catalog_1 = require("../modules/admin/admin-command.catalog");
const shard_authority_service_1 = require("../modules/mmo/shard-authority.service");
const world_state_store_1 = require("../modules/mmo/world-state.store");
const quest_service_1 = __importDefault(require("../modules/quests/quest.service"));
const npc_service_1 = __importDefault(require("../modules/npcs/npc.service"));
// Map userId -> Set of socketIds
const userSockets = new Map();
const userZones = world_state_store_1.worldStateStore.userZones;
const userZoneChannels = world_state_store_1.worldStateStore.userZoneChannels;
const zoneChannelMembers = world_state_store_1.worldStateStore.zoneChannelMembers;
const userWorldPosition = world_state_store_1.worldStateStore.userWorldPosition;
const userWorldIdentity = new Map();
const userVisibleMonsters = new Map();
const userVisiblePlayers = world_state_store_1.worldStateStore.userVisiblePlayers;
let ioInstance = null;
const aiTurnLocks = new Set();
let mmoDeltaTimer = null;
let mmoResyncTimer = null;
let mmoChannelMetricsTimer = null;
let mmoPlayerUpdateEmitCount = 0;
let pvpPhaseWatchdogTimer = null;
const pendingDisconnectForfeitTimers = new Map();
const zoneMonsterBroadcastState = new Map();
const lastQuestPositionSyncAt = new Map();
function parseSocketPositiveInt(value, max = 2147483647) {
    if (value === null || value === undefined)
        return null;
    if (typeof value === 'bigint') {
        const n = Number(value);
        return Number.isFinite(n) && n >= 1 && n <= max ? Math.floor(n) : null;
    }
    if (typeof value === 'number') {
        if (!Number.isFinite(value) || value < 1)
            return null;
        const n = Math.floor(value);
        return n >= 1 && n <= max ? n : null;
    }
    if (typeof value === 'string') {
        const t = value.trim();
        if (!/^\d{1,12}$/.test(t))
            return null;
        const n = parseInt(t, 10);
        return n >= 1 && n <= max ? n : null;
    }
    return null;
}
const MMO_PERF_PRESETS = {
    mobile: { aoiRadius: 700, deltaIntervalMs: 1400, resyncIntervalMs: 20000 },
    balanced: { aoiRadius: 1200, deltaIntervalMs: 1000, resyncIntervalMs: 15000 },
    high: { aoiRadius: 1600, deltaIntervalMs: 700, resyncIntervalMs: 10000 }
};
const PVP_PHASE_TIMEOUT_MS = 60 * 1000;
const PVP_PHASE_WATCHDOG_INTERVAL_MS = 2000;
const DISCONNECT_FORFEIT_GRACE_MS = 30 * 1000;
const CROSS_INSTANCE_FINALIZE_EVENT = 'match:finalize:request';
let mmoPerfState = {
    preset: 'balanced',
    aoiRadius: Math.max(200, env_1.ENV.MMO_AOI_RADIUS || 1200),
    aoiRadiusSq: Math.max(200, env_1.ENV.MMO_AOI_RADIUS || 1200) * Math.max(200, env_1.ENV.MMO_AOI_RADIUS || 1200),
    deltaIntervalMs: Math.max(250, env_1.ENV.MMO_MONSTER_DELTA_INTERVAL_MS || 1000),
    resyncIntervalMs: Math.max(3000, env_1.ENV.MMO_MONSTER_RESYNC_INTERVAL_MS || 15000)
};
function getDefaultAppearance() {
    return {
        gender: 'male',
        body_id: 'clothes',
        head_id: 'male_head1',
        skin_body_id: null,
        skin_head_id: null
    };
}
function normalizeAppearance(appearance) {
    const gender = String(appearance?.gender || 'male').toLowerCase() === 'female' ? 'female' : 'male';
    return {
        gender,
        body_id: String(appearance?.body_id || 'clothes'),
        head_id: String(appearance?.head_id || (gender === 'female' ? 'head_long' : 'male_head1')),
        skin_body_id: appearance?.skin_body_id ? String(appearance.skin_body_id) : null,
        skin_head_id: appearance?.skin_head_id ? String(appearance.skin_head_id) : null
    };
}
function clearPendingDisconnectForfeit(userId) {
    const timer = pendingDisconnectForfeitTimers.get(userId);
    if (timer) {
        clearTimeout(timer);
        pendingDisconnectForfeitTimers.delete(userId);
    }
}
async function finalizeMatchAndBroadcast(io, payload, requestedByUserId = 0, emitError) {
    const matchId = Number(payload?.matchId);
    const winnerId = Number(payload?.winnerId);
    if (!Number.isFinite(matchId) || matchId <= 0) {
        emitError?.('matchId is required to end match');
        return false;
    }
    if (!Number.isFinite(winnerId) || winnerId <= 0) {
        emitError?.('winnerId is required to end match');
        return false;
    }
    const match = match_manager_1.default.getMatch(matchId);
    if (match?.ended) {
        return true;
    }
    // Resultado do encounter é sempre do ponto de vista do jogador humano (player1 em partidas AI/PvE).
    // Nunca usar finishEncounter antes de resolver o match: requestedByUserId === 0 ou confundir
    // vencedor com o requester gerava 'loss' indevido e zerava progresso de quest.
    let encounterResult;
    if (match) {
        encounterResult = winnerId === Number(match.player1Id) ? 'win' : 'loss';
    }
    else if (requestedByUserId > 0) {
        encounterResult = winnerId === requestedByUserId ? 'win' : 'loss';
    }
    else {
        encounterResult = 'loss';
    }
    const encounterFinish = await monster_service_1.default.finishEncounter(matchId, encounterResult);
    if (!match) {
        if (encounterFinish) {
            if (encounterFinish.monster) {
                emitMonsterDespawnToAoiViewers(io, encounterFinish.monster.zone, encounterFinish.monster.spawn_uid, encounterFinish.monster.next_respawn_at || 0);
            }
            emitToUser(io, encounterFinish.userId, constants_1.SOCKET_EVENTS.MMO_DROP_RESULT, {
                result: encounterFinish.result,
                drop: encounterFinish.drop,
                templateId: encounterFinish.templateId
            });
            try {
                await quest_service_1.default.onMonsterEncounterResult(encounterFinish.userId, encounterFinish.templateId, encounterFinish.result);
                await emitQuestSnapshotForUser(io, encounterFinish.userId, userZones.get(encounterFinish.userId) || 'shadowland', constants_1.SOCKET_EVENTS.QUESTS_UPDATE);
            }
            catch (error) {
                console.error('[Quests] Monster encounter progress failed (no local match):', error);
            }
            return true;
        }
        emitError?.('Match not found');
        return false;
    }
    const isAiMatch = match.matchType === 'ai';
    const player1Id = Number(match.player1Id);
    const player2Id = Number(match.player2Id);
    const isEncounterMatch = !!encounterFinish;
    let eloUpdate = {
        player1EloChange: 0,
        player2EloChange: 0,
        player1NewElo: 0,
        player2NewElo: 0,
        expUpdate: { winnerExpGained: 0, loserExpGained: 0 }
    };
    if (!isAiMatch && !isEncounterMatch) {
        try {
            const computed = await elo_service_1.default.updateEloAfterMatch(player1Id, player2Id, winnerId, match.matchType);
            eloUpdate = computed;
        }
        catch (error) {
            console.error('[Match] ELO update failed; preserving GAME_END emission', {
                matchId,
                winnerId,
                player1Id,
                player2Id,
                error
            });
        }
    }
    if (encounterFinish?.monster) {
        emitMonsterDespawnToAoiViewers(io, encounterFinish.monster.zone, encounterFinish.monster.spawn_uid, encounterFinish.monster.next_respawn_at || 0);
    }
    if (encounterFinish) {
        emitToUser(io, encounterFinish.userId, constants_1.SOCKET_EVENTS.MMO_DROP_RESULT, {
            result: encounterFinish.result,
            drop: encounterFinish.drop,
            templateId: encounterFinish.templateId
        });
        try {
            await quest_service_1.default.onMonsterEncounterResult(encounterFinish.userId, encounterFinish.templateId, encounterFinish.result);
            await emitQuestSnapshotForUser(io, encounterFinish.userId, userZones.get(encounterFinish.userId) || 'shadowland', constants_1.SOCKET_EVENTS.QUESTS_UPDATE);
        }
        catch (error) {
            console.error('[Quests] Monster encounter progress failed:', error);
        }
    }
    match_manager_1.default.endMatch(matchId, winnerId);
    const endData = {
        matchId,
        winnerId,
        eloUpdate: {
            player1EloChange: eloUpdate.player1EloChange,
            player2EloChange: eloUpdate.player2EloChange,
            player1NewElo: eloUpdate.player1NewElo,
            player2NewElo: eloUpdate.player2NewElo
        },
        expUpdate: eloUpdate.expUpdate,
        monsterDrop: encounterFinish?.drop || null
    };
    emitToUser(io, player1Id, constants_1.SOCKET_EVENTS.GAME_END, endData);
    emitToUser(io, player2Id, constants_1.SOCKET_EVENTS.GAME_END, endData);
    if (!isAiMatch) {
        await quest_service_1.default.onPvpMatchResult(winnerId, true, matchId);
        await emitQuestSnapshotForUser(io, winnerId, userZones.get(winnerId) || 'shadowland', constants_1.SOCKET_EVENTS.QUESTS_UPDATE);
    }
    return true;
}
function requestCrossInstanceFinalize(io, request) {
    io.serverSideEmit(CROSS_INSTANCE_FINALIZE_EVENT, request);
}
async function setupSocketIO(server) {
    await (0, redis_1.initializeRedis)();
    const io = new socket_io_1.Server(server, {
        cors: {
            origin: env_1.ENV.CORS_ORIGINS,
            methods: ['GET', 'POST']
        }
    });
    if ((0, redis_1.isRedisReady)()) {
        const pub = (0, redis_1.getRedisPubClient)();
        const sub = (0, redis_1.getRedisSubClient)();
        if (pub && sub) {
            io.adapter((0, redis_adapter_1.createAdapter)(pub, sub));
            console.log('[Socket.IO] Redis adapter enabled');
        }
    }
    await world_state_store_1.worldStateStore.initialize();
    if ((0, redis_1.isRedisReady)()) {
        const redisOk = await (0, redis_1.pingRedis)();
        if (!redisOk) {
            console.warn('[Redis] Ping failed after initialization');
        }
    }
    ioInstance = io;
    io.on(CROSS_INSTANCE_FINALIZE_EVENT, async (request) => {
        try {
            const requestedMatchId = Number(request?.matchId);
            let winnerId = Number(request?.winnerId);
            let matchId = requestedMatchId;
            if ((!Number.isFinite(matchId) || matchId <= 0) && Number.isFinite(request?.loserUserId)) {
                const localMatch = match_manager_1.default.findActiveMatchByUser(Number(request?.loserUserId));
                if (localMatch && !localMatch.ended) {
                    matchId = localMatch.matchId;
                    if (!Number.isFinite(winnerId) || winnerId <= 0) {
                        winnerId = localMatch.player1Id === Number(request?.loserUserId) ? localMatch.player2Id : localMatch.player1Id;
                    }
                }
            }
            if (!Number.isFinite(matchId) || matchId <= 0 || !Number.isFinite(winnerId) || winnerId <= 0) {
                return;
            }
            const localMatchById = match_manager_1.default.getMatch(matchId);
            if (!localMatchById || localMatchById.ended) {
                return;
            }
            await finalizeMatchAndBroadcast(io, { matchId, winnerId }, Number(request?.requestedByUserId || 0));
            console.log('[Match] Finalized from cross-instance request', {
                matchId,
                winnerId,
                requestedByUserId: request?.requestedByUserId || 0,
                reason: request?.reason || 'unknown',
                instanceId: env_1.ENV.INSTANCE_ID
            });
        }
        catch (error) {
            console.warn('[Match] Cross-instance finalize failed:', error);
        }
    });
    // Authentication middleware
    io.use(async (socket, next) => {
        const token = socket.handshake.auth.token ||
            socket.handshake.headers.authorization?.split(' ')[1] ||
            socket.handshake.query.token;
        if (!token) {
            return next(new Error('Authentication token required'));
        }
        try {
            const decoded = jsonwebtoken_1.default.verify(token, env_1.ENV.JWT_SECRET);
            const user = await user_repository_1.default.getUserById(decoded.userId);
            if (!user) {
                return next(new Error('User not found'));
            }
            socket.userId = user.id;
            socket.user = {
                id: user.id,
                username: user.username,
                email: user.email,
                isAdmin: Boolean(user.is_admin),
                profileAvatarId: String(user?.profile_avatar_id || '')
                    .trim()
                    .toLowerCase(),
                appearance: normalizeAppearance({
                    gender: user.gender,
                    body_id: user.body_id,
                    head_id: user.head_id,
                    skin_body_id: user.skin_body_id,
                    skin_head_id: user.skin_head_id
                })
            };
            next();
        }
        catch (error) {
            next(new Error('Invalid token'));
        }
    });
    // Connection handler
    io.on(constants_1.SOCKET_EVENTS.CONNECT, (socket) => {
        const userId = socket.userId;
        const username = socket.user.username;
        clearPendingDisconnectForfeit(userId);
        userWorldIdentity.set(userId, {
            username,
            appearance: normalizeAppearance(socket.user?.appearance),
            profileAvatarId: String(socket.user?.profileAvatarId || '')
                .trim()
                .toLowerCase()
        });
        console.log(`[Socket.IO] User ${userId} (${username}) connected. Socket ID: ${socket.id}`);
        // Register socket
        if (!userSockets.has(userId)) {
            userSockets.set(userId, new Set());
        }
        userSockets.get(userId).add(socket.id);
        socket.join(`user:${userId}`);
        (0, chat_handlers_1.registerChatHandlers)(io, socket, {
            getUserSocketIds
        });
        notifyScopedChatPresence(io, userId, username, true).catch((error) => {
            console.warn('[Socket.IO] Failed to notify scoped chat join presence:', error);
        });
        notifyFriendPresence(io, userId, username, true).catch((error) => {
            console.warn('[Socket.IO] Failed to notify online presence:', error);
        });
        // Matchmaking: Join queue
        socket.on(constants_1.SOCKET_EVENTS.QUEUE_JOIN, async (data) => {
            try {
                const { deckId, matchType } = data;
                if (!deckId || !matchType) {
                    socket.emit(constants_1.SOCKET_EVENTS.PVP_ERROR, { message: 'deckId and matchType are required' });
                    return;
                }
                if (matchType !== 'casual' && matchType !== 'ranked') {
                    socket.emit(constants_1.SOCKET_EVENTS.PVP_ERROR, { message: 'matchType must be "casual" or "ranked"' });
                    return;
                }
                const userDeck = await deck_repository_1.default.getDeckById(Number(deckId));
                if (!userDeck || userDeck.user_id !== userId) {
                    socket.emit(constants_1.SOCKET_EVENTS.PVP_ERROR, { message: 'Deck not found or access denied' });
                    return;
                }
                const queueDeckUnlocked = socket.user?.isAdmin
                    ? true
                    : await card_repository_1.default.areCardsAvailableForUser(userId, userDeck.cards || []);
                if (!queueDeckUnlocked) {
                    socket.emit(constants_1.SOCKET_EVENTS.PVP_ERROR, {
                        message: 'Seu deck possui cartas bloqueadas para este usuario'
                    });
                    return;
                }
                console.log(`[Matchmaking] User ${userId} joining ${matchType} queue with deck ${deckId}`);
                // Add to queue
                const match = await matchmaking_service_1.default.addToQueue(userId, socket.id, matchType, deckId);
                socket.emit(constants_1.SOCKET_EVENTS.MATCHMAKING_JOINED, { matchType });
                // If found match immediately
                if (match) {
                    await handleMatchFound(io, match, matchType);
                }
            }
            catch (error) {
                console.error('[Matchmaking] Join error:', error);
                socket.emit(constants_1.SOCKET_EVENTS.PVP_ERROR, { message: error.message || 'Failed to join queue' });
            }
        });
        // MMO Zone Join + Snapshot
        socket.on(constants_1.SOCKET_EVENTS.MMO_ZONE_JOIN, async (data) => {
            try {
                const zone = normalizeZoneName(data?.zone);
                const previousZone = userZones.get(userId) || '';
                const previousZoneKey = userZoneChannels.get(userId) || '';
                const zoneKey = assignZoneChannelForUser(zone, userId);
                if (previousZoneKey !== '') {
                    socket.leave(`zone:${previousZoneKey}`);
                    clearPlayerVisibilityForUser(io, userId);
                }
                if (previousZone !== '' && previousZone !== zone) {
                    socket.leave(`zone:${previousZone}`);
                }
                socket.join(`zone:${zone}`);
                socket.join(`zone:${zoneKey}`);
                world_state_store_1.worldStateStore.setUserZone(userId, zone);
                world_state_store_1.worldStateStore.setUserZoneChannel(userId, zoneKey);
                const initialX = Number.isFinite(data?.x) ? Number(data?.x) : 0;
                const initialY = Number.isFinite(data?.y) ? Number(data?.y) : 0;
                world_state_store_1.worldStateStore.setUserWorldPosition(userId, {
                    zone,
                    x: initialX,
                    y: initialY,
                    updatedAt: Date.now()
                });
                const players = getZonePlayersSnapshot(zoneKey, initialX, initialY, userId);
                socket.emit(constants_1.SOCKET_EVENTS.MMO_PLAYERS_SNAPSHOT, { zone, zoneKey, players });
                reconcilePlayerAoiForUser(io, userId);
                const monsters = getAoiSnapshotForUser(zone, initialX, initialY);
                socket.emit(constants_1.SOCKET_EVENTS.MMO_MONSTERS_SNAPSHOT, { zone, monsters });
                const npcs = await npc_service_1.default.listZoneSpawns(zone, userId);
                socket.emit(constants_1.SOCKET_EVENTS.MMO_NPCS_SNAPSHOT, { zone, npcs });
                userVisibleMonsters.set(userId, new Set(monsters.map((monster) => monster.spawn_uid)));
                await emitQuestSnapshotForUser(io, userId, zone, constants_1.SOCKET_EVENTS.QUESTS_SNAPSHOT);
                // Prime the zone cache when first users join to avoid a large first delta burst.
                if (!zoneMonsterBroadcastState.has(zone)) {
                    const zoneState = new Map();
                    for (const monster of monster_service_1.default.getZoneRuntime(zone)) {
                        zoneState.set(monster.spawn_uid, {
                            x: monster.x,
                            y: monster.y,
                            status: monster.status,
                            nextRespawnAt: monster.next_respawn_at ?? null
                        });
                    }
                    zoneMonsterBroadcastState.set(zone, zoneState);
                }
            }
            catch (error) {
                socket.emit(constants_1.SOCKET_EVENTS.PVP_ERROR, { message: error.message || 'Failed to join zone' });
            }
        });
        socket.on(constants_1.SOCKET_EVENTS.MMO_PLAYER_POSITION, async (data) => {
            const previousZone = userZones.get(userId) || '';
            const previousZoneKey = userZoneChannels.get(userId) || '';
            const zone = normalizeZoneName(data?.zone || previousZone || 'shadowland');
            const x = Number.isFinite(data?.x) ? Number(data?.x) : 0;
            const y = Number.isFinite(data?.y) ? Number(data?.y) : 0;
            if (previousZone !== zone) {
                const newZoneKey = assignZoneChannelForUser(zone, userId);
                if (previousZoneKey !== '') {
                    socket.leave(`zone:${previousZoneKey}`);
                    clearPlayerVisibilityForUser(io, userId);
                }
                if (previousZone !== '') {
                    socket.leave(`zone:${previousZone}`);
                }
                socket.join(`zone:${zone}`);
                socket.join(`zone:${newZoneKey}`);
                world_state_store_1.worldStateStore.setUserZoneChannel(userId, newZoneKey);
                const players = getZonePlayersSnapshot(newZoneKey, x, y, userId);
                socket.emit(constants_1.SOCKET_EVENTS.MMO_PLAYERS_SNAPSHOT, { zone, zoneKey: newZoneKey, players });
                const npcs = await npc_service_1.default.listZoneSpawns(zone, userId);
                socket.emit(constants_1.SOCKET_EVENTS.MMO_NPCS_SNAPSHOT, { zone, npcs });
            }
            world_state_store_1.worldStateStore.setUserZone(userId, zone);
            world_state_store_1.worldStateStore.setUserWorldPosition(userId, {
                zone,
                x,
                y,
                updatedAt: Date.now()
            });
            reconcilePlayerAoiForUser(io, userId);
            const now = Date.now();
            const lastSync = Number(lastQuestPositionSyncAt.get(userId) || 0);
            if ((now - lastSync) >= 1500) {
                lastQuestPositionSyncAt.set(userId, now);
                void quest_service_1.default
                    .onPlayerPosition(userId, zone, x, y)
                    .then(() => emitQuestSnapshotForUser(io, userId, zone, constants_1.SOCKET_EVENTS.QUESTS_UPDATE))
                    .catch((error) => {
                    console.warn('[Quests] Position progress error:', error);
                });
            }
        });
        // MMO Engage monster (server-authoritative lock)
        socket.on(constants_1.SOCKET_EVENTS.MMO_MONSTER_ENGAGE, async (data) => {
            try {
                const spawnUid = String(data?.spawnUid || '').trim();
                const zone = String(data?.zone || userZones.get(userId) || 'shadowland').trim().toLowerCase();
                const requestedDeckId = Number(data?.playerDeckId);
                if (!spawnUid) {
                    socket.emit(constants_1.SOCKET_EVENTS.PVP_ERROR, { message: 'spawnUid is required' });
                    return;
                }
                let playerDeckId = Number.isFinite(requestedDeckId) && requestedDeckId > 0 ? requestedDeckId : 0;
                if (playerDeckId > 0) {
                    const requestedDeck = await deck_repository_1.default.getDeckById(playerDeckId);
                    if (!requestedDeck || requestedDeck.user_id !== userId) {
                        playerDeckId = 0;
                    }
                    else {
                        const requestedDeckUnlocked = await card_repository_1.default.areCardsAvailableForUser(userId, requestedDeck.cards || []);
                        if (!requestedDeckUnlocked) {
                            playerDeckId = 0;
                        }
                    }
                }
                if (playerDeckId <= 0) {
                    const userDecks = await deck_repository_1.default.getUserDecks(userId);
                    const nonEmptyDecks = userDecks.filter((deck) => Array.isArray(deck.cards) && deck.cards.length > 0);
                    let selectedDeckId = 0;
                    for (const deck of nonEmptyDecks) {
                        const unlocked = await card_repository_1.default.areCardsAvailableForUser(userId, deck.cards || []);
                        if (unlocked) {
                            selectedDeckId = Number(deck.id);
                            break;
                        }
                    }
                    // Fallback para PvE: se não houver deck "desbloqueado", ainda permite usar
                    // o primeiro deck não-vazio para não bloquear encounters após resets de coleção.
                    if (selectedDeckId <= 0 && nonEmptyDecks.length > 0) {
                        selectedDeckId = Number(nonEmptyDecks[0].id);
                        console.warn('[MMO] No unlocked deck found, using fallback non-empty deck for encounter', {
                            userId,
                            deckId: selectedDeckId
                        });
                    }
                    if (selectedDeckId <= 0) {
                        socket.emit(constants_1.SOCKET_EVENTS.PVP_ERROR, { message: 'No valid deck found for player' });
                        return;
                    }
                    playerDeckId = selectedDeckId;
                }
                const monster = monster_service_1.default.getMonster(spawnUid);
                if (!monster || monster.zone !== zone || monster.status !== 'alive') {
                    socket.emit(constants_1.SOCKET_EVENTS.PVP_ERROR, { message: 'Monster unavailable' });
                    return;
                }
                const monsterName = String(monster?.template_name || 'Monstro').trim() || 'Monstro';
                const matchId = await match_manager_1.default.createMatch(userId, userId + 1000000, playerDeckId, monster.deck_id, 'ai');
                await match_manager_1.default.startMatch(matchId);
                await monster_service_1.default.engageMonster(spawnUid, userId, matchId);
                emitMonsterDespawnToAoiViewers(io, zone, spawnUid, Date.now() + monster.respawn_seconds * 1000);
                socket.emit(constants_1.SOCKET_EVENTS.MMO_ENCOUNTER_START, { matchId, spawnUid, zone, monsterName });
                socket.emit(constants_1.SOCKET_EVENTS.GAME_START, {
                    matchId,
                    localPlayerRole: 'player1',
                    aiOpponentName: monsterName,
                    initialState: match_manager_1.default.getMatchState(matchId)
                });
            }
            catch (error) {
                socket.emit(constants_1.SOCKET_EVENTS.PVP_ERROR, { message: error.message || 'Failed to engage monster' });
            }
        });
        // Admin command: /spawn "template name" (NPC first, then monster fallback)
        socket.on(constants_1.SOCKET_EVENTS.MMO_COMMAND_SPAWN, async (data) => {
            try {
                if (!socket.user?.isAdmin) {
                    socket.emit(constants_1.SOCKET_EVENTS.PVP_ERROR, { message: 'Admin only command' });
                    return;
                }
                const name = String(data?.name || '').trim();
                const zone = String(data?.zone || userZones.get(userId) || 'shadowland').trim().toLowerCase();
                const x = Number.isFinite(data?.x) ? Number(data.x) : 0;
                const y = Number.isFinite(data?.y) ? Number(data.y) : 0;
                if (!name) {
                    socket.emit(constants_1.SOCKET_EVENTS.PVP_ERROR, { message: 'name is required' });
                    return;
                }
                try {
                    const npcSpawn = await npc_service_1.default.spawnByTemplateName(name, zone, x, y);
                    await emitNpcSnapshotForZone(io, zone);
                    socket.emit(constants_1.SOCKET_EVENTS.MMO_COMMAND_RESULT, {
                        command: 'spawn',
                        success: true,
                        message: `NPC criado para "${name}"`,
                        spawn: {
                            kind: 'npc',
                            spawnUid: npcSpawn.spawn_uid,
                            templateName: String(npcSpawn?.template?.name || name),
                            templateCode: String(npcSpawn?.template?.code || ''),
                            zone,
                            x: Math.round(Number(npcSpawn.x || 0)),
                            y: Math.round(Number(npcSpawn.y || 0))
                        }
                    });
                    return;
                }
                catch (npcError) {
                    const npcMessage = String(npcError?.message || '');
                    const npcNotFound = npcMessage.toLowerCase().indexOf('not found') >= 0;
                    if (!npcNotFound) {
                        throw npcError;
                    }
                }
                const spawned = await monster_service_1.default.spawnByTemplateName(name, zone, x, y);
                emitMonsterUpdateToAoiNearby(io, zone, spawned);
                socket.emit(constants_1.SOCKET_EVENTS.MMO_COMMAND_RESULT, {
                    command: 'spawn',
                    success: true,
                    message: `Monstro criado para "${name}"`,
                    spawn: {
                        kind: 'monster',
                        spawnUid: spawned.spawn_uid,
                        templateName: spawned.template_name,
                        zone,
                        x: Math.round(spawned.x),
                        y: Math.round(spawned.y),
                        respawnSeconds: spawned.respawn_seconds
                    }
                });
            }
            catch (error) {
                socket.emit(constants_1.SOCKET_EVENTS.PVP_ERROR, { message: error.message || 'Spawn command failed' });
            }
        });
        socket.on(constants_1.SOCKET_EVENTS.MMO_COMMAND_PERF, (data) => {
            try {
                if (!socket.user?.isAdmin) {
                    socket.emit(constants_1.SOCKET_EVENTS.PVP_ERROR, { message: 'Admin only command' });
                    return;
                }
                const requestedPreset = String(data?.preset || '')
                    .trim()
                    .toLowerCase();
                if (!isValidPerfPreset(requestedPreset)) {
                    socket.emit(constants_1.SOCKET_EVENTS.PVP_ERROR, {
                        message: 'Preset invalido. Use: mobile, balanced ou high'
                    });
                    return;
                }
                applyMmoPerfPreset(requestedPreset);
                restartMmoBroadcastLoops(io);
                socket.emit(constants_1.SOCKET_EVENTS.MMO_COMMAND_RESULT, {
                    command: 'perf',
                    success: true,
                    message: `Preset de performance aplicado: ${requestedPreset}`,
                    settings: {
                        aoiRadius: mmoPerfState.aoiRadius,
                        deltaIntervalMs: mmoPerfState.deltaIntervalMs,
                        resyncIntervalMs: mmoPerfState.resyncIntervalMs
                    }
                });
            }
            catch (error) {
                socket.emit(constants_1.SOCKET_EVENTS.PVP_ERROR, { message: error.message || 'Perf command failed' });
            }
        });
        socket.on(constants_1.SOCKET_EVENTS.MMO_COMMAND_CHANNELS, () => {
            try {
                if (!socket.user?.isAdmin) {
                    socket.emit(constants_1.SOCKET_EVENTS.PVP_ERROR, { message: 'Admin only command' });
                    return;
                }
                const channels = getChannelHealthSnapshot();
                socket.emit(constants_1.SOCKET_EVENTS.MMO_COMMAND_RESULT, {
                    command: 'channels',
                    success: true,
                    message: 'Snapshot de channels gerado',
                    channels
                });
            }
            catch (error) {
                socket.emit(constants_1.SOCKET_EVENTS.PVP_ERROR, { message: error.message || 'Channels snapshot failed' });
            }
        });
        socket.on(constants_1.SOCKET_EVENTS.MMO_COMMANDS_GET, () => {
            const isAdmin = Boolean(socket.user?.isAdmin);
            const commands = admin_command_catalog_1.ADMIN_COMMANDS_CATALOG.filter((cmd) => cmd.permission === 'any' ? true : isAdmin);
            socket.emit(constants_1.SOCKET_EVENTS.MMO_COMMANDS_LIST, { commands });
        });
        socket.on(constants_1.SOCKET_EVENTS.QUESTS_SYNC, async () => {
            const zone = userZones.get(userId) || 'shadowland';
            await emitQuestSnapshotForUser(io, userId, zone, constants_1.SOCKET_EVENTS.QUESTS_SNAPSHOT);
            await emitNpcSnapshotForUser(io, userId, zone);
        });
        socket.on(constants_1.SOCKET_EVENTS.QUESTS_ACCEPT, async (data) => {
            try {
                const questId = parseSocketPositiveInt(data?.questId);
                if (questId == null) {
                    socket.emit(constants_1.SOCKET_EVENTS.PVP_ERROR, { message: 'questId is required' });
                    return;
                }
                await quest_service_1.default.acceptQuest(userId, questId);
                const zone = userZones.get(userId) || 'shadowland';
                await emitQuestSnapshotForUser(io, userId, zone, constants_1.SOCKET_EVENTS.QUESTS_UPDATE);
                await emitNpcSnapshotForUser(io, userId, zone);
            }
            catch (error) {
                socket.emit(constants_1.SOCKET_EVENTS.PVP_ERROR, { message: error.message || 'Failed to accept quest' });
            }
        });
        socket.on(constants_1.SOCKET_EVENTS.QUESTS_ABANDON, async (data) => {
            try {
                const questId = parseSocketPositiveInt(data?.questId);
                if (questId == null) {
                    socket.emit(constants_1.SOCKET_EVENTS.PVP_ERROR, { message: 'questId is required' });
                    return;
                }
                await quest_service_1.default.abandonQuest(userId, questId);
                const zone = userZones.get(userId) || 'shadowland';
                await emitQuestSnapshotForUser(io, userId, zone, constants_1.SOCKET_EVENTS.QUESTS_UPDATE);
                await emitNpcSnapshotForUser(io, userId, zone);
            }
            catch (error) {
                socket.emit(constants_1.SOCKET_EVENTS.PVP_ERROR, { message: error.message || 'Failed to abandon quest' });
            }
        });
        socket.on(constants_1.SOCKET_EVENTS.QUESTS_TRACK, async (data) => {
            try {
                const questId = parseSocketPositiveInt(data?.questId);
                const tracked = data?.tracked !== false;
                if (questId == null) {
                    socket.emit(constants_1.SOCKET_EVENTS.PVP_ERROR, { message: 'questId is required' });
                    return;
                }
                await quest_service_1.default.trackQuest(userId, questId, tracked);
                await emitQuestSnapshotForUser(io, userId, userZones.get(userId) || 'shadowland', constants_1.SOCKET_EVENTS.QUESTS_UPDATE);
            }
            catch (error) {
                socket.emit(constants_1.SOCKET_EVENTS.PVP_ERROR, { message: error.message || 'Failed to track quest' });
            }
        });
        socket.on(constants_1.SOCKET_EVENTS.QUESTS_TURNIN, async (data) => {
            try {
                const questId = parseSocketPositiveInt(data?.questId);
                if (questId == null) {
                    socket.emit(constants_1.SOCKET_EVENTS.PVP_ERROR, { message: 'questId is required' });
                    return;
                }
                await quest_service_1.default.turnInQuest(userId, questId);
                const zone = userZones.get(userId) || 'shadowland';
                try {
                    await emitQuestSnapshotForUser(io, userId, zone, constants_1.SOCKET_EVENTS.QUESTS_UPDATE);
                    await emitNpcSnapshotForUser(io, userId, zone);
                }
                catch (emitErr) {
                    console.error('[Quests] post-turnin snapshot failed:', emitErr?.message || emitErr);
                }
            }
            catch (error) {
                socket.emit(constants_1.SOCKET_EVENTS.PVP_ERROR, { message: error.message || 'Failed to turn in quest' });
            }
        });
        socket.on(constants_1.SOCKET_EVENTS.QUESTS_NPC_TALK, async (data) => {
            try {
                const npcTemplateId = parseSocketPositiveInt(data?.npcTemplateId);
                if (npcTemplateId == null) {
                    socket.emit(constants_1.SOCKET_EVENTS.PVP_ERROR, { message: 'npcTemplateId is required' });
                    return;
                }
                await npc_service_1.default.interactWithNpc(userId, npcTemplateId);
                const zone = userZones.get(userId) || 'shadowland';
                await emitQuestSnapshotForUser(io, userId, zone, constants_1.SOCKET_EVENTS.QUESTS_UPDATE);
                await emitNpcSnapshotForUser(io, userId, zone);
            }
            catch (error) {
                socket.emit(constants_1.SOCKET_EVENTS.PVP_ERROR, { message: error.message || 'Failed to process NPC interaction' });
            }
        });
        // Matchmaking: Leave queue
        socket.on(constants_1.SOCKET_EVENTS.QUEUE_LEAVE, () => {
            try {
                matchmaking_service_1.default.removeFromQueue(userId, 'casual');
                matchmaking_service_1.default.removeFromQueue(userId, 'ranked');
                socket.emit(constants_1.SOCKET_EVENTS.MATCHMAKING_LEFT);
                console.log(`[Matchmaking] User ${userId} left queue`);
            }
            catch (error) {
                console.error('[Matchmaking] Leave error:', error);
            }
        });
        const handleMatchReady = async (data) => {
            try {
                const matchId = Number(data?.matchId);
                if (!Number.isFinite(matchId) || matchId <= 0) {
                    socket.emit(constants_1.SOCKET_EVENTS.PVP_ERROR, { message: 'matchId is required for ready' });
                    return;
                }
                match_manager_1.default.setPlayerReady(matchId, userId);
                socket.emit(constants_1.SOCKET_EVENTS.MATCH_READY, { matchId, readyUserId: userId });
                // If both ready, start game
                if (match_manager_1.default.areBothPlayersReady(matchId)) {
                    await match_manager_1.default.startMatch(matchId);
                    const state = match_manager_1.default.getMatchState(matchId);
                    // Notify both players
                    const match = match_manager_1.default.getMatch(matchId);
                    if (match) {
                        const { player1Username, player2Username, player1AvatarId, player2AvatarId } = await resolveMatchIdentity(match);
                        logPvpIdentity('GAME_START -> player1', {
                            matchId,
                            targetUserId: Number(match.player1Id),
                            localPlayerRole: 'player1',
                            player1Id: Number(match.player1Id),
                            player2Id: Number(match.player2Id),
                            player1Username,
                            player2Username
                        });
                        emitToUser(io, match.player1Id, constants_1.SOCKET_EVENTS.GAME_START, {
                            matchId,
                            localPlayerRole: 'player1',
                            player1Id: Number(match.player1Id),
                            player2Id: Number(match.player2Id),
                            player1Username,
                            player2Username,
                            player1AvatarId,
                            player2AvatarId,
                            initialState: state
                        });
                        logPvpIdentity('GAME_START -> player2', {
                            matchId,
                            targetUserId: Number(match.player2Id),
                            localPlayerRole: 'player2',
                            player1Id: Number(match.player1Id),
                            player2Id: Number(match.player2Id),
                            player1Username,
                            player2Username
                        });
                        emitToUser(io, match.player2Id, constants_1.SOCKET_EVENTS.GAME_START, {
                            matchId,
                            localPlayerRole: 'player2',
                            player1Id: Number(match.player1Id),
                            player2Id: Number(match.player2Id),
                            player1Username,
                            player2Username,
                            player1AvatarId,
                            player2AvatarId,
                            initialState: state
                        });
                    }
                }
            }
            catch (error) {
                console.error('[Match] Ready error:', error);
                socket.emit(constants_1.SOCKET_EVENTS.PVP_ERROR, { message: error.message || 'Failed to ready' });
            }
        };
        // Match: Ready (accept prefixed and legacy unprefixed)
        socket.on(constants_1.SOCKET_EVENTS.MATCH_READY, handleMatchReady);
        socket.on('match:ready', handleMatchReady);
        // Game: Action
        socket.on(constants_1.SOCKET_EVENTS.GAME_ACTION, async (data) => {
            try {
                const { matchId, action } = data;
                const result = await match_manager_1.default.processAction(matchId, userId, action);
                if (!result.success) {
                    socket.emit(constants_1.SOCKET_EVENTS.GAME_ERROR, { message: result.error || 'Action failed' });
                    return;
                }
                // Notify both players
                const match = match_manager_1.default.getMatch(matchId);
                if (match) {
                    const { player1Username, player2Username, player1AvatarId, player2AvatarId } = await resolveMatchIdentity(match);
                    logPvpIdentity('GAME_UPDATE -> player1', {
                        matchId,
                        targetUserId: Number(match.player1Id),
                        localPlayerRole: 'player1',
                        player1Id: Number(match.player1Id),
                        player2Id: Number(match.player2Id),
                        player1Username,
                        player2Username
                    });
                    emitToUser(io, match.player1Id, constants_1.SOCKET_EVENTS.GAME_UPDATE, {
                        matchId,
                        localPlayerRole: 'player1',
                        player1Id: Number(match.player1Id),
                        player2Id: Number(match.player2Id),
                        player1Username,
                        player2Username,
                        player1AvatarId,
                        player2AvatarId,
                        lastAction: action,
                        state: result.state
                    });
                    logPvpIdentity('GAME_UPDATE -> player2', {
                        matchId,
                        targetUserId: Number(match.player2Id),
                        localPlayerRole: 'player2',
                        player1Id: Number(match.player1Id),
                        player2Id: Number(match.player2Id),
                        player1Username,
                        player2Username
                    });
                    emitToUser(io, match.player2Id, constants_1.SOCKET_EVENTS.GAME_UPDATE, {
                        matchId,
                        localPlayerRole: 'player2',
                        player1Id: Number(match.player1Id),
                        player2Id: Number(match.player2Id),
                        player1Username,
                        player2Username,
                        player1AvatarId,
                        player2AvatarId,
                        lastAction: action,
                        state: result.state
                    });
                    await maybeFinalizeMatchFromState(matchId, result.state, userId);
                    const refreshedMatch = match_manager_1.default.getMatch(matchId);
                    if (refreshedMatch && !refreshedMatch.ended) {
                        maybeRunAiTurn(io, matchId).catch((error) => {
                            console.warn('[AI] Failed to run AI turn loop:', error);
                        });
                    }
                }
            }
            catch (error) {
                console.error('[Game] Action error:', error);
                socket.emit(constants_1.SOCKET_EVENTS.GAME_ERROR, { message: error.message || 'Action failed' });
            }
        });
        const handleMatchSync = async (data) => {
            try {
                const matchId = Number(data?.matchId);
                if (!Number.isFinite(matchId) || matchId <= 0) {
                    socket.emit(constants_1.SOCKET_EVENTS.PVP_ERROR, { message: 'matchId is required for sync' });
                    return;
                }
                const state = match_manager_1.default.getMatchState(matchId);
                const match = match_manager_1.default.getMatch(matchId);
                if (match) {
                    const { player1Username, player2Username, player1AvatarId, player2AvatarId } = await resolveMatchIdentity(match);
                    const localPlayerRole = Number(match.player1Id) === Number(userId) ? 'player1' : 'player2';
                    logPvpIdentity('MATCH_STATE -> requester', {
                        matchId,
                        targetUserId: Number(userId),
                        localPlayerRole,
                        player1Id: Number(match.player1Id),
                        player2Id: Number(match.player2Id),
                        player1Username,
                        player2Username
                    });
                    socket.emit(constants_1.SOCKET_EVENTS.MATCH_STATE, {
                        matchId,
                        localPlayerRole,
                        player1Id: Number(match.player1Id),
                        player2Id: Number(match.player2Id),
                        player1Username,
                        player2Username,
                        player1AvatarId,
                        player2AvatarId,
                        state
                    });
                }
                else {
                    socket.emit(constants_1.SOCKET_EVENTS.MATCH_STATE, { matchId, state });
                }
            }
            catch (error) {
                console.error('[Match] Sync error:', error);
                socket.emit(constants_1.SOCKET_EVENTS.PVP_ERROR, { message: error.message || 'Sync failed' });
            }
        };
        // Match: Sync (accept prefixed and legacy unprefixed)
        socket.on(constants_1.SOCKET_EVENTS.MATCH_SYNC, handleMatchSync);
        socket.on('match:sync', handleMatchSync);
        const handleMatchEnd = async (data) => {
            try {
                console.log('[Match] End requested:', {
                    matchId: data?.matchId,
                    winnerId: data?.winnerId,
                    userId,
                    instanceId: env_1.ENV.INSTANCE_ID
                });
                const success = await finalizeMatchAndBroadcast(io, { matchId: data?.matchId, winnerId: data?.winnerId }, userId, (message) => socket.emit(constants_1.SOCKET_EVENTS.PVP_ERROR, { message }));
                if (!success) {
                    const matchId = Number(data?.matchId);
                    const winnerId = Number(data?.winnerId);
                    if (Number.isFinite(matchId) && matchId > 0 && Number.isFinite(winnerId) && winnerId > 0) {
                        requestCrossInstanceFinalize(io, {
                            matchId,
                            winnerId,
                            requestedByUserId: userId,
                            reason: 'match_end_forward'
                        });
                    }
                }
            }
            catch (error) {
                console.error('[Match] End error:', error);
                socket.emit(constants_1.SOCKET_EVENTS.PVP_ERROR, { message: error.message || 'Failed to end match' });
            }
        };
        const maybeFinalizeMatchFromState = async (matchId, state, requesterUserId) => {
            if (!state || !state.winner)
                return;
            const match = match_manager_1.default.getMatch(matchId);
            if (!match || match.ended)
                return;
            const winnerRaw = state.winner;
            let winnerId = Number(winnerRaw);
            if (!Number.isFinite(winnerId) || winnerId <= 0) {
                const winnerRole = String(winnerRaw || '').toLowerCase();
                if (winnerRole === 'player1') {
                    winnerId = Number(match.player1Id);
                }
                else if (winnerRole === 'player2' || winnerRole === 'ai') {
                    winnerId = Number(match.player2Id);
                }
            }
            if (!Number.isFinite(winnerId) || winnerId <= 0) {
                console.warn('[Match] Winner resolution failed from state:', { matchId, winnerRaw });
                return;
            }
            await handleMatchEnd({ matchId, winnerId });
            console.log('[Match] Finalized from authoritative winner state:', {
                matchId,
                winnerId,
                requestedBy: requesterUserId
            });
        };
        // Match: End (accept prefixed and legacy unprefixed)
        socket.on(constants_1.SOCKET_EVENTS.MATCH_END, handleMatchEnd);
        socket.on('match:end', handleMatchEnd);
        const handleMatchSurrender = async (data) => {
            try {
                const matchId = Number(data?.matchId);
                if (!Number.isFinite(matchId) || matchId <= 0) {
                    console.warn('[Match] Surrender rejected: missing matchId', { userId, raw: data?.matchId });
                    socket.emit(constants_1.SOCKET_EVENTS.PVP_ERROR, { message: 'matchId is required for surrender' });
                    return;
                }
                const match = match_manager_1.default.getMatch(matchId);
                if (!match) {
                    console.warn('[Match] Surrender rejected: match not found', { userId, matchId });
                    requestCrossInstanceFinalize(io, {
                        matchId,
                        loserUserId: userId,
                        requestedByUserId: userId,
                        reason: 'surrender_forward'
                    });
                    socket.emit(constants_1.SOCKET_EVENTS.PVP_ERROR, { message: 'Match not found on this instance. Retrying...' });
                    return;
                }
                if (match.ended) {
                    console.warn('[Match] Surrender rejected: match already ended', { userId, matchId });
                    socket.emit(constants_1.SOCKET_EVENTS.PVP_ERROR, { message: 'Match already ended' });
                    return;
                }
                if (match.player1Id !== userId && match.player2Id !== userId) {
                    console.warn('[Match] Surrender rejected: user not in match', { userId, matchId });
                    socket.emit(constants_1.SOCKET_EVENTS.PVP_ERROR, { message: 'You are not part of this match' });
                    return;
                }
                const winnerId = match.player1Id === userId ? match.player2Id : match.player1Id;
                console.log('[Match] Surrender accepted', { userId, matchId, winnerId });
                await handleMatchEnd({ matchId, winnerId });
            }
            catch (error) {
                console.error('[Match] Surrender error:', error);
                socket.emit(constants_1.SOCKET_EVENTS.PVP_ERROR, { message: error.message || 'Failed to surrender' });
            }
        };
        socket.on('pvp:match:surrender', handleMatchSurrender);
        socket.on('match:surrender', handleMatchSurrender);
        // Disconnection
        socket.on(constants_1.SOCKET_EVENTS.DISCONNECT, () => {
            console.log(`[Socket.IO] User ${userId} (${username}) disconnected`);
            // Remove from queues
            matchmaking_service_1.default.removeFromQueue(userId, 'casual');
            matchmaking_service_1.default.removeFromQueue(userId, 'ranked');
            // Remove socket
            const sockets = userSockets.get(userId);
            let userWentOffline = false;
            if (sockets) {
                sockets.delete(socket.id);
                if (sockets.size === 0) {
                    userSockets.delete(userId);
                    userWentOffline = true;
                }
            }
            if (userWentOffline) {
                const lastZone = userZones.get(userId);
                const lastZoneKey = userZoneChannels.get(userId);
                world_state_store_1.worldStateStore.deleteUserZone(userId);
                world_state_store_1.worldStateStore.deleteUserZoneChannel(userId);
                if (lastZone) {
                    const zoneHasUsers = Array.from(userZones.values()).includes(lastZone);
                    if (!zoneHasUsers) {
                        zoneMonsterBroadcastState.delete(lastZone);
                    }
                }
                clearPlayerVisibilityForUser(io, userId);
                if (lastZoneKey) {
                    removeUserFromZoneChannel(lastZoneKey, userId);
                }
                world_state_store_1.worldStateStore.deleteUserWorldPosition(userId);
                userWorldIdentity.delete(userId);
                userVisibleMonsters.delete(userId);
                world_state_store_1.worldStateStore.deleteUserVisiblePlayers(userId);
                lastQuestPositionSyncAt.delete(userId);
            }
            if (userWentOffline) {
                notifyScopedChatPresence(io, userId, username, false).catch((error) => {
                    console.warn('[Socket.IO] Failed to notify scoped chat leave presence:', error);
                });
                notifyFriendPresence(io, userId, username, false).catch((error) => {
                    console.warn('[Socket.IO] Failed to notify offline presence:', error);
                });
                const activeMatch = match_manager_1.default.findActiveMatchByUser(userId);
                clearPendingDisconnectForfeit(userId);
                const pendingMatchId = activeMatch && !activeMatch.ended ? activeMatch.matchId : 0;
                const timer = setTimeout(() => {
                    pendingDisconnectForfeitTimers.delete(userId);
                    const userReconnected = (userSockets.get(userId)?.size || 0) > 0;
                    if (userReconnected) {
                        return;
                    }
                    const latestMatch = pendingMatchId > 0 ? match_manager_1.default.getMatch(pendingMatchId) : null;
                    if (latestMatch && !latestMatch.ended && (latestMatch.player1Id === userId || latestMatch.player2Id === userId)) {
                        const winnerId = latestMatch.player1Id === userId ? latestMatch.player2Id : latestMatch.player1Id;
                        console.log('[Match] Disconnect forfeit expired, ending local match', {
                            loserId: userId,
                            winnerId,
                            matchId: pendingMatchId,
                            graceMs: DISCONNECT_FORFEIT_GRACE_MS,
                            instanceId: env_1.ENV.INSTANCE_ID
                        });
                        void finalizeMatchAndBroadcast(io, { matchId: pendingMatchId, winnerId }, userId);
                        return;
                    }
                    requestCrossInstanceFinalize(io, {
                        matchId: pendingMatchId > 0 ? pendingMatchId : undefined,
                        loserUserId: userId,
                        requestedByUserId: userId,
                        reason: 'disconnect_forfeit'
                    });
                    console.log('[Match] Disconnect forfeit forwarded cross-instance', {
                        loserId: userId,
                        matchId: pendingMatchId,
                        graceMs: DISCONNECT_FORFEIT_GRACE_MS,
                        instanceId: env_1.ENV.INSTANCE_ID
                    });
                }, DISCONNECT_FORFEIT_GRACE_MS);
                pendingDisconnectForfeitTimers.set(userId, timer);
                console.log('[Match] Disconnect forfeit pending', {
                    userId,
                    matchId: pendingMatchId,
                    graceMs: DISCONNECT_FORFEIT_GRACE_MS,
                    instanceId: env_1.ENV.INSTANCE_ID
                });
            }
        });
    });
    monster_service_1.default.initialize().catch((err) => {
        console.error('[MMO] Failed to initialize monster service:', err);
    });
    chat_service_1.default.startBackgroundJobs();
    restartMmoBroadcastLoops(io);
    restartPvpPhaseWatchdog(io);
    return io;
}
// Helper to emit to all sockets of a user
function getUserSocketIds(userId) {
    const sockets = userSockets.get(userId);
    if (!sockets)
        return [];
    return Array.from(sockets.values());
}
function getOnlineUserIds(candidates) {
    return candidates.filter((id) => (userSockets.get(id)?.size || 0) > 0);
}
function emitFriendUpdate(userId, payload) {
    if (!ioInstance)
        return;
    emitToUser(ioInstance, userId, constants_1.SOCKET_EVENTS.FRIEND_UPDATE, {
        ...payload,
        timestamp: Date.now()
    });
}
function emitToUser(io, userId, event, data) {
    io.to(`user:${userId}`).emit(event, data);
}
async function emitQuestSnapshotForUser(io, userId, zone, eventName) {
    const snapshot = await quest_service_1.default.getSnapshot(userId, zone);
    emitToUser(io, userId, eventName, snapshot);
}
async function emitNpcSnapshotForUser(io, userId, zone) {
    const npcs = await npc_service_1.default.listZoneSpawns(zone, userId);
    emitToUser(io, userId, constants_1.SOCKET_EVENTS.MMO_NPCS_SNAPSHOT, { zone, npcs });
}
async function emitNpcSnapshotForZone(io, zone) {
    const userEntries = Array.from(userZones.entries()).filter(([, userZone]) => String(userZone) === String(zone));
    for (const [userId] of userEntries) {
        await emitNpcSnapshotForUser(io, Number(userId), zone);
    }
}
async function resolveIdentityByUserId(userId) {
    if (!Number.isFinite(userId) || userId <= 0)
        return { username: '', profileAvatarId: '' };
    const worldIdentity = userWorldIdentity.get(userId);
    const worldUsername = String(worldIdentity?.username || '').trim();
    const worldAvatarId = String(worldIdentity?.profileAvatarId || '')
        .trim()
        .toLowerCase();
    try {
        const user = await user_repository_1.default.getUserById(userId);
        const dbUsername = String(user?.username || '').trim();
        const dbAvatarId = String(user?.profile_avatar_id || '')
            .trim()
            .toLowerCase();
        return {
            username: dbUsername || worldUsername,
            profileAvatarId: dbAvatarId || worldAvatarId
        };
    }
    catch {
        return { username: worldUsername, profileAvatarId: worldAvatarId };
    }
}
async function resolveMatchIdentity(match) {
    const [p1, p2] = await Promise.all([
        resolveIdentityByUserId(Number(match.player1Id)),
        resolveIdentityByUserId(Number(match.player2Id))
    ]);
    return {
        player1Username: p1.username,
        player2Username: p2.username,
        player1AvatarId: p1.profileAvatarId,
        player2AvatarId: p2.profileAvatarId
    };
}
function logPvpIdentity(tag, payload) {
    if (!env_1.ENV.PVP_IDENTITY_DEBUG)
        return;
    console.log(`[PVP_IDENTITY] ${tag}`, payload);
}
function buildWorldPlayerPayload(userId) {
    const pos = userWorldPosition.get(userId);
    if (!pos)
        return null;
    const zoneKey = userZoneChannels.get(userId) || `${pos.zone}#1`;
    const identity = userWorldIdentity.get(userId);
    return {
        userId,
        username: identity?.username || `Player_${userId}`,
        zone: pos.zone,
        zoneKey,
        x: pos.x,
        y: pos.y,
        kind: 'player',
        appearance: normalizeAppearance(identity?.appearance || getDefaultAppearance())
    };
}
function getZonePlayersSnapshot(zoneKey, x, y, excludeUserId = 0) {
    const players = [];
    for (const userId of getUsersInZoneChannel(zoneKey)) {
        if (excludeUserId > 0 && userId === excludeUserId)
            continue;
        const payload = buildWorldPlayerPayload(userId);
        if (payload && isPlayerInAoi(x, y, payload.x, payload.y)) {
            players.push(payload);
        }
    }
    return players;
}
function reconcilePlayerAoiForUser(io, userId) {
    const me = buildWorldPlayerPayload(userId);
    if (!me)
        return;
    const prevVisible = userVisiblePlayers.get(userId) || new Set();
    const nextVisible = new Set();
    for (const otherUserId of getUsersInZoneChannel(me.zoneKey)) {
        if (otherUserId === userId)
            continue;
        const other = buildWorldPlayerPayload(otherUserId);
        if (!other)
            continue;
        const inRange = isPlayerInAoi(me.x, me.y, other.x, other.y);
        if (inRange) {
            nextVisible.add(otherUserId);
            const otherPrevVisible = userVisiblePlayers.get(otherUserId) || new Set();
            if (!prevVisible.has(otherUserId)) {
                emitToUser(io, userId, constants_1.SOCKET_EVENTS.MMO_PLAYER_UPDATE, { player: other });
                mmoPlayerUpdateEmitCount += 1;
            }
            emitToUser(io, otherUserId, constants_1.SOCKET_EVENTS.MMO_PLAYER_UPDATE, { player: me });
            mmoPlayerUpdateEmitCount += 1;
            otherPrevVisible.add(userId);
            world_state_store_1.worldStateStore.setUserVisiblePlayers(otherUserId, otherPrevVisible);
            continue;
        }
        if (prevVisible.has(otherUserId)) {
            emitToUser(io, userId, constants_1.SOCKET_EVENTS.MMO_PLAYER_LEAVE, { userId: otherUserId, zone: me.zone, zoneKey: me.zoneKey });
        }
        const otherPrevVisible = userVisiblePlayers.get(otherUserId);
        if (otherPrevVisible && otherPrevVisible.has(userId)) {
            emitToUser(io, otherUserId, constants_1.SOCKET_EVENTS.MMO_PLAYER_LEAVE, { userId, zone: me.zone, zoneKey: me.zoneKey });
            otherPrevVisible.delete(userId);
            world_state_store_1.worldStateStore.setUserVisiblePlayers(otherUserId, otherPrevVisible);
        }
    }
    world_state_store_1.worldStateStore.setUserVisiblePlayers(userId, nextVisible);
}
function clearPlayerVisibilityForUser(io, userId) {
    const me = buildWorldPlayerPayload(userId);
    const zone = me?.zone || userZones.get(userId) || 'shadowland';
    const zoneKey = me?.zoneKey || userZoneChannels.get(userId) || `${zone}#1`;
    const visible = userVisiblePlayers.get(userId) || new Set();
    for (const otherUserId of visible) {
        emitToUser(io, otherUserId, constants_1.SOCKET_EVENTS.MMO_PLAYER_LEAVE, { userId, zone, zoneKey });
        const otherVisible = userVisiblePlayers.get(otherUserId);
        if (otherVisible && otherVisible.has(userId)) {
            otherVisible.delete(userId);
            world_state_store_1.worldStateStore.setUserVisiblePlayers(otherUserId, otherVisible);
        }
    }
    world_state_store_1.worldStateStore.setUserVisiblePlayers(userId, new Set());
}
function emitZoneMonsterDelta(io, zone) {
    const currentRuntime = monster_service_1.default.getZoneRuntime(zone);
    const previousState = zoneMonsterBroadcastState.get(zone) || new Map();
    const nextState = new Map();
    const changedMonsterIds = new Set();
    const currentById = new Map();
    for (const monster of currentRuntime) {
        const spawnUid = monster.spawn_uid;
        const status = String(monster.status || 'alive');
        const nextRespawnAt = monster.next_respawn_at ?? null;
        const prev = previousState.get(spawnUid);
        currentById.set(spawnUid, monster);
        nextState.set(spawnUid, {
            x: monster.x,
            y: monster.y,
            status,
            nextRespawnAt
        });
        const changed = !prev ||
            prev.status !== status ||
            Math.abs(prev.x - monster.x) >= 2 ||
            Math.abs(prev.y - monster.y) >= 2 ||
            (prev.nextRespawnAt || 0) !== (nextRespawnAt || 0);
        if (changed) {
            changedMonsterIds.add(spawnUid);
        }
    }
    // Removed spawns should also be tracked as changed.
    for (const [spawnUid] of previousState.entries()) {
        if (!nextState.has(spawnUid)) {
            changedMonsterIds.add(spawnUid);
        }
    }
    // AOI dispatch per player.
    for (const userId of getUsersInZone(zone)) {
        const pos = userWorldPosition.get(userId);
        if (!pos || pos.zone !== zone)
            continue;
        const prevVisible = userVisibleMonsters.get(userId) || new Set();
        const nextVisible = new Set();
        for (const monster of currentRuntime) {
            if (monster.status !== 'alive')
                continue;
            if (isMonsterInAoi(pos.x, pos.y, monster.x, monster.y)) {
                nextVisible.add(monster.spawn_uid);
            }
        }
        // Spawn/enter AOI or changed while visible.
        for (const spawnUid of nextVisible) {
            const monster = currentById.get(spawnUid);
            if (!monster)
                continue;
            if (!prevVisible.has(spawnUid) || changedMonsterIds.has(spawnUid)) {
                emitToUser(io, userId, constants_1.SOCKET_EVENTS.MMO_MONSTER_UPDATE, { monster });
            }
        }
        // Leave AOI or became non-alive/removed.
        for (const spawnUid of prevVisible) {
            if (nextVisible.has(spawnUid))
                continue;
            const runtime = currentById.get(spawnUid);
            const respawnAt = runtime?.next_respawn_at ?? 0;
            emitToUser(io, userId, constants_1.SOCKET_EVENTS.MMO_MONSTER_DESPAWN, {
                spawnUid,
                zone,
                respawnAt
            });
        }
        userVisibleMonsters.set(userId, nextVisible);
    }
    zoneMonsterBroadcastState.set(zone, nextState);
}
function getAoiSnapshotForUser(zone, x, y) {
    const monsters = monster_service_1.default.getZoneSnapshot(zone);
    return monsters.filter((monster) => isMonsterInAoi(x, y, monster.x, monster.y));
}
function isMonsterInAoi(playerX, playerY, monsterX, monsterY) {
    const dx = monsterX - playerX;
    const dy = monsterY - playerY;
    return dx * dx + dy * dy <= mmoPerfState.aoiRadiusSq;
}
function isPlayerInAoi(playerX, playerY, targetX, targetY) {
    const dx = targetX - playerX;
    const dy = targetY - playerY;
    return dx * dx + dy * dy <= mmoPerfState.aoiRadiusSq;
}
function getUsersInZone(zone) {
    const users = [];
    for (const [userId, userZone] of userZones.entries()) {
        if (userZone === zone) {
            users.push(userId);
        }
    }
    return users;
}
function normalizeZoneName(rawZone) {
    const safe = String(rawZone || 'shadowland').trim().toLowerCase();
    if (safe.includes('#')) {
        return safe.split('#')[0] || 'shadowland';
    }
    return safe || 'shadowland';
}
function getUsersInZoneChannel(zoneKey) {
    const members = zoneChannelMembers.get(zoneKey);
    if (!members)
        return [];
    return Array.from(members.values());
}
function addUserToZoneChannel(zoneKey, userId) {
    world_state_store_1.worldStateStore.addUserToZoneChannel(zoneKey, userId);
}
function removeUserFromZoneChannel(zoneKey, userId) {
    world_state_store_1.worldStateStore.removeUserFromZoneChannel(zoneKey, userId);
}
function assignZoneChannelForUser(baseZone, userId) {
    const existing = userZoneChannels.get(userId);
    if (existing && existing.startsWith(`${baseZone}#`)) {
        addUserToZoneChannel(existing, userId);
        return existing;
    }
    if (existing) {
        removeUserFromZoneChannel(existing, userId);
    }
    const maxPlayers = Math.max(20, env_1.ENV.MMO_CHANNEL_MAX_PLAYERS);
    const softTarget = Math.max(10, Math.min(env_1.ENV.MMO_CHANNEL_SOFT_TARGET, maxPlayers));
    let selected = `${baseZone}#1`;
    let selectedCount = Number.MAX_SAFE_INTEGER;
    let fallback = '';
    let fallbackCount = Number.MAX_SAFE_INTEGER;
    for (const [zoneKey, members] of zoneChannelMembers.entries()) {
        if (!zoneKey.startsWith(`${baseZone}#`))
            continue;
        const count = members.size;
        if (count < softTarget && count < selectedCount) {
            selected = zoneKey;
            selectedCount = count;
        }
        if (count < maxPlayers && count < fallbackCount) {
            fallback = zoneKey;
            fallbackCount = count;
        }
    }
    if (selectedCount === Number.MAX_SAFE_INTEGER) {
        if (fallback !== '') {
            selected = fallback;
        }
        else {
            let maxIndex = 0;
            for (const zoneKey of zoneChannelMembers.keys()) {
                if (!zoneKey.startsWith(`${baseZone}#`))
                    continue;
                const idx = parseInt(zoneKey.split('#')[1] || '0', 10);
                if (Number.isFinite(idx))
                    maxIndex = Math.max(maxIndex, idx);
            }
            selected = `${baseZone}#${maxIndex + 1}`;
        }
    }
    addUserToZoneChannel(selected, userId);
    return selected;
}
function getChannelHealthSnapshot() {
    const snapshot = [];
    for (const [zoneKey, members] of zoneChannelMembers.entries()) {
        const zone = normalizeZoneName(zoneKey);
        let visibleTotal = 0;
        for (const userId of members.values()) {
            visibleTotal += (userVisiblePlayers.get(userId) || new Set()).size;
        }
        const avgVisiblePlayers = members.size > 0 ? visibleTotal / members.size : 0;
        snapshot.push({
            zoneKey,
            zone,
            players: members.size,
            avgVisiblePlayers: Number(avgVisiblePlayers.toFixed(2)),
            ownerHere: shard_authority_service_1.shardAuthorityService.isOwner(`zoneKey:${zoneKey}`)
        });
    }
    snapshot.sort((a, b) => a.zoneKey.localeCompare(b.zoneKey));
    return snapshot;
}
function logChannelHealthMetrics() {
    const channels = getChannelHealthSnapshot();
    if (channels.length === 0) {
        return;
    }
    const intervalMs = Math.max(5000, env_1.ENV.MMO_CHANNEL_METRICS_INTERVAL_MS);
    const updatesPerSecond = Number(((mmoPlayerUpdateEmitCount * 1000) / intervalMs).toFixed(2));
    mmoPlayerUpdateEmitCount = 0;
    console.log('[MMO] Channel health', {
        channels,
        updatesPerSecond
    });
}
function emitMonsterDespawnToAoiViewers(io, zone, spawnUid, respawnAt) {
    for (const userId of getUsersInZone(zone)) {
        const visible = userVisibleMonsters.get(userId);
        if (!visible || !visible.has(spawnUid))
            continue;
        emitToUser(io, userId, constants_1.SOCKET_EVENTS.MMO_MONSTER_DESPAWN, {
            spawnUid,
            zone,
            respawnAt
        });
        visible.delete(spawnUid);
    }
}
function emitMonsterUpdateToAoiNearby(io, zone, monster) {
    for (const userId of getUsersInZone(zone)) {
        const pos = userWorldPosition.get(userId);
        if (!pos || pos.zone !== zone)
            continue;
        if (!isMonsterInAoi(pos.x, pos.y, monster.x, monster.y))
            continue;
        emitToUser(io, userId, constants_1.SOCKET_EVENTS.MMO_MONSTER_UPDATE, { monster });
        const visible = userVisibleMonsters.get(userId) || new Set();
        visible.add(monster.spawn_uid);
        userVisibleMonsters.set(userId, visible);
    }
}
function isValidPerfPreset(value) {
    return value === 'mobile' || value === 'balanced' || value === 'high';
}
function applyMmoPerfPreset(preset) {
    const values = MMO_PERF_PRESETS[preset];
    const aoiRadius = Math.max(200, values.aoiRadius);
    mmoPerfState = {
        preset,
        aoiRadius,
        aoiRadiusSq: aoiRadius * aoiRadius,
        deltaIntervalMs: Math.max(250, values.deltaIntervalMs),
        resyncIntervalMs: Math.max(3000, values.resyncIntervalMs)
    };
}
function restartMmoBroadcastLoops(io) {
    if (mmoDeltaTimer) {
        clearInterval(mmoDeltaTimer);
        mmoDeltaTimer = null;
    }
    if (mmoResyncTimer) {
        clearInterval(mmoResyncTimer);
        mmoResyncTimer = null;
    }
    if (mmoChannelMetricsTimer) {
        clearInterval(mmoChannelMetricsTimer);
        mmoChannelMetricsTimer = null;
    }
    mmoDeltaTimer = setInterval(() => {
        void (async () => {
            const zones = new Set(Array.from(userZones.values()));
            for (const zone of zones.values()) {
                const canProcess = await shard_authority_service_1.shardAuthorityService.tryClaimOrRenew(`monster:${zone}`);
                if (!canProcess)
                    continue;
                emitZoneMonsterDelta(io, zone);
            }
        })();
    }, mmoPerfState.deltaIntervalMs);
    mmoResyncTimer = setInterval(() => {
        void (async () => {
            const zoneKeys = Array.from(zoneChannelMembers.keys());
            for (const zoneKey of zoneKeys) {
                const canProcess = await shard_authority_service_1.shardAuthorityService.tryClaimOrRenew(`zoneKey:${zoneKey}`);
                if (!canProcess)
                    continue;
                const baseZone = normalizeZoneName(zoneKey);
                for (const userId of getUsersInZoneChannel(zoneKey)) {
                    const pos = userWorldPosition.get(userId);
                    if (!pos || pos.zone !== baseZone)
                        continue;
                    const monsters = getAoiSnapshotForUser(baseZone, pos.x, pos.y);
                    emitToUser(io, userId, constants_1.SOCKET_EVENTS.MMO_MONSTERS_SNAPSHOT, { zone: baseZone, monsters });
                    const players = getZonePlayersSnapshot(zoneKey, pos.x, pos.y, userId);
                    emitToUser(io, userId, constants_1.SOCKET_EVENTS.MMO_PLAYERS_SNAPSHOT, { zone: baseZone, zoneKey, players });
                    userVisibleMonsters.set(userId, new Set(monsters.map((monster) => monster.spawn_uid)));
                }
            }
        })();
    }, mmoPerfState.resyncIntervalMs);
    mmoChannelMetricsTimer = setInterval(() => {
        logChannelHealthMetrics();
    }, Math.max(5000, env_1.ENV.MMO_CHANNEL_METRICS_INTERVAL_MS));
}
function restartPvpPhaseWatchdog(io) {
    if (pvpPhaseWatchdogTimer) {
        clearInterval(pvpPhaseWatchdogTimer);
        pvpPhaseWatchdogTimer = null;
    }
    pvpPhaseWatchdogTimer = setInterval(() => {
        void (async () => {
            try {
                const updates = await match_manager_1.default.autoAdvanceExpiredPhases(PVP_PHASE_TIMEOUT_MS);
                for (const update of updates) {
                    const { player1Username, player2Username, player1AvatarId, player2AvatarId } = await resolveMatchIdentity(update.match);
                    emitToUser(io, update.match.player1Id, constants_1.SOCKET_EVENTS.GAME_UPDATE, {
                        matchId: update.matchId,
                        localPlayerRole: 'player1',
                        player1Id: Number(update.match.player1Id),
                        player2Id: Number(update.match.player2Id),
                        player1Username,
                        player2Username,
                        player1AvatarId,
                        player2AvatarId,
                        state: update.state
                    });
                    emitToUser(io, update.match.player2Id, constants_1.SOCKET_EVENTS.GAME_UPDATE, {
                        matchId: update.matchId,
                        localPlayerRole: 'player2',
                        player1Id: Number(update.match.player1Id),
                        player2Id: Number(update.match.player2Id),
                        player1Username,
                        player2Username,
                        player1AvatarId,
                        player2AvatarId,
                        state: update.state
                    });
                    maybeRunAiTurn(io, update.matchId).catch((error) => {
                        console.warn('[AI] Failed to run AI turn loop after timeout auto-advance:', error);
                    });
                    const winnerRaw = update.state?.winner;
                    if (winnerRaw != null && winnerRaw !== '') {
                        let winnerId = Number(winnerRaw);
                        if (!Number.isFinite(winnerId) || winnerId <= 0) {
                            const winnerRole = String(winnerRaw).toLowerCase();
                            if (winnerRole === 'player1')
                                winnerId = Number(update.match.player1Id);
                            else if (winnerRole === 'player2' || winnerRole === 'ai')
                                winnerId = Number(update.match.player2Id);
                        }
                        if (Number.isFinite(winnerId) && winnerId > 0) {
                            await finalizeMatchAndBroadcast(io, { matchId: update.matchId, winnerId }, winnerId);
                        }
                    }
                }
            }
            catch (error) {
                console.warn('[PVP] Phase watchdog failed:', error);
            }
        })();
    }, PVP_PHASE_WATCHDOG_INTERVAL_MS);
}
async function maybeRunAiTurn(io, matchId) {
    const match = match_manager_1.default.getMatch(matchId);
    if (!match || match.matchType !== 'ai' || match.ended)
        return;
    const state = match_manager_1.default.getMatchState(matchId);
    if (!state || state.winner || state.currentPlayer !== 'player2')
        return;
    if (aiTurnLocks.has(matchId))
        return;
    aiTurnLocks.add(matchId);
    try {
        for (let step = 0; step < 12; step++) {
            const currentMatch = match_manager_1.default.getMatch(matchId);
            if (!currentMatch || currentMatch.ended || currentMatch.matchType !== 'ai')
                break;
            const currentState = match_manager_1.default.getMatchState(matchId);
            if (!currentState || currentState.winner || currentState.currentPlayer !== 'player2')
                break;
            const aiPlayer = currentState.players?.player2;
            const humanPlayer = currentState.players?.player1;
            if (!aiPlayer || !humanPlayer)
                break;
            let action = null;
            const phase = String(currentState.currentPhase || '').toLowerCase();
            if (phase === 'strategy') {
                action = chooseAiStrategyAction(aiPlayer, humanPlayer);
                if (!action) {
                    action = { type: 'endTurn' };
                }
            }
            else if (phase === 'combat') {
                action = chooseAiCombatAction(aiPlayer, humanPlayer);
                if (!action) {
                    action = { type: 'endTurn' };
                }
            }
            else {
                action = { type: 'endTurn' };
            }
            const result = await match_manager_1.default.processAction(matchId, currentMatch.player2Id, action);
            if (!result.success) {
                console.warn('[AI] Action failed, trying fallback endTurn:', {
                    matchId,
                    actionType: action?.type,
                    reason: result.error
                });
                const fallback = await match_manager_1.default.processAction(matchId, currentMatch.player2Id, { type: 'endTurn' });
                if (!fallback.success)
                    break;
                const { player1Username, player2Username, player1AvatarId, player2AvatarId } = await resolveMatchIdentity(currentMatch);
                emitToUser(io, currentMatch.player1Id, constants_1.SOCKET_EVENTS.GAME_UPDATE, {
                    matchId,
                    localPlayerRole: 'player1',
                    player1Id: Number(currentMatch.player1Id),
                    player2Id: Number(currentMatch.player2Id),
                    player1Username,
                    player2Username,
                    player1AvatarId,
                    player2AvatarId,
                    state: fallback.state
                });
                emitToUser(io, currentMatch.player2Id, constants_1.SOCKET_EVENTS.GAME_UPDATE, {
                    matchId,
                    localPlayerRole: 'player2',
                    player1Id: Number(currentMatch.player1Id),
                    player2Id: Number(currentMatch.player2Id),
                    player1Username,
                    player2Username,
                    player1AvatarId,
                    player2AvatarId,
                    state: fallback.state
                });
            }
            else {
                const { player1Username, player2Username, player1AvatarId, player2AvatarId } = await resolveMatchIdentity(currentMatch);
                emitToUser(io, currentMatch.player1Id, constants_1.SOCKET_EVENTS.GAME_UPDATE, {
                    matchId,
                    localPlayerRole: 'player1',
                    player1Id: Number(currentMatch.player1Id),
                    player2Id: Number(currentMatch.player2Id),
                    player1Username,
                    player2Username,
                    player1AvatarId,
                    player2AvatarId,
                    state: result.state
                });
                emitToUser(io, currentMatch.player2Id, constants_1.SOCKET_EVENTS.GAME_UPDATE, {
                    matchId,
                    localPlayerRole: 'player2',
                    player1Id: Number(currentMatch.player1Id),
                    player2Id: Number(currentMatch.player2Id),
                    player1Username,
                    player2Username,
                    player1AvatarId,
                    player2AvatarId,
                    state: result.state
                });
            }
            await sleep(420);
        }
    }
    finally {
        aiTurnLocks.delete(matchId);
    }
}
function chooseAiStrategyAction(aiPlayer, humanPlayer) {
    const hand = Array.isArray(aiPlayer?.hand) ? aiPlayer.hand : [];
    if (hand.length === 0)
        return null;
    const resources = Number(aiPlayer?.warResources || 0);
    const affordable = hand.filter((card) => Number(card?.cost || 0) <= resources);
    if (affordable.length === 0)
        return null;
    // Priority close to local Play VS AI behavior: develop board first.
    const byPriority = [...affordable].sort((a, b) => {
        const pa = aiCardPriority(a);
        const pb = aiCardPriority(b);
        if (pa !== pb)
            return pa - pb;
        return Number(a?.cost || 0) - Number(b?.cost || 0);
    });
    const aiField = Array.isArray(aiPlayer?.field) ? aiPlayer.field : [];
    const enemyField = Array.isArray(humanPlayer?.field) ? humanPlayer.field : [];
    for (const chosen of byPriority) {
        const type = String(chosen?.type || '').toUpperCase();
        const targetMode = resolveAiSingleTargetMode(chosen);
        if (type === 'MOUNT') {
            return {
                type: 'playCard',
                cardInstanceId: String(chosen.instanceId || ''),
                options: { asDefender: true }
            };
        }
        if (type === 'EQUIPMENT') {
            if (aiField.length > 0) {
                return {
                    type: 'playCard',
                    cardInstanceId: String(chosen.instanceId || ''),
                    options: { targetId: String(aiField[0]?.instanceId || '') }
                };
            }
            continue;
        }
        if ((type === 'ABILITY' || type === 'CONSUMABLE') && targetMode === 'SINGLE_ALLY') {
            if (aiField.length === 0) {
                continue;
            }
            return {
                type: 'playCard',
                cardInstanceId: String(chosen.instanceId || ''),
                options: { targetId: String(aiField[0]?.instanceId || '') }
            };
        }
        if ((type === 'ABILITY' || type === 'CONSUMABLE') && targetMode === 'SINGLE_ENEMY') {
            if (enemyField.length === 0) {
                continue;
            }
            return {
                type: 'playCard',
                cardInstanceId: String(chosen.instanceId || ''),
                options: { targetId: String(enemyField[0]?.instanceId || '') }
            };
        }
        return {
            type: 'playCard',
            cardInstanceId: String(chosen.instanceId || ''),
            options: {}
        };
    }
    return null;
}
function resolveAiSingleTargetMode(card) {
    const effects = [];
    if (Array.isArray(card?.effects)) {
        effects.push(...card.effects);
    }
    else if (card?.effect) {
        effects.push(card.effect);
    }
    for (const effect of effects) {
        const target = String(effect?.target || '').toUpperCase();
        if (target === 'SINGLE_ALLY' || target === 'SINGLE_ENEMY') {
            return target;
        }
    }
    return '';
}
function chooseAiCombatAction(aiPlayer, humanPlayer) {
    const aiField = Array.isArray(aiPlayer?.field) ? aiPlayer.field : [];
    const attacker = aiField.find((card) => !card?.hasAttacked &&
        !card?.isSummoned &&
        Number(card?.currentAttack || 0) > 0);
    if (!attacker)
        return null;
    const enemyField = Array.isArray(humanPlayer?.field) ? humanPlayer.field : [];
    const taunts = enemyField.filter((card) => Array.isArray(card?.hasAbilities) &&
        card.hasAbilities.some((ability) => String(ability || '').toLowerCase() === 'taunt'));
    const target = taunts.length > 0 ? taunts[0] : (enemyField[0] || null);
    return {
        type: 'attack',
        attackerId: String(attacker.instanceId || ''),
        targetId: target ? String(target.instanceId || '') : 'general'
    };
}
function aiCardPriority(card) {
    const type = String(card?.type || '').toUpperCase();
    if (type === 'DEFENDER')
        return 1;
    if (type === 'MOUNT')
        return 2;
    if (type === 'CONSUMABLE')
        return 3;
    if (type === 'ABILITY')
        return 4;
    if (type === 'EQUIPMENT')
        return 5;
    return 9;
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function notifyFriendPresence(io, userId, username, online) {
    const friendIds = await friends_repository_1.default.getAcceptedFriendIds(userId);
    for (const friendId of friendIds) {
        const targetSockets = getUserSocketIds(friendId);
        if (targetSockets.length === 0)
            continue;
        for (const sid of targetSockets) {
            io.to(sid).emit(online ? constants_1.SOCKET_EVENTS.FRIEND_ONLINE : constants_1.SOCKET_EVENTS.FRIEND_OFFLINE, { userId, username });
        }
        io.to(targetSockets[0]).emit(constants_1.SOCKET_EVENTS.FRIEND_UPDATE, {
            type: online ? 'presence_online' : 'presence_offline',
            data: { userId, username },
            timestamp: Date.now()
        });
    }
}
async function notifyScopedChatPresence(io, userId, username, joined) {
    const friendIds = await friends_repository_1.default.getAcceptedFriendIds(userId);
    if (friendIds.length === 0)
        return;
    const payload = {
        userId,
        username,
        timestamp: Date.now()
    };
    for (const friendId of friendIds) {
        const sockets = getUserSocketIds(friendId);
        for (const sid of sockets) {
            io.to(sid).emit(joined ? constants_1.SOCKET_EVENTS.CHAT_USER_JOINED : constants_1.SOCKET_EVENTS.CHAT_USER_LEFT, payload);
        }
    }
}
// Handle match found
async function handleMatchFound(io, match, matchType) {
    console.log(`[Matchmaking] Match found: ${match.player1.userId} vs ${match.player2.userId}`);
    // Create match
    const matchId = await match_manager_1.default.createMatch(match.player1.userId, match.player2.userId, match.player1.deckId, match.player2.deckId, matchType);
    // Get user data with profiles
    const [player1User, player2User] = await Promise.all([
        user_repository_1.default.getUserById(match.player1.userId),
        user_repository_1.default.getUserById(match.player2.userId)
    ]);
    const rankService = (await Promise.resolve().then(() => __importStar(require('../modules/users/rank.service')))).default;
    const p1Profile = player1User ? rankService.buildProfile(player1User) : null;
    const p2Profile = player2User ? rankService.buildProfile(player2User) : null;
    // Notify player 1
    emitToUser(io, match.player1.userId, constants_1.SOCKET_EVENTS.MATCHMAKING_FOUND, {
        matchId,
        opponent: {
            userId: match.player2.userId,
            username: player2User?.username || 'Unknown',
            level: p2Profile?.level ?? 1,
            rank_info: p2Profile?.rank_info ?? null
        },
        matchType
    });
    // Notify player 2
    emitToUser(io, match.player2.userId, constants_1.SOCKET_EVENTS.MATCHMAKING_FOUND, {
        matchId,
        opponent: {
            userId: match.player1.userId,
            username: player1User?.username || 'Unknown',
            level: p1Profile?.level ?? 1,
            rank_info: p1Profile?.rank_info ?? null
        },
        matchType
    });
}
//# sourceMappingURL=socket.js.map