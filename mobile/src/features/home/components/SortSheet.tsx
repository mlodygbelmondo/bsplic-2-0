import { router } from 'expo-router';
import { Check, Flame, Sparkles, Timer, type LucideIcon } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Switch, Text as RNText, View } from 'react-native';
import Animated, { Easing, Keyframe, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptics } from '@/lib/haptics';
import { useReducedMotion } from '@/lib/motion';
import { alpha, createStyles, useTheme } from '@/theme';
import { PressScale } from '@/ui';
import { homePreferencesActions, useHomePreferences } from '../hooks/use-home-preferences';
import type { SortMode } from '../logic/sort-bets';
import { SORT_OPTIONS } from '../logic/sort-options';

const MAX_FONT_SCALE = 1.35;

const SORT_ICONS: Record<SortMode, LucideIcon> = {
  newest: Sparkles,
  popular: Flame,
  ending_soon: Timer,
};

/** Lets the highlight slide to the picked option before the sheet goes away. */
const SELECT_CLOSE_DELAY_MS = 220;
/** `h-14` option rows with `gap-1` between them. */
const OPTION_ROW = 60;
/** `.sort-sheet-highlight`: 320 ms with a slight overshoot. */
const HIGHLIGHT_TIMING = { duration: 320, easing: Easing.bezier(0.34, 1.3, 0.64, 1) };
/** `transition-colors duration-200` on the icon boxes and the status dot. */
const COLOR_TRANSITION = {
  transitionProperty: ['backgroundColor', 'boxShadow'],
  transitionDuration: 200,
};

/** `.sort-sheet-item`: 320 ms rise from 14 px, 90 ms + 45 ms per item. */
const ITEM_ENTERINGS = Array.from({ length: 6 }, (_, index) =>
  new Keyframe({
    0: { opacity: 0, transform: [{ translateY: 14 }] },
    100: { opacity: 1, transform: [{ translateY: 0 }], easing: Easing.bezier(0.16, 1, 0.3, 1) },
  })
    .duration(320)
    .delay(90 + index * 45),
);

/** `.sort-sheet-check`: pops in with a small turn. */
const CHECK_ENTERING = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.4 }, { rotate: '-20deg' }] },
  100: { opacity: 1, transform: [{ scale: 1 }, { rotate: '0deg' }], easing: Easing.bezier(0.34, 1.56, 0.64, 1) },
}).duration(300);

/**
 * Web `SortSheet` as a native form sheet: the home sort modes and the
 * active-only filter. The system sheet provides the grabber, backdrop and
 * drag-to-dismiss.
 */
