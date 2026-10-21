import { alpha, hsl } from './color';

/**
 * Design tokens ported from the web's `src/index.css` (`:root` = dark,
 * `.light` = light). Hex values are exact conversions of the HSL triplets.
 */

export type SchemeName = 'dark' | 'light';

export interface Colors {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  success: string;
  successForeground: string;
  warning: string;
  warningForeground: string;
  border: string;
  input: string;
  ring: string;
  navbar: string;
  navbarForeground: string;
  oddsBg: string;
  oddsFg: string;
  oddsBgAlt: string;
  oddsFgAlt: string;
  oddsSelected: string;
  oddsSelectedFg: string;
  oddsLockedBg: string;
  oddsLockedFg: string;
  liveIndicator: string;
  /** Wallet/top-up chip in the header. */
  navbarChipBg: string;
  navbarChipBorder: string;
}

export interface Gradients {
  /** `.gradient-primary` — main CTA buttons. */
  primary: string;
  /** `.gradient-navbar` / `--navbar-gradient`. */
  navbar: string;
  navbarBorder: string;
  /** `.gradient-banner`. */
  banner: string;
  /** `.gradient-cta`. */
  cta: string;
  /** `.auth-shell` — login background. */
  authShell: string;
  /** `--app-aurora` painted on full-screen shells (`.h-safe-screen.bg-background`). */
  appAurora: string;
  /** `--bookmaker-surface` (`.card-shadow.bg-card`). */
  bookmakerSurface: string;
  /** `--bookmaker-surface-strong` (`.bet-card`). */
  bookmakerSurfaceStrong: string;
  /** `--bookmaker-surface-live` (`.bet-card-live`). */
  bookmakerSurfaceLive: string;
  /** `.app-surface` background. */
  appSurface: string;
}

export interface Shadows {
  card: string;
  cardHover: string;
  appSurface: string;
  betCard: string;
}

export interface Radii {
  /** Tailwind `rounded-sm` = calc(var(--radius) - 4px). */
  sm: number;
  /** Tailwind `rounded-md` = calc(var(--radius) - 2px). */
  md: number;
  /** Tailwind `rounded-lg` = var(--radius). */
  lg: number;
  /** Tailwind fixed sizes. */
  xl: number;
  '2xl': number;
  '3xl': number;
  full: number;
}

export interface Palette {
  scheme: SchemeName;
  colors: Colors;
  gradients: Gradients;
  shadows: Shadows;
  radius: Radii;
}

const darkColors: Colors = {
  background: '#0f0006',
  foreground: '#ffebeb',
  card: '#1a050c',
  cardForeground: '#ffebeb',
  popover: '#1a050c',
  popoverForeground: '#ffebeb',
  primary: '#ff0a54',
  primaryForeground: '#ffffff',
  secondary: '#2c0715',
  secondaryForeground: '#ffebeb',
  muted: '#2c0715',
  mutedForeground: '#e4b4b4',
  accent: '#2c0715',
  accentForeground: '#ffebeb',
  destructive: '#ef4343',
  destructiveForeground: '#ffffff',
  success: '#2fc67a',
  successForeground: '#ffffff',
  warning: '#f6a823',
  warningForeground: '#ffffff',
  border: '#3e1e29',
  input: '#44222d',
  ring: '#ff2969',
  navbar: '#0f0006',
  navbarForeground: '#ffffff',
  oddsBg: '#fdc50d',
  oddsFg: '#1b1918',
  oddsBgAlt: '#ffc229',
  oddsFgAlt: '#1e1c1a',
  oddsSelected: '#0f0006',
  oddsSelectedFg: '#ffffff',
  oddsLockedBg: hsl(46, 38, 26),
  oddsLockedFg: hsl(46, 65, 86),
  liveIndicator: hsl(355, 100, 66),
  navbarChipBg: alpha('#1a050c', 0.8),
  navbarChipBorder: alpha('#3e1e29', 0.7),
};

