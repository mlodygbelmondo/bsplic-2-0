export interface Profile {
  id: string;
  username: string;
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
  payout: number;
  status: 'pending' | 'won' | 'lost';
  created_at: string;
  legs: CouponLeg[] | null;
}

export interface SocialCouponEntry extends CouponHistoryEntry {
  user_id: string;
  username: string;
}

export interface PublicProfile {
  id: string;
  username: string;
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