export function SortSheet() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const sort = useHomePreferences((s) => s.sort);
  const activeOnly = useHomePreferences((s) => s.activeOnly);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedIndex = Math.max(
    0,
    SORT_OPTIONS.findIndex((option) => option.value === sort),
  );
  const highlightY = useSharedValue(selectedIndex * OPTION_ROW);
  const highlightStyle = useAnimatedStyle(() => ({ transform: [{ translateY: highlightY.get() }] }));

  useEffect(() => {
    const target = selectedIndex * OPTION_ROW;
    highlightY.set(reducedMotion ? target : withTiming(target, HIGHLIGHT_TIMING));
  }, [selectedIndex, reducedMotion, highlightY]);

  useEffect(() => {
    homePreferencesActions.setSortSheetOpen(true);
    return () => {
      homePreferencesActions.setSortSheetOpen(false);
      if (closeTimer.current !== null) clearTimeout(closeTimer.current);
    };
  }, []);

  const handleSelect = (value: SortMode) => {
    if (value === sort) {
      router.back();
      return;
    }
    haptics.selection();
    homePreferencesActions.setSort(value);
    if (closeTimer.current !== null) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      router.back();
    }, SELECT_CLOSE_DELAY_MS);
  };

  const entering = (index: number) => (reducedMotion ? undefined : ITEM_ENTERINGS[index]);

  return (
    <View style={[styles.root, { paddingBottom: 12 + insets.bottom }]} collapsable={false}>
      <Animated.Text
        entering={entering(0)}
        accessibilityRole="header"
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        style={styles.title}
      >
        Sortowanie
      </Animated.Text>

      <View accessibilityRole="radiogroup" accessibilityLabel="Sortowanie" style={styles.options}>
        <Animated.View pointerEvents="none" style={[styles.highlight, highlightStyle]} />
        {SORT_OPTIONS.map((option, index) => {
          const Icon = SORT_ICONS[option.value];
          const selected = option.value === sort;
          return (
            <Animated.View key={option.value} entering={entering(index + 1)}>
              <PressScale
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                onPress={() => handleSelect(option.value)}
                style={styles.option}
              >
                <Animated.View style={[styles.iconBox, selected ? styles.iconBoxSelected : styles.iconBoxIdle, COLOR_TRANSITION]}>
                  <Icon size={18} color={selected ? colors.primaryForeground : colors.mutedForeground} />
                </Animated.View>
                <View style={styles.optionText}>
                  <RNText maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.optionLabel}>
                    {option.label}
                  </RNText>
                  <RNText maxFontSizeMultiplier={MAX_FONT_SCALE} numberOfLines={1} style={styles.optionHint}>
                    {option.hint}
                  </RNText>
                </View>
                {selected ? (
                  <Animated.View entering={reducedMotion ? undefined : CHECK_ENTERING}>
                    <Check size={20} color={colors.primary} />
                  </Animated.View>
                ) : null}
              </PressScale>
            </Animated.View>
          );
        })}
      </View>

      <Animated.View entering={entering(4)} style={styles.divider} />

      <Animated.View entering={entering(5)} style={styles.activeRow}>
        <View style={styles.dotBox}>
          <Animated.View style={[styles.dot, activeOnly ? styles.dotOn : styles.dotOff, COLOR_TRANSITION]} />
        </View>
        <View style={styles.optionText}>
          <RNText maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.optionLabel}>
            Tylko aktywne
          </RNText>
          <RNText maxFontSizeMultiplier={MAX_FONT_SCALE} numberOfLines={1} style={styles.optionHint}>
            Ukrywa zakłady w trakcie
          </RNText>
        </View>
        <Switch
          value={activeOnly}
          onValueChange={homePreferencesActions.toggleActiveOnly}
          accessibilityLabel="Tylko aktywne"
          trackColor={{ false: colors.input, true: colors.primary }}
          ios_backgroundColor={colors.input}
          thumbColor={colors.background}
        />
      </Animated.View>
    </View>
  );
}

const useStyles = createStyles(({ colors }) => ({
  // `rounded-t-[28px] bg-card px-4 pt-3`; the top padding also covers the web grab handle (`h-1.5 mb-4`).
  root: { backgroundColor: colors.card, paddingHorizontal: 16, paddingTop: 34 },
  // `mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground`
  title: {
    marginBottom: 8,
    paddingHorizontal: 4,
    fontFamily: 'Inter',
    fontSize: 11,
    lineHeight: 16.5,
    fontWeight: '600',
    letterSpacing: 1.54,
    textTransform: 'uppercase',
    color: colors.mutedForeground,
  },
  options: { gap: 4 },
  // `absolute inset-x-0 top-0 h-14 rounded-2xl border border-primary/40 bg-primary/15`
  highlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 56,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: alpha(colors.primary, 0.4),
    backgroundColor: alpha(colors.primary, 0.15),
  },
  // `flex h-14 items-center gap-3 rounded-2xl px-3`
  option: { height: 56, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, paddingHorizontal: 12 },
  // `grid h-9 w-9 place-items-center rounded-xl`
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxSelected: { backgroundColor: colors.primary, boxShadow: `0px 0px 18px ${alpha(colors.primary, 0.45)}` },
  iconBoxIdle: { backgroundColor: colors.muted, boxShadow: `0px 0px 0px ${alpha(colors.primary, 0)}` },
  optionText: { flex: 1, minWidth: 0 },
  // `text-[15px] font-semibold leading-tight`
  optionLabel: { fontFamily: 'Inter', fontSize: 15, lineHeight: 18.75, fontWeight: '600', color: colors.foreground },
  // `text-xs text-muted-foreground`
  optionHint: { fontFamily: 'Inter', fontSize: 12, lineHeight: 16, color: colors.mutedForeground },
  // `my-3 h-px bg-border`
  divider: { marginVertical: 12, height: 1, backgroundColor: colors.border },
  // `flex h-14 items-center gap-3 px-3`
  activeRow: { height: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12 },
  dotBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.muted,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotOn: { backgroundColor: colors.success, boxShadow: `0px 0px 8px ${colors.success}` },
  dotOff: { backgroundColor: alpha(colors.mutedForeground, 0.5), boxShadow: `0px 0px 0px ${alpha(colors.success, 0)}` },
}));
