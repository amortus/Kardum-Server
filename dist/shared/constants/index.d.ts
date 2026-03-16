import { PlayerRank } from '../types';
export declare const LEVEL_BASE_EXP = 100;
export declare const LEVEL_EXP_INCREMENT = 50;
export declare const MAX_LEVEL = 100;
export declare const EXP_REWARDS: {
    readonly casual: {
        readonly win: 80;
        readonly loss: 30;
    };
    readonly ranked: {
        readonly win: 120;
        readonly loss: 50;
    };
    readonly ai: {
        readonly win: 40;
        readonly loss: 15;
    };
};
export declare const RANK_TIERS: readonly [{
    readonly tier: PlayerRank.GRANDMASTER;
    readonly min_elo: 2000;
    readonly max_elo: null;
    readonly divisions: null;
}, {
    readonly tier: PlayerRank.DIAMOND;
    readonly min_elo: 1800;
    readonly max_elo: 1999;
    readonly divisions: readonly ["IV", "III", "II", "I"];
}, {
    readonly tier: PlayerRank.PLATINUM;
    readonly min_elo: 1600;
    readonly max_elo: 1799;
    readonly divisions: readonly ["IV", "III", "II", "I"];
}, {
    readonly tier: PlayerRank.GOLD;
    readonly min_elo: 1400;
    readonly max_elo: 1599;
    readonly divisions: readonly ["IV", "III", "II", "I"];
}, {
    readonly tier: PlayerRank.SILVER;
    readonly min_elo: 1200;
    readonly max_elo: 1399;
    readonly divisions: readonly ["IV", "III", "II", "I"];
}, {
    readonly tier: PlayerRank.BRONZE;
    readonly min_elo: 1000;
    readonly max_elo: 1199;
    readonly divisions: readonly ["IV", "III", "II", "I"];
}, {
    readonly tier: PlayerRank.UNRANKED;
    readonly min_elo: 0;
    readonly max_elo: 999;
    readonly divisions: null;
}];
export declare const GAME_CONSTANTS: {
    INITIAL_WAR_RESOURCES: number;
    MAX_WAR_RESOURCES: number;
    WAR_RESOURCES_PER_TURN: number;
    MIN_DECK_SIZE: number;
    MAX_DECK_SIZE: number;
    INITIAL_HAND_SIZE: number;
    CARDS_DRAWN_PER_TURN: number;
    PLAYER_INITIAL_HEALTH: number;
    EMPTY_DECK_DAMAGE: number;
    MAX_ABILITIES_PER_TURN: number;
    MAX_MOUNTS_PER_TURN: number;
    MATCHMAKING_TIMEOUT_MS: number;
    ELO_RANGE_CASUAL: number;
    ELO_RANGE_RANKED: number;
    DEFAULT_ELO: number;
    MATCH_CLEANUP_TIME_MS: number;
    MATCH_RECOVERY_TIME_MS: number;
    JWT_EXPIRES_IN: string;
    BCRYPT_ROUNDS: number;
};
export declare const SOCKET_EVENTS: {
    CONNECT: string;
    DISCONNECT: string;
    QUEUE_JOIN: string;
    QUEUE_LEAVE: string;
    MATCHMAKING_JOINED: string;
    MATCHMAKING_LEFT: string;
    MATCHMAKING_FOUND: string;
    MATCH_READY: string;
    MATCH_START: string;
    MATCH_ACTION: string;
    MATCH_ACTION_CONFIRMED: string;
    MATCH_SYNC: string;
    MATCH_STATE: string;
    MATCH_END: string;
    GAME_START: string;
    GAME_STATE: string;
    GAME_ACTION: string;
    GAME_UPDATE: string;
    GAME_END: string;
    GAME_ERROR: string;
    AI_START: string;
    AI_ACTION: string;
    MMO_ZONE_JOIN: string;
    MMO_PLAYERS_SNAPSHOT: string;
    MMO_PLAYER_UPDATE: string;
    MMO_PLAYER_LEAVE: string;
    MMO_MONSTERS_SNAPSHOT: string;
    MMO_NPCS_SNAPSHOT: string;
    MMO_MONSTER_UPDATE: string;
    MMO_MONSTER_DESPAWN: string;
    MMO_MONSTER_ENGAGE: string;
    MMO_ENCOUNTER_START: string;
    MMO_COMMAND_SPAWN: string;
    MMO_PLAYER_POSITION: string;
    MMO_COMMAND_PERF: string;
    MMO_COMMAND_CHANNELS: string;
    MMO_COMMAND_RESULT: string;
    MMO_COMMANDS_GET: string;
    MMO_COMMANDS_LIST: string;
    MMO_DROP_RESULT: string;
    QUESTS_SNAPSHOT: string;
    QUESTS_UPDATE: string;
    QUESTS_ACCEPT: string;
    QUESTS_ABANDON: string;
    QUESTS_TRACK: string;
    QUESTS_TURNIN: string;
    QUESTS_SYNC: string;
    QUESTS_NPC_TALK: string;
    CHAT_ZONE_SEND: string;
    CHAT_ZONE_MESSAGE: string;
    CHAT_JOIN: string;
    CHAT_HISTORY: string;
    CHAT_MESSAGE: string;
    CHAT_WHISPER: string;
    CHAT_ERROR: string;
    CHAT_USER_JOINED: string;
    CHAT_USER_LEFT: string;
    FRIEND_UPDATE: string;
    FRIEND_ONLINE: string;
    FRIEND_OFFLINE: string;
    PVP_ERROR: string;
    ERROR: string;
};
export declare const API_ROUTES: {
    AUTH_LOGIN: string;
    AUTH_REGISTER: string;
    AUTH_REFRESH: string;
    CARDS_LIST: string;
    CARDS_GET: string;
    CARDS_CREATE: string;
    CARDS_UPDATE: string;
    CARDS_DELETE: string;
    DECKS_LIST: string;
    DECKS_GET: string;
    DECKS_CREATE: string;
    DECKS_UPDATE: string;
    DECKS_DELETE: string;
    USERS_ME: string;
    USERS_STATS: string;
    FRIENDS_LIST: string;
    FRIENDS_ONLINE: string;
};
//# sourceMappingURL=index.d.ts.map