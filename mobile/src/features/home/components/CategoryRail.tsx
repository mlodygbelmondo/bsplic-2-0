import { memo, useEffect, useRef, type RefObject } from 'react';
import {
  Pressable,
  ScrollView,
  Text as RNText,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from 'react-native';
import Animated, { Easing, Keyframe, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { haptics } from '@/lib/haptics';
import { alpha, createStyles } from '@/theme';
import type { Category } from '@/types/database';
import { PressScale } from '@/ui';
import { buildCategoryTree, type CategoryTreeNode } from '../logic/category-tree';
import { getStripRevealOffset, type StripMetrics } from '../logic/strip-reveal';

const MAX_FONT_SCALE = 1.35;
/** Strip key of the "Wszystko" tile (web uses `''` for the `null` id). */
const ALL_KEY = '';

/** `sport-rail-pop`: 320 ms from 0.86 with an overshoot. */
const POP_TIMING = { duration: 320, easing: Easing.bezier(0.34, 1.56, 0.64, 1) };
/** `league-tab-indicator`: 300 ms slide and resize. */
const INDICATOR_TIMING = { duration: 300, easing: Easing.bezier(0.34, 1.2, 0.64, 1) };
/** `league-tabs-enter`: 260 ms fade down from -6 px. */
const LEAGUE_TABS_ENTER = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: -6 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }], easing: Easing.bezier(0.16, 1, 0.3, 1) },
}).duration(260);
/** `transition-[background-color,border-color,box-shadow] duration-200`. */
const TILE_TRANSITION = {
  transitionProperty: ['backgroundColor', 'borderColor', 'boxShadow'],
  transitionDuration: 200,
};
const COLOR_TRANSITION = { transitionProperty: 'color', transitionDuration: 200 } as const;

interface ItemLayout {
  x: number;
  width: number;
}

/**
 * Horizontal strip that can scroll an item into view (web `revealInStrip`).
 * Item layouts arrive asynchronously, so a reveal waits until the item, the
 * viewport and the content are measured.
 */
function useStrip(scrollRef: RefObject<ScrollViewInstance | null>) {
  const metrics = useRef<StripMetrics>({ offset: 0, viewportWidth: 0, contentWidth: 0 });
  const items = useRef(new Map<string, ItemLayout>());
  const pending = useRef<{ key: string; animated: boolean } | null>(null);

  const flush = () => {
    const request = pending.current;
    if (!request) return;
    const item = items.current.get(request.key);
    const strip = metrics.current;
    if (!item || strip.viewportWidth === 0 || strip.contentWidth === 0) return;
    pending.current = null;
    const target = getStripRevealOffset(strip, item);
    if (target !== null) scrollRef.current?.scrollTo({ x: target, animated: request.animated });
  };

  return {
    getItem: (key: string) => items.current.get(key),
    reveal: (key: string, animated: boolean) => {
      pending.current = { key, animated };
      flush();
    },
    setItemLayout: (key: string, event: LayoutChangeEvent) => {
      const { x, width } = event.nativeEvent.layout;
      items.current.set(key, { x, width });
      flush();
    },
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      metrics.current.offset = event.nativeEvent.contentOffset.x;
    },
    onLayout: (event: LayoutChangeEvent) => {
      metrics.current.viewportWidth = event.nativeEvent.layout.width;
      flush();
    },
    onContentSizeChange: (width: number) => {
      metrics.current.contentWidth = width;
      flush();
    },
  };
}

interface CategoryRailProps {
  categories: Category[];
  selectedCategory: string | null;
  onSelectCategory: (id: string | null) => void;
  reducedMotion: boolean;
}

/**
 * Web `CategoryRail`: a scrollable rail of sport tiles ("Wszystko" first) and,
 * under a sport that has leagues, underline tabs for "Wszystkie" and each league.
 */
