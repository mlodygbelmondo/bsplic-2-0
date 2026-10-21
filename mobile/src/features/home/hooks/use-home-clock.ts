import { useEffect } from 'react';
import { create } from 'zustand';

/**
 * Minute clock shared by every bet card (web cards keep their own `now` and
 * refresh it every 60 s while a countdown shows). One shared ticker keeps
 * recycled list cells correct and locks bets that end while on screen.
 */
const useHomeClockStore = create<{ now: number }>(() => ({ now: Date.now() }));

const TICK_MS = 60_000;

export const useHomeNow = () => useHomeClockStore((s) => s.now);

/** Ticks while the home screen is visible; refreshes at once when it becomes visible again. */
export function useHomeClockTicker(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const tick = () => useHomeClockStore.setState({ now: Date.now() });
    tick();
    const interval = setInterval(tick, TICK_MS);
    return () => clearInterval(interval);
  }, [active]);
}
