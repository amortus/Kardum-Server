import { PlayerRank, RankInfo, PlayerProfile, User } from '../../shared/types';
import { RANK_TIERS } from '../../shared/constants';
import experienceService from './experience.service';

class RankService {
  getRankInfo(eloRanked: number): RankInfo {
    for (const tier of RANK_TIERS) {
      if (eloRanked >= tier.min_elo && (tier.max_elo === null || eloRanked <= tier.max_elo)) {
        let division: 'IV' | 'III' | 'II' | 'I' | null = null;

        if (tier.divisions !== null) {
          const range = tier.max_elo! - tier.min_elo + 1;
          const divSize = Math.floor(range / 4);
          const posInTier = eloRanked - tier.min_elo;
          const divIndex = Math.min(Math.floor(posInTier / divSize), 3);
          // IV is lowest (0), I is highest (3)
          const divNames: Array<'IV' | 'III' | 'II' | 'I'> = ['IV', 'III', 'II', 'I'];
          division = divNames[divIndex];
        }

        const displayName = division
          ? `${this.tierDisplayName(tier.tier)} ${division}`
          : this.tierDisplayName(tier.tier);

        return {
          tier: tier.tier,
          division,
          elo: eloRanked,
          min_elo: tier.min_elo,
          max_elo: tier.max_elo,
          display_name: displayName
        };
      }
    }

    // Fallback (should never reach here with RANK_TIERS covering 0+)
    return {
      tier: PlayerRank.UNRANKED,
      division: null,
      elo: eloRanked,
      min_elo: 0,
      max_elo: 999,
      display_name: 'Unranked'
    };
  }

  private tierDisplayName(tier: PlayerRank): string {
    const names: Record<PlayerRank, string> = {
      [PlayerRank.UNRANKED]:    'Unranked',
      [PlayerRank.BRONZE]:      'Bronze',
      [PlayerRank.SILVER]:      'Silver',
      [PlayerRank.GOLD]:        'Gold',
      [PlayerRank.PLATINUM]:    'Platinum',
      [PlayerRank.DIAMOND]:     'Diamond',
      [PlayerRank.GRANDMASTER]: 'Grandmaster'
    };
    return names[tier];
  }

  buildProfile(user: User): PlayerProfile {
    const experience = user.experience ?? 0;
    const { level, expToNext, progressPercent, expIntoLevel } = experienceService.computeLevel(experience);

    const rank_info = this.getRankInfo(user.elo_ranked ?? 1000);

    const win_rate = user.total_matches > 0
      ? Math.round((user.wins / user.total_matches) * 100)
      : 0;
    const gender = (user.gender || 'male').toLowerCase();
    const defaultHead = gender === 'female' ? 'head_long' : 'male_head1';
    const bodyId = user.body_id || 'clothes';
    const headId = user.head_id || defaultHead;
    const skinBodyId = user.skin_body_id || null;
    const skinHeadId = user.skin_head_id || null;
    const characterCompleted = Number(user.character_completed || 0) === 1;
    const profileAvatarId = user.profile_avatar_id || null;

    return {
      id: user.id,
      username: user.username,
      level,
      experience,
      exp_to_next_level: expToNext,
      exp_into_level: expIntoLevel,
      exp_progress_percent: progressPercent,
      rank_info,
      elo_ranked: user.elo_ranked ?? 1000,
      elo_casual: user.elo_casual ?? 1000,
      wins: user.wins ?? 0,
      losses: user.losses ?? 0,
      total_matches: user.total_matches ?? 0,
      win_rate,
      character: {
        gender,
        body_id: bodyId,
        head_id: headId,
        skin_body_id: skinBodyId,
        skin_head_id: skinHeadId,
        character_completed: characterCompleted
      },
      profile_avatar_id: profileAvatarId,
      character_completed: characterCompleted,
      created_at: user.created_at
    };
  }
}

export default new RankService();