export function CategoryRail({ categories, selectedCategory, onSelectCategory, reducedMotion }: CategoryRailProps) {
  const styles = useStyles();
  const tree = buildCategoryTree(categories);
  const activeSport =
    tree.find(
      (node) =>
        node.category.id === selectedCategory || node.children.some((child) => child.id === selectedCategory),
    ) ?? null;
  const activeKey = activeSport?.category.id ?? ALL_KEY;
  const scrollRef = useRef<ScrollViewInstance>(null);
  const strip = useStrip(scrollRef);

  // Keeps the active sport in view: jumps there on first render, slides later.
  const revealedKey = useRef<string | null>(null);
  useEffect(() => {
    if (revealedKey.current === activeKey) return;
    strip.reveal(activeKey, revealedKey.current !== null);
    revealedKey.current = activeKey;
  });

  return (
    <>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={strip.onScroll}
        onLayout={strip.onLayout}
        onContentSizeChange={strip.onContentSizeChange}
        contentContainerStyle={styles.rail}
      >
        <RailTile
          stripKey={ALL_KEY}
          id={null}
          emoji="🌐"
          name="Wszystko"
          selected={activeKey === ALL_KEY}
          onSelect={onSelectCategory}
          onItemLayout={strip.setItemLayout}
          reducedMotion={reducedMotion}
        />
        {tree.map(({ category }) => (
          <RailTile
            key={category.id}
            stripKey={category.id}
            id={category.id}
            emoji={category.emoji}
            name={category.name}
            selected={activeKey === category.id}
            onSelect={onSelectCategory}
            onItemLayout={strip.setItemLayout}
            reducedMotion={reducedMotion}
          />
        ))}
      </ScrollView>

      {activeSport && activeSport.children.length > 0 ? (
        <LeagueTabs
          key={activeSport.category.id}
          sport={activeSport}
          selectedCategory={selectedCategory}
          onSelectCategory={onSelectCategory}
          reducedMotion={reducedMotion}
        />
      ) : null}
    </>
  );
}

interface RailTileProps {
  stripKey: string;
  id: string | null;
  emoji: string;
  name: string;
  selected: boolean;
  onSelect: (id: string | null) => void;
  onItemLayout: (key: string, event: LayoutChangeEvent) => void;
  reducedMotion: boolean;
}

const RailTile = memo(function RailTile({
  stripKey,
  id,
  emoji,
  name,
  selected,
  onSelect,
  onItemLayout,
  reducedMotion,
}: RailTileProps) {
  const styles = useStyles();
  const pop = useSharedValue(1);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.get() }] }));

  useEffect(() => {
    if (!selected || reducedMotion) return;
    pop.set(0.86);
    pop.set(withTiming(1, POP_TIMING));
  }, [selected, reducedMotion, pop]);

  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={name}
      accessibilityState={{ selected }}
      onPress={() => {
        if (!selected) haptics.selection();
        onSelect(id);
      }}
      onLayout={(event) => onItemLayout(stripKey, event)}
      style={styles.tile}
    >
      <Animated.View style={popStyle}>
        <Animated.View style={[styles.tileIcon, selected ? styles.tileIconSelected : styles.tileIconIdle, TILE_TRANSITION]}>
          <RNText allowFontScaling={false} style={styles.tileEmoji}>
            {emoji}
          </RNText>
        </Animated.View>
      </Animated.View>
      <Animated.Text
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        numberOfLines={1}
        style={[styles.tileLabel, selected ? styles.tileLabelSelected : styles.tileLabelIdle, COLOR_TRANSITION]}
      >
        {name}
      </Animated.Text>
    </PressScale>
  );
});

interface LeagueTabsProps {
  sport: CategoryTreeNode;
  selectedCategory: string | null;
  onSelectCategory: (id: string | null) => void;
  reducedMotion: boolean;
}