const lightColors: Colors = {
  background: '#f3f4f6',
  foreground: '#21242c',
  card: '#ffffff',
  cardForeground: '#21242c',
  popover: '#ffffff',
  popoverForeground: '#21242c',
  primary: '#e00013',
  primaryForeground: '#ffffff',
  secondary: '#f3f4f6',
  secondaryForeground: '#21242c',
  muted: '#f0f2f4',
  mutedForeground: '#757c8a',
  accent: '#f3f4f6',
  accentForeground: '#21242c',
  destructive: '#ef4343',
  destructiveForeground: '#ffffff',
  success: '#25b15f',
  successForeground: '#ffffff',
  warning: '#f59f0a',
  warningForeground: '#ffffff',
  border: '#e2e4e9',
  input: '#e2e4e9',
  ring: '#e00013',
  navbar: '#e00013',
  navbarForeground: '#ffffff',
  oddsBg: '#fdc50d',
  oddsFg: '#1b1918',
  oddsBgAlt: '#ffc229',
  oddsFgAlt: '#1e1c1a',
  oddsSelected: '#121317',
  oddsSelectedFg: '#ffffff',
  oddsLockedBg: hsl(46, 98, 52, 0.42),
  oddsLockedFg: hsl(25, 6, 10, 0.72),
  liveIndicator: hsl(355, 100, 40),
  navbarChipBg: 'rgba(255, 255, 255, 0.16)',
  navbarChipBorder: 'rgba(255, 255, 255, 0.25)',
};

const sharedGradients = {
  primary: `linear-gradient(135deg, ${hsl(355, 100, 50)}, ${hsl(355, 80, 40)})`,
  banner: `linear-gradient(135deg, ${hsl(355, 100, 50)}, ${hsl(340, 70, 45)})`,
  cta: `linear-gradient(135deg, ${hsl(355, 100, 50)}, ${hsl(15, 90, 55)})`,
};

const darkGradients: Gradients = {
  ...sharedGradients,
  navbar: `linear-gradient(90deg, ${hsl(0, 0, 0, 0.99)} 0%, ${hsl(338, 100, 4, 0.99)} 32%, ${hsl(343, 86, 20, 0.98)} 70%, ${hsl(343, 86, 34, 0.98)} 100%)`,
  navbarBorder: hsl(342, 100, 52, 0.28),
  authShell: [
    `radial-gradient(900px 520px at 50% -18%, ${hsl(355, 88, 34, 0.34)}, transparent 58%)`,
    `radial-gradient(720px 440px at 100% 0%, ${hsl(355, 82, 28, 0.2)}, transparent 60%)`,
    `linear-gradient(180deg, ${hsl(348, 20, 7)} 0%, ${hsl(340, 28, 5)} 52%, ${hsl(0, 0, 2)} 100%)`,
  ].join(', '),
  appAurora: [
    `radial-gradient(900px 480px at 12% -6%, ${hsl(342, 100, 42, 0.22)}, transparent 58%)`,
    `radial-gradient(780px 440px at 98% -4%, ${hsl(343, 86, 32, 0.18)}, transparent 58%)`,
  ].join(', '),
  bookmakerSurface: [
    `radial-gradient(115% 105% at 100% 0%, ${hsl(342, 100, 52, 0.16)} 0%, ${hsl(343, 86, 32, 0.08)} 38%, transparent 64%)`,
    `linear-gradient(150deg, ${hsl(340, 68, 8)} 0%, ${hsl(338, 78, 5)} 64%, ${hsl(0, 0, 0)} 100%)`,
  ].join(', '),
  bookmakerSurfaceStrong: [
    `radial-gradient(86% 120% at 100% 0%, ${hsl(342, 100, 52, 0.34)} 0%, ${hsl(343, 86, 30, 0.2)} 34%, transparent 64%)`,
    `linear-gradient(150deg, ${hsl(340, 68, 9)} 0%, ${hsl(338, 80, 6)} 60%, ${hsl(0, 0, 0)} 100%)`,
  ].join(', '),
  bookmakerSurfaceLive: [
    `radial-gradient(86% 122% at 100% 0%, ${hsl(342, 100, 54, 0.46)} 0%, ${hsl(343, 86, 34, 0.26)} 34%, transparent 66%)`,
    `linear-gradient(150deg, ${hsl(340, 68, 9)} 0%, ${hsl(338, 82, 6)} 58%, ${hsl(0, 0, 0)} 100%)`,
  ].join(', '),
  appSurface: [
    `radial-gradient(120% 120% at 100% 0%, ${alpha(darkColors.primary, 0.09)}, transparent 48%)`,
    `linear-gradient(155deg, ${alpha(darkColors.card, 0.98)}, ${alpha(darkColors.secondary, 0.72)})`,
  ].join(', '),
};

