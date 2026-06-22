export interface Profile {
  id: string;
  username: string;
  avatar_url?: string | null;
  balance: number;
  current_streak: number;
  longest_streak: number;
  last_bet_date: string | null;
  last_topup_at: string | null;
  created_at: string;
}

export type RouletteBetType = 'straight' | 'color' | 'parity' | 'range';

export type RouletteColor = 'red' | 'black' | 'green';

export type RouletteRoundPhase = 'waiting' | 'spinning' | 'settled';

export interface RouletteRoundResult {
  id: string;
  bet_type: RouletteBetType;
  bet_value: string;
  stake: number;
  winning_number: number;
  winning_color: RouletteColor;
  payout: number;
  balance_after: number;
  created_at: string;
  is_win: boolean;
  net_change: number;
}

export interface RouletteTableRound {
  id: string;
  table_key: string;
  round_number: number;
  phase: RouletteRoundPhase;
  betting_opens_at: string;
  betting_closes_at: string;
  spin_started_at: string | null;
  settled_at: string | null;
  winning_number: number | null;
  winning_color: RouletteColor | null;
  created_at: string;
}

export interface RouletteBetRecord {
  id: string;
  round_id: string;
  user_id?: string;
  bet_type: RouletteBetType;
  bet_value: string;
  stake: number;
  payout: number;
  is_win: boolean | null;
  created_at: string;
  settled_at?: string | null;
}

export interface RouletteRoundParticipant {
  user_id: string;
  username: string;
  avatar_url?: string | null;
  total_stake: number;
  bet_count: number;
  bets: RouletteRoundParticipantBet[];
}

export interface RouletteRoundParticipantBet {
  bet_type: RouletteBetType;
  bet_value: string;
  stake: number;
}

export interface RouletteRecentWin extends RouletteBetRecord {
  username: string;
  avatar_url?: string | null;
  round_number: number;
}

export interface CasinoHistoryEntry {
  id: string;
  game_type: string;
  bet_label: string;
  stake: number;
  payout: number;
  status: 'pending' | 'won' | 'lost' | 'push';
  round_label: string | null;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  emoji: string;
  color: string;
  sort_order: number;
  created_at: string;
}

export interface BetOption {
  name: string;
  odds: number;
}

export type BetProposalSource = 'human' | 'agent';

export interface Bet {
  id: string;
  title: string;
  category_id: string | null;
  bet_type: '1x2' | '12' | 'multi' | 'single';
  options: BetOption[];
  ends_at: string;
  is_live: boolean;
  is_bsplicboost?: boolean;
  is_active: boolean;
  winning_option: string | null;
  bet_count: number;
  created_at: string;
  category?: Category;
}

export interface PlacedBet {
  id: string;
  user_id: string;
  bet_id: string;
  selected_option: string;
  stake: number;
  odds_at_time: number;
  result: 'pending' | 'won' | 'lost' | 'refund';
  payout: number;
  coupon_id: string | null;
  created_at: string;
  bet?: Bet;
}

export interface Coupon {
  id: string;
  user_id: string;
  total_odds: number;
  stake: number;
  payout: number;
  status: 'pending' | 'won' | 'lost' | 'refund';
  created_at: string;
}

export interface BetProposal {
  id: string;
  user_id: string;
  title: string;
  category_id: string | null;
  bet_type: '1x2' | '12' | 'multi' | 'single';
  proposal_source: BetProposalSource;
  agent_metadata: unknown | null;
  agent_duplicate_key: string | null;
  options: BetOption[];
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  profile?: Profile;
}

export interface Badge {
  id: string;
  user_id: string;
  badge_key: string;
  unlocked_at: string;
}

export interface CouponItem {
  bet: Bet;
  selectedOption: string;
  odds: number;
}

export interface CouponLeg {
  id: string;
  bet_id?: string | null;
  selected_option: string;
  odds_at_time: number;
  leg_stake?: number;
  leg_payout?: number;
  result: 'pending' | 'won' | 'lost' | 'refund';
  bet_title: string | null;
}

export interface CouponHistoryEntry {
  id: string;
  total_odds: number;
  stake: number;
  payout: number;
  status: 'pending' | 'won' | 'lost' | 'refund';
  created_at: string;
  legs: CouponLeg[] | null;
}

export interface SocialCouponEntry extends CouponHistoryEntry {
  user_id: string;
  username: string;
}

// --- Social types ---

