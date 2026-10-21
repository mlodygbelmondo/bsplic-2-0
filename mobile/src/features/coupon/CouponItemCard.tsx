import { X } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, View } from 'react-native';

import { haptics } from '@/lib/haptics';
import { alpha, createStyles, useTheme } from '@/theme';
import type { CouponItem } from '@/types/database';
import { Text } from '@/ui';

import { couponActions } from './coupon-store';
import { couponSheetActions, useCouponSingleStake } from './coupon-sheet-store';
import { StakeInput } from './StakeInput';

interface CouponItemCardProps {
  item: CouponItem;
  emoji: string;
  /** Single tab: per-bet stake row. */
  showStake: boolean;
  onSubmitStake: () => void;
}

/** One coupon selection (web `CouponDrawer` `article`). */
export const CouponItemCard = memo(function CouponItemCard({
  item,
  emoji,
  showStake,
  onSubmitStake,
}: CouponItemCardProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const betId = item.bet.id;
  const stake = useCouponSingleStake(betId);

  return (
    <View style={styles.card}>
      <View style={styles.body}>
        <Text color="mutedForeground" numberOfLines={1} style={styles.title}>
          {emoji} {item.bet.title}
        </Text>
        <Text style={styles.option}>{item.selectedOption}</Text>
        <View style={styles.oddsChip}>
          <Text tabular italic style={styles.oddsText}>
            {item.odds.toFixed(2)}
          </Text>
        </View>
        {showStake ? (
          <View style={styles.stakeRow}>
            <Text color="mutedForeground" style={styles.label}>
              Stawka
            </Text>
            <StakeInput
              variant="single"
              value={stake}
              onChangeValue={(value) => couponSheetActions.setSingleStake(betId, value)}
              onSubmitEditing={onSubmitStake}
              placeholder="0.00"
              accessibilityLabel="Stawka"
              style={styles.stakeInput}
            />
            <Text color="mutedForeground" style={styles.label}>
              zł
            </Text>
          </View>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Usuń zdarzenie"
        hitSlop={11}
        onPress={() => {
          haptics.selection();
          couponActions.removeItem(betId);
        }}
        style={({ pressed }) => [styles.remove, pressed && styles.removePressed]}
      >
        {({ pressed }) => <X size={14} color={pressed ? colors.destructive : colors.mutedForeground} />}
      </Pressable>
    </View>
  );
});

const useStyles = createStyles(({ colors, radius }) => ({
  // `rounded-xl border border-border bg-background/60 p-2.5`, inner `flex items-start gap-2`.
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: radius.xl,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: alpha(colors.background, 0.6),
  },
  body: { flex: 1, minWidth: 0 },
  title: { fontSize: 11, lineHeight: 16.5 },
  option: { fontSize: 13, lineHeight: 18, fontWeight: '700', marginTop: 2 },
  // `.odds-yellow inline-block mt-1 rounded-md px-1.5 py-0.5 text-[11px] font-extrabold italic`.
  oddsChip: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    backgroundColor: colors.oddsBgAlt,
  },
  oddsText: { fontSize: 11, lineHeight: 16.5, fontWeight: '800', color: colors.oddsFgAlt },
  // `mt-2.5 grid grid-cols-[auto_1fr_auto] items-center gap-2`.
  stakeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  label: { fontSize: 11, lineHeight: 16.5 },
  stakeInput: { flex: 1 },
  // `p-1 rounded`, hover `text-destructive bg-destructive/10`.
  remove: { padding: 4, borderRadius: 4 },
  removePressed: { backgroundColor: alpha(colors.destructive, 0.1) },
}));
