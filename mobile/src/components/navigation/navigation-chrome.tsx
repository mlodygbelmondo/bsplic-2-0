/* eslint-disable react-refresh/only-export-components -- provider and its hooks form one context API. */
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import {
  Easing,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { useReducedMotion } from '@/components/feedback/use-reduced-motion';

import {
  advanceChromeScroll,
  createChromeScrollState,
  NATIVE_CHROME_SCROLL_CONFIG,
  type ChromeScrollState,
} from './navigation-motion';

interface NavigationChromeContextValue {
  hidden: boolean;
  progress: SharedValue<number>;
  hide(): void;
  show(): void;
}

const NavigationChromeContext = createContext<NavigationChromeContextValue | null>(null);

export function NavigationChromeProvider({ children }: { children: ReactNode }) {
  const reducedMotion = useReducedMotion();
  const [hidden, setHidden] = useState(false);
  const progress = useSharedValue(0);

  const show = useCallback(() => setHidden(false), []);
  const hide = useCallback(() => setHidden(true), []);

  useEffect(() => {
    const target = hidden ? 1 : 0;
    if (reducedMotion) {
      progress.value = target;
      return;
    }
    progress.value = withTiming(target, {
      duration: 210,
      easing: Easing.out(Easing.cubic),
    });
  }, [hidden, progress, reducedMotion]);

  const value = useMemo(
    () => ({ hidden, progress, hide, show }),
    [hidden, progress, hide, show],
  );

  return (
    <NavigationChromeContext.Provider value={value}>
      {children}
    </NavigationChromeContext.Provider>
  );
}

export function useNavigationChrome() {
  const value = use(NavigationChromeContext);
  if (!value) throw new Error('useNavigationChrome must be used inside NavigationChromeProvider');
  return value;
}

export interface ChromeScrollOptions {
  active: boolean;
  minimumHideOffset?: number;
  onBeginDrag?: () => void;
}

export function useChromeScroll({ active, minimumHideOffset, onBeginDrag }: ChromeScrollOptions) {
  const { hidden, hide, show } = useNavigationChrome();
  const trackerRef = useRef<ChromeScrollState>(createChromeScrollState());

  useEffect(() => {
    if (!active) return;
    trackerRef.current = createChromeScrollState(trackerRef.current.lastOffset);
    show();
  }, [active, show]);

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!active) return;
    const next = advanceChromeScroll(
      trackerRef.current,
      event.nativeEvent.contentOffset.y,
      minimumHideOffset === undefined
        ? NATIVE_CHROME_SCROLL_CONFIG
        : { ...NATIVE_CHROME_SCROLL_CONFIG, minimumHideOffset },
    );
    trackerRef.current = next;
    if (next.visibility === 'hidden' && !hidden) hide();
    if (next.visibility === 'visible' && hidden) show();
  }, [active, hidden, hide, minimumHideOffset, show]);

  const onScrollBeginDrag = useCallback(() => {
    if (!active) return;
    onBeginDrag?.();
  }, [active, onBeginDrag]);

  return {
    onScroll,
    onScrollBeginDrag,
    scrollEventThrottle: 16 as const,
  };
}
