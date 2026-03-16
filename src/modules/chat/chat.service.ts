import { ENV } from '../../config/env';
import type { ChatChannel, ChatMessage, ChatErrorPayload } from '../../shared/types';
import chatRepository from './chat.repository';
import { ChatRateLimit } from './chat.rate-limit';

type CachedHistory = {
  expiresAt: number;
  messages: ChatMessage[];
};

type PersistQueueItem = ChatMessage;
type QueuePriority = 'alert' | 'normal' | 'bulk';
type WindowBucket = {
  count: number;
  resetAt: number;
};

const VALID_CHANNELS = new Set<ChatChannel>(['global', 'group', 'trade', 'system', 'zone', 'whisper']);

class ChatService {
  private readonly historyCache = new Map<string, CachedHistory>();
  private readonly persistQueues: Record<QueuePriority, PersistQueueItem[]> = {
    alert: [],
    normal: [],
    bulk: []
  };
  private readonly rateLimit = new ChatRateLimit(ENV.CHAT_RATE_LIMIT_WINDOW_MS, ENV.CHAT_RATE_LIMIT_MAX_MESSAGES);
  private readonly userChannelBuckets = new Map<string, WindowBucket>();
  private readonly hotChannelBuckets = new Map<string, WindowBucket>();
  private readonly warmupBuckets = new Map<number, WindowBucket>();
  private readonly metrics = {
    messagesIn: 0,
    messagesDropped: 0,
    joinsWithoutHistory: 0
  };
  private flushTimer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private metricsTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.ensureFlushTimer();
  }

  startBackgroundJobs(): void {
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

  stopBackgroundJobs(): void {
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

  private ensureFlushTimer(): void {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => {
      this.flushPersistQueue().catch((error) => {
        console.error('[Chat] batch flush failed', error);
      });
    }, ENV.CHAT_BATCH_DELAY_MS);
  }

  isValidChannel(channel: string): boolean {
    return VALID_CHANNELS.has(channel as ChatChannel);
  }

  validateMessageInput(userId: number, channel: string, message: string): ChatErrorPayload | null {
    const text = message.trim();
    if (!text) {
      return { code: 'empty_message', message: 'Message cannot be empty.' };
    }
    if (text.length > ENV.CHAT_MAX_MESSAGE_LENGTH) {
      return {
        code: 'message_too_long',
        message: `Max ${ENV.CHAT_MAX_MESSAGE_LENGTH} chars`
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

  private allowWarmupWindow(userId: number): boolean {
    const now = Date.now();
    const bucket = this.warmupBuckets.get(userId);
    if (!bucket || now >= bucket.resetAt) {
      this.warmupBuckets.set(userId, {
        count: 1,
        resetAt: now + ENV.CHAT_WARMUP_WINDOW_MS
      });
      return true;
    }
    if (bucket.count >= ENV.CHAT_WARMUP_MAX_MESSAGES) {
      return false;
    }
    bucket.count += 1;
    return true;
  }

  private allowPerUserPerChannel(userId: number, channel: string): boolean {
    const now = Date.now();
    const key = `${userId}:${channel}`;
    const bucket = this.userChannelBuckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      this.userChannelBuckets.set(key, {
        count: 1,
        resetAt: now + ENV.CHAT_CHANNEL_RATE_LIMIT_WINDOW_MS
      });
      return true;
    }
    if (bucket.count >= ENV.CHAT_CHANNEL_RATE_LIMIT_MAX_MESSAGES) {
      return false;
    }
    bucket.count += 1;
    return true;
  }

  private allowHotChannel(channel: string): boolean {
    const now = Date.now();
    const bucket = this.hotChannelBuckets.get(channel);
    if (!bucket || now >= bucket.resetAt) {
      this.hotChannelBuckets.set(channel, {
        count: 1,
        resetAt: now + ENV.CHAT_HOT_CHANNEL_WINDOW_MS
      });
      return true;
    }
    if (bucket.count >= ENV.CHAT_HOT_CHANNEL_MAX_MESSAGES) {
      return false;
    }
    bucket.count += 1;
    return true;
  }

  private getQueuePriority(channel: string): QueuePriority {
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

  private getPersistQueueDepth(): number {
    return (
      this.persistQueues.alert.length + this.persistQueues.normal.length + this.persistQueues.bulk.length
    );
  }

  private buildPriorityBatch(maxBatchSize: number): PersistQueueItem[] {
    const batch: PersistQueueItem[] = [];
    const pushFrom = (priority: QueuePriority) => {
      while (batch.length < maxBatchSize && this.persistQueues[priority].length > 0) {
        const item = this.persistQueues[priority].shift();
        if (item) {
          batch.push(item);
        }
      };
    };
    // ALERT first, then NORMAL, then BULK to preserve real-time responsiveness.
    pushFrom('alert');
    pushFrom('normal');
    pushFrom('bulk');
    return batch;
  }

  recordJoin(includeHistory: boolean): void {
    if (!includeHistory) {
      this.metrics.joinsWithoutHistory += 1;
    }
  }

  recordMessageIngress(): void {
    this.metrics.messagesIn += 1;
  }

  recordDroppedMessage(reasonCode: string, channel: string, userId: number): void {
    this.metrics.messagesDropped += 1;
    console.log(
      JSON.stringify({
        event: 'chat_message_dropped',
        reasonCode,
        channel,
        userId,
        queueDepth: this.getPersistQueueDepth(),
        timestamp: Date.now()
      })
    );
  }

  private logMetricsSnapshot(): void {
    console.log(
      JSON.stringify({
        event: 'chat_metrics_snapshot',
        messagesIn: this.metrics.messagesIn,
        messagesDropped: this.metrics.messagesDropped,
        joinsWithoutHistory: this.metrics.joinsWithoutHistory,
        queueDepth: this.getPersistQueueDepth(),
        queueAlertDepth: this.persistQueues.alert.length,
        queueNormalDepth: this.persistQueues.normal.length,
        queueBulkDepth: this.persistQueues.bulk.length,
        timestamp: Date.now()
      })
    );
  }

  async getChannelHistory(channel: string): Promise<ChatMessage[]> {
    const cached = this.historyCache.get(channel);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      return cached.messages;
    }

    const messages = await chatRepository.getChannelHistory(channel, ENV.CHAT_HISTORY_LIMIT);
    this.historyCache.set(channel, {
      expiresAt: now + ENV.CHAT_HISTORY_CACHE_TTL_MS,
      messages
    });
    return messages;
  }

  createChannelMessage(data: {
    channel: string;
    senderUserId: number;
    senderUsername: string;
    message: string;
  }): ChatMessage {
    return {
      id: `msg-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      channel: data.channel,
      senderUserId: data.senderUserId,
      senderUsername: data.senderUsername,
      message: data.message.trim(),
      timestamp: Date.now()
    };
  }

  createWhisperMessage(data: {
    senderUserId: number;
    senderUsername: string;
    recipientUserId: number;
    recipientUsername: string;
    message: string;
  }): ChatMessage {
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

  queueForPersistence(message: ChatMessage): void {
    if (message.channel === 'system') return;
    const priority = this.getQueuePriority(String(message.channel || ''));
    this.persistQueues[priority].push(message);
    const queueDepth = this.getPersistQueueDepth();
    if (queueDepth > ENV.CHAT_ALERT_QUEUE_DEPTH) {
      console.warn(
        JSON.stringify({
          event: 'chat_alert_queue_depth',
          queueDepth,
          queueAlertDepth: this.persistQueues.alert.length,
          queueNormalDepth: this.persistQueues.normal.length,
          queueBulkDepth: this.persistQueues.bulk.length,
          threshold: ENV.CHAT_ALERT_QUEUE_DEPTH,
          timestamp: Date.now()
        })
      );
    }
    if (queueDepth >= ENV.CHAT_BATCH_SIZE) {
      this.flushPersistQueue().catch((error) => {
        console.error('[Chat] immediate batch flush failed', error);
      });
    }
    if (message.channel !== 'whisper') {
      this.historyCache.delete(message.channel);
    }
  }

  async flushPersistQueue(): Promise<void> {
    if (this.getPersistQueueDepth() === 0) return;
    const batch = this.buildPriorityBatch(ENV.CHAT_BATCH_SIZE);
    if (batch.length === 0) return;
    const startedAt = Date.now();
    await chatRepository.saveMessagesBatch(batch);
    console.log(
      JSON.stringify({
        event: 'chat_batch_flush',
        batchSize: batch.length,
        queueSizeAfter: this.getPersistQueueDepth(),
        queueAlertDepth: this.persistQueues.alert.length,
        queueNormalDepth: this.persistQueues.normal.length,
        queueBulkDepth: this.persistQueues.bulk.length,
        latencyMs: Date.now() - startedAt,
        timestamp: Date.now()
      })
    );
  }

  async cleanupOldMessages(): Promise<number> {
    const startedAt = Date.now();
    const deleted = await chatRepository.runCleanupKeepLatestPerChannel(
      ENV.CHAT_KEEP_PUBLIC_MESSAGES,
      ENV.CHAT_KEEP_WHISPER_MESSAGES,
      ENV.CHAT_CLEANUP_MAX_DELETE_PER_RUN
    );
    console.log(
      JSON.stringify({
        event: 'chat_cleanup',
        deletedRows: deleted,
        latencyMs: Date.now() - startedAt,
        timestamp: Date.now()
      })
    );
    return deleted;
  }
}

export default new ChatService();
