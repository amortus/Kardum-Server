// Constantes do jogo Kardum

import { PlayerRank } from '../types';

export const LEVEL_BASE_EXP = 100;
export const LEVEL_EXP_INCREMENT = 50;
export const MAX_LEVEL = 100;

export const EXP_REWARDS = {
  casual: { win: 80, loss: 30 },
  ranked: { win: 120, loss: 50 },
  ai:     { win: 40,  loss: 15 }
} as const;

export const RANK_TIERS = [
  { tier: PlayerRank.GRANDMASTER, min_elo: 2000, max_elo: null,  divisions: null },
  { tier: PlayerRank.DIAMOND,     min_elo: 1800, max_elo: 1999,  divisions: ['IV', 'III', 'II', 'I'] },
  { tier: PlayerRank.PLATINUM,    min_elo: 1600, max_elo: 1799,  divisions: ['IV', 'III', 'II', 'I'] },
  { tier: PlayerRank.GOLD,        min_elo: 1400, max_elo: 1599,  divisions: ['IV', 'III', 'II', 'I'] },
  { tier: PlayerRank.SILVER,      min_elo: 1200, max_elo: 1399,  divisions: ['IV', 'III', 'II', 'I'] },
  { tier: PlayerRank.BRONZE,      min_elo: 1000, max_elo: 1199,  divisions: ['IV', 'III', 'II', 'I'] },
  { tier: PlayerRank.UNRANKED,    min_elo: 0,    max_elo: 999,   divisions: null }
] as const;

export const GAME_CONSTANTS = {
  // Recursos de Guerra
  INITIAL_WAR_RESOURCES: 1,
  MAX_WAR_RESOURCES: 10,
  WAR_RESOURCES_PER_TURN: 1,
  
  // Deck
  MIN_DECK_SIZE: 30,
  MAX_DECK_SIZE: 40,
  INITIAL_HAND_SIZE: 5,
  CARDS_DRAWN_PER_TURN: 1,
  
  // Player combat profile
  PLAYER_INITIAL_HEALTH: 30,
  
  // Penalidades
  EMPTY_DECK_DAMAGE: 2,
  
  // Limites por turno
  MAX_ABILITIES_PER_TURN: 1,
  MAX_MOUNTS_PER_TURN: 1,
  
  // Matchmaking
  MATCHMAKING_TIMEOUT_MS: 5 * 60 * 1000, // 5 minutos
  ELO_RANGE_CASUAL: 500,
  ELO_RANGE_RANKED: 200,
  DEFAULT_ELO: 1000,
  
  // Match
  MATCH_CLEANUP_TIME_MS: 30 * 60 * 1000, // 30 minutos
  MATCH_RECOVERY_TIME_MS: 5 * 60 * 1000, // 5 minutos
  
  // Server
  JWT_EXPIRES_IN: '7d',
  BCRYPT_ROUNDS: 10
};

