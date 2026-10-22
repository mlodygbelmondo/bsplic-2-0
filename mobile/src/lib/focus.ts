import { useIsFocused, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/** True while the app is in the foreground. */
export function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => setActive(state === 'active'));
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

/**
 * True while a sheet or modal route is presented. An RN `Modal` cannot present
 * over it (UIKit refuses and RN never retries), so global dialogs wait.
 */
export function useModalRouteOpen(): boolean {
  const [root] = useSegments();
  return root === 'sheets' || root === 'jackpot';
}

/** True while the screen is focused and the app is in the foreground. */
export function useScreenActive(): boolean {
  const focused = useIsFocused();
  const appActive = useAppActive();
  return focused && appActive;
}
