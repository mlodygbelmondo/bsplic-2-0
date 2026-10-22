import { useEffect } from 'react';
import { create } from 'zustand';

/**
 * Minute clock shared by bet cards and social time labels (web cards keep
 * their own `now` and refresh it every 60 s while a countdown shows). One
 * shared ticker keeps recycled list cells correct, locks bets that end while
 * on screen and moves "5 min temu" labels forward.
 */
const useMinuteClockStore = create<{ now: number }>(() => ({ now: Date.now() }));

const TICK_MS = 60_000;

export const useMinuteNow = () => useMinuteClockStore((s) => s.now);

/**
 * Ticks on each full minute while the calling screen is visible, and catches up
 * at once when it becomes visible again. The value is the start of the minute,
 * so coming back within the same minute re-renders nothing.
 */
export function useMinuteClockTicker(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const tick = () => useMinuteClockStore.setState({ now: Math.floor(Date.now() / TICK_MS) * TICK_MS });
    tick();
    let interval: ReturnType<typeof setInterval> | undefined;
    const timeout = setTimeout(() => {
      tick();
      interval = setInterval(tick, TICK_MS);
    }, TICK_MS - (Date.now() % TICK_MS));
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [active]);
}
