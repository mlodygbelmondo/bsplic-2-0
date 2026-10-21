/**
 * Blackjack colors. The web table uses fixed Tailwind colors over the felt
 * artwork in both themes (white/black alphas, amber, emerald, sky), so they
 * are constants rather than theme tokens.
 */

export const white = (a: number) => `rgba(255, 255, 255, ${a})`;
export const black = (a: number) => `rgba(0, 0, 0, ${a})`;

export const bj = {
  white: '#ffffff',
  black: '#000000',
  /** `bg-[#211014]` decision bar and betting panel. */
  panel: '#211014',
  panel95: 'rgba(33, 16, 20, 0.95)',
  amber50: '#fffbeb',
  amber100: '#fef3c7',
  amber200: '#fde68a',
  amber300: '#fcd34d',
  amber400: '#fbbf24',
  amber600: '#d97706',
  green300: '#86efac',
  green400: '#4ade80',
  green500: '#22c55e',
  red200: '#fecaca',
  red400: '#f87171',
  red500: '#ef4444',
  emerald100: '#d1fae5',
  gray300: '#d1d5db',
  sky50: '#f0f9ff',
  zinc800: '#27272a',
} as const;

/** `bg-gradient-to-b from-amber-400 to-amber-600` + `shadow-[0_4px_18px_rgba(251,191,36,0.3)]`. */
export const amberButton = {
  backgroundImage: `linear-gradient(to bottom, ${bj.amber400}, ${bj.amber600})`,
  boxShadow: '0px 4px 18px rgba(251, 191, 36, 0.3)',
} as const;