const lightGradients: Gradients = {
  ...sharedGradients,
  navbar: `linear-gradient(90deg, ${hsl(355, 100, 44)}, ${hsl(355, 90, 38)})`,
  navbarBorder: 'transparent',
  authShell: `linear-gradient(135deg, ${hsl(355, 100, 50)}, ${hsl(355, 85, 39)})`,
  appAurora: 'none',
  bookmakerSurface: `linear-gradient(${lightColors.card}, ${lightColors.card})`,
  bookmakerSurfaceStrong: `linear-gradient(${lightColors.card}, ${lightColors.card})`,
  bookmakerSurfaceLive: [
    `radial-gradient(120% 90% at 100% 0%, ${hsl(355, 90, 58, 0.09)}, transparent 58%)`,
    `linear-gradient(${lightColors.card}, ${lightColors.card})`,
  ].join(', '),
  appSurface: `linear-gradient(${lightColors.card}, ${lightColors.card})`,
};

const darkShadows: Shadows = {
  card: '0px 2px 10px rgba(0, 0, 0, 0.35), 0px 10px 28px rgba(0, 0, 0, 0.28)',
  cardHover: '0px 4px 14px rgba(0, 0, 0, 0.45), 0px 14px 36px rgba(0, 0, 0, 0.38)',
  appSurface:
    '0px 2px 10px rgba(0, 0, 0, 0.35), 0px 10px 28px rgba(0, 0, 0, 0.28), inset 0px 1px 0px rgba(255, 255, 255, 0.05)',
  betCard: 'inset 0px 1px 0px rgba(255, 255, 255, 0.05), inset 0px -1px 0px rgba(0, 0, 0, 0.25)',
};

const lightShadows: Shadows = {
  card: '0px 1px 3px rgba(15, 23, 42, 0.05), 0px 5px 14px rgba(15, 23, 42, 0.07)',
  cardHover: '0px 2px 6px rgba(15, 23, 42, 0.08), 0px 8px 18px rgba(15, 23, 42, 0.1)',
  appSurface: '0px 1px 3px rgba(15, 23, 42, 0.05), 0px 5px 14px rgba(15, 23, 42, 0.07)',
  betCard: 'none',
};

const radiusFor = (base: number): Radii => ({
  sm: base - 4,
  md: base - 2,
  lg: base,
  xl: 12,
  '2xl': 16,
  '3xl': 24,
  full: 9999,
});

export const palettes: Record<SchemeName, Palette> = {
  dark: {
    scheme: 'dark',
    colors: darkColors,
    gradients: darkGradients,
    shadows: darkShadows,
    radius: radiusFor(12),
  },
  light: {
    scheme: 'light',
    colors: lightColors,
    gradients: lightGradients,
    shadows: lightShadows,
    radius: radiusFor(8),
  },
};

/**
 * On phones the Social page always uses this Facebook-like light palette,
 * regardless of the app theme (`.social-mobile-page` overrides in index.css).
 */
export const socialMobileColors = {
  background: '#f0f2f4',
  foreground: '#0b0d0e',
  card: '#ffffff',
  cardForeground: '#0b0d0e',
  primary: '#e00013',
  primaryForeground: '#ffffff',
  secondary: '#f0f2f4',
  muted: '#e9ecef',
  mutedForeground: '#626b75',
  accent: '#e9ecef',
  border: '#dcdfe3',
  input: '#dcdfe3',
  ring: '#e00013',
} as const;

/** Brand constants shared by both schemes. */
export const brand = {
  red: hsl(355, 100, 50),
  gold: hsl(46, 98, 54),
  goldGlow: hsl(46, 98, 56),
  splashBackground: '#0f0e16',
} as const;
