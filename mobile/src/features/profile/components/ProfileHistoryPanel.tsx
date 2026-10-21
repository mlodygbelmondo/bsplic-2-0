import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { useBootHold } from '@/features/boot/boot-store';
import { getDisplayedCouponOdds, getDisplayedCouponWin } from '@/features/coupon/display';
import { haptics } from '@/lib/haptics';
import { alpha, createStyles, useTheme, type Colors } from '@/theme';
import type { CasinoHistoryEntry } from '@/types/database';
import { PressScale, Skeleton, Text } from '@/ui';
import { HISTORY_PREVIEW_SIZE } from '../api/profileQueries';
import type { ProfileHistoryState } from '../hooks/useProfileHistory';
import {
  deriveSportsbookCouponRows,
  type ProfileHistoryType,
  type SportsbookCouponRow,
  type SportsbookHistoryFilter,
} from '../logic/historyRows';
import { useSurfaceStyles } from './surfaces';

const HISTORY_TYPE_OPTIONS: [ProfileHistoryType, string][] = [
  ['sportsbook', 'Zakłady'],
  ['casino', 'Kasyno'],
];

const SPORTSBOOK_FILTER_LABELS: Record<SportsbookHistoryFilter, string> = {
  all: 'Wszystkie',
  won: 'Wygrane',
  lost: 'Przegrane',
  pending: 'W toku',
  refund: 'Zwroty',
};
const SPORTSBOOK_FILTERS = Object.keys(SPORTSBOOK_FILTER_LABELS) as SportsbookHistoryFilter[];

type ResultTone = { color: keyof Colors; label: string };

function couponStatusTone(status: SportsbookCouponRow['status'], displayedWin: number): ResultTone {
  if (status === 'won') return { color: 'success', label: `+${displayedWin.toFixed(2)} zł` };
  if (status === 'lost') return { color: 'destructive', label: 'Przegrana' };
  if (status === 'refund') return { color: 'primary', label: `Zwrot ${displayedWin.toFixed(2)} zł` };
  return { color: 'mutedForeground', label: 'W toku' };
}

type LegTone = ResultTone & { pill: 'pillSuccess' | 'pillDestructive' | 'pillPrimary' | 'pillMuted' };

function legResultTone(result: string): LegTone {
  if (result === 'won') return { color: 'success', label: 'Wygrana', pill: 'pillSuccess' };
  if (result === 'lost') return { color: 'destructive', label: 'Przegrana', pill: 'pillDestructive' };
  if (result === 'refund') return { color: 'primary', label: 'Zwrot', pill: 'pillPrimary' };
  return { color: 'mutedForeground', label: 'W toku', pill: 'pillMuted' };
}

function casinoStatusTone(entry: CasinoHistoryEntry): ResultTone {
  if (entry.status === 'won') return { color: 'success', label: `+${entry.payout.toFixed(2)} zł` };
  if (entry.status === 'lost') return { color: 'destructive', label: 'Przegrana' };
  if (entry.status === 'push') return { color: 'primary', label: `Zwrot ${entry.payout.toFixed(2)} zł` };
  return { color: 'mutedForeground', label: 'W toku' };
}

