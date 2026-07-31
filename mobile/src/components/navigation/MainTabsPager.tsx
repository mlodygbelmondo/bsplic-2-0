import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import PagerView, {
  type PagerViewOnPageScrollEventData,
  type PagerViewOnPageSelectedEvent,
} from 'react-native-pager-view';
import Animated, {
  useEvent,
  type SharedValue,
} from 'react-native-reanimated';

import { useReducedMotion } from '@/components/feedback/use-reduced-motion';
import { MOBILE_NAV_ITEMS, type MobileNavKey } from '@/constants/mobile-navigation';
import { BlackjackScreen } from '@/features/casino/components/blackjack-screen';
import { RouletteScreen } from '@/features/casino/components/roulette-screen';
import { SportsbookScreen } from '@/features/home/components/sportsbook-screen';
import { RankingsScreen } from '@/features/rankings/components/rankings-screen';
import { SocialScreen } from '@/features/social';

import { useNavigationChrome } from './navigation-chrome';
import {
  getMountedPagerIndexes,
  isPagerSwipeEnabled,
  resolvePagerRouteSync,
  shouldAcceptPagerSelection,
} from './navigation-motion';

const AnimatedPagerView = Animated.createAnimatedComponent(PagerView);

export interface MainTabsPagerHandle {
  navigateTo(key: MobileNavKey): void;
}

interface MainTabsPagerProps {
  routeKey: MobileNavKey | null;
  topInset: number;
  visible: boolean;
  tabPosition: SharedValue<number>;
  onActiveKeyChange(key: MobileNavKey): void;
}

function indexForKey(key: MobileNavKey | null) {
  return Math.max(0, MOBILE_NAV_ITEMS.findIndex((item) => item.key === key));
}

function mountedKeysForIndex(index: number) {
  return new Set(
    getMountedPagerIndexes(index, MOBILE_NAV_ITEMS.length).map(
      (mountedIndex) => MOBILE_NAV_ITEMS[mountedIndex].key,
    ),
  );
}

function PagerPage({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <View style={styles.page} collapsable={false}>
      {children}
    </View>
  );
}

