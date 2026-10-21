import { ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';

import { createStyles, useTheme } from '@/theme';
import { Surface, Text } from '@/ui';
import { formatReplayDate, formatReplayMoney, STATUS_LABELS, type ReplayModel } from './model';
import { replayTone, statusColor, useReplayTone } from './replay-colors';
import { ReplayChart } from './ReplayChart';
import { ReplayCouponDetails } from './ReplayCouponDetails';
import { ReplayHistoryList } from './ReplayHistoryList';

export function ReplaySummary({ model }: { model: ReplayModel }) {
  const styles = useStyles();
  const coupon = model.highlight;
  const hasResults = model.settledCount > 0;
  const { width } = useWindowDimensions();
  // `.replay-net { font-size: clamp(1.75rem, 5vw, 3.5rem); line-height: 1.2 }`
  const netSize = Math.max(28, Math.min(width * 0.05, 56));
  const netTone = !hasResults ? undefined : model.netCents > 0 ? styles.won : model.netCents < 0 ? styles.lost : undefined;
  const highlightTitle = coupon?.status === 'won' ? 'Najwyższa wypłata' : 'Ostatni kupon';

  return (
    <View style={styles.stack}>
      <Surface variant="app" style={styles.balance} accessibilityLabel="Bilans kuponów">
        <Text weight="500" style={styles.muted} accessibilityRole="header">Bilans</Text>
        <Text
          weight="700"
          tabular
          style={[styles.net, { fontSize: netSize, lineHeight: netSize * 1.2, letterSpacing: netSize * -0.025 }, netTone]}
        >
          {hasResults ? formatReplayMoney(model.netCents, true) : '—'}
        </Text>
        {!hasResults ? <Text style={[styles.muted, styles.noResults]}>Brak rozliczonych kuponów.</Text> : null}
        <ReplayChart model={model} />
        <View style={styles.stats}>
          <View style={styles.statsRow}>
            <Stat label="Stawki rozliczonych" value={hasResults ? formatReplayMoney(model.stakeCents) : '—'} />
            <Stat label="Wypłaty rozliczonych" value={hasResults ? formatReplayMoney(model.payoutCents) : '—'} />
          </View>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.muted}>Wygrane</Text>
              <Text size="lg" weight="600" tabular style={styles.statValue}>
                {model.counts.won}
                <Text weight="400" style={styles.muted}>{` / ${model.counts.won + model.counts.lost}`}</Text>
              </Text>
            </View>
            <Stat label="Skuteczność" value={model.winRate === null ? '—' : `${model.winRate}%`} />
          </View>
        </View>
        <Method coverageLabel={model.coverageLabel} />
      </Surface>
      {coupon ? (
        <Surface variant="app" style={styles.highlight} accessibilityLabel={highlightTitle}>
          <Text size="base" weight="600" accessibilityRole="header">{highlightTitle}</Text>
          <View style={styles.highlightMeta}>
            <Text size="xs" style={styles.muted}>{formatReplayDate(coupon.created_at)}</Text>
            <Text size="xs" weight="500" style={styles[coupon.status]}>{STATUS_LABELS[coupon.status]}</Text>
          </View>
          <Text size="base" weight="600" style={styles.highlightTitle}>{coupon.legs?.[0]?.bet_title || 'Kupon'}</Text>
          <Text
            size="2xl"
            weight="700"
            tabular
            style={styles.highlightAmount}
            accessibilityLabel={`${coupon.status === 'pending' ? '—' : formatReplayMoney(Math.round(coupon.payout * 100))} wypłaty`}
          >
            {coupon.status === 'pending' ? '—' : formatReplayMoney(Math.round(coupon.payout * 100))}
          </Text>
          <View style={styles.highlightDetails}>
            <ReplayCouponDetails coupon={coupon} />
          </View>
        </Surface>
      ) : null}
      <ReplayHistoryList model={model} />
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.stat}>
      <Text style={styles.muted}>{label}</Text>
      <Text size="lg" weight="600" tabular style={styles.statValue}>{value}</Text>
    </View>
  );
}

/** Native `<details class="replay-method">`: "Jak liczymy?" disclosure. */
function Method({ coverageLabel }: { coverageLabel: string }) {
  const styles = useStyles();
  const tone = useReplayTone();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.method}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((value) => !value)}
        style={styles.methodSummary}
      >
        {({ pressed }) => (
          <>
            <Text style={pressed ? undefined : styles.muted}>Jak liczymy?</Text>
            <ChevronDown size={14} color={pressed ? colors.foreground : tone.muted} />
          </>
        )}
      </Pressable>
      {open ? (
        <View style={styles.methodBody}>
          <Text style={styles.methodText}>
            Bilans to wypłaty minus stawki rozliczonych kuponów, nie saldo konta. Kupony w grze są pomijane. Skuteczność to wygrane / (wygrane + przegrane); zwroty się nie liczą.
          </Text>
          <Text style={styles.methodText}>
            Wykres pokazuje obecne wyniki w kolejności postawienia, nie historię salda ani dat rozliczeń. Zakres 7 lub 30 dni oznacza ostatnie 7 × 24 lub 30 × 24 godziny od pobrania danych. Daty: Europe/Warsaw.
          </Text>
          <Text style={styles.methodText}>
            Tylko zakłady za wirtualne zł, bez kasyna, wpłat i transferów. Maksymalnie 200 najnowszych kuponów. {coverageLabel}.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = createStyles((palette) => {
  const { colors } = palette;
  const tone = replayTone(palette);
  return {
    stack: { gap: 20 },
    balance: { borderRadius: 12, padding: 20 },
    muted: { color: tone.muted },
    won: { color: statusColor(tone, 'won') },
    lost: { color: statusColor(tone, 'lost') },
    pending: { color: statusColor(tone, 'pending') },
    refund: { color: statusColor(tone, 'refund') },
    net: { marginTop: 4 },
    noResults: { marginTop: 8 },
    stats: { marginTop: 20, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 20, gap: 20 },
    statsRow: { flexDirection: 'row', gap: 20 },
    stat: { flex: 1, minWidth: 0 },
    statValue: { marginTop: 4 },
    method: { marginTop: 16 },
    methodSummary: { alignSelf: 'flex-start', minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 4 },
    methodBody: { gap: 8, paddingTop: 8, paddingBottom: 4 },
    methodText: { color: tone.muted, lineHeight: 22.75 },
    highlight: { borderRadius: 12, padding: 20, minWidth: 0 },
    highlightMeta: { marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    highlightTitle: { marginTop: 12 },
    highlightAmount: { marginTop: 8 },
    highlightDetails: { marginTop: 16, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16 },
  };
});
