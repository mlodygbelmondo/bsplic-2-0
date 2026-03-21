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

export interface Bet {
  id: string;
  title: string;
  category_id: string | null;
  bet_type: '1x2' | '12' | 'multi';
  options: BetOption[];
  ends_at: string;
  is_live: boolean;
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
  result: 'pending' | 'won' | 'lost';
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
  stake_asset_id?: string | null;
  stake_asset_symbol?: string | null;
  stake_asset_type?: 'stock' | 'etf' | 'crypto' | 'forex' | 'commodity' | null;
  stake_asset_quantity?: number | null;
  stake_asset_unit_price_pln?: number | null;
  stake_asset_fx_rate_to_pln?: number | null;
  payout: number;
  status: 'pending' | 'won' | 'lost';
  created_at: string;
}

export interface BetProposal {
  id: string;
  user_id: string;
  title: string;
  category_id: string | null;
  bet_type: '1x2' | '12' | 'multi';
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
  result: 'pending' | 'won' | 'lost';
  bet_title: string | null;
}

export interface CouponHistoryEntry {
  id: string;
  total_odds: number;
  stake: number;
  stake_asset_id?: string | null;
  stake_asset_symbol?: string | null;
  stake_asset_type?: 'stock' | 'etf' | 'crypto' | 'forex' | 'commodity' | null;
  stake_asset_quantity?: number | null;
  stake_asset_unit_price_pln?: number | null;
  stake_asset_fx_rate_to_pln?: number | null;
  payout: number;
  status: 'pending' | 'won' | 'lost';
  created_at: string;
  legs: CouponLeg[] | null;
}

export interface SocialCouponEntry extends CouponHistoryEntry {
  user_id: string;
  username: string;
}

// --- Social types ---

export type ReactionEmoji = 'like' | 'heart' | 'laugh' | 'wow' | 'sad' | 'angry' | 'fire';

export type FeedItemType = 'post' | 'coupon';

export type NotificationType = 'mention_post' | 'mention_comment' | 'coupon_won' | 'comment_post';

export interface SocialFeedItem {
  id: string;
  item_type: FeedItemType;
  user_id: string;
  username: string;
  avatar_url?: string | null;
  content: string | null;
  total_odds: number | null;
  stake: number | null;
  stake_asset_id?: string | null;
  stake_asset_symbol?: string | null;
  stake_asset_type?: 'stock' | 'etf' | 'crypto' | 'forex' | 'commodity' | null;
  stake_asset_quantity?: number | null;
  stake_asset_unit_price_pln?: number | null;
  stake_asset_fx_rate_to_pln?: number | null;
  payout: number | null;
  status: string | null;
  legs: CouponLeg[] | null;
  created_at: string;
  reactions: Partial<Record<ReactionEmoji, number>> | null;
  comment_count: number;
  my_reaction: ReactionEmoji | null;
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

export const BADGE_DEFINITIONS: Record<string, { emoji: string; name: string; description: string }> = {
  debiutant: { emoji: '🎰', name: 'Debiutant', description: 'Pierwszy postawiony zakład' },
  trafiony: { emoji: '🎯', name: 'Trafiony zakład', description: 'Pierwszy wygrany zakład' },
  kuponista: { emoji: '📋', name: 'Kuponista', description: 'Pierwszy kupon AKO' },
  goraca_passa: { emoji: '🔥', name: 'Gorąca passa', description: '3 wygrane z rzędu' },
  nie_do_zatrzymania: { emoji: '⚡', name: 'Nie do zatrzymania', description: '5 wygranych z rzędu' },
  mistrz_serii: { emoji: '👑', name: 'Mistrz serii', description: '10 wygranych z rzędu' },
  pierwszy_tysiac: { emoji: '💰', name: 'Pierwszy tysiąc', description: 'Łączne wygrane powyżej 1000 zł' },
  wieloryb: { emoji: '🐋', name: 'Wieloryb', description: 'Pojedynczy zakład na 500 zł lub więcej' },
  ryzykant: { emoji: '🎲', name: 'Ryzykant', description: 'Kupon AKO z 5+ wydarzeniami' },
  analityk: { emoji: '🧠', name: 'Analityk', description: 'Win rate powyżej 60% (min. 20 zakładów)' },
  staly_bywalec: { emoji: '📅', name: 'Stały bywalec', description: 'Seria 7 dni' },
  legenda: { emoji: '🏆', name: 'Legenda', description: 'Seria 30 dni' },
  pomyslodawca: { emoji: '💡', name: 'Pomysłodawca', description: 'Pierwsza zaakceptowana propozycja' },
  wszechstronny: { emoji: '🌍', name: 'Wszechstronny', description: 'Zakłady w 4+ kategoriach' },
  multi_fan: { emoji: '🎪', name: 'Multi-fan', description: '10 kuponów AKO' },
};