export const MainTabsPager = forwardRef<MainTabsPagerHandle, MainTabsPagerProps>(
  function MainTabsPager({ routeKey, topInset, visible, tabPosition, onActiveKeyChange }, ref) {
    const reducedMotion = useReducedMotion();
    const { show: showChrome } = useNavigationChrome();
    const initialIndex = indexForKey(routeKey);
    const [displayIndex, setDisplayIndex] = useState(initialIndex);
    const [mountedKeys, setMountedKeys] = useState<Set<MobileNavKey>>(
      () => mountedKeysForIndex(initialIndex),
    );
    const [swipeBlocked, setSwipeBlocked] = useState(false);
    const [programmaticTransition, setProgrammaticTransition] = useState(false);
    const pagerRef = useRef<PagerView>(null);
    const displayIndexRef = useRef(initialIndex);
    const pendingRouteKeyRef = useRef<MobileNavKey | null>(null);
    const requestedIndexRef = useRef<number | null>(null);
    const navigationFrameRef = useRef<number | null>(null);
    const nativeIndexRef = useRef(initialIndex);
    const visibleRef = useRef(visible);
    visibleRef.current = visible;
    const pageScrollHandler = useEvent<PagerViewOnPageScrollEventData>((event) => {
      'worklet';
      tabPosition.value = event.position + event.offset;
    }, ['onPageScroll']);

    const updateSelectedPage = useCallback((targetIndex: number) => {
      if (!visibleRef.current) return;
      const item = MOBILE_NAV_ITEMS[targetIndex];
      if (!item) return;

      const changed = displayIndexRef.current !== targetIndex;
      displayIndexRef.current = targetIndex;
      setDisplayIndex(targetIndex);
      setMountedKeys(mountedKeysForIndex(targetIndex));
      setSwipeBlocked(false);
      setProgrammaticTransition(false);
      showChrome();
      onActiveKeyChange(item.key);
      tabPosition.value = targetIndex;

      if (routeKey !== item.key) {
        pendingRouteKeyRef.current = item.key;
        router.replace(item.href);
      }

      if (changed && Platform.OS === 'ios') {
        void Haptics.selectionAsync();
      }
    }, [onActiveKeyChange, routeKey, showChrome, tabPosition]);

    const onPageSelected = useCallback((event: PagerViewOnPageSelectedEvent) => {
      const selectedIndex = Math.round(event.nativeEvent.position);
      nativeIndexRef.current = selectedIndex;
      if (!shouldAcceptPagerSelection(requestedIndexRef.current, selectedIndex, visibleRef.current)) {
        return;
      }
      requestedIndexRef.current = null;
      updateSelectedPage(selectedIndex);
    }, [updateSelectedPage]);

    const navigateToIndex = useCallback((targetIndex: number) => {
      if (targetIndex < 0 || targetIndex >= MOBILE_NAV_ITEMS.length) return;
      if (targetIndex === displayIndexRef.current) {
        showChrome();
        return;
      }

      const item = MOBILE_NAV_ITEMS[targetIndex];
      const pendingFrame = navigationFrameRef.current;
      const hadPendingFrame = pendingFrame !== null;
      if (pendingFrame !== null) {
        cancelAnimationFrame(pendingFrame);
        navigationFrameRef.current = null;
      }
      requestedIndexRef.current = targetIndex;
      displayIndexRef.current = targetIndex;
      setDisplayIndex(targetIndex);
      setMountedKeys((current) => new Set([...current, ...mountedKeysForIndex(targetIndex)]));
      setSwipeBlocked(false);
      setProgrammaticTransition(true);
      showChrome();
      onActiveKeyChange(item.key);
      pendingRouteKeyRef.current = item.key;
      router.replace(item.href);
      if (Platform.OS === 'ios') void Haptics.selectionAsync();

      if (hadPendingFrame && nativeIndexRef.current === targetIndex) {
        requestedIndexRef.current = null;
        setProgrammaticTransition(false);
        setMountedKeys(mountedKeysForIndex(targetIndex));
        tabPosition.value = targetIndex;
        return;
      }
      navigationFrameRef.current = requestAnimationFrame(() => {
        navigationFrameRef.current = null;
        if (reducedMotion) {
          tabPosition.value = targetIndex;
          pagerRef.current?.setPageWithoutAnimation(targetIndex);
          nativeIndexRef.current = targetIndex;
          requestedIndexRef.current = null;
          setMountedKeys(mountedKeysForIndex(targetIndex));
          setProgrammaticTransition(false);
        }
        else pagerRef.current?.setPage(targetIndex);
      });
    }, [onActiveKeyChange, reducedMotion, showChrome, tabPosition]);

    useImperativeHandle(ref, () => ({
      navigateTo(key) {
        navigateToIndex(indexForKey(key));
      },
    }), [navigateToIndex]);

    useEffect(() => {
      const displayKey = MOBILE_NAV_ITEMS[displayIndexRef.current].key;
      const action = resolvePagerRouteSync({
        displayKey,
        pendingRouteKey: pendingRouteKeyRef.current,
        routeKey,
      });

      if (action === 'acknowledge') {
        pendingRouteKeyRef.current = null;
        if (routeKey === null) requestedIndexRef.current = null;
        return;
      }
      if (action !== 'synchronize' || !routeKey) return;

      const nextIndex = indexForKey(routeKey);
      requestedIndexRef.current = null;
      displayIndexRef.current = nextIndex;
      setDisplayIndex(nextIndex);
      setMountedKeys(mountedKeysForIndex(nextIndex));
      setSwipeBlocked(false);
      setProgrammaticTransition(false);
      nativeIndexRef.current = nextIndex;
      pagerRef.current?.setPageWithoutAnimation(nextIndex);
      tabPosition.value = nextIndex;
      onActiveKeyChange(routeKey);
      showChrome();
    }, [onActiveKeyChange, routeKey, showChrome, tabPosition]);

    useEffect(() => {
      if (visible) return;
      requestedIndexRef.current = null;
      pendingRouteKeyRef.current = null;
      setProgrammaticTransition(false);
      if (navigationFrameRef.current !== null) {
        cancelAnimationFrame(navigationFrameRef.current);
        navigationFrameRef.current = null;
      }
    }, [visible]);

    useEffect(() => () => {
      if (navigationFrameRef.current !== null) {
        cancelAnimationFrame(navigationFrameRef.current);
      }
    }, []);

    return (
      <View
        pointerEvents={visible ? 'auto' : 'none'}
        style={[StyleSheet.absoluteFill, styles.container, !visible && styles.hidden]}
      >
        <AnimatedPagerView
          ref={pagerRef}
          style={styles.container}
          initialPage={initialIndex}
          scrollEnabled={isPagerSwipeEnabled({
            visible,
            screenBlocked: swipeBlocked,
            programmaticTransition,
          })}
          overdrag
          onPageScroll={pageScrollHandler as unknown as ComponentProps<typeof PagerView>['onPageScroll']}
          onPageSelected={onPageSelected}
        >
          {MOBILE_NAV_ITEMS.map((item, index) => {
            const isActive = visible && index === displayIndex;
            const block = isActive ? setSwipeBlocked : undefined;

            return (
              <PagerPage key={item.key}>
                {mountedKeys.has(item.key) ? (
                  <>
                    {item.key === 'bets' ? <SportsbookScreen active={isActive} topInset={topInset} onSwipeBlockedChange={block} /> : null}
                    {item.key === 'social' ? <SocialScreen active={isActive} topInset={topInset} onSwipeBlockedChange={block} /> : null}
                    {item.key === 'roulette' ? <RouletteScreen active={isActive} topInset={topInset} onSwipeBlockedChange={block} /> : null}
                    {item.key === 'blackjack' ? <BlackjackScreen active={isActive} topInset={topInset} onSwipeBlockedChange={block} /> : null}
                    {item.key === 'rankings' ? <RankingsScreen active={isActive} topInset={topInset} /> : null}
                  </>
                ) : null}
              </PagerPage>
            );
          })}
        </AnimatedPagerView>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  hidden: { opacity: 0 },
  page: { width: '100%', height: '100%' },
});
