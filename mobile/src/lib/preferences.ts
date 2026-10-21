import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { SchemeName } from '@/theme/palette';
import { zustandStorage } from './storage';

interface PreferencesState {
  /** Web default is light; `bsplic.theme` stores the choice. */
  theme: SchemeName;
  /** Casino sound effects (web key `bsplic.casino.sound`). */
  casinoSound: boolean;
  /** In-app notification blip. */
  notificationSound: boolean;
  setTheme: (theme: SchemeName) => void;
  toggleTheme: () => void;
  setCasinoSound: (enabled: boolean) => void;
  setNotificationSound: (enabled: boolean) => void;
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: 'light',
      casinoSound: true,
      notificationSound: true,
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
      setCasinoSound: (casinoSound) => set({ casinoSound }),
      setNotificationSound: (notificationSound) => set({ notificationSound }),
    }),
    {
      name: 'bsplic.preferences',
      storage: createJSONStorage(() => zustandStorage),
      partialize: ({ theme, casinoSound, notificationSound }) => ({ theme, casinoSound, notificationSound }),
    },
  ),
);
