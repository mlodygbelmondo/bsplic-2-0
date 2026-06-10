import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Theme = "dark" | "light";

const THEME_STORAGE_KEY = "bsplic.theme";
const LEGACY_DARK_PALETTE_STORAGE_KEY = "bsplic.darkPalette";

// Keeps the browser/PWA chrome color in sync with the active theme.
const THEME_META_COLORS: Record<Theme, string> = {
  dark: "#090005",
  light: "#dc2626",
};

function readStoredTheme(): Theme {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === "dark"
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("light", theme === "light");
  document.documentElement.removeAttribute("data-dark-palette");
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_META_COLORS[theme]);
}

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readStoredTheme);

  useEffect(() => {
    applyTheme(theme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
      window.localStorage.removeItem(LEGACY_DARK_PALETTE_STORAGE_KEY);
    } catch {
      // Storage unavailable — preferences just won't persist.
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
