import { ChevronLeft, ChevronRight, History } from 'lucide-react-native';
import { memo, useRef, useState, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from 'react-native';

import { createStyles } from '@/theme';
import { Text } from '@/ui';
import type { RouletteTableRound } from '@/types/database';

import { arbitraryText, MONO_FONT, rgba, tw } from '../../shared/casinoTheme';
import { fadeSlideIn } from '../../shared/motion';
import { getRouletteColorLabel } from '../lib/roulette';
import { getLeadingColorStreak } from '../lib/rouletteGame';
import { useRouletteTable } from '../state/tableStore';
import { RailCard } from './RailCard';

const CARD_ENTERING = fadeSlideIn({ y: 20, delayMs: 300 });
/** `min-w-[72px]` tiles with `gap-3`: one arrow press moves one tile, like Embla's `scrollNext`. */
const TILE_WIDTH = 72;
const TILE_GAP = 12;
const STEP = TILE_WIDTH + TILE_GAP;

/** Web `RecentSpinsCarousel`: the last spins as a swipeable strip with arrows. */
export const RecentSpinsCarousel = memo(function RecentSpinsCarousel() {
  const styles = useStyles();
  const spins = useRouletteTable((state) => state.recentSpins);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [offset, setOffset] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);

  if (spins.length === 0) return null;

  const streak = getLeadingColorStreak(spins);
  const maxOffset = Math.max(0, contentWidth - viewportWidth);
  const canScrollPrev = offset > 1;
  const canScrollNext = offset < maxOffset - 1;

  const scrollToIndex = (index: number) => {
    scrollRef.current?.scrollTo({ x: Math.min(maxOffset, Math.max(0, index * STEP)), animated: true });
  };

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setOffset(event.nativeEvent.contentOffset.x);
  };

  return (
    <RailCard
      Icon={History}
      title="Ostatnie spiny"
      entering={CARD_ENTERING}
      titleAccessory={
        streak ? (
          <View style={[styles.streak, styles[`streak_${streak.color}`]]}>
            <Text weight="700" numberOfLines={1} style={[styles.streakText, styles[`streakText_${streak.color}`]]}>
              {streak.length}× {getRouletteColorLabel(streak.color)} z rzędu
            </Text>
          </View>
        ) : null
      }
      right={
        <View style={styles.arrows}>
          <ArrowButton label="Poprzednie spiny" disabled={!canScrollPrev} onPress={() => scrollToIndex(Math.ceil(offset / STEP) - 1)}>
            <ChevronLeft size={16} color={rgba(tw.white, 0.6)} />
          </ArrowButton>
          <ArrowButton label="Następne spiny" disabled={!canScrollNext} onPress={() => scrollToIndex(Math.floor(offset / STEP) + 1)}>
            <ChevronRight size={16} color={rgba(tw.white, 0.6)} />
          </ArrowButton>
        </View>
      }
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        scrollEventThrottle={64}
        onScroll={onScroll}
        onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}
        onContentSizeChange={(width) => setContentWidth(width)}
        contentContainerStyle={styles.track}
      >
        {spins.map((spin) => (
          <SpinTile key={spin.id} spin={spin} />
        ))}
      </ScrollView>
    </RailCard>
  );
});

function ArrowButton({
  label,
  disabled,
  onPress,
  children,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={10}
      style={[styles.arrow, disabled && styles.arrowDisabled]}
    >
      {children}
    </Pressable>
  );
}

const SpinTile = memo(function SpinTile({ spin }: { spin: RouletteTableRound }) {
  const styles = useStyles();
  const color = spin.winning_color;
  return (
    <View
      accessible
      accessibilityLabel={`Runda ${spin.round_number}: ${spin.winning_number ?? '?'}${color ? ` ${getRouletteColorLabel(color)}` : ''}`}
      style={styles.tile}
    >
      <View style={[styles.ball, color ? styles[`ball_${color}`] : null]}>
        <Text weight="700" style={color ? styles[`ballText_${color}`] : styles.ballTextUnknown}>
          {spin.winning_number ?? '?'}
        </Text>
      </View>
      <Text style={styles.round}>#{spin.round_number}</Text>
    </View>
  );
});

const useStyles = createStyles(() => ({
  // `truncate rounded-full border px-2 py-0.5 text-[10px] font-bold`
  streak: { flexShrink: 1, minWidth: 0, borderRadius: 9999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
  streak_red: { borderColor: rgba(tw.rose400, 0.3), backgroundColor: rgba(tw.rose500, 0.1) },
  streak_black: { borderColor: rgba(tw.white, 0.2), backgroundColor: rgba(tw.white, 0.06) },
  streak_green: { borderColor: rgba(tw.emerald400, 0.3), backgroundColor: rgba(tw.emerald500, 0.1) },
  streakText: arbitraryText(10),
  streakText_red: { color: tw.rose200 },
  streakText_black: { color: tw.stone200 },
  streakText_green: { color: tw.emerald200 },
  arrows: { flexDirection: 'row', gap: 4 },
  // `rounded-lg bg-white/5 p-1 disabled:opacity-30`
  arrow: { borderRadius: 8, backgroundColor: rgba(tw.white, 0.05), padding: 4 },
  arrowDisabled: { opacity: 0.3 },
  track: { gap: TILE_GAP },
  // `flex min-w-[72px] flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3`
  tile: {
    minWidth: TILE_WIDTH,
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: rgba(tw.white, 0.1),
    backgroundColor: rgba(tw.white, 0.03),
    padding: 12,
  },
  // `h-10 w-10 rounded-full border-2 text-sm font-bold`
  ball: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ball_red: { borderColor: tw.rose400, backgroundColor: rgba(tw.rose500, 0.2) },
  ball_black: { borderColor: tw.stone400, backgroundColor: tw.stone800 },
  ball_green: { borderColor: tw.emerald400, backgroundColor: rgba(tw.emerald500, 0.2) },
  ballText_red: { color: tw.rose200 },
  ballText_black: { color: tw.stone200 },
  ballText_green: { color: tw.emerald200 },
  ballTextUnknown: { color: tw.white },
  round: { ...arbitraryText(10), fontFamily: MONO_FONT, color: rgba(tw.white, 0.3) },
}));
