import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { Appearance, StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';

import { usePreferences } from '@/lib/preferences';
import { palettes, type Palette, type SchemeName } from './palette';

export * from './palette';
export { alpha, hsl } from './color';
export { fonts, text } from './typography';

const navigationThemes = {
  dark: {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: palettes.dark.colors.primary,
      background: palettes.dark.colors.background,
      card: palettes.dark.colors.card,
      text: palettes.dark.colors.foreground,
      border: palettes.dark.colors.border,
      notification: palettes.dark.colors.primary,
    },
  },
  light: {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: palettes.light.colors.primary,
      background: palettes.light.colors.background,
      card: palettes.light.colors.card,
      text: palettes.light.colors.foreground,
      border: palettes.light.colors.border,
      notification: palettes.light.colors.primary,
    },
  },
};

export function useScheme(): SchemeName {
  return usePreferences((s) => s.theme);
}

export function useTheme(): Palette {
  return palettes[usePreferences((s) => s.theme)];
}

/** Applies the chosen scheme to native UI (keyboard, alerts, menus, sheets) and navigation. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useScheme();

  useEffect(() => {
    Appearance.setColorScheme(scheme);
  }, [scheme]);

  return <NavigationThemeProvider value={navigationThemes[scheme]}>{children}</NavigationThemeProvider>;
}

type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

/**
 * Declares theme-aware styles once at module level. Styles are built at most
 * once per scheme and reused, so components never allocate style objects.
 *
 *   const useStyles = createStyles(({ colors, radius }) => ({
 *     card: { backgroundColor: colors.card, borderRadius: radius.lg },
 *   }));
 */
export function createStyles<T extends NamedStyles<T>>(factory: (palette: Palette) => T) {
  const cache: Partial<Record<SchemeName, T>> = {};
  return function useStyles(): T {
    const palette = useTheme();
    let styles = cache[palette.scheme];
    if (!styles) {
      styles = StyleSheet.create(factory(palette)) as T;
      cache[palette.scheme] = styles;
    }
    return styles;
  };
}
