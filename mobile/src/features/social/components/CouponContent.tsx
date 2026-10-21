import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { deriveCouponStatus, getDisplayedCouponOdds, getDisplayedCouponWin } from '@/features/coupon/display';
import { alpha, createStyles } from '@/theme';
import type { CouponLeg, SocialFeedItem } from '@/types/database';
import { Text } from '@/ui';
import { social } from './socialColors';

type CouponStatus = 'pending' | 'won' | 'lost' | 'refund';

const STATUS_STYLE = {
  won: 'statusWon',
  lost: 'statusLost',
  refund: 'statusRefund',
  pending: 'statusPending',
} as const;

const LEG_BADGES = {
  won: { label: 'Wygrana', badge: 'legWon', text: 'legWonText' },
  lost: { label: 'Przegrana', badge: 'legLost', text: 'legLostText' },
  refund: { label: 'Zwrot', badge: 'legRefund', text: 'legRefundText' },
  pending: { label: 'W toku', badge: 'legPending', text: 'legPendingText' },
} as const;

function statusLabel(status: CouponStatus, win: number) {
  if (status === 'won') return `+${win.toFixed(2)} zł`;
  if (status === 'lost') return 'Przegrana';
  if (status === 'refund') return `Zwrot ${win.toFixed(2)} zł`;
  return 'W toku';
}

/**
 * Coupon body of a feed card (web `CouponContent` with the phone
 * `.social-coupon-content`/`.social-coupon-legs` boxes). AKO coupons toggle
 * their legs; singles show the bet and option.
 */
export function CouponContent({
  item,
  ako,
  expanded,
  onToggle,
}: {
  item: SocialFeedItem;
  ako: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const styles = useStyles();
  const legs = item.legs ?? [];
  const status = deriveCouponStatus({
    status: item.status as CouponStatus | null,
    legs: legs.map((leg) => ({ result: leg.result })),
  });
  const odds = getDisplayedCouponOdds({
    totalOdds: Number(item.total_odds),
    legs: legs.map((leg) => ({ oddsAtTime: Number(leg.odds_at_time), result: leg.result })),
  });
  const win = getDisplayedCouponWin({
    status,
    isAko: ako,
    stake: Number(item.stake),
    displayedOdds: odds,
    couponPayout: Number(item.payout),
    legs: legs.map((leg) => ({ legPayout: Number(leg.leg_payout ?? 0) })),
  });
  const ChevronIcon = expanded ? ChevronUp : ChevronDown;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityState={ako ? { expanded } : undefined}
        accessibilityHint={ako ? (expanded ? 'Zwija zdarzenia' : 'Rozwija zdarzenia') : undefined}
        onPress={() => {
          if (ako) onToggle();
        }}
        style={styles.box}
      >
        <View style={styles.left}>
          {ako ? (
            <View style={styles.akoRow}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>AKO {legs.length}</Text>
              </View>
              <Text style={styles.akoOdds}>kurs {odds.toFixed(2)}</Text>
              <ChevronIcon size={14} color={social.mutedForeground} />
            </View>
          ) : (
            <>
              <Text numberOfLines={1} style={styles.title}>
                {legs[0]?.bet_title || 'Zakład'}
              </Text>
              <Text style={styles.meta}>
                {legs[0]?.selected_option} • kurs {odds.toFixed(2)}
              </Text>
            </>
          )}
        </View>
        <View style={styles.right}>
          <Text tabular style={styles.stake}>
            {Number(item.stake).toFixed(2)} zł
          </Text>
          <Text tabular style={[styles.status, styles[STATUS_STYLE[status]]]}>
            {statusLabel(status, win)}
          </Text>
        </View>
      </Pressable>

      {ako && expanded ? (
        <View style={styles.legs}>
          {legs.map((leg) => (
            <CouponLegRow key={leg.id} leg={leg} />
          ))}
        </View>
      ) : null}
    </>
  );
}

function CouponLegRow({ leg }: { leg: CouponLeg }) {
  const styles = useStyles();
  const badge = LEG_BADGES[leg.result] ?? LEG_BADGES.pending;
  return (
    <View style={styles.legRow}>
      <View style={styles.left}>
        <Text numberOfLines={1} style={styles.legTitle}>
          {leg.bet_title || 'Zakład'}
        </Text>
        <Text style={styles.legMeta}>
          {leg.selected_option} • kurs {Number(leg.odds_at_time).toFixed(2)}
        </Text>
      </View>
      <View style={[styles.legBadge, styles[badge.badge]]}>
        <Text style={[styles.legBadgeText, styles[badge.text]]}>{badge.label}</Text>
      </View>
    </View>
  );
}

const useStyles = createStyles(({ colors }) => ({
  // `.social-coupon-content` on phones: margin 0 0.75rem 0.5rem, border, radius 0.75rem, muted, p 0.75rem.
  box: {
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: social.border,
    borderRadius: 12,
    backgroundColor: social.muted,
  },
  left: { flex: 1, minWidth: 0 },
  akoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // `px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary` (line height from `text-sm`).
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: social.primarySoft },
  badgeText: { fontSize: 10, lineHeight: 20, fontWeight: '700', color: social.primary },
  akoOdds: { fontSize: 12, lineHeight: 16, fontWeight: '500', color: social.mutedForeground },
  title: { fontSize: 14, lineHeight: 20, fontWeight: '500', color: social.foreground },
  meta: { fontSize: 12, lineHeight: 16, color: social.mutedForeground },
  right: { marginLeft: 12, flexShrink: 0, alignItems: 'flex-end' },
  stake: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: social.foreground },
  status: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  statusWon: { color: colors.success },
  statusLost: { color: colors.destructive },
  statusRefund: { color: social.primary },
  statusPending: { color: social.mutedForeground },
  // `.social-coupon-legs` on phones: margin -0.2rem 0.75rem 0.65rem, border, radius 0.75rem, card;
  // `px-3 pb-3 pt-2 space-y-1.5`.
  legs: {
    marginTop: -3.2,
    marginHorizontal: 12,
    marginBottom: 10.4,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: social.border,
    borderRadius: 12,
    backgroundColor: social.card,
  },
  legRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  legTitle: { fontSize: 12, lineHeight: 16, fontWeight: '500', color: social.foreground },
  legMeta: { fontSize: 12, lineHeight: 16, color: social.mutedForeground },
  // `ml-2 shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded` (line height from `text-xs`).
  legBadge: { marginLeft: 8, flexShrink: 0, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  legBadgeText: { fontSize: 10, lineHeight: 16, fontWeight: '700' },
  legWon: { backgroundColor: alpha(colors.success, 0.1) },
  legWonText: { color: colors.success },
  legLost: { backgroundColor: alpha(colors.destructive, 0.1) },
  legLostText: { color: colors.destructive },
  legRefund: { backgroundColor: social.primarySoft },
  legRefundText: { color: social.primary },
  legPending: { backgroundColor: social.mutedForegroundSoft },
  legPendingText: { color: social.mutedForeground },
}));
