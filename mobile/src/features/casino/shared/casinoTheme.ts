import { Platform } from 'react-native';

/**
 * Tailwind palette values used by the casino screens. The web casino is
 * always dark and image-backed regardless of the app theme, so these are
 * fixed colors, not theme tokens.
 */
export const tw = {
  white: '#ffffff',
  black: '#000000',
  amber100: '#fef3c7',
  amber200: '#fde68a',
  amber300: '#fcd34d',
  amber400: '#fbbf24',
  amber500: '#f59e0b',
  emerald50: '#ecfdf5',
  emerald100: '#d1fae5',
  emerald200: '#a7f3d0',
  emerald300: '#6ee7b7',
  emerald400: '#34d399',
  emerald500: '#10b981',
  emerald950: '#022c22',
  red50: '#fef2f2',
  red300: '#fca5a5',
  red500: '#ef4444',
  red600: '#dc2626',
  red950: '#450a0a',
  rose200: '#fecdd3',
  rose300: '#fda4af',
  rose400: '#fb7185',
  rose500: '#f43f5e',
  stone200: '#e7e5e4',
  stone300: '#d6d3d1',
  stone400: '#a8a29e',
  stone500: '#78716c',
  stone700: '#44403c',
  stone800: '#292524',
  stone900: '#1c1917',
  orange400: '#fb923c',
  sky400: '#38bdf8',
} as const;

/** `rgba()` from a `#rrggbb` Tailwind color and an opacity modifier (`bg-white/10`). */
export function rgba(hex: string, opacity: number): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/** Tailwind `font-mono` (ui-monospace → SF Mono in Safari; Menlo is the closest face apps can name). */
export const MONO_FONT = Platform.select({ ios: 'Menlo', default: 'monospace' });

/** Tailwind `font-serif` (ui-serif, Georgia, …). */
export const SERIF_FONT = Platform.select({ ios: 'Georgia', default: 'serif' });

/** Web `text-[Npx]` without a line-height class inherits the body's 1.5 line height. */
export const arbitraryText = (fontSize: number) => ({ fontSize, lineHeight: fontSize * 1.5 });
