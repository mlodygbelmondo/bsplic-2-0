import { ChevronDown } from 'lucide-react-native';
import { memo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { haptics } from '@/lib/haptics';
import { createStyles } from '@/theme';
import type { CouponHistoryEntry } from '@/types/database';
import { Button, Surface, Text } from '@/ui';
import { formatReplayDate, formatReplayMoney, STATUS_LABELS, type ReplayModel } from './model';
import { replayTone, statusColor, useReplayTone } from './replay-colors';
import { ReplayCouponDetails } from './ReplayCouponDetails';

const PAGE_SIZE = 20;
const FILTERS = { all: 'Wszystkie', won: 'Wygrane', lost: 'Przegrane', pending: 'W grze', refund: 'Zwroty' };
type Filter = keyof typeof FILTERS;
const FILTER_ENTRIES = Object.entries(FILTERS) as [Filter, string][];

/**
 * Newest-first coupons of the period with local outcome filters and 20-row
 * pages (up to all 200 loaded coupons). The rows live inside one continuous
 * card, like the web; pagination keeps the rendered count small.
 */
export function ReplayHistoryList({ model }: { model: ReplayModel }) {
  const styles = useStyles();
  const [filter, setFilter] = useState<Filter>('all');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const coupons = model.coupons.slice().reverse().filter((coupon) => filter === 'all' || coupon.status === filter);
  const visible = coupons.slice(0, limit);

  return (
    <Surface variant="app" style={styles.card} accessibilityLabel="Kupony">
      <View style={styles.header}>
        <View accessible accessibilityRole="header" accessibilityLabel={`Kupony ${model.coupons.length}`} style={styles.title}>
          <Text size="base" weight="600">Kupony</Text>
          <Text size="base" style={[styles.muted, styles.titleCount]}>{model.coupons.length}</Text>
        </View>
        <Text style={styles.muted}>Wypłata</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filters}
        contentContainerStyle={styles.filtersContent}
        accessibilityLabel="Filtr kuponów"
      >
        {FILTER_ENTRIES.map(([value, label]) => {
          const selected = filter === value;
          return (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => {
                if (!selected) haptics.selection();
                setFilter(value);
                setLimit(PAGE_SIZE);
              }}
              style={({ pressed }) => [styles.filter, selected ? styles.filterSelected : pressed && styles.filterPressed]}
            >
              {({ pressed }) => {
                const tone = selected ? styles.filterSelectedText : pressed ? undefined : styles.muted;
                return (
                  <View style={styles.filterLabel}>
                    <Text weight="500" style={tone}>{label}</Text>
                    {value !== 'all' ? <Text weight="500" tabular style={[tone, styles.filterCount]}>{model.counts[value]}</Text> : null}
                  </View>
                );
              }}
            </Pressable>
          );
        })}
      </ScrollView>
      {visible.length > 0 ? (
        <View style={styles.rows}>
          {visible.map((coupon, index) => (
            <CouponRow key={coupon.id} coupon={coupon} first={index === 0} />
          ))}
        </View>
      ) : (
        <Text style={[styles.muted, styles.empty]} accessibilityLiveRegion="polite">Brak kuponów z tym wynikiem.</Text>
      )}
      {coupons.length > PAGE_SIZE ? (
        <View style={styles.pager}>
          <Text style={[styles.muted, styles.pagerText]}>{visible.length} z {coupons.length}</Text>
          {limit < coupons.length ? (
            <Button variant="ghost" label="Pokaż więcej" onPress={() => setLimit((current) => current + PAGE_SIZE)} />
          ) : (
            <Button variant="ghost" label="Pokaż mniej" onPress={() => setLimit(PAGE_SIZE)} />
          )}
        </View>
      ) : null}
    </Surface>
  );
}

const CouponRow = memo(function CouponRow({ coupon, first }: { coupon: CouponHistoryEntry; first: boolean }) {
  const styles = useStyles();
  const tone = useReplayTone();
  const [open, setOpen] = useState(false);
  const title = coupon.legs?.[0]?.bet_title || 'Kupon';
  const meta = `${formatReplayDate(coupon.created_at)}${coupon.legs && coupon.legs.length > 1 ? ` · AKO ${coupon.legs.length}` : ''}`;
  const amount = coupon.status === 'pending' ? '—' : formatReplayMoney(Math.round(coupon.payout * 100));
  return (
    <View style={!first && styles.rowDivider}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${title}, ${meta}, ${STATUS_LABELS[coupon.status]}, ${amount} wypłaty`}
        onPress={() => setOpen((value) => !value)}
        style={({ pressed }) => [styles.summary, pressed && styles.summaryPressed]}
      >
        <View style={styles.summaryMain}>
          <Text weight="600" numberOfLines={1}>{title}</Text>
          <Text size="xs" style={[styles.muted, styles.summaryMeta]}>{meta}</Text>
        </View>
        <View style={styles.summaryRight}>
          <Text size="xs" weight="500" style={styles[coupon.status]}>
            {STATUS_LABELS[coupon.status]}
          </Text>
          <Text weight="600" tabular>{amount}</Text>
        </View>
        <ChevronDown size={16} color={tone.muted} style={open ? styles.chevronOpen : undefined} />
      </Pressable>
      {open ? (
        <View style={styles.body}>
          <ReplayCouponDetails coupon={coupon} />
        </View>
      ) : null}
    </View>
  );
});

const useStyles = createStyles((palette) => {
  const { colors } = palette;
  const tone = replayTone(palette);
  return {
    card: { borderRadius: 12, minWidth: 0 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 20, paddingTop: 20 },
    muted: { color: tone.muted },
    title: { flexDirection: 'row', alignItems: 'baseline' },
    titleCount: { marginLeft: 8 },
    won: { color: statusColor(tone, 'won') },
    lost: { color: statusColor(tone, 'lost') },
    pending: { color: statusColor(tone, 'pending') },
    refund: { color: statusColor(tone, 'refund') },
    filters: { marginHorizontal: 20, marginVertical: 16, flexGrow: 0 },
    filtersContent: { gap: 4, paddingBottom: 4 },
    filter: { minHeight: 44, borderRadius: 9999, paddingHorizontal: 12, justifyContent: 'center' },
    filterSelected: { backgroundColor: colors.foreground },
    filterPressed: { backgroundColor: colors.muted },
    filterSelectedText: { color: colors.background },
    filterLabel: { flexDirection: 'row', alignItems: 'center' },
    filterCount: { marginLeft: 6 },
    rows: { borderTopWidth: 1, borderTopColor: colors.border },
    rowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
    empty: { paddingHorizontal: 20, paddingBottom: 24 },
    pager: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      padding: 12,
    },
    pagerText: { paddingHorizontal: 8 },
    summary: { minHeight: 80, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16 },
    summaryPressed: { backgroundColor: `${colors.muted}66` },
    summaryMain: { flex: 1, minWidth: 0 },
    summaryMeta: { marginTop: 4 },
    summaryRight: { alignItems: 'flex-end', gap: 4 },
    chevronOpen: { transform: [{ rotate: '180deg' }] },
    body: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: `${colors.muted}33`,
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
  };
});
