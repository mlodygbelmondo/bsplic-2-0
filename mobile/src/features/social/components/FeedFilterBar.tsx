import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useStore } from 'zustand';

import { haptics } from '@/lib/haptics';
import { alpha, createStyles } from '@/theme';
import { Text } from '@/ui';
import { FEED_FILTERS, type FeedFilter } from '../lib/feedList';
import type { FeedChromeStore } from './feedChrome';
import { social } from './socialColors';

/** `py-1` + the 2.45rem buttons. The list header reserves this much space. */
export const FILTER_BAR_HEIGHT = 47.2;

/** Web `transition: transform 180ms ease, opacity 160ms ease`. */
const TRANSITION = {
  transitionProperty: ['transform', 'opacity'],
  transitionDuration: ['180ms', '160ms'],
  transitionTimingFunction: 'ease' as const,
};

/**
 * Phone filter bar (`social-edge-filter`): four equal tabs over the top of the
 * list. It slides up out of view on deliberate downward scrolling and returns
 * on upward scrolling (web `data-hidden`).
 */
export function FeedFilterBar({
  filter,
  onChange,
  chrome,
}: {
  filter: FeedFilter;
  onChange: (filter: FeedFilter) => void;
  chrome: FeedChromeStore;
}) {
  const styles = useStyles();
  const hidden = useStore(chrome, (state) => state.filterHidden);

  return (
    <Animated.View
      accessibilityRole="tablist"
      pointerEvents={hidden ? 'none' : 'auto'}
      style={[styles.bar, hidden ? styles.barHidden : styles.barShown, TRANSITION]}
    >
      {FEED_FILTERS.map(({ value, label }) => {
        const active = value === filter;
        return (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (active) return;
              haptics.selection();
              onChange(value);
            }}
            style={({ pressed }) => [styles.button, pressed && !active && styles.buttonPressed]}
          >
            <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={[styles.label, active && styles.labelActive]}>
              {label}
            </Text>
            {active ? <View style={styles.underline} /> : null}
          </Pressable>
        );
      })}
    </Animated.View>
  );
}

const useStyles = createStyles(() => ({
  // `grid grid-cols-4 items-center gap-1 bg-card px-2 py-1`, sticky over the list.
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    height: FILTER_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: social.card,
  },
  barShown: { opacity: 1, transform: [{ translateY: 0 }] },
  // `translateY(calc(-100% - 0.25rem))`, `opacity: 0`.
  barHidden: { opacity: 0, transform: [{ translateY: -(FILTER_BAR_HEIGHT + 4) }] },
  // `.social-filter-button` on phones: min-h 2.45rem, radius 0.65rem, padding-inline 0.25rem.
  button: {
    flex: 1,
    minWidth: 0,
    minHeight: 39.2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderRadius: 10.4,
  },
  buttonPressed: { backgroundColor: alpha(social.muted, 0.72) },
  // 0.86rem, weight 800, muted; active is primary.
  label: { fontSize: 13.76, lineHeight: 18, fontWeight: '800', color: social.mutedForeground, textAlign: 'center' },
  labelActive: { color: social.primary },
  // `::after`: left/right 0.35rem, bottom 0.15rem, 0.18rem tall, full radius.
  underline: {
    position: 'absolute',
    left: 5.6,
    right: 5.6,
    bottom: 2.4,
    height: 2.88,
    borderRadius: 999,
    backgroundColor: social.primary,
  },
}));
