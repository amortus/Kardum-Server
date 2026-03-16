export declare class ChatRateLimit {
    private readonly windowMs;
    private readonly maxMessages;
    private readonly buckets;
    constructor(windowMs: number, maxMessages: number);
    allow(userId: number): boolean;
}
//# sourceMappingURL=chat.rate-limit.d.ts.map