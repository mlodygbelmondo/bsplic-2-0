import { Sparkles, Users } from 'lucide-react-native';
import { memo } from 'react';
import { Text as RNText, View } from 'react-native';
import Animated, { css, cubicBezier } from 'react-native-reanimated';

import { couponActions, useCouponSelection } from '@/features/coupon/coupon-store';
import { haptics } from '@/lib/haptics';
import { alpha, createStyles, hsl, useTheme } from '@/theme';
import { BalancedText } from '@/ui';
import type { Bet, BetOption, Category } from '@/types/database';
import { useHomeNow } from '../hooks/use-home-clock';
import {
  buildOddsRows,
  formatBetDate,
  formatTimeRemaining,
  getBetClockState,
  getOddsAccessibilityLabel,
  getOddsChipState,
  getOddsPressAction,
  getOptionProbabilities,
  HOUR_MS,
} from '../logic/bet-card';
import { OddsChip } from './OddsChip';

const MAX_FONT_SCALE = 1.35;
/** Tailwind `red-100` (boost top bar text). */
const BOOST_META_STRONG = '#fee2e2';
const BOOST_META = 'rgba(254, 226, 226, 0.9)';

interface BetCardProps {
  bet: Bet;
  category?: Category;
  /** Reduced motion or Low Power Mode: decorative loops stay still. */
  lite: boolean;
  reducedMotion: boolean;
}

/** Native port of the web `BetCard` (`src/components/BetCard.tsx`). */
export const BetCard = memo(function BetCard({ bet, category, lite, reducedMotion }: BetCardProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const now = useHomeNow();
  const selectedOption = useCouponSelection(bet.id);
  const clock = getBetClockState(bet, now);
  const options: BetOption[] = bet.options ?? [];
  const isBoost = Boolean(bet.is_bsplicboost);
  const rows = buildOddsRows(bet.bet_type, options);
  const probabilities = getOptionProbabilities(options);
  const metaColor = isBoost ? BOOST_META : colors.mutedForeground;

  const handleSelect = (option: BetOption) => {
    const action = getOddsPressAction(option.name, selectedOption, clock.isLocked);
    if (action === 'ignore') return;
    haptics.selection();
    if (action === 'remove') {
      couponActions.removeItem(bet.id);
    } else {
      couponActions.addItem({ bet, selectedOption: option.name, odds: option.odds });
    }
  };

  return (
    <View style={[styles.card, bet.is_live && styles.cardLive, isBoost && styles.cardBoost]}>
      <View style={isBoost ? styles.topBarBoost : styles.topBar}>
        <View style={styles.topLeft}>
          {category ? (
            <View style={styles.categoryRow}>
              <RNText maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.categoryText, isBoost && styles.boostMeta]}>
                {category.emoji}
              </RNText>
              <RNText
                maxFontSizeMultiplier={MAX_FONT_SCALE}
                numberOfLines={1}
                style={[styles.categoryText, styles.shrink, isBoost && styles.boostMeta]}
              >
                {category.name}
              </RNText>
            </View>
          ) : null}
          {isBoost ? (
            <View style={styles.boostBadge}>
              <Sparkles size={12} color={styles.boostBadgeText.color} />
              <RNText maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.boostBadgeText}>
                BSPLBOOST
              </RNText>
            </View>
          ) : null}
        </View>
        <View style={styles.topRight}>
          {bet.is_live ? (
            <View style={styles.liveRow}>
              <Animated.View style={[styles.liveDot, isBoost ? styles.liveDotBoost : styles.liveDotDefault, !lite && motion.pulseLive]} />
              <RNText maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.liveText, isBoost && styles.liveTextBoost]}>
                LIVE
              </RNText>
            </View>
          ) : null}
          <View style={styles.countRow}>
            <Users size={12} color={metaColor} />
            <RNText maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.countText, isBoost && styles.boostMeta]}>
              {bet.bet_count}
            </RNText>
          </View>
        </View>
      </View>

      <View style={isBoost ? styles.bodyBoost : styles.body}>
        <View style={styles.titleBlock}>
          <BalancedText maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.title}>
            {bet.title}
          </BalancedText>
          {clock.isInProgress ? (
            <View style={styles.inProgressRow}>
              <Animated.View style={[styles.inProgressDot, !lite && motion.pulse]} />
              <RNText maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.inProgressText}>
                W trakcie
              </RNText>
            </View>
          ) : null}
          <RNText maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.date}>
            {formatBetDate(bet.ends_at)}
            {clock.endsSoon ? (
              <RNText style={clock.remainingMs <= HOUR_MS ? styles.countdownUrgent : styles.countdownSoon}>
                {` · kończy się ${formatTimeRemaining(clock.remainingMs)}`}
              </RNText>
            ) : null}
          </RNText>
        </View>

        <View style={styles.grid}>
          {rows.map((row, rowIndex) => (
            <View key={rowIndex} style={row.centered ? styles.gridRowCentered : styles.gridRow}>
              {row.cells.map((option, cellIndex) => {
                if (!option) return <View key={`empty-${cellIndex}`} style={styles.gridSpacer} />;
                const isSelected = selectedOption === option.name;
                return (
                  <OddsChip
                    key={`${option.name}:${cellIndex}`}
                    option={option}
                    state={getOddsChipState(isSelected, clock.isLocked)}
                    disabled={clock.isLocked}
                    centered={row.centered}
                    accessibilityLabel={getOddsAccessibilityLabel(bet.title, option, isSelected, clock.isLocked)}
                    reducedMotion={reducedMotion}
                    onSelect={handleSelect}
                  />
                );
              })}
            </View>
          ))}
        </View>

        <View style={styles.probabilityBar}>
          {probabilities.map((probability, index) => (
            <View
              key={index}
              style={[styles.probabilitySegment, [styles.toneFirst, styles.toneSecond, styles.toneThird][index % 3], { flexGrow: probability }]}
            />
          ))}
        </View>
      </View>

      {isBoost && !lite ? (
        <Animated.View pointerEvents="none" style={[styles.boostShimmer, motion.boostShimmer]} />
      ) : null}
    </View>
  );
});