/** Web `LeagueTabs`: "Wszystkie" (the sport itself) and its leagues, with a sliding underline. */
function LeagueTabs({ sport, selectedCategory, onSelectCategory, reducedMotion }: LeagueTabsProps) {
  const styles = useStyles();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const strip = useStrip(scrollRef);
  const indicatorX = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);
  const indicatorPlaced = useRef(false);
  const indicatorStyle = useAnimatedStyle(() => ({
    width: indicatorWidth.get(),
    transform: [{ translateX: indicatorX.get() }],
  }));
  const tabs = [{ id: sport.category.id, name: 'Wszystkie' }, ...sport.children];

  // The underline jumps into place first, then slides between tabs.
  const placeIndicator = (layout: ItemLayout | undefined) => {
    if (!layout) return;
    if (indicatorPlaced.current && !reducedMotion) {
      indicatorX.set(withTiming(layout.x, INDICATOR_TIMING));
      indicatorWidth.set(withTiming(layout.width, INDICATOR_TIMING));
    } else {
      indicatorX.set(layout.x);
      indicatorWidth.set(layout.width);
    }
    indicatorPlaced.current = true;
  };

  const shownSelection = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (shownSelection.current === selectedCategory) return;
    shownSelection.current = selectedCategory;
    if (selectedCategory === null) return;
    placeIndicator(strip.getItem(selectedCategory));
    strip.reveal(selectedCategory, true);
  });

  return (
    <Animated.View entering={reducedMotion ? undefined : LEAGUE_TABS_ENTER}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={strip.onScroll}
        onLayout={strip.onLayout}
        onContentSizeChange={strip.onContentSizeChange}
        contentContainerStyle={styles.leagueStrip}
      >
        {tabs.map((tab) => {
          const selected = tab.id === selectedCategory;
          return (
            <Pressable
              key={tab.id}
              accessibilityRole="button"
              accessibilityLabel={tab.name}
              accessibilityState={{ selected }}
              hitSlop={LEAGUE_HIT_SLOP}
              onPress={() => {
                if (!selected) haptics.selection();
                onSelectCategory(tab.id);
              }}
              onLayout={(event) => {
                strip.setItemLayout(tab.id, event);
                // The bold label of a newly selected tab is wider: follow it.
                if (selected) placeIndicator(event.nativeEvent.layout);
              }}
              style={styles.leagueTab}
            >
              <Animated.Text
                maxFontSizeMultiplier={MAX_FONT_SCALE}
                numberOfLines={1}
                style={[styles.leagueLabel, selected ? styles.leagueLabelSelected : styles.leagueLabelIdle, COLOR_TRANSITION]}
              >
                {tab.name}
              </Animated.Text>
            </Pressable>
          );
        })}
        <Animated.View pointerEvents="none" style={[styles.indicator, indicatorStyle]} />
      </ScrollView>
    </Animated.View>
  );
}

const LEAGUE_HIT_SLOP = { left: 10, right: 10, top: 2, bottom: 2 };

const useStyles = createStyles(({ colors }) => ({
  // `flex gap-2.5 px-3 py-2.5`
  rail: { gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  // `w-14 flex-col items-center gap-1.5 rounded-2xl`
  tile: { width: 56, alignItems: 'center', gap: 5, borderRadius: 16 },
  // `h-12 w-12 rounded-2xl border text-[22px]`
  tileIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // `sport-rail-glow border-primary bg-primary`
  tileIconSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
    boxShadow: `0px 0px 18px ${alpha(colors.primary, 0.45)}`,
  },
  tileIconIdle: {
    borderColor: colors.border,
    backgroundColor: alpha(colors.card, 0.8),
    boxShadow: `0px 0px 0px ${alpha(colors.primary, 0)}`,
  },
  tileEmoji: { fontSize: 22, lineHeight: 27, textAlign: 'center' },
  // `w-full truncate text-center text-[10.5px] leading-none`
  tileLabel: { width: 56, fontFamily: 'Inter', fontSize: 10.5, lineHeight: 13, textAlign: 'center' },
  tileLabelSelected: { fontWeight: '600', color: colors.foreground },
  tileLabelIdle: { fontWeight: '400', color: colors.mutedForeground },
  // `relative flex h-10 gap-5 px-3`
  leagueStrip: { height: 40, gap: 20, paddingHorizontal: 12 },
  leagueTab: { height: 40, justifyContent: 'center' },
  // `text-[13px]`
  leagueLabel: { fontFamily: 'Inter', fontSize: 13, lineHeight: 18 },
  leagueLabelSelected: { fontWeight: '600', color: colors.foreground },
  leagueLabelIdle: { fontWeight: '400', color: colors.mutedForeground },
  // `absolute bottom-0 left-0 h-[2px] rounded-full bg-primary`
  indicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 2,
    borderRadius: 9999,
    backgroundColor: colors.primary,
  },
}));
