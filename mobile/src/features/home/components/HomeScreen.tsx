import type { FlashListRef } from '@shopify/flash-list';
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import {
  Easing,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollOffset,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useBootHold } from '@/features/boot/boot-store';
import { CouponBar } from '@/features/coupon/CouponBar';
import { AppHeader } from '@/features/shell/AppHeader';
import { whenOnline } from '@/lib/connectivity';
import { useHasBeenFocused, useScreenActive } from '@/lib/focus';
import { useLiteMotion, useReducedMotion } from '@/lib/motion';
import { getNextScrollChromeState, INITIAL_SCROLL_CHROME_STATE, type ScrollChromeState } from '@/lib/scroll-chrome';
import { createStyles } from '@/theme';
import type { Category } from '@/types/database';
import { ScreenBackground } from '@/ui';
import { betsQueryKey, betsQueryOptions, type BetsCriteria } from '../api/bets';
import { categoriesQueryOptions, toCategoryMap } from '../api/categories';
import { useHomeClockTicker } from '../hooks/use-home-clock';
import { homePreferencesActions, useHomePreferences } from '../hooks/use-home-preferences';
import { useHomeRealtime } from '../hooks/use-home-realtime';
import { buildBetSections } from '../logic/bet-sections';
import { getCategoryFilterIds } from '../logic/category-tree';
import { BetFeedList, buildHomeRows, NO_ROWS, SKELETON_ROWS, type HomeRow } from './BetFeedList';
import { HomeFilterBar } from './HomeFilterBar';

const NO_CATEGORIES: Category[] = [];
/** Filter bar slide: `transition-transform duration-200 ease-out`. */
const CHROME_TIMING = { duration: 200, easing: Easing.bezier(0, 0, 0.58, 1) };
/** Filter bar `mb-2.5`: the gap between it and the first card. */
const FILTER_BAR_GAP = 10;
/** Filter bar height before it is measured: rail + count row + border, or just the count row. */
const ESTIMATED_BAR_HEIGHT = { withRail: 131, withoutRail: 45 };

/**
 * Signed-in sportsbook home (web `AuthenticatedHome` + `HomeShell` + `BetList`
 * at phone width): header, filter bar, jackpot banner, live and regular bet
 * blocks, and the coupon bar.
 */
