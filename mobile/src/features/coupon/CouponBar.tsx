import { router } from 'expo-router';
import { Ticket } from 'lucide-react-native';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBonusCtaVisible } from '@/features/bonus-campaigns/bonus-cta-store';
import { haptics } from '@/lib/haptics';
import { createStyles, hsl, useTheme } from '@/theme';
import { PressScale, Text } from '@/ui';

import { useCouponCount } from './coupon-store';

/** Web `bottom-[calc(1rem + nav + safe-area)]`: the tab screen's bottom inset already covers the tab bar. */
const TRIGGER_GAP = 16;
/** Web `.bonus-campaign-cta-visible .coupon-mobile-trigger`: 4.5rem instead of 1rem above the nav. */
const BONUS_CTA_LIFT = 56;

/** `.coupon-mobile-trigger` moves with the bottom nav over 200 ms ease-out. */
const BOTTOM_TRANSITION = {
  transitionProperty: 'bottom',
  transitionDuration: 200,
  transitionTimingFunction: 'ease-out',
} as const;

/**
 * Phone coupon trigger (web `CouponDrawer` closed state below `lg`): a round
 * ticket button at the bottom right of the sportsbook screen, red with a count
 * badge while the coupon has items. Opens the coupon sheet.
 */
export function CouponBar() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const count = useCouponCount();
  const bonusCtaVisible = useBonusCtaVisible();
  const hasItems = count > 0;
  const bottom = insets.bottom + TRIGGER_GAP + (bonusCtaVisible ? BONUS_CTA_LIFT : 0);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.anchor, { bottom }, BOTTOM_TRANSITION]}
    >
      <PressScale
        accessibilityRole="button"
        accessibilityLabel={hasItems ? `Otwórz kupon, zdarzenia: ${count}` : 'Otwórz kupon'}
        onPress={() => {
          haptics.selection();
          router.push('/sheets/coupon');
        }}
        style={[styles.button, hasItems ? styles.filled : styles.empty]}
      >
        <View>
          <Ticket size={24} color={hasItems ? colors.primaryForeground : colors.foreground} />
          {hasItems ? (
            <View style={styles.badge}>
              <Text tabular maxFontSizeMultiplier={1} style={styles.badgeText}>
                {count}
              </Text>
            </View>
          ) : null}
        </View>
      </PressScale>
    </Animated.View>
  );
}

const useStyles = createStyles(({ colors, gradients }) => ({
  anchor: { position: 'absolute', right: 16, zIndex: 40 },
  // `flex h-14 w-14 items-center justify-center rounded-full shadow-2xl`.
  button: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // `bg-card text-foreground border border-border` + `shadow-2xl`.
  empty: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: '0px 25px 50px -12px rgba(0, 0, 0, 0.25)',
  },
  // `gradient-primary text-primary-foreground shadow-[0_8px_28px_hsl(355_100%_45%/0.45)]`.
  filled: {
    backgroundImage: gradients.primary,
    boxShadow: `0px 8px 28px ${hsl(355, 100, 45, 0.45)}`,
  },
  // `absolute -right-2 -top-2 h-5 w-5 rounded-full bg-card text-[10px] font-bold shadow`.
  badge: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    boxShadow: '0px 1px 3px 0px rgba(0, 0, 0, 0.1), 0px 1px 2px -1px rgba(0, 0, 0, 0.1)',
  },
  badgeText: { fontSize: 10, lineHeight: 15, fontWeight: '700', color: colors.foreground },
}));
