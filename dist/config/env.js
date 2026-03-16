"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENV = void 0;
exports.isDevelopment = isDevelopment;
exports.isProduction = isProduction;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const jwtSecret = (process.env.JWT_SECRET || '').trim();
if (!jwtSecret) {
    throw new Error('JWT_SECRET is required. Refusing to start with insecure default.');
}
function parseCorsOrigins() {
    const raw = (process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:5173').trim();
    return raw
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v.length > 0);
}
exports.ENV = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: parseInt(process.env.PORT || '3000', 10),
    // Database
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_PATH: process.env.DATABASE_PATH || './database.sqlite',
    // JWT
    JWT_SECRET: jwtSecret,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '30d',
    // Admin
    ADMIN_USERNAME: process.env.ADMIN_USERNAME || 'admin',
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'admin123',
    // Server
    CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:5173',
    CORS_ORIGINS: parseCorsOrigins(),
    // Game
    ENABLE_AI: process.env.ENABLE_AI !== 'false',
    // Chat
    CHAT_MAX_MESSAGE_LENGTH: parseInt(process.env.CHAT_MAX_MESSAGE_LENGTH || '500', 10),
    CHAT_BATCH_SIZE: parseInt(process.env.CHAT_BATCH_SIZE || '10', 10),
    CHAT_BATCH_DELAY_MS: parseInt(process.env.CHAT_BATCH_DELAY_MS || '500', 10),
    CHAT_HISTORY_LIMIT: parseInt(process.env.CHAT_HISTORY_LIMIT || '100', 10),
    CHAT_HISTORY_CACHE_TTL_MS: parseInt(process.env.CHAT_HISTORY_CACHE_TTL_MS || '10000', 10),
    CHAT_RATE_LIMIT_WINDOW_MS: parseInt(process.env.CHAT_RATE_LIMIT_WINDOW_MS || '10000', 10),
    CHAT_RATE_LIMIT_MAX_MESSAGES: parseInt(process.env.CHAT_RATE_LIMIT_MAX_MESSAGES || '15', 10),
    CHAT_CHANNEL_RATE_LIMIT_WINDOW_MS: parseInt(process.env.CHAT_CHANNEL_RATE_LIMIT_WINDOW_MS || '10000', 10),
    CHAT_CHANNEL_RATE_LIMIT_MAX_MESSAGES: parseInt(process.env.CHAT_CHANNEL_RATE_LIMIT_MAX_MESSAGES || '8', 10),
    CHAT_HOT_CHANNEL_WINDOW_MS: parseInt(process.env.CHAT_HOT_CHANNEL_WINDOW_MS || '1000', 10),
    CHAT_HOT_CHANNEL_MAX_MESSAGES: parseInt(process.env.CHAT_HOT_CHANNEL_MAX_MESSAGES || '250', 10),
    CHAT_WARMUP_WINDOW_MS: parseInt(process.env.CHAT_WARMUP_WINDOW_MS || '5000', 10),
    CHAT_WARMUP_MAX_MESSAGES: parseInt(process.env.CHAT_WARMUP_MAX_MESSAGES || '3', 10),
    CHAT_PERSIST_CHUNK_SIZE: parseInt(process.env.CHAT_PERSIST_CHUNK_SIZE || '100', 10),
    CHAT_KEEP_PUBLIC_MESSAGES: parseInt(process.env.CHAT_KEEP_PUBLIC_MESSAGES || '100', 10),
    CHAT_KEEP_WHISPER_MESSAGES: parseInt(process.env.CHAT_KEEP_WHISPER_MESSAGES || '300', 10),
    CHAT_CLEANUP_MAX_DELETE_PER_RUN: parseInt(process.env.CHAT_CLEANUP_MAX_DELETE_PER_RUN || '5000', 10),
    CHAT_ALERT_QUEUE_DEPTH: parseInt(process.env.CHAT_ALERT_QUEUE_DEPTH || '500', 10),
    // MMO AOI / monster replication
    MMO_AOI_RADIUS: parseInt(process.env.MMO_AOI_RADIUS || '1200', 10),
    MMO_MONSTER_DELTA_INTERVAL_MS: parseInt(process.env.MMO_MONSTER_DELTA_INTERVAL_MS || '1000', 10),
    MMO_MONSTER_RESYNC_INTERVAL_MS: parseInt(process.env.MMO_MONSTER_RESYNC_INTERVAL_MS || '15000', 10),
    MMO_CHANNEL_MAX_PLAYERS: parseInt(process.env.MMO_CHANNEL_MAX_PLAYERS || '150', 10),
    MMO_CHANNEL_SOFT_TARGET: parseInt(process.env.MMO_CHANNEL_SOFT_TARGET || '120', 10),
    MMO_CHANNEL_METRICS_INTERVAL_MS: parseInt(process.env.MMO_CHANNEL_METRICS_INTERVAL_MS || '15000', 10),
    MMO_DISTRIBUTED_STATE_ENABLED: process.env.MMO_DISTRIBUTED_STATE_ENABLED === 'true',
    MMO_SHARD_AUTHORITY_ENABLED: process.env.MMO_SHARD_AUTHORITY_ENABLED === 'true',
    MM_MATCHMAKING_REDIS_ENABLED: process.env.MM_MATCHMAKING_REDIS_ENABLED === 'true',
    REDIS_URL: (process.env.REDIS_URL || '').trim(),
    REDIS_KEY_PREFIX: process.env.REDIS_KEY_PREFIX || 'kardum',
    INSTANCE_ID: (process.env.INSTANCE_ID || '').trim() ||
        `${process.pid}-${Math.random().toString(36).slice(2, 8)}`,
    SHARD_LOCK_TTL_MS: parseInt(process.env.SHARD_LOCK_TTL_MS || '12000', 10),
    // Logging
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    PVP_IDENTITY_DEBUG: process.env.PVP_IDENTITY_DEBUG === 'true'
};
function isDevelopment() {
    return exports.ENV.NODE_ENV === 'development';
}
function isProduction() {
    return exports.ENV.NODE_ENV === 'production';
}
//# sourceMappingURL=env.js.map