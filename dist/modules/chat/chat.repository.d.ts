import type { ChatMessage } from '../../shared/types';
declare class ChatRepository {
    saveMessagesBatch(messages: ChatMessage[]): Promise<void>;
    getChannelHistory(channel: string, limit: number): Promise<ChatMessage[]>;
    runCleanupKeepLatestPerChannel(keepPublicPerChannel?: number, keepWhisperPerChannel?: number, maxDeletePerRun?: number): Promise<number>;
}
declare const _default: ChatRepository;
export default _default;
//# sourceMappingURL=chat.repository.d.ts.map