/** Web `ProfileHistoryPanel`: sportsbook coupons and casino bets with "Pokaż więcej / mniej". */
export function ProfileHistoryPanel({ history }: { history: ProfileHistoryState }) {
  const surfaces = useSurfaceStyles();
  const styles = useStyles();
  const visibleCoupons = history.sportsbookHistoryExpanded
    ? history.coupons
    : history.coupons.slice(0, HISTORY_PREVIEW_SIZE);
  const visibleCasinoHistory = history.casinoHistoryExpanded
    ? history.casinoHistory
    : history.casinoHistory.slice(0, HISTORY_PREVIEW_SIZE);
  const filtered = deriveSportsbookCouponRows(visibleCoupons, history.filter);

  return (
    <View style={[surfaces.card, styles.panel]}>
      <View style={styles.header}>
        <Text size="base" weight="700" accessibilityRole="header">
          Historia
        </Text>
        <View style={[surfaces.sub, styles.segmented]} accessibilityRole="tablist">
          {HISTORY_TYPE_OPTIONS.map(([value, label]) => {
            const selected = history.historyType === value;
            return (
              <Pressable
                key={value}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                hitSlop={{ top: 8, bottom: 8 }}
                onPress={() => {
                  if (selected) return;
                  haptics.selection();
                  history.setHistoryType(value);
                }}
                style={[styles.segment, selected && styles.segmentActive]}
              >
                <Text size="xs" weight="600" color={selected ? 'primaryForeground' : 'mutedForeground'}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {history.historyType === 'sportsbook' ? (
        <SportsbookHistory history={history} filteredCoupons={filtered} />
      ) : (
        <CasinoHistory history={history} visibleCasinoHistory={visibleCasinoHistory} />
      )}
    </View>
  );
}

function SportsbookHistory({
  history,
  filteredCoupons,
}: {
  history: ProfileHistoryState;
  filteredCoupons: SportsbookCouponRow[];
}) {
  const styles = useStyles();
  const showFooter =
    !history.loadingCoupons &&
    !history.sportsbookHistoryError &&
    history.coupons.length > 0 &&
    (history.sportsbookHistoryExpanded || history.coupons.length > HISTORY_PREVIEW_SIZE || history.hasMoreCoupons);

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroller}
        contentContainerStyle={styles.filterRow}
      >
        {SPORTSBOOK_FILTERS.map((value) => {
          const selected = history.filter === value;
          return (
            <PressScale
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              hitSlop={{ top: 7, bottom: 7 }}
              onPress={() => {
                haptics.selection();
                history.setFilter(value);
              }}
              style={[styles.chip, selected ? styles.chipActive : styles.chipInactive]}
            >
              <Text size="xs" weight="600" color={selected ? 'background' : 'mutedForeground'}>
                {SPORTSBOOK_FILTER_LABELS[value]}
              </Text>
            </PressScale>
          );
        })}
      </ScrollView>

      {history.loadingCoupons ? (
        <HistorySkeleton />
      ) : history.sportsbookHistoryError ? (
        <Text color="destructive" align="center" style={styles.message}>
          {history.sportsbookHistoryError}
        </Text>
      ) : filteredCoupons.length === 0 ? (
        <Text color="mutedForeground" align="center" style={styles.message}>
          Brak zakładów
        </Text>
      ) : (
        <View style={styles.list}>
          {filteredCoupons.map((coupon) => (
            <SportsbookCouponRowView
              key={coupon.id}
              coupon={coupon}
              expanded={history.expandedCoupons.has(coupon.id)}
              onToggle={history.toggleCoupon}
            />
          ))}
        </View>
      )}

      {showFooter ? (
        <HistoryFooter
          expanded={history.sportsbookHistoryExpanded}
          hasMore={history.hasMoreCoupons}
          loadingMore={history.loadingMoreCoupons}
          onCollapse={history.collapseSportsbookHistory}
          onShowMore={history.showMoreSportsbookHistory}
        />
      ) : null}
    </>
  );
}

const SportsbookCouponRowView = memo(function SportsbookCouponRowView({
  coupon,
  expanded,
  onToggle,
}: {
  coupon: SportsbookCouponRow;
  expanded: boolean;
  onToggle: (couponId: string) => void;
}) {
  const surfaces = useSurfaceStyles();
  const styles = useStyles();
  const { colors } = useTheme();
  const legs = coupon.legs ?? [];
  const ako = coupon.legs !== null && coupon.legs.length > 1;
  const displayedOdds = getDisplayedCouponOdds({
    totalOdds: Number(coupon.total_odds),
    legs: legs.map((leg) => ({ oddsAtTime: Number(leg.odds_at_time), result: leg.result })),
  });
  const displayedWin = getDisplayedCouponWin({
    status: coupon.status,
    isAko: ako,
    stake: Number(coupon.stake),
    displayedOdds,
    couponPayout: Number(coupon.payout),
    legs: legs.map((leg) => ({ legPayout: Number(leg.leg_payout ?? 0) })),
  });
  const status = couponStatusTone(coupon.status, displayedWin);

  const summary = (
    <>
      <View style={styles.rowMain}>
        {ako ? (
          <View style={styles.akoLine}>
            <View style={styles.akoBadge}>
              <Text weight="700" color="primary" style={styles.tinyText}>
                AKO {legs.length}
              </Text>
            </View>
            <Text size="xs" weight="500" color="mutedForeground">
              kurs {displayedOdds.toFixed(2)}
            </Text>
            {expanded ? (
              <ChevronUp size={14} color={colors.mutedForeground} />
            ) : (
              <ChevronDown size={14} color={colors.mutedForeground} />
            )}
          </View>
        ) : (
          <>
            <Text weight="500" numberOfLines={1}>
              {legs[0]?.bet_title || 'Zakład'}
            </Text>
            <Text size="xs" color="mutedForeground">
              {legs[0]?.selected_option} • kurs {displayedOdds.toFixed(2)}
            </Text>
          </>
        )}
      </View>
      <View style={styles.rowAside}>
        <Text weight="700" tabular>
          {Number(coupon.stake).toFixed(2)} zł
        </Text>
        <Text size="xs" weight="500" color={status.color} tabular>
          {status.label}
        </Text>
      </View>
    </>
  );

  return (
    <View style={[surfaces.sub, styles.rowCard]}>
      {ako ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          onPress={() => {
            haptics.selection();
            onToggle(coupon.id);
          }}
          style={({ pressed }) => [styles.rowHeader, pressed && styles.rowPressed]}
        >
          {summary}
        </Pressable>
      ) : (
        <View style={styles.rowHeader}>{summary}</View>
      )}

      {ako && expanded ? (
        <View style={styles.legs}>
          {legs.map((leg) => {
            const tone = legResultTone(leg.result);
            return (
              <View key={leg.id} style={styles.legRow}>
                <View style={styles.rowMain}>
                  <Text size="xs" weight="500" numberOfLines={1}>
                    {leg.bet_title || 'Zakład'}
                  </Text>
                  <Text size="xs" color="mutedForeground">
                    {leg.selected_option} • kurs {Number(leg.odds_at_time).toFixed(2)}
                  </Text>
                </View>
                <View style={[styles.legPill, styles[tone.pill]]}>
                  <Text weight="700" color={tone.color} style={styles.tinyLegText}>
                    {tone.label}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
});

function CasinoHistory({
  history,
  visibleCasinoHistory,
}: {
  history: ProfileHistoryState;
  visibleCasinoHistory: CasinoHistoryEntry[];
}) {
  const styles = useStyles();
  const showFooter =
    !history.loadingCasinoHistory &&
    !history.casinoHistoryError &&
    history.casinoHistory.length > 0 &&
    (history.casinoHistoryExpanded ||
      history.casinoHistory.length > HISTORY_PREVIEW_SIZE ||
      history.hasMoreCasinoHistory);

  return (
    <>
      {history.loadingCasinoHistory ? (
        <HistorySkeleton />
      ) : history.casinoHistoryError ? (
        <Text color="destructive" align="center" style={styles.message}>
          {history.casinoHistoryError}
        </Text>
      ) : history.casinoHistory.length === 0 ? (
        <Text color="mutedForeground" align="center" style={styles.message}>
          Brak betów z kasyna
        </Text>
      ) : (
        <View style={styles.list}>
          {visibleCasinoHistory.map((entry) => (
            <CasinoHistoryRow key={entry.id} entry={entry} />
          ))}
        </View>
      )}

      {showFooter ? (
        <HistoryFooter
          expanded={history.casinoHistoryExpanded}
          hasMore={history.hasMoreCasinoHistory}
          loadingMore={history.loadingMoreCasinoHistory}
          onCollapse={history.collapseCasinoHistory}
          onShowMore={history.showMoreCasinoHistory}
        />
      ) : null}
    </>
  );
}

const CasinoHistoryRow = memo(function CasinoHistoryRow({ entry }: { entry: CasinoHistoryEntry }) {
  const surfaces = useSurfaceStyles();
  const styles = useStyles();
  const status = casinoStatusTone(entry);
  return (
    <View style={[surfaces.sub, styles.rowCard, styles.rowHeader]}>
      <View style={styles.rowMain}>
        <View style={styles.casinoTitleLine}>
          <Text weight="500" numberOfLines={1} style={styles.shrink}>
            {entry.game_type}
          </Text>
          {entry.round_label ? (
            <View style={styles.akoBadge}>
              <Text weight="700" color="primary" style={styles.tinyText}>
                {entry.round_label}
              </Text>
            </View>
          ) : null}
        </View>
        {entry.bet_label ? (
          <Text size="xs" color="mutedForeground" numberOfLines={1}>
            {entry.bet_label}
          </Text>
        ) : null}
      </View>
      <View style={styles.rowAside}>
        <Text weight="700" tabular>
          {entry.stake.toFixed(2)} zł
        </Text>
        <Text size="xs" weight="500" color={status.color} tabular>
          {status.label}
        </Text>
      </View>
    </View>
  );
});

function HistoryFooter({
  expanded,
  hasMore,
  loadingMore,
  onCollapse,
  onShowMore,
}: {
  expanded: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onCollapse: () => void;
  onShowMore: () => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.footer}>
      {expanded ? (
        <Pressable
          accessibilityRole="button"
          onPress={onCollapse}
          style={({ pressed }) => [styles.footerButton, pressed && styles.footerButtonPressed]}
        >
          <Text weight="500">Pokaż mniej</Text>
        </Pressable>
      ) : null}
      {!expanded || hasMore ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: loadingMore, busy: loadingMore }}
          disabled={loadingMore}
          onPress={onShowMore}
          style={({ pressed }) => [
            styles.footerButton,
            pressed && styles.footerButtonPressed,
            loadingMore && styles.footerButtonBusy,
          ]}
        >
          <Text weight="500">{loadingMore ? 'Ładowanie...' : 'Pokaż więcej'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Placeholder rows shaped like coupon rows; holds the boot overlay like the web loader. */
export function HistorySkeleton() {
  useBootHold();
  const surfaces = useSurfaceStyles();
  const styles = useStyles();
  return (
    <View style={styles.list} accessibilityRole="progressbar" accessibilityLabel="Wczytywanie historii...">
      {[0, 1, 2].map((index) => (
        <View key={index} style={[surfaces.sub, styles.rowCard, styles.rowHeader]}>
          <View style={[styles.rowMain, styles.skeletonColumn]}>
            <Skeleton width="62%" height={14} />
            <Skeleton width="42%" height={12} />
          </View>
          <View style={[styles.rowAside, styles.skeletonColumn]}>
            <Skeleton width={64} height={14} />
            <Skeleton width={48} height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

const useStyles = createStyles(({ colors, radius }) => ({
  panel: { padding: 16 },
  header: { marginBottom: 12, gap: 12 },
  segmented: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg, padding: 4 },
  segment: { borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 6 },
  segmentActive: { backgroundColor: colors.primary, boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)' },
  filterScroller: { marginHorizontal: -4, marginBottom: 12, flexGrow: 0 },
  filterRow: { flexGrow: 1, gap: 8, paddingHorizontal: 4, paddingBottom: 4 },
  chip: { justifyContent: 'center', borderRadius: 9999, paddingHorizontal: 14, paddingVertical: 6 },
  chipActive: {
    backgroundColor: colors.foreground,
    boxShadow: '0px 4px 6px -1px rgba(0, 0, 0, 0.1), 0px 2px 4px -2px rgba(0, 0, 0, 0.1)',
  },
  chipInactive: {
    borderWidth: 1,
    borderColor: alpha(colors.border, 0.7),
    backgroundColor: alpha(colors.muted, 0.6),
  },
  message: { paddingVertical: 16 },
  list: { gap: 8 },
  rowCard: { overflow: 'hidden', borderRadius: radius.lg, borderCurve: 'continuous' },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12 },
  rowPressed: { opacity: 0.85 },
  rowMain: { flex: 1, minWidth: 0 },
  rowAside: { marginLeft: 12, flexShrink: 0, alignItems: 'flex-end' },
  akoLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  akoBadge: {
    flexShrink: 0,
    borderRadius: 4,
    backgroundColor: alpha(colors.primary, 0.1),
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  // text-[10px] inherits the row's text-sm line height (20px) on the web.
  tinyText: { fontSize: 10, lineHeight: 20 },
  casinoTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  shrink: { flexShrink: 1 },
  legs: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 8,
    gap: 6,
  },
  legRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  legPill: { marginLeft: 8, flexShrink: 0, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  pillSuccess: { backgroundColor: alpha(colors.success, 0.1) },
  pillDestructive: { backgroundColor: alpha(colors.destructive, 0.1) },
  pillPrimary: { backgroundColor: alpha(colors.primary, 0.1) },
  pillMuted: { backgroundColor: alpha(colors.mutedForeground, 0.1) },
  // Legs are text-xs, so their text-[10px] pills inherit a 16px line height.
  tinyLegText: { fontSize: 10, lineHeight: 16 },
  footer: { marginTop: 12, flexDirection: 'row', gap: 8 },
  footerButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 38,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  footerButtonPressed: { backgroundColor: colors.muted },
  footerButtonBusy: { opacity: 0.7 },
  // Matches the 20px + 16px text lines of a real row.
  skeletonColumn: { gap: 8, paddingVertical: 1 },
}));
