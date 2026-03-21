// Tipos compartilhados do Kardum TCG

export enum CardType {
  GENERAL = 'general',
  DEFENDER = 'defender',
  EQUIPMENT = 'equipment',
  MOUNT = 'mount',
  CONSUMABLE = 'consumable',
  ABILITY = 'ability'
}

export enum Race {
  HUMAN = 'human',
  DEVA = 'deva',
  ORC = 'orc',
  DWARF = 'dwarf',
  ELF = 'elf'
}

export enum Class {
  WARRIOR = 'warrior',
  BARBARIAN = 'barbarian',
  DRUID = 'druid',
  ELEMENTALIST = 'elementalist',
  NECROMANCER = 'necromancer',
  ARCHER = 'archer',
  ASSASSIN = 'assassin',
  CHIVALRY = 'chivalry'
}

export enum Ability {
  RUSH = 'rush',
  TAUNT = 'taunt',
  DIVINE_SHIELD = 'divine_shield',
  LIFESTEAL = 'lifesteal',
  CHARGE = 'charge',
  DRAW_CARD = 'draw_card',
  BUFF_ALL = 'buff_all',
  DAMAGE_ALL = 'damage_all',
  STEALTH = 'stealth',
  REGENERATE = 'regenerate',
  POISON = 'poison'
}

export enum Rarity {
  COMMON = 'common',
  RARE = 'rare',
  EPIC = 'epic',
  LEGENDARY = 'legendary'
}

export interface CardEffect {
  type: string;
  amount?: number;
  attack?: number;
  defense?: number;
  target?: string;       // SELF, OWN_GENERAL, ENEMY_GENERAL, SINGLE_ALLY, ALL_ALLIES, SINGLE_ENEMY, ALL_ENEMIES
  trigger?: string;      // INSTANT, ON_ENTER, ON_ATTACK, ON_DAMAGE, ON_DEATH, START_TURN, END_TURN
  duration?: number;     // 0 = permanent/one-shot, N = expires after N turns
  ability?: string;      // Para GRANT_ABILITY: nome da habilidade concedida (STEALTH, TAUNT, etc.)
}

/** Efeito do poder de herói ou passiva do General (JSON). */
export interface GeneralAbilityEffect {
  type: string;
  amount?: number;
  target?: string;
  [key: string]: unknown;
}

