import type { FlashListRef } from '@shopify/flash-list';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import {
  Easing,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollOffset,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useBootHold } from '@/features/boot/boot-store';
import { CouponBar } from '@/features/coupon/CouponBar';
import { AppHeader } from '@/features/shell/AppHeader';
import { useHasBeenFocused, useScreenActive } from '@/lib/focus';
import { useLiteMotion, useReducedMotion } from '@/lib/motion';
import { createStyles } from '@/theme';
import type { Category } from '@/types/database';
import { ScreenBackground } from '@/ui';
import { betsQueryKey, betsQueryOptions, type BetsCriteria } from '../api/bets';
import { categoriesQueryOptions, toCategoryMap } from '../api/categories';
import { useHomeClockTicker } from '../hooks/use-home-clock';
import { forgetStoredCategory, useHomePreferences } from '../hooks/use-home-preferences';
import { useHomeRealtime } from '../hooks/use-home-realtime';
import { buildBetSections } from '../logic/bet-sections';
import { getNextScrollChromeState, INITIAL_SCROLL_CHROME_STATE, type ScrollChromeState } from '../logic/scroll-chrome';
import { BetFeedList, buildHomeRows, NO_ROWS, SKELETON_ROWS, type HomeRow } from './BetFeedList';
import { BetListToolbar, TOOLBAR_HEIGHT, type FilterPanel } from './BetListToolbar';

const NO_CATEGORIES: Category[] = [];
/** Toolbar slide: `transition-transform duration-200 ease-out`. */
const CHROME_TIMING = { duration: 200, easing: Easing.bezier(0, 0, 0.58, 1) };

/**
 * Signed-in sportsbook home (web `AuthenticatedHome` + `HomeShell` + `BetList`
 * at phone width): header, filter toolbar, jackpot banner, live and regular
 * bet blocks, and the coupon bar.
 */