const pulseLive = css.keyframes({
  '0%': { opacity: 1 },
  '50%': { opacity: 0.3 },
  '100%': { opacity: 1 },
});

/** Tailwind `animate-pulse`. */
const pulse = css.keyframes({
  '0%': { opacity: 1 },
  '50%': { opacity: 0.5 },
  '100%': { opacity: 1 },
});

const SKEW = { skewX: '-14deg' } as const;
const boostShimmer = css.keyframes({
  '0%': { opacity: 0, transform: [{ translateX: '-140%' }, SKEW] },
  '68%': { opacity: 0, transform: [{ translateX: '-140%' }, SKEW] },
  '73%': { opacity: 1 },
  '86%': { opacity: 1, transform: [{ translateX: '145%' }, SKEW] },
  '100%': { opacity: 0, transform: [{ translateX: '145%' }, SKEW] },
});

const motion = {
  pulseLive: {
    animationName: pulseLive,
    animationDuration: '1.5s',
    animationTimingFunction: 'ease-in-out',
    animationIterationCount: 'infinite',
  },
  pulse: {
    animationName: pulse,
    animationDuration: '2s',
    animationTimingFunction: cubicBezier(0.4, 0, 0.6, 1),
    animationIterationCount: 'infinite',
  },
  boostShimmer: {
    animationName: boostShimmer,
    animationDuration: '5.5s',
    animationTimingFunction: 'ease-in-out',
    animationIterationCount: 'infinite',
  },
} as const;

const META_TEXT = { fontFamily: 'Inter', fontSize: 11, lineHeight: 16, fontWeight: '600' } as const;

