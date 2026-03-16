import type { ChatMessage, ChatErrorPayload } from '../../shared/types';
declare class ChatService {
    private readonly historyCache;
    private readonly persistQueues;
    private readonly rateLimit;
    private readonly userChannelBuckets;
    private readonly hotChannelBuckets;
    private readonly warmupBuckets;
    private readonly metrics;
    private flushTimer;
    private cleanupTimer;
    private metricsTimer;
    constructor();
    startBackgroundJobs(): void;
    stopBackgroundJobs(): void;
    private ensureFlushTimer;
    isValidChannel(channel: string): boolean;
    validateMessageInput(userId: number, channel: string, message: string): ChatErrorPayload | null;
    private allowWarmupWindow;
    private allowPerUserPerChannel;
    private allowHotChannel;
    private getQueuePriority;
    private getPersistQueueDepth;
    private buildPriorityBatch;
    recordJoin(includeHistory: boolean): void;
    recordMessageIngress(): void;
    recordDroppedMessage(reasonCode: string, channel: string, userId: number): void;
    private logMetricsSnapshot;
    getChannelHistory(channel: string): Promise<ChatMessage[]>;
    createChannelMessage(data: {
        channel: string;
        senderUserId: number;
        senderUsername: string;
        message: string;
    }): ChatMessage;
    createWhisperMessage(data: {
        senderUserId: number;
        senderUsername: string;
        recipientUserId: number;
        recipientUsername: string;
        message: string;
    }): ChatMessage;
    queueForPersistence(message: ChatMessage): void;
    flushPersistQueue(): Promise<void>;
    cleanupOldMessages(): Promise<number>;
}
declare const _default: ChatService;
export default _default;
//# sourceMappingURL=chat.service.d.ts.map