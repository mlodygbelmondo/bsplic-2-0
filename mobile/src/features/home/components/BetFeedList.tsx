import { FlashList, type FlashListRef, type ListRenderItemInfo } from '@shopify/flash-list';
import { useEffect } from 'react';
import { Pressable, RefreshControl, Text as RNText, View } from 'react-native';
import { Easing, useSharedValue, withTiming, type AnimatedRef, type SharedValue } from 'react-native-reanimated';

import { DailyJackpotCard } from '@/features/jackpot/DailyJackpotCard';
import { createStyles, useTheme } from '@/theme';
import type { Bet, Category } from '@/types/database';
import type { BetSections } from '../logic/bet-sections';
import { BetCardSkeleton } from './BetCardSkeleton';
import { TOOLBAR_SPACE } from './BetListToolbar';
import { BetRow, ENTER_TOTAL_MS, type RowGap } from './BetRow';

const MAX_FONT_SCALE = 1.35;

export type HomeRow =
  | { kind: 'bet'; key: string; bet: Bet; category?: Category; gap: RowGap; enterIndex: number }
  | { kind: 'skeleton'; key: string; gap: RowGap };

const SKELETON_COUNT = 4;
export const SKELETON_ROWS: HomeRow[] = Array.from({ length: SKELETON_COUNT }, (_, index) => ({
  kind: 'skeleton',
  key: `skeleton-${index}`,
  gap: index === SKELETON_COUNT - 1 ? 'none' : 'card',
}));
export const NO_ROWS: HomeRow[] = [];

/** Live block first (`mb-4` after it), then the regular block (`space-y-2.5`). */
export function buildHomeRows({ liveBets, sortedBets }: BetSections, categoryMap: Record<string, Category>): HomeRow[] {
  const categoryOf = (bet: Bet) => (bet.category_id ? categoryMap[bet.category_id] : undefined);
  const rows: HomeRow[] = liveBets.map((bet, index) => ({
    kind: 'bet',
    key: bet.id,
    bet,
    category: categoryOf(bet),
    gap: index === liveBets.length - 1 ? 'section' : 'card',
    enterIndex: index,
  }));
  sortedBets.forEach((bet, index) => {
    rows.push({
      kind: 'bet',
      key: bet.id,
      bet,
      category: categoryOf(bet),
      gap: index === sortedBets.length - 1 ? 'none' : 'card',
      enterIndex: index + liveBets.length,
    });
  });
  return rows;
}

const keyExtractor = (row: HomeRow) => row.key;
const getItemType = (row: HomeRow) => (row.kind === 'skeleton' ? 'skeleton' : row.bet.is_bsplicboost ? 'boost' : 'bet');

interface BetFeedListProps {
  listRef: AnimatedRef<FlashListRef<HomeRow>>;
  rows: HomeRow[];
  /** The first page is in (cards can play their entrance). */
  ready: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  hasRegularBets: boolean;
  onLoadMore: () => void;
  refreshing: boolean;
  onRefresh: () => void;
  contentHeight: SharedValue<number>;
  viewportHeight: SharedValue<number>;
  lite: boolean;
  reducedMotion: boolean;
}

/**
 * The scrolling bet list. Keyed by sort, category and Aktywne by the parent,
 * so a filter change starts at the top and replays the card entrance (web
 * remounts its scroll container the same way).
 */
export function BetFeedList({
  listRef,
  rows,
  ready,
  hasMore,
  loadingMore,
  hasRegularBets,
  onLoadMore,
  refreshing,
  onRefresh,
  contentHeight,
  viewportHeight,
  lite,
  reducedMotion,
}: BetFeedListProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const enterClock = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (!ready) return;
    if (reducedMotion) {
      enterClock.set(1);
      return;
    }
    enterClock.set(withTiming(1, { duration: ENTER_TOTAL_MS, easing: Easing.linear }));
  }, [ready, reducedMotion, enterClock]);

  const renderItem = ({ item }: ListRenderItemInfo<HomeRow>) =>
    item.kind === 'skeleton' ? (
      <BetCardSkeleton gap={item.gap} />
    ) : (
      <BetRow
        bet={item.bet}
        category={item.category}
        gap={item.gap}
        enterIndex={item.enterIndex}
        enterClock={enterClock}
        lite={lite}
        reducedMotion={reducedMotion}
      />
    );

  return (
    <FlashList
      ref={listRef}
      data={rows}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      getItemType={getItemType}
      ListHeaderComponent={
        <View>
          <View style={styles.toolbarSpace} />
          <View style={styles.banner}>
            <DailyJackpotCard />
          </View>
        </View>
      }
      ListFooterComponent={
        <View style={styles.footer}>
          {hasMore ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: loadingMore, busy: loadingMore }}
              disabled={loadingMore}
              hitSlop={4}
              onPress={onLoadMore}
              style={({ pressed }) => [
                styles.loadMore,
                hasRegularBets && styles.loadMoreSpaced,
                pressed && styles.loadMorePressed,
                loadingMore && styles.loadMoreBusy,
              ]}
            >
              <RNText maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.loadMoreText}>
                {loadingMore ? 'Ładowanie...' : 'Pokaż więcej'}
              </RNText>
            </Pressable>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <RNText maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.emptyTitle}>
            Brak dostępnych zakładów
          </RNText>
          <RNText maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.emptySubtitle}>
            Wróć później lub zmień kategorię
          </RNText>
        </View>
      }
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.5}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.mutedForeground} />}
      contentInsetAdjustmentBehavior="automatic"
      maintainVisibleContentPosition={{ autoscrollToTopThreshold: 32 }}
      keyboardShouldPersistTaps="handled"
      onLayout={(event) => viewportHeight.set(event.nativeEvent.layout.height)}
      onContentSizeChange={(_width, height) => contentHeight.set(height)}
    />
  );
}

const useStyles = createStyles(({ colors, radius }) => ({
  toolbarSpace: { height: TOOLBAR_SPACE },
  banner: { paddingHorizontal: 12 },
  // Regular block `mb-8`, plus the clearance the web keeps above its floating nav.
  footer: { paddingHorizontal: 12, paddingBottom: 48 },
  loadMore: {
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  loadMoreSpaced: { marginTop: 10 },
  loadMorePressed: { backgroundColor: colors.muted },
  loadMoreBusy: { opacity: 0.7 },
  loadMoreText: { fontFamily: 'Inter', fontSize: 14, lineHeight: 20, fontWeight: '500', color: colors.foreground },
  empty: { paddingVertical: 64, alignItems: 'center', paddingHorizontal: 12 },
  emptyTitle: {
    fontFamily: 'Inter',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    textAlign: 'center',
    color: colors.mutedForeground,
  },
  emptySubtitle: {
    marginTop: 4,
    fontFamily: 'Inter',
    fontSize: 13,
    lineHeight: 19.5,
    textAlign: 'center',
    color: colors.mutedForeground,
  },
}));