export function HomeScreen() {
  const styles = useStyles();
  const hasBeenFocused = useHasBeenFocused();
  const screenActive = useScreenActive();
  const lite = useLiteMotion();
  const reducedMotion = useReducedMotion();
  const { storedCategory, selectCategory, sort, setSort, activeOnly, toggleActiveOnly } = useHomePreferences();

  const categoriesQuery = useQuery({ ...categoriesQueryOptions(), enabled: hasBeenFocused });
  const categories = categoriesQuery.data ?? NO_CATEGORIES;
  const categoryMap = toCategoryMap(categories);
  // A remembered category that no longer exists falls back to all bets.
  const staleCategory = categoriesQuery.isSuccess && storedCategory !== null && !categoryMap[storedCategory];
  const selectedCategory = staleCategory ? null : storedCategory;
  useEffect(() => {
    if (staleCategory) forgetStoredCategory();
  }, [staleCategory]);

  const criteria: BetsCriteria = { category: selectedCategory, sort, includeInProgress: !activeOnly };
  const betsQuery = useInfiniteQuery({
    ...betsQueryOptions(criteria),
    enabled: hasBeenFocused,
    select: (data) => buildBetSections(data.pages, sort),
  });
  const sections = betsQuery.data;

  // First screen after boot: keep the boot overlay up until both lists load or fail.
  const waitingForBets = betsQuery.isPending && betsQuery.fetchStatus !== 'paused';
  const waitingForCategories = categoriesQuery.isPending && categoriesQuery.fetchStatus !== 'paused';
  useBootHold(waitingForBets || waitingForCategories);

  useHomeRealtime(hasBeenFocused, betsQueryKey(criteria));
  useHomeClockTicker(screenActive);

  const [panel, setPanel] = useState<FilterPanel | null>(null);
  if (!screenActive && panel !== null) setPanel(null);

  // Scroll chrome on the UI thread: the toolbar slides away on a deliberate
  // downward scroll, comes back on an upward one and follows pull-to-refresh.
  const listRef = useAnimatedRef<FlashListRef<HomeRow>>();
  const scrollY = useScrollOffset(listRef);
  const contentHeight = useSharedValue(0);
  const viewportHeight = useSharedValue(0);
  const chrome = useSharedValue<ScrollChromeState>(INITIAL_SCROLL_CHROME_STATE);
  const hidden = useSharedValue(0);
  const panelOpen = useSharedValue(false);

  useEffect(() => {
    panelOpen.set(panel !== null);
  }, [panel, panelOpen]);

  useAnimatedReaction(
    () => scrollY.get(),
    (offset, previous) => {
      if (previous === null || offset === previous) return;
      const current = chrome.get();
      const next = getNextScrollChromeState(current, {
        scrollTop: offset,
        scrollHeight: contentHeight.get(),
        clientHeight: viewportHeight.get(),
      });
      chrome.set(next);
      if (next.hidden !== current.hidden) {
        hidden.set(withTiming(next.hidden ? 1 : 0, CHROME_TIMING));
        if (next.hidden && panelOpen.get()) scheduleOnRN(setPanel, null);
      }
    },
  );

  const toolbarStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: Math.max(0, -scrollY.get()) - TOOLBAR_HEIGHT * hidden.get() }],
  }));

  // Changing a filter remounts the list at the top, so the toolbar must show again.
  const listKey = `${sort}:${selectedCategory ?? 'all'}:${activeOnly ? 'active' : 'all-states'}`;
  useEffect(() => {
    chrome.set(INITIAL_SCROLL_CHROME_STATE);
    hidden.set(withTiming(0, CHROME_TIMING));
    scrollY.set(0);
  }, [listKey, chrome, hidden, scrollY]);

  // Taps outside the toolbar close an open filter panel without being swallowed.
  const touchStartedInToolbar = useRef(false);
  const handleRootTouch = () => {
    if (touchStartedInToolbar.current) {
      touchStartedInToolbar.current = false;
      return;
    }
    if (panel !== null) setPanel(null);
  };

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([betsQuery.refetch(), categoriesQuery.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleLoadMore = () => {
    if (betsQuery.hasNextPage && !betsQuery.isFetchingNextPage) void betsQuery.fetchNextPage();
  };

  const rows = sections ? buildHomeRows(sections, categoryMap) : betsQuery.isPending ? SKELETON_ROWS : NO_ROWS;

  return (
    <ScreenBackground>
      <View style={styles.root} onTouchStart={handleRootTouch}>
        <AppHeader />
        <View style={styles.main}>
          <BetFeedList
            key={listKey}
            listRef={listRef}
            rows={rows}
            ready={!betsQuery.isPending}
            hasMore={betsQuery.hasNextPage}
            loadingMore={betsQuery.isFetchingNextPage}
            hasRegularBets={(sections?.sortedBets.length ?? 0) > 0}
            onLoadMore={handleLoadMore}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            contentHeight={contentHeight}
            viewportHeight={viewportHeight}
            lite={lite}
            reducedMotion={reducedMotion}
          />
          <BetListToolbar
            style={toolbarStyle}
            panel={panel}
            onTogglePanel={(next) => setPanel((current) => (current === next ? null : next))}
            onClosePanel={() => setPanel(null)}
            sort={sort}
            onSelectSort={setSort}
            activeOnly={activeOnly}
            onToggleActiveOnly={toggleActiveOnly}
            selectedCategory={selectedCategory}
            categories={categories}
            categoryMap={categoryMap}
            onSelectCategory={selectCategory}
            onTouchInside={() => {
              touchStartedInToolbar.current = true;
            }}
          />
        </View>
        <CouponBar />
      </View>
    </ScreenBackground>
  );
}

const useStyles = createStyles(() => ({
  root: { flex: 1 },
  // HomeShell `pt-2`; the list clips at its top edge like the web scroll container.
  main: { flex: 1, marginTop: 8, overflow: 'hidden' },
}));
