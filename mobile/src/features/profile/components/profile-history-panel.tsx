import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, LinearTransition, ReduceMotion } from 'react-native-reanimated';

import { AppButton, AppCard } from '@/components/ui';
import { useAppTheme } from '@/hooks/use-app-theme';
import type { CasinoHistoryEntry, CouponHistoryEntry } from '@/types/database';

import {
  deriveCouponStatus,
  getCasinoGameLabel,
  getDisplayedCouponOdds,
  getDisplayedCouponWin,
} from '../profile-history';

export type HistoryKind = 'sportsbook' | 'casino';
export type CouponFilter = 'all' | 'won' | 'lost' | 'pending' | 'refund';

const FILTERS: Array<[CouponFilter, string]> = [
  ['all', 'Wszystkie'],
  ['won', 'Wygrane'],
  ['lost', 'Przegrane'],
  ['pending', 'W toku'],
  ['refund', 'Zwroty'],
];

interface ProfileHistoryPanelProps {
  coupons: CouponHistoryEntry[];
  casino: CasinoHistoryEntry[];
  kind: HistoryKind;
  filter: CouponFilter;
  expandedCouponIds: Set<string>;
  sportsbookExpanded: boolean;
  casinoExpanded: boolean;
  hasMoreCoupons: boolean;
  hasMoreCasino: boolean;
  hasHiddenCoupons: boolean;
  hasHiddenCasino: boolean;
  loadingCasino: boolean;
  loadingMore: boolean;
  error: string | null;
  onKindChange(kind: HistoryKind): void;
  onFilterChange(filter: CouponFilter): void;
  onToggleCoupon(id: string): void;
  onShowMore(): void;
  onCollapse(): void;
}

function statusPresentation(status: CouponHistoryEntry['status']) {
  if (status === 'won') return { label: 'Wygrana', tone: 'success' as const };
  if (status === 'lost') return { label: 'Przegrana', tone: 'danger' as const };
  if (status === 'refund') return { label: 'Zwrot', tone: 'primary' as const };
  return { label: 'W toku', tone: 'muted' as const };
}

