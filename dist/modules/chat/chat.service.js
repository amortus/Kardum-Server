"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const env_1 = require("../../config/env");
const chat_repository_1 = __importDefault(require("./chat.repository"));
const chat_rate_limit_1 = require("./chat.rate-limit");
const VALID_CHANNELS = new Set(['global', 'group', 'trade', 'system', 'zone', 'whisper']);
class ChatService {
    constructor() {
        this.historyCache = new Map();
        this.persistQueues = {
            alert: [],
            normal: [],
            bulk: []
        };
        this.rateLimit = new chat_rate_limit_1.ChatRateLimit(env_1.ENV.CHAT_RATE_LIMIT_WINDOW_MS, env_1.ENV.CHAT_RATE_LIMIT_MAX_MESSAGES);
        this.userChannelBuckets = new Map();
        this.hotChannelBuckets = new Map();
        this.warmupBuckets = new Map();
        this.metrics = {
            messagesIn: 0,
            messagesDropped: 0,
            joinsWithoutHistory: 0
        };
        this.flushTimer = null;
        this.cleanupTimer = null;
        this.metricsTimer = null;
        this.ensureFlushTimer();
    }
    startBackgroundJobs() {
        if (!this.cleanupTimer) {
            this.cleanupTimer = setInterval(() => {
                this.cleanupOldMessages().catch((error) => {
                    console.error('[Chat] cleanup job failed', error);
                });
            }, 60 * 60 * 1000);
        }
        if (!this.metricsTimer) {
            this.metricsTimer = setInterval(() => {
                this.logMetricsSnapshot();
            }, 30 * 1000);
        }
    }
    stopBackgroundJobs() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
        if (this.metricsTimer) {
            clearInterval(this.metricsTimer);
            this.metricsTimer = null;
        }
    }
    ensureFlushTimer() {
        if (this.flushTimer)
            return;
        this.flushTimer = setInterval(() => {
            this.flushPersistQueue().catch((error) => {
                console.error('[Chat] batch flush failed', error);
            });
        }, env_1.ENV.CHAT_BATCH_DELAY_MS);
    }
    isValidChannel(channel) {
        return VALID_CHANNELS.has(channel);
    }
    validateMessageInput(userId, channel, message) {
        const text = message.trim();
        if (!text) {
            return { code: 'empty_message', message: 'Message cannot be empty.' };
        }
        if (text.length > env_1.ENV.CHAT_MAX_MESSAGE_LENGTH) {
            return {
                code: 'message_too_long',
                message: `Max ${env_1.ENV.CHAT_MAX_MESSAGE_LENGTH} chars`
            };
        }
        if (!this.allowWarmupWindow(userId)) {
            return { code: 'warmup_rate_limited', message: 'Please wait a few seconds after connecting.' };
        }
        if (!this.rateLimit.allow(userId)) {
            return { code: 'rate_limited', message: 'You are sending messages too fast.' };
        }
        if (!this.allowPerUserPerChannel(userId, channel)) {
            return { code: 'channel_rate_limited', message: 'You are sending too many messages in this channel.' };
        }
        if (!this.allowHotChannel(channel)) {
            return { code: 'channel_busy', message: 'Channel is busy right now, try again shortly.' };
        }
        return null;
    }
    allowWarmupWindow(userId) {
        const now = Date.now();
        const bucket = this.warmupBuckets.get(userId);
        if (!bucket || now >= bucket.resetAt) {
            this.warmupBuckets.set(userId, {
                count: 1,
                resetAt: now + env_1.ENV.CHAT_WARMUP_WINDOW_MS
            });
            return true;
        }
        if (bucket.count >= env_1.ENV.CHAT_WARMUP_MAX_MESSAGES) {
            return false;
        }
        bucket.count += 1;
        return true;
    }
    allowPerUserPerChannel(userId, channel) {
        const now = Date.now();
        const key = `${userId}:${channel}`;
        const bucket = this.userChannelBuckets.get(key);
        if (!bucket || now >= bucket.resetAt) {
            this.userChannelBuckets.set(key, {
                count: 1,
                resetAt: now + env_1.ENV.CHAT_CHANNEL_RATE_LIMIT_WINDOW_MS
            });
            return true;
        }
        if (bucket.count >= env_1.ENV.CHAT_CHANNEL_RATE_LIMIT_MAX_MESSAGES) {
            return false;
        }
        bucket.count += 1;
        return true;
    }
    allowHotChannel(channel) {
        const now = Date.now();
        const bucket = this.hotChannelBuckets.get(channel);
        if (!bucket || now >= bucket.resetAt) {
            this.hotChannelBuckets.set(channel, {
                count: 1,
                resetAt: now + env_1.ENV.CHAT_HOT_CHANNEL_WINDOW_MS
            });
            return true;
        }
        if (bucket.count >= env_1.ENV.CHAT_HOT_CHANNEL_MAX_MESSAGES) {
            return false;
        }
        bucket.count += 1;
        return true;
    }
    getQueuePriority(channel) {
        switch (channel) {
            case 'whisper':
                return 'alert';
            case 'global':
            case 'group':
            case 'trade':
                return 'normal';
            default:
                return 'bulk';
        }
    }
    getPersistQueueDepth() {
        return (this.persistQueues.alert.length + this.persistQueues.normal.length + this.persistQueues.bulk.length);
    }
    buildPriorityBatch(maxBatchSize) {
        const batch = [];
        const pushFrom = (priority) => {
            while (batch.length < maxBatchSize && this.persistQueues[priority].length > 0) {
                const item = this.persistQueues[priority].shift();
                if (item) {
                    batch.push(item);
                }
            }
            ;
        };
        // ALERT first, then NORMAL, then BULK to preserve real-time responsiveness.
        pushFrom('alert');
        pushFrom('normal');
        pushFrom('bulk');
        return batch;
    }
    recordJoin(includeHistory) {
        if (!includeHistory) {
            this.metrics.joinsWithoutHistory += 1;
        }
    }
    recordMessageIngress() {
        this.metrics.messagesIn += 1;
    }
    recordDroppedMessage(reasonCode, channel, userId) {
        this.metrics.messagesDropped += 1;
        console.log(JSON.stringify({
            event: 'chat_message_dropped',
            reasonCode,
            channel,
            userId,
            queueDepth: this.getPersistQueueDepth(),
            timestamp: Date.now()
        }));
    }
    logMetricsSnapshot() {
        console.log(JSON.stringify({
            event: 'chat_metrics_snapshot',
            messagesIn: this.metrics.messagesIn,
            messagesDropped: this.metrics.messagesDropped,
            joinsWithoutHistory: this.metrics.joinsWithoutHistory,
            queueDepth: this.getPersistQueueDepth(),
            queueAlertDepth: this.persistQueues.alert.length,
            queueNormalDepth: this.persistQueues.normal.length,
            queueBulkDepth: this.persistQueues.bulk.length,
            timestamp: Date.now()
        }));
    }
    async getChannelHistory(channel) {
        const cached = this.historyCache.get(channel);
        const now = Date.now();
        if (cached && cached.expiresAt > now) {
            return cached.messages;
        }
        const messages = await chat_repository_1.default.getChannelHistory(channel, env_1.ENV.CHAT_HISTORY_LIMIT);
        this.historyCache.set(channel, {
            expiresAt: now + env_1.ENV.CHAT_HISTORY_CACHE_TTL_MS,
            messages
        });
        return messages;
    }
    createChannelMessage(data) {
        return {
            id: `msg-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
            channel: data.channel,
            senderUserId: data.senderUserId,
            senderUsername: data.senderUsername,
            message: data.message.trim(),
            timestamp: Date.now()
        };
    }
    createWhisperMessage(data) {
        return {
            id: `whisper-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
            channel: 'whisper',
            senderUserId: data.senderUserId,
            senderUsername: data.senderUsername,
            recipientUserId: data.recipientUserId,
            recipientUsername: data.recipientUsername,
            message: data.message.trim(),
            timestamp: Date.now()
        };
    }
    queueForPersistence(message) {
        if (message.channel === 'system')
            return;
        const priority = this.getQueuePriority(String(message.channel || ''));
        this.persistQueues[priority].push(message);
        const queueDepth = this.getPersistQueueDepth();
        if (queueDepth > env_1.ENV.CHAT_ALERT_QUEUE_DEPTH) {
            console.warn(JSON.stringify({
                event: 'chat_alert_queue_depth',
                queueDepth,
                queueAlertDepth: this.persistQueues.alert.length,
                queueNormalDepth: this.persistQueues.normal.length,
                queueBulkDepth: this.persistQueues.bulk.length,
                threshold: env_1.ENV.CHAT_ALERT_QUEUE_DEPTH,
                timestamp: Date.now()
            }));
        }
        if (queueDepth >= env_1.ENV.CHAT_BATCH_SIZE) {
            this.flushPersistQueue().catch((error) => {
                console.error('[Chat] immediate batch flush failed', error);
            });
        }
        if (message.channel !== 'whisper') {
            this.historyCache.delete(message.channel);
        }
    }
    async flushPersistQueue() {
        if (this.getPersistQueueDepth() === 0)
            return;
        const batch = this.buildPriorityBatch(env_1.ENV.CHAT_BATCH_SIZE);
        if (batch.length === 0)
            return;
        const startedAt = Date.now();
        await chat_repository_1.default.saveMessagesBatch(batch);
        console.log(JSON.stringify({
            event: 'chat_batch_flush',
            batchSize: batch.length,
            queueSizeAfter: this.getPersistQueueDepth(),
            queueAlertDepth: this.persistQueues.alert.length,
            queueNormalDepth: this.persistQueues.normal.length,
            queueBulkDepth: this.persistQueues.bulk.length,
            latencyMs: Date.now() - startedAt,
            timestamp: Date.now()
        }));
    }
    async cleanupOldMessages() {
        const startedAt = Date.now();
        const deleted = await chat_repository_1.default.runCleanupKeepLatestPerChannel(env_1.ENV.CHAT_KEEP_PUBLIC_MESSAGES, env_1.ENV.CHAT_KEEP_WHISPER_MESSAGES, env_1.ENV.CHAT_CLEANUP_MAX_DELETE_PER_RUN);
        console.log(JSON.stringify({
            event: 'chat_cleanup',
            deletedRows: deleted,
            latencyMs: Date.now() - startedAt,
            timestamp: Date.now()
        }));
        return deleted;
    }
}
exports.default = new ChatService();
//# sourceMappingURL=chat.service.js.map