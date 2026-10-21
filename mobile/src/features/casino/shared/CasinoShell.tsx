import type { ReactNode } from 'react';
import { View } from 'react-native';

/**
 * SCAFFOLD — casino screen shell (web `CasinoLayout` + `.casino-page-bg`): AppHeader, dark
 * image-backed background, scroll-to-top per screen. Used by the hub, roulette, blackjack
 * and slots. Owner: casino worker. Keep the export name and props.
 */
export function CasinoShell({ children }: { children: ReactNode }) {
  return <View style={{ flex: 1, backgroundColor: '#0b0507' }}>{children}</View>;
}
