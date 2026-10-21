import { memo, useEffect, useRef, useState } from 'react';
import { ScrollView, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useReducedMotion } from '@/lib/motion';
import { createStyles } from '@/theme';
import { Text } from '@/ui';
import type { BlackjackHandState } from '../api/blackjack';
import { calculateHandValue } from '../logic/blackjackReveal';
import { fadeIn } from './motion';
import { PlayingCard } from './PlayingCard';
import { black, bj, white } from './tokens';

const SPLIT_HAND_WIDTH = 272; // `w-[17rem]`
const RAIL_GAP = 12; // `gap-3`
const RAIL_PADDING = 8; // `px-2`

/** Scroll offset that centers hand `index` in the rail (web `snap-center`). */
function centeredOffset(index: number, handWidth: number, railWidth: number) {
  return Math.max(RAIL_PADDING + index * (handWidth + RAIL_GAP) - (railWidth - handWidth) / 2, 0);
}

interface PlayerHandsProps {
  hands: BlackjackHandState[];
  activeHandIndex: number;
  isDecisionState: boolean;
  isSettled: boolean;
  stake: number;
  compact: boolean;
}

/**
 * Player hands. One hand sits centered; after a split the hands become a
 * snapping carousel that keeps the active hand centered during decisions.
 */
export function PlayerHands({ hands, activeHandIndex, isDecisionState, isSettled, stake, compact }: PlayerHandsProps) {
  const styles = useStyles();
  const reducedMotion = useReducedMotion();
  const { width: windowWidth } = useWindowDimensions();
  const railRef = useRef<ScrollViewInstance>(null);
  const [railWidth, setRailWidth] = useState(0);
  const hasSplitHands = hands.length > 1;
  // `max-w-[calc(100vw-2rem)]`
  const handWidth = Math.min(SPLIT_HAND_WIDTH, windowWidth - 32);

  // Keep the active split hand centered in the carousel.
  useEffect(() => {
    if (!isDecisionState || !hasSplitHands || railWidth === 0) return;
    railRef.current?.scrollTo({ x: centeredOffset(activeHandIndex, handWidth, railWidth), animated: !reducedMotion });
  }, [activeHandIndex, hasSplitHands, isDecisionState, railWidth, handWidth, reducedMotion]);

  if (hands.length === 0) return null;

  return (
    <Animated.View entering={fadeIn} style={styles.root}>
      <ScrollView
        ref={railRef}
        horizontal
        scrollEnabled={hasSplitHands}
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToOffsets={hasSplitHands ? hands.map((_, index) => centeredOffset(index, handWidth, railWidth)) : undefined}
        onLayout={(event) => setRailWidth(event.nativeEvent.layout.width)}
        style={styles.rail}
        contentContainerStyle={hasSplitHands ? styles.railSplit : styles.railSingle}
      >
        {hands.map((hand, handIndex) => {
          const isActive = isDecisionState && handIndex === activeHandIndex;
          return (
            <HandView
              key={hand.id}
              hand={hand}
              handIndex={handIndex}
              split={hasSplitHands}
              width={handWidth}
              isActive={isActive}
              isDimmed={hasSplitHands && isDecisionState && !isActive}
              isSettled={isSettled}
              compact={compact}
            />
          );
        })}
      </ScrollView>
      {hands.length === 1 ? (
        <Text size="sm" style={styles.totalStake}>
          Łączna stawka: {stake.toFixed(2)} zł
        </Text>
      ) : null}
    </Animated.View>
  );
}

interface HandViewProps {
  hand: BlackjackHandState;
  handIndex: number;
  split: boolean;
  width: number;
  isActive: boolean;
  isDimmed: boolean;
  isSettled: boolean;
  compact: boolean;
}

