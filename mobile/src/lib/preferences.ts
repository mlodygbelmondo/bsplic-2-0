import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { SchemeName } from '@/theme/palette';
import { zustandStorage } from './storage';

interface PreferencesState {
  /** Web default is light; `bsplic.theme` stores the choice. */
  theme: SchemeName;
  /** Roulette sound effects (web key `bsplic.casino.sound`). */
  casinoSound: boolean;
  /** Blackjack sound effects (web key `bsplic.blackjack.muted`). */
  blackjackSound: boolean;
  /** Jackpot draw and ticket sounds (web key `bsplic:jackpot-sound-muted`). */
  jackpotSound: boolean;
  /** In-app notification blip. */
  notificationSound: boolean;
  setTheme: (theme: SchemeName) => void;
  toggleTheme: () => void;
  setCasinoSound: (enabled: boolean) => void;
  setBlackjackSound: (enabled: boolean) => void;
  setJackpotSound: (enabled: boolean) => void;
  setNotificationSound: (enabled: boolean) => void;
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: 'light',
      casinoSound: true,
      blackjackSound: true,
      jackpotSound: true,
      notificationSound: true,
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
      setCasinoSound: (casinoSound) => set({ casinoSound }),
      setBlackjackSound: (blackjackSound) => set({ blackjackSound }),
      setJackpotSound: (jackpotSound) => set({ jackpotSound }),
      setNotificationSound: (notificationSound) => set({ notificationSound }),
    }),
    {
      name: 'bsplic.preferences',
      storage: createJSONStorage(() => zustandStorage),
      partialize: ({ theme, casinoSound, blackjackSound, jackpotSound, notificationSound }) => ({
        theme,
        casinoSound,
        blackjackSound,
        jackpotSound,
        notificationSound,
      }),
    },
  ),
);