export interface Card {
  id: string;
  name: string;
  type: CardType;
  race: Race | null;
  class?: Class;
  cost: number;
  attack?: number;
  defense?: number;
  abilities?: Ability[];
  text: string;
  rarity: Rarity;
  image_url?: string;
  visual_auras?: string[];
  collection_id?: string | null;
  effects?: CardEffect[];
  /** @deprecated Use effects[] instead */
  effect?: CardEffect;
  /** Apenas para type=general: descrição do poder de herói. */
  hero_power_text?: string;
  /** Apenas para type=general: custo em mana/cristais para usar o poder. */
  hero_power_cost?: number;
  /** Apenas para type=general: efeito ativável (JSON). */
  hero_power_effect?: GeneralAbilityEffect;
  /** Apenas para type=general: efeito passivo (JSON). */
  passive_effect?: GeneralAbilityEffect;
  default_unlocked?: boolean;
  is_active?: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface CardInstance extends Card {
  instanceId: string;
  cardId: string;
  currentAttack: number;
  currentDefense: number;
  hasAttacked: boolean;
  isSummoned: boolean;
  hasAbilities: Ability[];
  equipped: CardInstance | null;
}

export enum PlayerRank {
  UNRANKED = 'unranked',
  BRONZE = 'bronze',
  SILVER = 'silver',
  GOLD = 'gold',
  PLATINUM = 'platinum',
  DIAMOND = 'diamond',
  GRANDMASTER = 'grandmaster'
}

export interface RankInfo {
  tier: PlayerRank;
  division: 'IV' | 'III' | 'II' | 'I' | null;
  elo: number;
  min_elo: number;
  max_elo: number | null;
  display_name: string;
}

export interface PlayerProfile {
  id: number;
  username: string;
  level: number;
  experience: number;
  exp_to_next_level: number;
  /** EXP já obtida no nível atual (0 .. exp_to_next_level). */
  exp_into_level: number;
  exp_progress_percent: number;
  rank_info: RankInfo;
  elo_ranked: number;
  elo_casual: number;
  wins: number;
  losses: number;
  total_matches: number;
  win_rate: number;
  character: {
    gender: string;
    body_id: string;
    head_id: string;
    skin_body_id?: string | null;
    skin_head_id?: string | null;
    character_completed: boolean;
  };
  profile_avatar_id?: string | null;
  character_completed: boolean;
  created_at: Date;
}

export interface User {
  id: number;
  username: string;
  password_hash: string;
  email?: string;
  elo_casual: number;
  elo_ranked: number;
  total_matches: number;
  wins: number;
  losses: number;
  level: number;
  experience: number;
  gender?: string;
  body_id?: string;
  head_id?: string;
  skin_body_id?: string | null;
  skin_head_id?: string | null;
  character_completed?: number;
  profile_avatar_id?: string | null;
  created_at: Date;
  last_login?: Date;
  is_admin: boolean;
}

export interface Deck {
  id: number;
  user_id: number;
  name: string;
  cards: string[]; // Array de card IDs
  created_at: Date;
  updated_at: Date;
}

export interface PlayerState {
  id: string;
  health: number;
  warResources: number;
  maxWarResources: number;
  deck: string[];
  hand: CardInstance[];
  field: CardInstance[];
  graveyard: CardInstance[];
  equipments: { [defenderId: string]: CardInstance };
  mounts: CardInstance[];
  abilityUsedThisTurn: boolean;
  mountUsedThisTurn: boolean;
}

export enum GamePhase {
  DRAW = 'draw',
  STRATEGY = 'strategy',
  COMBAT = 'combat',
  END = 'end'
}

export interface GameState {
  players: {
    player1: PlayerState;
    player2: PlayerState;
  };
  currentPlayer: 'player1' | 'player2';
  currentPhase: GamePhase;
  turnNumber: number;
  winner: string | null;
  gameStarted: boolean;
  isFirstTurn: boolean;
  actionHistory: GameAction[];
}

export interface GameAction {
  turn: number;
  player: string;
  action: string;
  data: any;
  timestamp: number;
}

export interface Match {
  id: number;
  player1_id: number;
  player2_id: number;
  winner_id?: number;
  match_type: 'casual' | 'ranked' | 'ai';
  duration_seconds?: number;
  player1_deck?: string;
  player2_deck?: string;
  created_at: Date;
}

export interface MatchState {
  matchId: number;
  player1Id: number;
  player2Id: number;
  player1DeckId: number;
  player2DeckId: number;
  player1Deck: {
    cards: string[];
  };
  player2Deck: {
    cards: string[];
  };
  matchType: 'casual' | 'ranked' | 'ai';
  gameState: GameState | null;
  currentPlayer: 'player1' | 'player2';
  turnNumber: number;
  startedAt: number;
  lastActionAt: number;
  player1Ready: boolean;
  player2Ready: boolean;
  winner: number | null;
  ended: boolean;
  actionHistory: any[];
}

export type MonsterDifficulty = 'easy' | 'medium' | 'hard';
export type MonsterStatus = 'alive' | 'engaged' | 'cooldown';
export type MonsterDeckMode = 'auto' | 'manual' | 'hybrid';

export interface CardCollection {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface MonsterTemplate {
  id: number;
  name: string;
  deck_id: number;
  difficulty: MonsterDifficulty;
  sprite_ref?: string | null;
  visual?: string | null;
  collection_id?: string | null;
  deck_mode?: MonsterDeckMode;
  manual_deck_cards?: string[];
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface MonsterSpawn {
  id: number;
  spawn_uid: string;
  template_id: number;
  zone: string;
  spawn_x: number;
  spawn_y: number;
  respawn_seconds: number;
  move_radius: number;
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface MonsterRuntimeState {
  spawn_uid: string;
  template_id: number;
  template_name: string;
  zone: string;
  x: number;
  y: number;
  spawn_x: number;
  spawn_y: number;
  move_radius: number;
  respawn_seconds: number;
  status: MonsterStatus;
  engaged_by_user_id?: number | null;
  next_respawn_at?: number | null;
  difficulty: MonsterDifficulty;
  deck_id: number;
  sprite_ref?: string | null;
  visual?: string | null;
}

export interface MonsterTemplateDrop {
  id: number;
  template_id: number;
  card_id: string;
  drop_chance_percent: number;
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface UserCardUnlock {
  id: number;
  user_id: number;
  card_id: string;
  source?: string;
  created_at?: Date;
}

export interface ZoneChatMessage {
  zone: string;
  userId: number;
  username: string;
  message: string;
  sentAt: number;
}

export interface PlayerAppearance {
  gender: string;
  body_id: string;
  head_id: string;
  skin_body_id?: string | null;
  skin_head_id?: string | null;
}

export interface WorldPlayerState {
  userId: number;
  username: string;
  zone: string;
  zoneKey: string;
  x: number;
  y: number;
  kind: 'player';
  appearance: PlayerAppearance;
}

export type ChatChannel = 'global' | 'group' | 'trade' | 'whisper' | 'system' | 'zone';

export interface ChatMessage {
  id?: number | string;
  channel: ChatChannel | string;
  senderUserId: number | null;
  senderUsername: string;
  message: string;
  timestamp: number;
  recipientUserId?: number | null;
  recipientUsername?: string | null;
}

export interface ChatErrorPayload {
  code: string;
  message: string;
}

export type FriendshipStatus = 'pending' | 'accepted' | 'blocked';

export interface Friendship {
  id: number;
  user_id: number;
  friend_id: number;
  status: FriendshipStatus;
  requested_at?: Date;
  accepted_at?: Date | null;
}

// Socket.io Event Types
export interface SocketEvents {
  // Connection
  connect: () => void;
  disconnect: () => void;
  
  // Matchmaking
  'queue:join': (data: { deckId: number; matchType: 'casual' | 'ranked' }) => void;
  'queue:leave': () => void;
  'match:found': (data: { matchId: number; opponent: { userId: number; username: string }; matchType: string }) => void;
  
  // Game
  'game:start': (data: { matchId: number; initialState: GameState }) => void;
  'game:state': (data: { matchId: number; state: GameState }) => void;
  'game:action': (data: { matchId: number; action: any; fromPlayer: number }) => void;
  'game:update': (data: { matchId: number; state: GameState }) => void;
  'game:end': (data: { matchId: number; winnerId: number; eloUpdate: any }) => void;
  'game:error': (data: { message: string }) => void;
  
  // Match
  'match:ready': (data: { matchId: number }) => void;
  'match:sync': (data: { matchId: number }) => void;
  
  // AI
  'ai:start': (data: { difficulty: 'easy' | 'medium' | 'hard'; deckId: number }) => void;

  // MMO Monsters
  'mmo:zone:join': (data: { zone: string }) => void;
  'mmo:players:snapshot': (data: { zone: string; zoneKey?: string; players: WorldPlayerState[] }) => void;
  'mmo:player:update': (data: { player: WorldPlayerState }) => void;
  'mmo:player:leave': (data: { userId: number; zone: string; zoneKey?: string }) => void;
  'mmo:monsters:snapshot': (data: { zone: string; monsters: MonsterRuntimeState[] }) => void;
  'mmo:monster:update': (data: { monster: MonsterRuntimeState }) => void;
  'mmo:monster:despawn': (data: { spawnUid: string; zone: string; respawnAt: number }) => void;
  'mmo:monster:engage': (data: { spawnUid: string; zone: string }) => void;
  'mmo:encounter:start': (data: { matchId: number; spawnUid: string; zone: string }) => void;
  'mmo:command:spawn': (data: { name: string; zone: string; x: number; y: number }) => void;
  'mmo:command:channels': () => void;

  // Zone Chat
  'chat:zone:send': (data: { zone: string; message: string }) => void;
  'chat:zone:message': (data: ZoneChatMessage) => void;

  // Full chat
  'chat:join': (data: { channel: string; includeHistory?: boolean }) => void;
  'chat:history': (data: { channel: string; messages: ChatMessage[] }) => void;
  'chat:message': (data: ChatMessage) => void;
  'chat:whisper': (data: { recipient: string; message: string }) => void;
  'chat:error': (data: ChatErrorPayload) => void;
  'chat:user-joined': (data: { userId: number; username: string; timestamp: number }) => void;
  'chat:user-left': (data: { userId: number; username: string; timestamp: number }) => void;
  'friend:update': (data: { type: string; data?: unknown; timestamp: number }) => void;
  'friend:online': (data: { userId: number; username: string }) => void;
  'friend:offline': (data: { userId: number; username: string }) => void;
  
  // Errors
  'pvp:error': (data: { message: string }) => void;
}
