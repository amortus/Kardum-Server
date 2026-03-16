declare class ShardAuthorityService {
    private ownedUntilMs;
    tryClaimOrRenew(shardKey: string): Promise<boolean>;
    isOwner(shardKey: string): boolean;
    release(shardKey: string): Promise<void>;
    private key;
}
export declare const shardAuthorityService: ShardAuthorityService;
export {};
//# sourceMappingURL=shard-authority.service.d.ts.map