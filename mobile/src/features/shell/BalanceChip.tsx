import { Plus } from 'lucide-react-native';
import { View } from 'react-native';

import { useAuthStore, useBalance } from '@/features/auth/auth-store';
import { haptics } from '@/lib/haptics';
import { createStyles, useTheme } from '@/theme';
import { PressScale, Text } from '@/ui';
import { canClaimTopup } from './polish-day';
import { openTopupSheet } from './topup';

/**
 * Header wallet chip (web mobile `navbar-chip`): balance with a gradient
 * plus circle. Subscribes only to the balance and last top-up time, so a
 * balance change re-renders this chip and nothing else in the header.
 */
export function BalanceChip({ compact }: { compact: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const hasProfile = useAuthStore((s) => s.profile !== null);
  const balance = useBalance();
  const lastTopupAt = useAuthStore((s) => s.profile?.last_topup_at ?? null);

  if (!hasProfile) return null;

  const formattedBalance = Number(balance).toFixed(2);
  const topupAvailable = canClaimTopup(lastTopupAt);

  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={`Portfel: ${formattedBalance} zł. ${topupAvailable ? 'Doładuj portfel' : 'Doładowanie dostępne jutro'}`}
      hitSlop={6}
      onPress={() => {
        haptics.selection();
        openTopupSheet(lastTopupAt);
      }}
      style={styles.chip}
    >
      <View style={styles.circle}>
        <Plus size={14} strokeWidth={3} color={colors.primaryForeground} />
      </View>
      <Text
        weight="700"
        numberOfLines={1}
        maxFontSizeMultiplier={1.2}
        style={[styles.label, compact && styles.labelCompact]}
      >
        {formattedBalance} zł
      </Text>
    </PressScale>
  );
}

const useStyles = createStyles(({ colors, gradients }) => ({
  chip: {
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 4,
    paddingRight: 10,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: colors.navbarChipBorder,
    backgroundColor: colors.navbarChipBg,
  },
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundImage: gradients.primary,
  },
  label: { fontSize: 12, lineHeight: 14, color: colors.primaryForeground },
  labelCompact: { fontSize: 10, lineHeight: 12 },
}));