export function HomeScreen() {
  const styles = useStyles();
  const hasBeenFocused = useHasBeenFocused();
  const screenActive = useScreenActive();
  const lite = useLiteMotion();
  // Tabs stay mounted: the cards' decorative loops stop while another tab or a sheet covers home.
  const stillCards = lite || !screenActive;
  const reducedMotion = useReducedMotion();
  const storedCategory = useHomePreferences((s) => s.category);
  const sort = useHomePreferences((s) => s.sort);
  const activeOnly = useHomePreferences((s) => s.activeOnly);

  const categoriesQuery = useQuery({ ...categoriesQueryOptions(), enabled: hasBeenFocused });
  const categories = categoriesQuery.data ?? NO_CATEGORIES;
  const categoryMap = toCategoryMap(categories);
  // A remembered category that no longer exists (or a failed category load) falls back to all bets.
  const categoriesSettled = categoriesQuery.isSuccess || categoriesQuery.isError;
  const staleCategory = categoriesSettled && storedCategory !== null && !categoryMap[storedCategory];
  const selectedCategory = staleCategory ? null : storedCategory;
  useEffect(() => {
    if (staleCategory) homePreferencesActions.selectCategory(null);
  }, [staleCategory]);

  // A sport covers its leagues too, so a remembered category waits for the
  // category list instead of loading alone and then reloading.
  const categoryIdsReady = !selectedCategory || Boolean(categoryMap[selectedCategory]);
  const criteria: BetsCriteria = {
    categoryIds: getCategoryFilterIds(categories, selectedCategory),
    sort,
    includeInProgress: !activeOnly,
  };
  const betsQuery = useInfiniteQuery({
    ...betsQueryOptions(criteria),
    enabled: hasBeenFocused && categoryIdsReady,
    // A filter without cached bets keeps the current list (dimmed) until its bets arrive.
    placeholderData: keepPreviousData,
    select: (data) => buildBetSections(data.pages, sort),
  });
  const sections = betsQuery.data;
  const refreshingFilter = betsQuery.isPlaceholderData;

  // The list re-keys (and replays its entrance) once the new filter's bets are in.
  const filterKey = `${sort}:${selectedCategory ?? 'all'}:${activeOnly ? 'active' : 'all-states'}`;
  const [listKey, setListKey] = useState(filterKey);
  if (!refreshingFilter && listKey !== filterKey) setListKey(filterKey);

  // First screen after boot: keep the boot overlay up until both lists load or fail.
  const waitingForCategories = categoriesQuery.isPending && categoriesQuery.fetchStatus !== 'paused';
  const waitingForBets = betsQuery.isPending && betsQuery.fetchStatus === 'fetching';
  useBootHold(waitingForBets || waitingForCategories);

  useHomeRealtime(hasBeenFocused, betsQueryKey(criteria));
  useHomeClockTicker(screenActive);

  // Scroll chrome on the UI thread: the filter bar slides away on a deliberate
  // downward scroll, comes back on an upward one and follows pull-to-refresh.
  const listRef = useAnimatedRef<FlashListRef<HomeRow>>();
  const scrollY = useScrollOffset(listRef);
  const contentHeight = useSharedValue(0);
  const viewportHeight = useSharedValue(0);
  const chrome = useSharedValue<ScrollChromeState>(INITIAL_SCROLL_CHROME_STATE);
  const hidden = useSharedValue(0);
  const barHeight = useSharedValue(0);
  const [measuredBarHeight, setMeasuredBarHeight] = useState<number | null>(null);
  const headerSpace =
    (measuredBarHeight ?? (categories.length > 0 ? ESTIMATED_BAR_HEIGHT.withRail : ESTIMATED_BAR_HEIGHT.withoutRail)) +
    FILTER_BAR_GAP;

  const handleBarLayout = (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    barHeight.set(height);
    setMeasuredBarHeight(height);
  };

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
      }
    },
  );

  const barStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: Math.max(0, -scrollY.get()) - barHeight.get() * hidden.get() }],
  }));

  // A new sort/category starts at the top of the list with the filters shown.
  useEffect(() => {
    chrome.set(INITIAL_SCROLL_CHROME_STATE);
    hidden.set(withTiming(0, CHROME_TIMING));
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [filterKey, chrome, hidden, listRef]);

  // The re-keyed list mounts at the top.
  useEffect(() => {
    scrollY.set(0);
  }, [listKey, scrollY]);

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = () => {
    setRefreshing(true);
    void Promise.all([betsQuery.refetch(), categoriesQuery.refetch()]).finally(() => setRefreshing(false));
  };

  const handleLoadMore = () => {
    if (refreshingFilter) return;
    if (betsQuery.hasNextPage && !betsQuery.isFetchingNextPage) void betsQuery.fetchNextPage();
  };

  const rows = sections ? buildHomeRows(sections, categoryMap) : betsQuery.isPending ? SKELETON_ROWS : NO_ROWS;

  return (
    <ScreenBackground>
      <View style={styles.root}>
        <AppHeader />
        <View style={styles.main}>
          <BetFeedList
            key={listKey}
            listRef={listRef}
            rows={rows}
            ready={!betsQuery.isPending}
            headerSpace={headerSpace}
            dimmed={refreshingFilter}
            hasMore={betsQuery.hasNextPage}
            loadingMore={betsQuery.isFetchingNextPage}
            hasRegularBets={(sections?.sortedBets.length ?? 0) > 0}
            onLoadMore={handleLoadMore}
            refreshing={refreshing}
            onRefresh={whenOnline(handleRefresh)}
            contentHeight={contentHeight}
            viewportHeight={viewportHeight}
            lite={stillCards}
            reducedMotion={reducedMotion}
          />
          <HomeFilterBar
            style={barStyle}
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={homePreferencesActions.selectCategory}
            betCount={sections ? sections.liveBets.length + sections.sortedBets.length : null}
            hasMore={betsQuery.hasNextPage}
            activeOnly={activeOnly}
            sort={sort}
            refreshing={refreshingFilter}
            onLayout={handleBarLayout}
            lite={lite}
            reducedMotion={reducedMotion}
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