const useStyles = createStyles(({ colors, gradients, shadows, scheme }) => {
  const dark = scheme === 'dark';
  return {
    card: {
      borderRadius: 20,
      borderCurve: 'continuous',
      borderWidth: 1,
      overflow: 'hidden',
      borderColor: dark ? hsl(355, 75, 50, 0.24) : colors.border,
      backgroundColor: colors.card,
      ...(dark ? { backgroundImage: gradients.bookmakerSurfaceStrong, boxShadow: shadows.betCard } : null),
    },
    cardLive: {
      borderColor: dark ? hsl(355, 88, 56, 0.34) : hsl(355, 80, 60, 0.45),
      backgroundImage: gradients.bookmakerSurfaceLive,
    },
    cardBoost: {
      borderColor: dark ? hsl(355, 75, 50, 0.45) : 'rgba(252, 165, 165, 0.4)',
      backgroundImage: dark
        ? [
            `radial-gradient(130% 120% at 10% 0%, ${hsl(355, 85, 40, 0.3)} 0%, transparent 50%)`,
            `radial-gradient(110% 130% at 100% 100%, ${hsl(46, 95, 52, 0.09)} 0%, transparent 46%)`,
            `linear-gradient(160deg, ${hsl(348, 35, 13)} 0%, ${hsl(340, 28, 9)} 60%, ${hsl(0, 0, 4)} 100%)`,
          ].join(', ')
        : [
            'radial-gradient(140% 130% at 0% 0%, rgba(239, 68, 68, 0.26) 0%, rgba(239, 68, 68, 0) 52%)',
            'radial-gradient(120% 130% at 100% 100%, rgba(127, 29, 29, 0.2) 0%, rgba(127, 29, 29, 0) 56%)',
            'linear-gradient(145deg, rgba(255, 255, 255, 0.02), rgba(220, 38, 38, 0.04))',
          ].join(', '),
    },
    boostShimmer: {
      position: 'absolute',
      top: '-30%',
      bottom: '-30%',
      left: 0,
      right: 0,
      opacity: 0,
      transform: [{ translateX: '-140%' }, SKEW],
      backgroundImage: dark
        ? 'linear-gradient(110deg, transparent 36%, rgba(255, 236, 200, 0.18) 50%, transparent 64%)'
        : 'linear-gradient(110deg, transparent 36%, rgba(255, 240, 240, 0.22) 50%, transparent 64%)',
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      paddingHorizontal: 14,
      paddingTop: 10,
      paddingBottom: 2,
    },
    topBarBoost: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundImage: dark
        ? `linear-gradient(90deg, ${hsl(352, 78, 30, 0.95)}, ${hsl(345, 75, 19, 0.92)})`
        : 'linear-gradient(90deg, rgba(185, 28, 28, 0.92), rgba(127, 29, 29, 0.86))',
    },
    topLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0, flexShrink: 1 },
    categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 0, flexShrink: 1 },
    categoryText: { ...META_TEXT, color: colors.mutedForeground },
    shrink: { flexShrink: 1 },
    boostMeta: { color: BOOST_META },
    boostBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      flexShrink: 0,
      borderRadius: 9999,
      paddingHorizontal: 8,
      paddingVertical: 2,
      backgroundColor: dark ? hsl(46, 95, 55, 0.16) : 'rgba(254, 226, 226, 0.2)',
      boxShadow: `inset 0px 0px 0px 1px ${dark ? hsl(46, 90, 60, 0.35) : 'rgba(254, 202, 202, 0.3)'}`,
    },
    boostBadgeText: {
      fontFamily: 'Inter',
      fontSize: 10,
      lineHeight: 15,
      fontWeight: '800',
      letterSpacing: 0.25,
      color: dark ? hsl(46, 96, 68) : 'rgb(254, 242, 242)',
    },
    topRight: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0 },
    liveRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    liveDot: { width: 6, height: 6, borderRadius: 3 },
    liveDotDefault: { backgroundColor: colors.liveIndicator },
    liveDotBoost: { backgroundColor: BOOST_META_STRONG },
    liveText: { ...META_TEXT, fontWeight: '800', letterSpacing: 0.275, color: colors.liveIndicator },
    liveTextBoost: { color: BOOST_META_STRONG },
    countRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    countText: { fontFamily: 'Inter', fontSize: 10, lineHeight: 15, color: colors.mutedForeground },
    body: { paddingHorizontal: 14, paddingBottom: 12, paddingTop: 6 },
    bodyBoost: { paddingHorizontal: 14, paddingBottom: 12, paddingTop: 10 },
    titleBlock: { marginBottom: 12, alignItems: 'center' },
    title: {
      fontFamily: 'Inter',
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '700',
      textAlign: 'center',
      color: colors.foreground,
    },
    inProgressRow: { marginTop: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
    inProgressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.liveIndicator },
    inProgressText: { fontFamily: 'Inter', fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.liveIndicator },
    date: {
      marginTop: 4,
      fontFamily: 'Inter',
      fontSize: 12,
      lineHeight: 18,
      fontWeight: '500',
      textAlign: 'center',
      color: colors.mutedForeground,
    },
    countdownUrgent: { fontWeight: '600', color: '#ef4444' },
    countdownSoon: { fontWeight: '600', color: '#d97706' },
    grid: { gap: 8 },
    gridRow: { flexDirection: 'row', gap: 8 },
    gridRowCentered: { flexDirection: 'row', justifyContent: 'center' },
    gridSpacer: { flex: 1 },
    probabilityBar: { flexDirection: 'row', marginTop: 8, height: 3, borderRadius: 9999, overflow: 'hidden', gap: 2 },
    probabilitySegment: { flexBasis: 0, flexShrink: 1, borderRadius: 9999 },
    // Probability segments cycle `bg-primary`, `bg-muted-foreground/30`, `bg-success`.
    toneFirst: { backgroundColor: colors.primary },
    toneSecond: { backgroundColor: alpha(colors.mutedForeground, 0.3) },
    toneThird: { backgroundColor: colors.success },
  };
});
