"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatRateLimit = void 0;
class ChatRateLimit {
    constructor(windowMs, maxMessages) {
        this.windowMs = windowMs;
        this.maxMessages = maxMessages;
        this.buckets = new Map();
    }
    allow(userId) {
        const now = Date.now();
        const current = this.buckets.get(userId);
        if (!current || now >= current.resetAt) {
            this.buckets.set(userId, {
                count: 1,
                resetAt: now + this.windowMs
            });
            return true;
        }
        if (current.count >= this.maxMessages) {
            return false;
        }
        current.count += 1;
        return true;
    }
}
exports.ChatRateLimit = ChatRateLimit;
//# sourceMappingURL=chat.rate-limit.js.map