import { useIsFocused, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/**
 * True while the app is in the foreground. iOS `inactive` (Control Center,
 * Notification Center, a system prompt) still counts: the app stays on screen.
 */
export function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState !== 'background');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => setActive(state !== 'background'));
    return () => subscription.remove();
  }, []);
  return active;
}

/**
 * True once the screen has been focused at least once. NativeTabs mounts every
 * tab eagerly; tab roots gate queries, images and heavy trees on this so only
 * the visible tab does work on boot.
 */
export function useHasBeenFocused(): boolean {
  const focused = useIsFocused();
  const [seen, setSeen] = useState(focused);
  if (focused && !seen) setSeen(true);
  return seen;
}

/** How long a closed sheet keeps animating away; UIKit refuses new presentations meanwhile. */
const MODAL_DISMISS_MS = 600;

/**
 * True while a sheet or modal route is presented, and briefly after it closes.
 * An RN `Modal` cannot present over it (UIKit refuses and RN never retries),
 * so global dialogs wait.
 */
export function useModalRouteOpen(): boolean {
  const [root] = useSegments();
  const open = root === 'sheets' || root === 'jackpot';
  const [dismissing, setDismissing] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    setDismissing(!open);
  }
  useEffect(() => {
    if (!dismissing) return;
    const timer = setTimeout(() => setDismissing(false), MODAL_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [dismissing]);
  return open || dismissing;
}

/** True while the screen is focused and the app is in the foreground. */
export function useScreenActive(): boolean {
  const focused = useIsFocused();
  const appActive = useAppActive();
  return focused && appActive;
}
