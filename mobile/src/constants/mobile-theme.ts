export type AppThemeName = 'light' | 'dark';

export type AppThemeTokens = {
  name: AppThemeName;
  dark: boolean;
  colors: {
    background: string;
    backgroundElevated: string;
    foreground: string;
    card: string;
    cardStrong: string;
    popover: string;
    primary: string;
    primaryPressed: string;
    primaryForeground: string;
    secondary: string;
    muted: string;
    mutedForeground: string;
    border: string;
    input: string;
    ring: string;
    destructive: string;
    success: string;
    warning: string;
    odds: string;
    oddsForeground: string;
    navbar: string;
    navbarForeground: string;
    glass: string;
    glassBorder: string;
    casino: string;
    casinoCard: string;
    casinoForeground: string;
    selectedYellow: string;
    overlay: string;
  };
  radii: {
    small: number;
    medium: number;
    large: number;
    xlarge: number;
    pill: number;
  };
  spacing: {
    xsmall: number;
    small: number;
    medium: number;
    large: number;
    xlarge: number;
  };
  typography: {
    regular: string;
    medium: string;
    semibold: string;
    bold: string;
    black: string;
  };
};

const shared = {
  radii: { small: 8, medium: 12, large: 16, xlarge: 20, pill: 999 },
  spacing: { xsmall: 4, small: 8, medium: 16, large: 24, xlarge: 32 },
  typography: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
    black: 'Inter_900Black',
  },
} as const;

export const MOBILE_THEMES: Record<AppThemeName, AppThemeTokens> = {
  dark: {
    name: 'dark',
    dark: true,
    colors: {
      background: '#0F0008',
      backgroundElevated: '#18050D',
      foreground: '#FFF0F0',
      card: '#1A050D',
      cardStrong: '#230711',
      popover: '#1A050D',
      primary: '#FF0A54',
      primaryPressed: '#D9003E',
      primaryForeground: '#FFFFFF',
      secondary: '#2C0717',
      muted: '#2C0717',
      mutedForeground: '#E6B3B3',
      border: '#3D1E28',
      input: '#44212D',
      ring: '#FF2969',
      destructive: '#EF4444',
      success: '#2EC477',
      warning: '#F5A623',
      odds: '#FBD113',
      oddsForeground: '#1B1918',
      navbar: '#0F0008',
      navbarForeground: '#FFFFFF',
      glass: 'rgba(23, 8, 17, 0.88)',
      glassBorder: 'rgba(255, 255, 255, 0.12)',
      casino: '#09090B',
      casinoCard: 'rgba(12, 10, 16, 0.90)',
      casinoForeground: '#FFFFFF',
      selectedYellow: '#FFE14A',
      overlay: 'rgba(0, 0, 0, 0.72)',
    },
    ...shared,
  },
  light: {
    name: 'light',
    dark: false,
    colors: {
      background: '#F3F4F6',
      backgroundElevated: '#FFFFFF',
      foreground: '#21242C',
      card: '#FFFFFF',
      cardStrong: '#FFFFFF',
      popover: '#FFFFFF',
      primary: '#E00013',
      primaryPressed: '#BF0016',
      primaryForeground: '#FFFFFF',
      secondary: '#F4F5F7',
      muted: '#F1F2F4',
      mutedForeground: '#747982',
      border: '#E2E4E8',
      input: '#E2E4E8',
      ring: '#E0001A',
      destructive: '#EF4444',
      success: '#25B56A',
      warning: '#F59E0B',
      odds: '#FBD113',
      oddsForeground: '#1B1918',
      navbar: '#E00013',
      navbarForeground: '#FFFFFF',
      glass: 'rgba(255, 255, 255, 0.86)',
      glassBorder: 'rgba(255, 255, 255, 0.78)',
      casino: '#09090B',
      casinoCard: 'rgba(12, 10, 16, 0.90)',
      casinoForeground: '#FFFFFF',
      selectedYellow: '#EAB308',
      overlay: 'rgba(15, 23, 42, 0.48)',
    },
    ...shared,
  },
};

export type MobileNavigationTheme = {
  dark: boolean;
  colors: {
    primary: string;
    background: string;
    card: string;
    text: string;
    border: string;
    notification: string;
  };
  fonts: {
    regular: { fontFamily: string; fontWeight: '400' };
    medium: { fontFamily: string; fontWeight: '500' };
    bold: { fontFamily: string; fontWeight: '700' };
    heavy: { fontFamily: string; fontWeight: '900' };
  };
};

export function createMobileNavigationTheme(tokens: AppThemeTokens): MobileNavigationTheme {
  return {
    dark: tokens.dark,
    colors: {
      primary: tokens.colors.primary,
      background: tokens.colors.background,
      card: tokens.colors.card,
      text: tokens.colors.foreground,
      border: tokens.colors.border,
      notification: tokens.colors.primary,
    },
    fonts: {
      regular: { fontFamily: tokens.typography.regular, fontWeight: '400' },
      medium: { fontFamily: tokens.typography.medium, fontWeight: '500' },
      bold: { fontFamily: tokens.typography.bold, fontWeight: '700' },
      heavy: { fontFamily: tokens.typography.black, fontWeight: '900' },
    },
  };
}

export const MOBILE_THEME_STORAGE_KEY = 'bsplic.theme';
export const MINIMUM_TOUCH_TARGET = 44;