export type ReactionEmoji = 'like' | 'heart' | 'laugh' | 'wow' | 'sad' | 'angry' | 'fire';

export type FeedItemType = 'post' | 'coupon' | 'casino';

export type NotificationType =
  | 'mention_post'
  | 'mention_comment'
  | 'coupon_won'
  | 'comment_post'
  | 'jackpot_draw_ready';

export interface SocialFeedItem {
  id: string;
  item_type: FeedItemType;
  user_id: string;
  username: string;
  avatar_url?: string | null;
  content: string | null;
  total_odds: number | null;
  stake: number | null;
  payout: number | null;
  status: string | null;
  legs: CouponLeg[] | null;
  created_at: string;
  reactions: Partial<Record<ReactionEmoji, number>> | null;
  comment_count: number;
  my_reaction: ReactionEmoji | null;
  // Optional casino fields
  casino_bet_type?: RouletteBetType | null;
  casino_bet_value?: string | null;
  casino_stake?: number | null;
  casino_payout?: number | null;
  casino_round_number?: number | null;
  casino_winning_number?: number | null;
  casino_winning_color?: RouletteColor | null;
}

export interface SocialStory {
  id: string;
  user_id: string;
  username: string;
  avatar_url?: string | null;
  content: string | null;
  created_at: string;
  expires_at: string;
}

export interface SocialComment {
  id: string;
  user_id: string;
  username: string;
  avatar_url?: string | null;
  content: string;
  parent_id: string | null;
  created_at: string;
  reactions: Partial<Record<ReactionEmoji, number>> | null;
  my_reaction: ReactionEmoji | null;
}

export interface UserNotification {
  id: string;
  user_id: string;
  actor_user_id: string | null;
  actor_username: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  link_path: string | null;
  metadata: Record<string, unknown> | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface PublicProfile {
  id: string;
  username: string;
  avatar_url?: string | null;
  current_streak: number;
  longest_streak: number;
  created_at: string;
  total_bets: number;
  won_bets: number;
  lost_bets: number;
  win_rate: number;
  total_profit: number;
}

export const BADGE_DEFINITIONS: Record<string, { imageSrc: string; name: string; description: string }> = {
  debiutant: { imageSrc: '/badges/debiutant.png', name: 'Debiutant', description: 'Pierwszy postawiony zakład' },
  trafiony: { imageSrc: '/badges/trafiony.png', name: 'Trafiony zakład', description: 'Pierwszy wygrany zakład' },
  kuponista: { imageSrc: '/badges/kuponista.png', name: 'Kuponista', description: 'Pierwszy kupon AKO' },
  goraca_passa: { imageSrc: '/badges/goraca_passa.png', name: 'Gorąca passa', description: '3 wygrane z rzędu' },
  nie_do_zatrzymania: { imageSrc: '/badges/nie_do_zatrzymania.png', name: 'Nie do zatrzymania', description: '5 wygranych z rzędu' },
  mistrz_serii: { imageSrc: '/badges/mistrz_serii.png', name: 'Mistrz serii', description: '10 wygranych z rzędu' },
  pierwszy_tysiac: { imageSrc: '/badges/pierwszy_tysiac.png', name: 'Pierwszy tysiąc', description: 'Łączne wygrane powyżej 1000 zł' },
  wieloryb: { imageSrc: '/badges/wieloryb.png', name: 'Wieloryb', description: 'Pojedynczy zakład na 500 zł lub więcej' },
  ryzykant: { imageSrc: '/badges/ryzykant.png', name: 'Ryzykant', description: 'Kupon AKO z 5+ wydarzeniami' },
  analityk: { imageSrc: '/badges/analityk.png', name: 'Analityk', description: 'Win rate powyżej 60% (min. 20 zakładów)' },
  staly_bywalec: { imageSrc: '/badges/staly_bywalec.png', name: 'Stały bywalec', description: 'Seria 7 dni' },
  legenda: { imageSrc: '/badges/legenda.png', name: 'Legenda', description: 'Seria 30 dni' },
  pomyslodawca: { imageSrc: '/badges/pomyslodawca.png', name: 'Pomysłodawca', description: 'Pierwsza zaakceptowana propozycja' },
  wszechstronny: { imageSrc: '/badges/wszechstronny.png', name: 'Wszechstronny', description: 'Zakłady w 4+ kategoriach' },
  multi_fan: { imageSrc: '/badges/multi_fan.png', name: 'Multi-fan', description: '10 kuponów AKO' },
};
