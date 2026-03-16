import { RankInfo, PlayerProfile, User } from '../../shared/types';
declare class RankService {
    getRankInfo(eloRanked: number): RankInfo;
    private tierDisplayName;
    buildProfile(user: User): PlayerProfile;
}
declare const _default: RankService;
export default _default;
//# sourceMappingURL=rank.service.d.ts.map