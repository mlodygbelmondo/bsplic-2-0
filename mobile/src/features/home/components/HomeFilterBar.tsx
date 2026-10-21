import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { ArrowUpDown, ChevronDown } from 'lucide-react-native';
import { StyleSheet, Text as RNText, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';

import { pluralPl } from '@/lib/format';
import { alpha, createStyles, useScheme, useTheme } from '@/theme';
import type { Category } from '@/types/database';
import { PressScale } from '@/ui';
import { useHomePreferences } from '../hooks/use-home-preferences';
import type { SortMode } from '../logic/sort-bets';
import { SORT_OPTIONS } from '../logic/sort-options';
import { CategoryRail } from './CategoryRail';

const MAX_FONT_SCALE = 1.35;
const BET_FORMS = ['zakład', 'zakłady', 'zakładów'] as const;
/** Count line `transition-opacity duration-200` while the next filter loads. */
const OPACITY_TRANSITION = { transitionProperty: 'opacity', transitionDuration: 200 } as const;
/** Sort chevron `transition-transform duration-300`. */
const CHEVRON_TRANSITION = { transitionProperty: 'transform', transitionDuration: 300 } as const;
const SORT_HIT_SLOP = { top: 4, bottom: 4, left: 4, right: 4 };

interface HomeFilterBarProps {
  style: StyleProp<AnimatedStyle<StyleProp<ViewStyle>>>;
  categories: Category[];
  selectedCategory: string | null;
  onSelectCategory: (id: string | null) => void;
  /** Loaded live and regular bets; `null` until the first page arrives. */
  betCount: number | null;
  hasMore: boolean;
  activeOnly: boolean;
  sort: SortMode;
  /** The previous filter's bets are on screen while the next ones load. */
  refreshing: boolean;
  onLayout: (event: LayoutChangeEvent) => void;
  lite: boolean;
  reducedMotion: boolean;
}

/**
 * Phone filter bar of the web `BetList` (`home-filter-bar`): a glass strip
 * with the category rail, the bet count and the sort trigger. Positioned over
 * the list and moved by the parent (hidden on scroll, follows pull-to-refresh).
 */
export function HomeFilterBar({
  style,
  categories,
  selectedCategory,
  onSelectCategory,
  betCount,
  hasMore,
  activeOnly,
  sort,
  refreshing,
  onLayout,
  lite,
  reducedMotion,
}: HomeFilterBarProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const scheme = useScheme();
  const sortSheetOpen = useHomePreferences((s) => s.sortSheetOpen);
  const sortLabel = SORT_OPTIONS.find((option) => option.value === sort)?.label ?? 'Sortowanie';

  return (
    <Animated.View style={[styles.bar, style]} onLayout={onLayout}>
      {lite ? (
        <View style={[StyleSheet.absoluteFill, styles.solid]} />
      ) : (
        <>
          <BlurView intensity={50} tint={scheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, styles.tint]} />
        </>
      )}

      {categories.length > 0 ? (
        <CategoryRail
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={onSelectCategory}
          reducedMotion={reducedMotion}
        />
      ) : null}

      <View style={styles.countRow}>
        <Animated.Text
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          numberOfLines={1}
          style={[styles.count, refreshing ? styles.dimmed : styles.opaque, OPACITY_TRANSITION]}
        >
          {betCount !== null ? (
            <>
              <RNText style={styles.countNumber}>
                {betCount}
                {hasMore ? '+' : ''}
              </RNText>{' '}
              {pluralPl(betCount, BET_FORMS)}
              {activeOnly ? '' : ' · też w trakcie'}
            </>
          ) : null}
        </Animated.Text>

        <PressScale
          accessibilityRole="button"
          accessibilityState={{ expanded: sortSheetOpen }}
          hitSlop={SORT_HIT_SLOP}
          onPress={() => router.push('/sheets/sort-bets')}
          style={styles.sortTrigger}
        >
          <ArrowUpDown size={14} color={colors.mutedForeground} />
          <RNText maxFontSizeMultiplier={MAX_FONT_SCALE} numberOfLines={1} style={styles.sortLabel}>
            {sortLabel}
          </RNText>
          <Animated.View style={[sortSheetOpen ? styles.chevronOpen : styles.chevronClosed, CHEVRON_TRANSITION]}>
            <ChevronDown size={14} color={colors.mutedForeground} />
          </Animated.View>
        </PressScale>
      </View>
    </Animated.View>
  );
}

const useStyles = createStyles(({ colors }) => ({
  // `sticky top-0 z-30 border-b border-border/60`, spanning the screen.
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderBottomWidth: 1,
    borderBottomColor: alpha(colors.border, 0.6),
    overflow: 'hidden',
  },
  // `.home-filter-bar`: background/0.82 over a blur; `.perf-lite`: background/0.96, no blur.
  tint: { backgroundColor: alpha(colors.background, 0.82) },
  solid: { backgroundColor: alpha(colors.background, 0.96) },
  // `flex h-11 items-center justify-between gap-3 px-3`
  countRow: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 12,
  },
  // `min-w-0 truncate text-[13px] text-muted-foreground`
  count: { flexShrink: 1, minWidth: 0, fontFamily: 'Inter', fontSize: 13, lineHeight: 19.5, color: colors.mutedForeground },
  countNumber: { fontWeight: '600', color: colors.foreground, fontVariant: ['tabular-nums'] },
  dimmed: { opacity: 0.4 },
  opaque: { opacity: 1 },
  // `-mr-1.5 flex h-9 shrink-0 items-center gap-1.5 rounded-full px-1.5 text-[13px] font-semibold`
  sortTrigger: {
    height: 36,
    flexShrink: 0,
    marginRight: -6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 9999,
    paddingHorizontal: 6,
  },
  sortLabel: { fontFamily: 'Inter', fontSize: 13, lineHeight: 18, fontWeight: '600', color: colors.foreground },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  chevronClosed: { transform: [{ rotate: '0deg' }] },
}));