function CouponRow({
  coupon,
  expanded,
  onToggle,
}: {
  coupon: CouponHistoryEntry;
  expanded: boolean;
  onToggle(): void;
}) {
  const { tokens } = useAppTheme();
  const legs = coupon.legs ?? [];
  const ako = legs.length > 1;
  const status = deriveCouponStatus(coupon);
  const odds = getDisplayedCouponOdds(coupon);
  const win = getDisplayedCouponWin(coupon, status);
  const presentation = statusPresentation(status);
  const statusColor = presentation.tone === 'success'
    ? tokens.colors.success
    : presentation.tone === 'danger'
      ? tokens.colors.destructive
      : presentation.tone === 'primary'
        ? tokens.colors.primary
        : tokens.colors.mutedForeground;

  return (
    <Animated.View layout={LinearTransition.reduceMotion(ReduceMotion.System)} style={[styles.rowCard, { backgroundColor: tokens.colors.secondary }]}>
      <Pressable
        accessibilityRole={ako ? 'button' : undefined}
        accessibilityState={ako ? { expanded } : undefined}
        onPress={ako ? onToggle : undefined}
        style={styles.rowSummary}
      >
        <View style={styles.rowMain}>
          {ako ? (
            <View style={styles.akoHeading}>
              <View style={[styles.miniBadge, { backgroundColor: `${tokens.colors.primary}18` }]}>
                <Text style={[styles.miniBadgeText, { color: tokens.colors.primary }]}>AKO {legs.length}</Text>
              </View>
              <Text style={[styles.rowMeta, { color: tokens.colors.mutedForeground }]}>kurs {odds.toFixed(2)}</Text>
              {expanded
                ? <ChevronUp color={tokens.colors.mutedForeground} size={15} />
                : <ChevronDown color={tokens.colors.mutedForeground} size={15} />}
            </View>
          ) : (
            <>
              <Text numberOfLines={1} style={[styles.rowTitle, { color: tokens.colors.foreground }]}>{legs[0]?.bet_title || 'Zakład'}</Text>
              <Text numberOfLines={1} style={[styles.rowMeta, { color: tokens.colors.mutedForeground }]}>{legs[0]?.selected_option || '—'} · kurs {odds.toFixed(2)}</Text>
            </>
          )}
        </View>
        <View style={styles.rowValue}>
          <Text style={[styles.stake, { color: tokens.colors.foreground }]}>{Number(coupon.stake).toFixed(2)} zł</Text>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {status === 'won'
              ? `+${win.toFixed(2)} zł`
              : status === 'refund'
                ? `Zwrot ${win.toFixed(2)} zł`
                : presentation.label}
          </Text>
        </View>
      </Pressable>

      {ako && expanded ? (
        <Animated.View
          entering={FadeIn.duration(160).reduceMotion(ReduceMotion.System)}
          style={[styles.legs, { borderTopColor: tokens.colors.border }]}
        >
          {legs.map((leg, index) => {
            const legPresentation = statusPresentation(leg.result);
            const legColor = legPresentation.tone === 'success'
              ? tokens.colors.success
              : legPresentation.tone === 'danger'
                ? tokens.colors.destructive
                : legPresentation.tone === 'primary'
                  ? tokens.colors.primary
                  : tokens.colors.mutedForeground;
            return (
              <View key={leg.id || `${coupon.id}-${index}`} style={styles.legRow}>
                <View style={styles.rowMain}>
                  <Text numberOfLines={1} style={[styles.legTitle, { color: tokens.colors.foreground }]}>{leg.bet_title || 'Zakład'}</Text>
                  <Text numberOfLines={1} style={[styles.rowMeta, { color: tokens.colors.mutedForeground }]}>{leg.selected_option} · kurs {Number(leg.odds_at_time).toFixed(2)}</Text>
                </View>
                <Text style={[styles.legStatus, { color: legColor, backgroundColor: `${legColor}12` }]}>{legPresentation.label}</Text>
              </View>
            );
          })}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

function CasinoRow({ entry }: { entry: CasinoHistoryEntry }) {
  const { tokens } = useAppTheme();
  const won = entry.status === 'won';
  const lost = entry.status === 'lost';
  const push = entry.status === 'push';
  const resultColor = won
    ? tokens.colors.success
    : lost
      ? tokens.colors.destructive
      : push
        ? tokens.colors.primary
        : tokens.colors.mutedForeground;

  return (
    <View style={[styles.rowCard, styles.rowSummary, { backgroundColor: tokens.colors.secondary }]}>
      <View style={styles.rowMain}>
        <View style={styles.akoHeading}>
          <Text numberOfLines={1} style={[styles.rowTitle, { color: tokens.colors.foreground }]}>{getCasinoGameLabel(entry.game_type)}</Text>
          {entry.round_label ? (
            <Text style={[styles.roundLabel, { color: tokens.colors.primary, backgroundColor: `${tokens.colors.primary}16` }]}>{entry.round_label}</Text>
          ) : null}
        </View>
        <Text numberOfLines={1} style={[styles.rowMeta, { color: tokens.colors.mutedForeground }]}>{entry.bet_label}</Text>
      </View>
      <View style={styles.rowValue}>
        <Text style={[styles.stake, { color: tokens.colors.foreground }]}>{entry.stake.toFixed(2)} zł</Text>
        <Text style={[styles.statusText, { color: resultColor }]}>
          {won ? `+${entry.payout.toFixed(2)} zł` : lost ? 'Przegrana' : push ? `Zwrot ${entry.payout.toFixed(2)} zł` : 'W toku'}
        </Text>
      </View>
    </View>
  );
}

export function ProfileHistoryPanel({
  coupons,
  casino,
  kind,
  filter,
  expandedCouponIds,
  sportsbookExpanded,
  casinoExpanded,
  hasMoreCoupons,
  hasMoreCasino,
  hasHiddenCoupons,
  hasHiddenCasino,
  loadingCasino,
  loadingMore,
  error,
  onKindChange,
  onFilterChange,
  onToggleCoupon,
  onShowMore,
  onCollapse,
}: ProfileHistoryPanelProps) {
  const { tokens } = useAppTheme();
  const filteredCoupons = coupons
    .map((coupon) => ({ ...coupon, status: deriveCouponStatus(coupon) }))
    .filter((coupon) => filter === 'all' || coupon.status === filter);
  const expanded = kind === 'sportsbook' ? sportsbookExpanded : casinoExpanded;
  const hasMore = kind === 'sportsbook' ? hasMoreCoupons : hasMoreCasino;
  const hasHidden = kind === 'sportsbook' ? hasHiddenCoupons : hasHiddenCasino;
  const hasRows = kind === 'sportsbook' ? coupons.length > 0 : casino.length > 0;

  return (
    <AppCard style={{ backgroundColor: tokens.colors.card, borderColor: tokens.colors.border, gap: 12 }}>
      <View style={styles.header}>
        <Text style={[styles.heading, { color: tokens.colors.foreground }]}>Historia</Text>
        <View style={[styles.kindSwitch, { backgroundColor: tokens.colors.secondary }]}>
          {([['sportsbook', 'Zakłady'], ['casino', 'Kasyno']] as const).map(([value, label]) => (
            <Pressable
              key={value}
              accessibilityRole="tab"
              accessibilityState={{ selected: kind === value }}
              onPress={() => onKindChange(value)}
              style={[styles.kindButton, kind === value && { backgroundColor: tokens.colors.primary }]}
            >
              <Text style={[styles.kindText, { color: kind === value ? tokens.colors.primaryForeground : tokens.colors.mutedForeground }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {kind === 'sportsbook' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map(([value, label]) => (
            <Pressable
              key={value}
              accessibilityRole="tab"
              accessibilityState={{ selected: filter === value }}
              onPress={() => onFilterChange(value)}
              style={[
                styles.filter,
                { borderColor: tokens.colors.border, backgroundColor: tokens.colors.secondary },
                filter === value && { borderColor: tokens.colors.foreground, backgroundColor: tokens.colors.foreground },
              ]}
            >
              <Text style={[styles.filterText, { color: filter === value ? tokens.colors.background : tokens.colors.mutedForeground }]}>{label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {error ? <Text style={[styles.empty, { color: tokens.colors.destructive }]}>{error}</Text> : null}
      {!error && loadingCasino && kind === 'casino' ? <Text style={[styles.empty, { color: tokens.colors.mutedForeground }]}>Wczytywanie historii kasyna…</Text> : null}
      {!error && !loadingCasino && kind === 'sportsbook' && filteredCoupons.length === 0 ? <Text style={[styles.empty, { color: tokens.colors.mutedForeground }]}>Brak zakładów</Text> : null}
      {!error && !loadingCasino && kind === 'casino' && casino.length === 0 ? <Text style={[styles.empty, { color: tokens.colors.mutedForeground }]}>Brak betów z kasyna</Text> : null}

      {!error && kind === 'sportsbook' ? (
        <View style={styles.rows}>
          {filteredCoupons.map((coupon) => (
            <CouponRow
              key={coupon.id}
              coupon={coupon}
              expanded={expandedCouponIds.has(coupon.id)}
              onToggle={() => onToggleCoupon(coupon.id)}
            />
          ))}
        </View>
      ) : null}
      {!error && kind === 'casino' ? <View style={styles.rows}>{casino.map((entry) => <CasinoRow key={entry.id} entry={entry} />)}</View> : null}

      {!error && hasRows && (expanded || hasMore || hasHidden) ? (
        <View style={styles.moreActions}>
          {expanded ? <AppButton variant="outline" onPress={onCollapse} style={styles.moreButton}>Pokaż mniej</AppButton> : null}
          {(!expanded && (hasHidden || hasMore)) || hasMore ? <AppButton variant="outline" loading={loadingMore} onPress={onShowMore} style={styles.moreButton}>Pokaż więcej</AppButton> : null}
        </View>
      ) : null}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  heading: { fontSize: 18, fontWeight: '900' },
  kindSwitch: { flexDirection: 'row', borderRadius: 10, padding: 4 },
  kindButton: { minHeight: 32, justifyContent: 'center', borderRadius: 7, paddingHorizontal: 12 },
  kindText: { fontSize: 11, fontWeight: '800' },
  filters: { gap: 7, paddingRight: 2 },
  filter: { minHeight: 34, justifyContent: 'center', borderRadius: 999, borderWidth: 1, paddingHorizontal: 13 },
  filterText: { fontSize: 11, fontWeight: '800' },
  rows: { gap: 8 },
  rowCard: { overflow: 'hidden', borderRadius: 12 },
  rowSummary: { minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: 12 },
  rowMain: { flex: 1, minWidth: 0, gap: 4 },
  rowValue: { flexShrink: 0, alignItems: 'flex-end', gap: 4 },
  rowTitle: { fontSize: 13, fontWeight: '700' },
  rowMeta: { fontSize: 11, fontWeight: '600' },
  stake: { fontSize: 13, fontWeight: '900' },
  statusText: { fontSize: 11, fontWeight: '800' },
  akoHeading: { minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 7 },
  miniBadge: { borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3 },
  miniBadgeText: { fontSize: 10, fontWeight: '900' },
  legs: { gap: 9, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingBottom: 12, paddingTop: 10 },
  legRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legTitle: { fontSize: 11, fontWeight: '700' },
  legStatus: { overflow: 'hidden', borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3, fontSize: 9, fontWeight: '900' },
  roundLabel: { overflow: 'hidden', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, fontSize: 9, fontWeight: '900' },
  empty: { paddingVertical: 18, textAlign: 'center', fontSize: 12, fontWeight: '600' },
  moreActions: { flexDirection: 'row', gap: 8 },
  moreButton: { flex: 1 },
});