export const SOCKET_EVENTS = {
  // Connection
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  
  // Matchmaking
  QUEUE_JOIN: 'queue:join',
  QUEUE_LEAVE: 'queue:leave',
  MATCHMAKING_JOINED: 'pvp:matchmaking:joined',
  MATCHMAKING_LEFT: 'pvp:matchmaking:left',
  MATCHMAKING_FOUND: 'pvp:matchmaking:found',
  
  // Match
  MATCH_READY: 'pvp:match:ready',
  MATCH_START: 'pvp:match:start',
  MATCH_ACTION: 'pvp:match:action',
  MATCH_ACTION_CONFIRMED: 'pvp:match:action:confirmed',
  MATCH_SYNC: 'pvp:match:sync',
  MATCH_STATE: 'pvp:match:state',
  MATCH_END: 'pvp:match:end',
  
  // Game (novo formato simplificado)
  GAME_START: 'game:start',
  GAME_STATE: 'game:state',
  GAME_ACTION: 'game:action',
  GAME_UPDATE: 'game:update',
  GAME_END: 'game:end',
  GAME_ERROR: 'game:error',
  
  // AI
  AI_START: 'ai:start',
  AI_ACTION: 'ai:action',

  // MMO world/monsters
  MMO_ZONE_JOIN: 'mmo:zone:join',
  MMO_PLAYERS_SNAPSHOT: 'mmo:players:snapshot',
  MMO_PLAYER_UPDATE: 'mmo:player:update',
  MMO_PLAYER_LEAVE: 'mmo:player:leave',
  MMO_MONSTERS_SNAPSHOT: 'mmo:monsters:snapshot',
  MMO_NPCS_SNAPSHOT: 'mmo:npcs:snapshot',
  MMO_MONSTER_UPDATE: 'mmo:monster:update',
  MMO_MONSTER_DESPAWN: 'mmo:monster:despawn',
  MMO_MONSTER_ENGAGE: 'mmo:monster:engage',
  MMO_ENCOUNTER_START: 'mmo:encounter:start',
  MMO_COMMAND_SPAWN: 'mmo:command:spawn',
  MMO_PLAYER_POSITION: 'mmo:player:position',
  MMO_COMMAND_PERF: 'mmo:command:perf',
  MMO_COMMAND_CHANNELS: 'mmo:command:channels',
  MMO_COMMAND_RESULT: 'mmo:command:result',
  MMO_COMMANDS_GET: 'mmo:commands:get',
  MMO_COMMANDS_LIST: 'mmo:commands:list',
  MMO_DROP_RESULT: 'mmo:drop:result',
  QUESTS_SNAPSHOT: 'quests:snapshot',
  QUESTS_UPDATE: 'quests:update',
  QUESTS_ACCEPT: 'quests:accept',
  QUESTS_ABANDON: 'quests:abandon',
  QUESTS_TRACK: 'quests:track',
  QUESTS_TURNIN: 'quests:turnin',
  QUESTS_SYNC: 'quests:sync',
  QUESTS_NPC_TALK: 'quests:npc:talk',

  // Zone chat
  CHAT_ZONE_SEND: 'chat:zone:send',
  CHAT_ZONE_MESSAGE: 'chat:zone:message',
  CHAT_JOIN: 'chat:join',
  CHAT_HISTORY: 'chat:history',
  CHAT_MESSAGE: 'chat:message',
  CHAT_WHISPER: 'chat:whisper',
  CHAT_ERROR: 'chat:error',
  CHAT_USER_JOINED: 'chat:user-joined',
  CHAT_USER_LEFT: 'chat:user-left',
  FRIEND_UPDATE: 'friend:update',
  FRIEND_ONLINE: 'friend:online',
  FRIEND_OFFLINE: 'friend:offline',
  
  // Errors
  PVP_ERROR: 'pvp:error',
  ERROR: 'error'
};

export const API_ROUTES = {
  // Auth
  AUTH_LOGIN: '/api/auth/login',
  AUTH_REGISTER: '/api/auth/register',
  AUTH_REFRESH: '/api/auth/refresh',
  
  // Cards
  CARDS_LIST: '/api/cards',
  CARDS_GET: '/api/cards/:id',
  CARDS_CREATE: '/api/cards',
  CARDS_UPDATE: '/api/cards/:id',
  CARDS_DELETE: '/api/cards/:id',
  
  // Decks
  DECKS_LIST: '/api/decks',
  DECKS_GET: '/api/decks/:id',
  DECKS_CREATE: '/api/decks',
  DECKS_UPDATE: '/api/decks/:id',
  DECKS_DELETE: '/api/decks/:id',
  
  // Users
  USERS_ME: '/api/users/me',
  USERS_STATS: '/api/users/stats',

  // Friends
  FRIENDS_LIST: '/api/friends',
  FRIENDS_ONLINE: '/api/friends/online'
};
