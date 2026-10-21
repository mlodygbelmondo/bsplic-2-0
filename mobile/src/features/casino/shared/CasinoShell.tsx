import type { ReactNode } from 'react';
import { View } from 'react-native';

import { AppHeader } from '@/features/shell/AppHeader';
import { createStyles } from '@/theme';

/** `.casino-page-bg` from the web `index.css`. */
const CASINO_PAGE_BG = [
  'radial-gradient(1200px 700px at 50% -12%, rgba(250, 204, 21, 0.14), transparent 52%)',
  'radial-gradient(900px 700px at 8% 18%, rgba(220, 38, 38, 0.18), transparent 54%)',
  'radial-gradient(1200px 900px at 92% 0%, rgba(120, 13, 25, 0.28), transparent 48%)',
  'radial-gradient(900px 620px at 50% 35%, rgba(180, 83, 9, 0.08), transparent 60%)',
  'linear-gradient(180deg, #09090b 0%, #13070b 28%, #0c0a10 62%, #07070a 100%)',
].join(', ');

/**
 * Casino screen shell (web `CasinoLayout`): the app header over the dark
 * `.casino-page-bg` backdrop. Each game brings its own scroll view and fixed
 * bars; since every casino screen is its own stack screen with its own scroll
 * view, each one starts at the top (the web resets `main.scrollTop` per route).
 */
export function CasinoShell({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.root}>
      <AppHeader />
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const useStyles = createStyles(() => ({
  root: { flex: 1, backgroundColor: '#09090b', backgroundImage: CASINO_PAGE_BG, overflow: 'hidden' },
  body: { flex: 1 },
}));
