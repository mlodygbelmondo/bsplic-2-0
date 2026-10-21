import { memo } from 'react';
import { View } from 'react-native';

import { createStyles } from '@/theme';
import type { CouponHistoryEntry } from '@/types/database';
import { Text } from '@/ui';
import { formatReplayMoney, STATUS_LABELS } from './model';
import { replayTone } from './replay-colors';

/** Stake, total odds and every leg of one coupon (highlight card and history rows). */
export const ReplayCouponDetails = memo(function ReplayCouponDetails({ coupon }: { coupon: CouponHistoryEntry }) {
  const styles = useStyles();
  const legs = coupon.legs ?? [];
  return (
    <View>
      <View style={styles.grid}>
        <View style={styles.cell}>
          <Text style={styles.muted}>Stawka</Text>
          <Text weight="600" tabular style={styles.value}>{formatReplayMoney(Math.round(coupon.stake * 100))}</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.muted}>Kurs łączny</Text>
          <Text weight="600" tabular style={styles.value}>×{coupon.total_odds.toFixed(2)}</Text>
        </View>
      </View>
      {legs.length > 0 ? (
        <View style={styles.legs}>
          {legs.map((leg, index) => (
            <View
              key={leg.id}
              style={[styles.leg, index === 0 && styles.firstLeg, index === legs.length - 1 && styles.lastLeg, index > 0 && styles.divider]}
            >
              <Text weight="500">{leg.bet_title || 'Wydarzenie'}</Text>
              <Text style={[styles.muted, styles.legMeta]}>
                {leg.selected_option} · ×{leg.odds_at_time.toFixed(2)} · {STATUS_LABELS[leg.result]}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={[styles.muted, styles.noLegs]}>Brak szczegółów tego kuponu.</Text>
      )}
    </View>
  );
});

const useStyles = createStyles((palette) => ({
  grid: { flexDirection: 'row', gap: 16 },
  cell: { flex: 1, minWidth: 0 },
  muted: { color: replayTone(palette).muted },
  value: { marginTop: 4 },
  legs: { marginTop: 16 },
  leg: { paddingVertical: 12 },
  firstLeg: { paddingTop: 0 },
  lastLeg: { paddingBottom: 0 },
  divider: { borderTopWidth: 1, borderTopColor: palette.colors.border },
  legMeta: { marginTop: 4 },
  noLegs: { marginTop: 16 },
}));
