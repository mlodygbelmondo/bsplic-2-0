import { memo } from 'react';
import { Pressable, Text as RNText } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { createStyles, fauxItalic, hsl } from '@/theme';
import type { BetOption } from '@/types/database';
import type { OddsChipState } from '../logic/bet-card';

const MAX_FONT_SCALE = 1.35;
/** `.odds-chip-selected` keyframes: cubic-bezier(0.34, 1.56, 0.64, 1) per segment. */
const POP_EASING = Easing.bezier(0.34, 1.56, 0.64, 1);
const PRESS_EASING = Easing.ease;
/** Selected odds text (`text-[#f6bf2b]`). */
const SELECTED_GOLD = '#f6bf2b';

interface OddsChipProps {
  option: BetOption;
  state: OddsChipState;
  disabled: boolean;
  /** Odd last option of a 4/5-option multi bet: `w-[48%]`, centered. */
  centered: boolean;
  accessibilityLabel: string;
  reducedMotion: boolean;
  onSelect: (option: BetOption) => void;
}

/** Web `.odds-chip` button: name + odds, press scale 0.95 and the select pop. */
export const OddsChip = memo(function OddsChip({
  option,
  state,
  disabled,
  centered,
  accessibilityLabel,
  reducedMotion,
  onSelect,
}: OddsChipProps) {
  const styles = useStyles();
  const press = useSharedValue(1);
  const pop = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.get() * pop.get() }] }));

  const handlePress = () => {
    if (state !== 'selected' && !reducedMotion) {
      pop.set(
        withSequence(
          withTiming(0.94, { duration: 0 }),
          withTiming(1.04, { duration: 149, easing: POP_EASING }),
          withTiming(1, { duration: 91, easing: POP_EASING }),
        ),
      );
    }
    onSelect(option);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, selected: state === 'selected' }}
      disabled={disabled}
      onPress={handlePress}
      onPressIn={() => {
        if (!reducedMotion) press.set(withTiming(0.95, { duration: 140, easing: PRESS_EASING }));
      }}
      onPressOut={() => {
        press.set(withTiming(1, { duration: 140, easing: PRESS_EASING }));
      }}
      style={centered ? styles.cellCentered : styles.cell}
    >
      <Animated.View style={[styles.chip, styles[state], animatedStyle]}>
        <RNText maxFontSizeMultiplier={MAX_FONT_SCALE} numberOfLines={1} style={[styles.name, styles[NAME_TONE[state]]]}>
          {option.name}
        </RNText>
        <RNText maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.odds, styles[ODDS_TONE[state]]]}>
          {option.odds.toFixed(2)}
        </RNText>
      </Animated.View>
    </Pressable>
  );
});

const NAME_TONE = { selected: 'textSelected', locked: 'textLocked', default: 'nameDefault' } as const;
const ODDS_TONE = { selected: 'textSelected', locked: 'oddsLocked', default: 'oddsDefault' } as const;

const useStyles = createStyles(({ colors }) => ({
  cell: { flex: 1, minWidth: 0 },
  cellCentered: { width: '48%' },
  chip: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderCurve: 'continuous',
  },
  default: { backgroundColor: colors.oddsBgAlt },
  selected: {
    backgroundColor: colors.oddsSelected,
    boxShadow: `0px 0px 0px 1px ${hsl(46, 98, 52, 0.4)}`,
  },
  locked: { backgroundColor: colors.oddsLockedBg },
  name: {
    alignSelf: 'stretch',
    marginBottom: 2,
    fontFamily: 'Inter',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  odds: {
    fontFamily: 'Inter',
    fontSize: 16,
    lineHeight: 16,
    fontWeight: '800',
    ...fauxItalic,
  },
  nameDefault: { color: '#27272a' },
  oddsDefault: { color: '#09090b' },
  textSelected: { color: SELECTED_GOLD },
  textLocked: { color: colors.oddsLockedFg },
  oddsLocked: { color: colors.oddsLockedFg, textDecorationLine: 'line-through' },
}));