const HandView = memo(function HandView({
  hand,
  handIndex,
  split,
  width,
  isActive,
  isDimmed,
  isSettled,
  compact,
}: HandViewProps) {
  const styles = useStyles();
  const value = calculateHandValue(hand.cards);
  const dim = useSharedValue(isDimmed ? 1 : 0);

  // `transition-[opacity,transform] duration-300` + `scale-[0.96] opacity-55`
  useEffect(() => {
    dim.set(withTiming(isDimmed ? 1 : 0, { duration: 300 }));
  }, [dim, isDimmed]);

  const dimStyle = useAnimatedStyle(() => {
    const amount = dim.get();
    return { opacity: 1 - 0.45 * amount, transform: [{ scale: 1 - 0.04 * amount }] };
  });

  const frameStyle = split
    ? [
        styles.splitFrame,
        { width },
        isActive
          ? styles.frameActive
          : isSettled
            ? hand.status === 'won'
              ? styles.frameWon
              : hand.status === 'push'
                ? styles.framePush
                : styles.frameLost
            : styles.frameIdle,
      ]
    : null;

  return (
    <Animated.View style={[styles.hand, frameStyle, dimStyle]}>
      {split ? (
        <View style={styles.header}>
          <View style={styles.headerLabel}>
            <Text size="xs" weight="600" style={styles.headerText}>
              Ręka {handIndex + 1}
            </Text>
            {hand.isSplitAces ? (
              <View style={styles.acesBadge}>
                <Text size="xs" weight="600" style={styles.acesText}>
                  ASY
                </Text>
              </View>
            ) : null}
          </View>
          {isActive ? (
            <View style={styles.activeBadge}>
              <Text size="xs" weight="600" style={styles.activeText}>
                Aktywna
              </Text>
            </View>
          ) : null}
          {isSettled && hand.status !== 'playing' ? (
            <View
              style={[
                styles.resultBadge,
                hand.status === 'won' ? styles.resultWon : hand.status === 'push' ? styles.resultPush : styles.resultLost,
              ]}
            >
              <Text
                size="xs"
                weight="700"
                style={[
                  styles.resultText,
                  hand.status === 'won'
                    ? styles.resultWonText
                    : hand.status === 'push'
                      ? styles.resultPushText
                      : styles.resultLostText,
                ]}
              >
                {hand.status === 'won'
                  ? `✓ +${hand.payout.toFixed(2)} zł`
                  : hand.status === 'push'
                    ? `= ${hand.payout.toFixed(2)} zł`
                    : '✗ przegrana'}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
      <View style={styles.cards}>
        {hand.cards.map((card, index) => (
          <PlayingCard
            key={card.id ?? `player-${hand.id}-${index}`}
            card={card}
            dealTarget="player"
            index={index}
            compact={compact}
            style={index > 0 ? styles.cardOverlap : undefined}
          />
        ))}
      </View>
      <View style={[styles.value, value > 21 ? styles.valueBust : value === 21 ? styles.value21 : styles.valueIdle]}>
        <Text size="base" weight="700" style={value > 21 || value === 21 ? styles.valueTextStrong : styles.valueText}>
          Ty: {value}
        </Text>
      </View>
      <Text size="sm" style={styles.stake}>
        Stawka: {hand.stake.toFixed(2)} zł
      </Text>
    </Animated.View>
  );
});

const useStyles = createStyles(() => ({
  root: { width: '100%', alignItems: 'center', gap: 8 },
  rail: { width: '100%', flexGrow: 0 },
  // `px-2 pb-2 gap-3 justify-center`
  railSingle: { flexGrow: 1, justifyContent: 'center', gap: RAIL_GAP, paddingHorizontal: RAIL_PADDING, paddingBottom: 8 },
  railSplit: { gap: RAIL_GAP, paddingHorizontal: RAIL_PADDING, paddingBottom: 8 },
  totalStake: { color: white(0.75), marginTop: 4 },
  // `flex flex-col items-center gap-2`
  hand: { alignItems: 'center', gap: 8 },
  // `shrink-0 rounded-2xl border bg-black/35 p-3`
  splitFrame: {
    flexShrink: 0,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    backgroundColor: black(0.35),
    padding: 12,
  },
  frameActive: { borderColor: 'rgba(252, 211, 77, 0.6)', boxShadow: '0px 0px 26px rgba(251, 191, 36, 0.2)' },
  frameWon: { borderColor: 'rgba(110, 231, 183, 0.45)', boxShadow: '0px 0px 22px rgba(16, 185, 129, 0.14)' },
  framePush: { borderColor: white(0.2) },
  frameLost: { borderColor: 'rgba(248, 113, 113, 0.3)' },
  frameIdle: { borderColor: white(0.1) },
  // `flex w-full items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/60`
  header: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  headerLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerText: { color: white(0.6), textTransform: 'uppercase', letterSpacing: 2.16 },
  // `rounded-full border border-amber-300/40 bg-amber-400/15 px-1.5 py-0.5 text-[9px] tracking-normal text-amber-100`
  acesBadge: {
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(252, 211, 77, 0.4)',
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  acesText: { color: bj.amber100, fontSize: 9, lineHeight: 12 },
  // `rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] text-amber-100`
  activeBadge: { borderRadius: 9999, backgroundColor: 'rgba(251, 191, 36, 0.2)', paddingHorizontal: 8, paddingVertical: 2 },
  activeText: { color: bj.amber100, fontSize: 10, lineHeight: 14, textTransform: 'uppercase', letterSpacing: 1.8 },
  // `rounded-full px-2 py-0.5 text-[10px] font-bold tracking-normal`
  resultBadge: { borderRadius: 9999, paddingHorizontal: 8, paddingVertical: 2 },
  resultWon: { backgroundColor: 'rgba(52, 211, 153, 0.2)' },
  resultPush: { backgroundColor: white(0.15) },
  resultLost: { backgroundColor: 'rgba(239, 68, 68, 0.2)' },
  resultText: { fontSize: 10, lineHeight: 14, textTransform: 'uppercase' },
  resultWonText: { color: bj.emerald100 },
  resultPushText: { color: white(0.8) },
  resultLostText: { color: bj.red200 },
  // `relative z-10 flex justify-center px-2 pb-2 -space-x-10`
  cards: { zIndex: 10, flexDirection: 'row', justifyContent: 'center', paddingHorizontal: 8, paddingBottom: 8 },
  cardOverlap: { marginLeft: -40 },
  // `rounded-full border border-white/10 px-4 py-1.5 text-base font-bold`
  value: { borderRadius: 9999, borderWidth: 1, borderColor: white(0.1), paddingHorizontal: 16, paddingVertical: 6 },
  valueBust: { backgroundColor: 'rgba(239, 68, 68, 0.8)' },
  value21: { backgroundColor: 'rgba(34, 197, 94, 0.8)' },
  valueIdle: { backgroundColor: black(0.5) },
  valueText: { color: white(0.9) },
  valueTextStrong: { color: bj.white },
  stake: { color: white(0.75) },
}));
