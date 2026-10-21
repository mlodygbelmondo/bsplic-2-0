import { Platform, type TextStyle } from 'react-native';

/** Inter is embedded natively (expo-font config plugin); select faces by weight. */
export const fonts = {
  family: 'Inter',
} as const;

const inter = (fontSize: number, lineHeight: number, fontWeight: TextStyle['fontWeight'] = '400'): TextStyle => ({
  fontFamily: fonts.family,
  fontSize,
  lineHeight,
  fontWeight,
});

/**
 * Tailwind text scale (size / line-height in px) used across the web app.
 * Combine with a weight: `[text.sm, { fontWeight: '700' }]`.
 */
export const text = {
  '2xs': inter(10, 14),
  xs: inter(12, 16),
  sm: inter(14, 20),
  base: inter(16, 24),
  lg: inter(18, 28),
  xl: inter(20, 28),
  '2xl': inter(24, 32),
  '3xl': inter(30, 36),
  '4xl': inter(36, 40),
  '5xl': inter(48, 48),
} as const;

/**
 * The web loads Inter without italic faces, so browsers draw a synthetic
 * oblique (about 14°). iOS never synthesizes italics for custom fonts (it falls
 * back to another face), so skew the glyphs there; Android synthesizes it.
 * Meant for single-line text (wordmarks, labels).
 */
export const fauxItalic: TextStyle =
  Platform.OS === 'ios' ? { transform: [{ skewX: '-14deg' }] } : { fontStyle: 'italic' };
