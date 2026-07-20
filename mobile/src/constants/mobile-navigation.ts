export type MobileNavKey = 'bets' | 'social' | 'roulette' | 'blackjack' | 'rankings';

export type MobileNavIconName = 'house' | 'message-circle' | 'circle-dot' | 'club' | 'trophy';

export type MobileNavItem = {
  key: MobileNavKey;
  label: 'Zakłady' | 'Social' | 'Ruletka' | 'Blackjack' | 'Rankingi';
  href: '/' | '/social' | '/casino/roulette' | '/casino/blackjack' | '/rankings';
  icon: MobileNavIconName;
};

export const MOBILE_NAV_ITEMS: readonly MobileNavItem[] = [
  { key: 'bets', label: 'Zakłady', href: '/', icon: 'house' },
  { key: 'social', label: 'Social', href: '/social', icon: 'message-circle' },
  { key: 'roulette', label: 'Ruletka', href: '/casino/roulette', icon: 'circle-dot' },
  { key: 'blackjack', label: 'Blackjack', href: '/casino/blackjack', icon: 'club' },
  { key: 'rankings', label: 'Rankingi', href: '/rankings', icon: 'trophy' },
] as const;
