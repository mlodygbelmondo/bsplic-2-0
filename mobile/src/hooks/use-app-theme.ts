import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  createMobileNavigationTheme,
  MOBILE_THEMES,
  MOBILE_THEME_STORAGE_KEY,
  type AppThemeName,
  type AppThemeTokens,
  type MobileNavigationTheme,
} from '@/constants/mobile-theme';

export interface AppThemeStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export interface AppThemeContextValue {
  theme: AppThemeName;
  tokens: AppThemeTokens;
  navigationTheme: MobileNavigationTheme;
  isHydrated: boolean;
  setTheme(theme: AppThemeName): void;
  toggleTheme(): void;
}

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

export interface AppThemeProviderProps {
  children: ReactNode;
  storage?: AppThemeStorage;
  initialTheme?: AppThemeName;
}

function isAppThemeName(value: string | null): value is AppThemeName {
  return value === 'light' || value === 'dark';
}

export function AppThemeProvider({
  children,
  storage,
  initialTheme = 'light',
}: AppThemeProviderProps) {
  const [theme, updateTheme] = useState<AppThemeName>(initialTheme);
  const [isHydrated, setIsHydrated] = useState(!storage);

  useEffect(() => {
    let active = true;

    if (!storage) {
      setIsHydrated(true);
      return () => {
        active = false;
      };
    }

    void storage
      .getItem(MOBILE_THEME_STORAGE_KEY)
      .then((storedTheme) => {
        if (active && isAppThemeName(storedTheme)) updateTheme(storedTheme);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setIsHydrated(true);
      });

    return () => {
      active = false;
    };
  }, [storage]);

  const setTheme = useCallback(
    (nextTheme: AppThemeName) => {
      updateTheme(nextTheme);
      if (storage) void storage.setItem(MOBILE_THEME_STORAGE_KEY, nextTheme).catch(() => undefined);
    },
    [storage],
  );

  const toggleTheme = useCallback(() => {
    updateTheme((currentTheme) => {
      const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
      if (storage) void storage.setItem(MOBILE_THEME_STORAGE_KEY, nextTheme).catch(() => undefined);
      return nextTheme;
    });
  }, [storage]);

  const value = useMemo<AppThemeContextValue>(() => {
    const tokens = MOBILE_THEMES[theme];
    return {
      theme,
      tokens,
      navigationTheme: createMobileNavigationTheme(tokens),
      isHydrated,
      setTheme,
      toggleTheme,
    };
  }, [isHydrated, setTheme, theme, toggleTheme]);

  return createElement(AppThemeContext.Provider, { value }, children);
}

export function useAppTheme(): AppThemeContextValue {
  const context = useContext(AppThemeContext);
  if (!context) throw new Error('useAppTheme must be used within AppThemeProvider');
  return context;
}
