import { memo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { Easing, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import type { Bet, Category } from '@/types/database';
import { BetCard } from './BetCard';

/** Space under a row: `gap-2.5` between cards, `mb-4` after the live block. */
export type RowGap = 'card' | 'section' | 'none';

/** `bet-card-enter`: 360 ms, 45 ms stagger, index capped at 8. */
const ENTER_MS = 360;
const ENTER_STAGGER_MS = 45;
const ENTER_MAX_INDEX = 8;
export const ENTER_TOTAL_MS = ENTER_MS + ENTER_MAX_INDEX * ENTER_STAGGER_MS;
const ENTER_EASING = Easing.bezierFn(0.22, 1, 0.36, 1);

interface BetRowProps {
  bet: Bet;
  category?: Category;
  gap: RowGap;
  /** Position used for the entrance stagger. */
  enterIndex: number;
  /** 0 → 1 over ENTER_TOTAL_MS when the list appears; stays at 1 afterwards. */
  enterClock: SharedValue<number>;
  lite: boolean;
  reducedMotion: boolean;
}

/** One list cell: horizontal page padding, row gap and the card entrance. */
export const BetRow = memo(function BetRow({ bet, category, gap, enterIndex, enterClock, lite, reducedMotion }: BetRowProps) {
  const delay = Math.min(enterIndex, ENTER_MAX_INDEX) * ENTER_STAGGER_MS;
  const enterStyle = useAnimatedStyle(() => {
    const elapsed = enterClock.get() * ENTER_TOTAL_MS - delay;
    const progress = ENTER_EASING(Math.min(1, Math.max(0, elapsed / ENTER_MS)));
    return {
      opacity: progress,
      transform: [{ translateY: 14 * (1 - progress) }, { scale: 0.985 + 0.015 * progress }],
    };
  });

  return (
    <Animated.View style={[styles.row, GAP_STYLES[gap], enterStyle]}>
      <BetCard bet={bet} category={category} lite={lite} reducedMotion={reducedMotion} />
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  row: { paddingHorizontal: 12 },
  card: { paddingBottom: 10 },
  section: { paddingBottom: 16 },
  none: { paddingBottom: 0 },
});

export const GAP_STYLES: Record<RowGap, (typeof styles)[RowGap]> = {
  card: styles.card,
  section: styles.section,
  none: styles.none,
};
