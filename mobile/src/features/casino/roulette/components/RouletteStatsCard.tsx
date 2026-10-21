import { BarChart3, Flame, Snowflake } from 'lucide-react-native';
import { memo } from 'react';
import { View } from 'react-native';

import { createStyles } from '@/theme';
import { Text } from '@/ui';

import { arbitraryText, MONO_FONT, rgba, tw } from '../../shared/casinoTheme';
import { fadeSlideIn } from '../../shared/motion';
import { getRouletteColor } from '../lib/roulette';
import { computeRouletteStats } from '../lib/rouletteGame';
import { useRouletteTable } from '../state/tableStore';
import { RailCard } from './RailCard';

const CARD_ENTERING = fadeSlideIn({ y: 20, delayMs: 340 });

/** Web `RouletteStatsCard`: color split bar plus hot and cold numbers (from five spins). */
export const RouletteStatsCard = memo(function RouletteStatsCard() {
  const styles = useStyles();
  const spins = useRouletteTable((state) => state.recentSpins);
  const stats = computeRouletteStats(spins);
  if (!stats) return null;

  const redPct = (stats.red / stats.total) * 100;
  const blackPct = (stats.black / stats.total) * 100;
  const greenPct = (stats.green / stats.total) * 100;

  return (
    <RailCard Icon={BarChart3} title={`Statystyki · ${stats.total} spinów`} entering={CARD_ENTERING}>
      <View style={styles.body}>
        <View>
          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel={`Czerwone ${redPct.toFixed(0)}%, czarne ${blackPct.toFixed(0)}%, zielone ${greenPct.toFixed(0)}%`}
            style={styles.bar}
          >
            <View style={[styles.barRed, { width: `${redPct}%` }]} />
            <View style={[styles.barBlack, { width: `${blackPct}%` }]} />
            <View style={[styles.barGreen, { width: `${greenPct}%` }]} />
          </View>
          <View style={styles.legend} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <Text weight="600" style={[styles.legendText, { color: tw.rose300 }]}>
              {redPct.toFixed(0)}% czerwone
            </Text>
            <Text weight="600" style={[styles.legendText, { color: tw.stone300 }]}>
              {blackPct.toFixed(0)}% czarne
            </Text>
            <Text weight="600" style={[styles.legendText, { color: tw.emerald300 }]}>
              {greenPct.toFixed(0)}% zielone
            </Text>
          </View>
        </View>

        {stats.hot.length > 0 ? (
          <View style={styles.numbersRow}>
            <Flame size={14} color={tw.orange400} />
            <Text weight="600" style={styles.numbersLabel}>
              Najczęstsze
            </Text>
            <View style={styles.chips}>
              {stats.hot.map(({ number, count }) => (
                <NumberChip key={number} number={number} count={count} />
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.numbersRow}>
          <Snowflake size={14} color={tw.sky400} />
          <Text weight="600" style={styles.numbersLabel}>
            Zimne
          </Text>
          <View style={styles.chips}>
            {stats.cold.map(({ number, count }) => (
              <NumberChip key={number} number={number} count={count} />
            ))}
          </View>
        </View>
      </View>
    </RailCard>
  );
});

function NumberChip({ number, count }: { number: number; count: number }) {
  const styles = useStyles();
  const color = getRouletteColor(number);
  return (
    <View style={[styles.chip, styles[`chip_${color}`]]}>
      <Text weight="700" style={[styles.chipNumber, styles[`chipText_${color}`]]}>
        {number}
      </Text>
      <Text weight="600" style={[styles.chipCount, styles[`chipText_${color}`]]}>
        ×{count}
      </Text>
    </View>
  );
}

const useStyles = createStyles(() => ({
  body: { gap: 12 },
  // `flex h-2.5 w-full overflow-hidden rounded-full border border-white/10`
  bar: {
    height: 10,
    width: '100%',
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: rgba(tw.white, 0.1),
  },
  barRed: { backgroundColor: rgba(tw.rose500, 0.8) },
  barBlack: { backgroundColor: tw.stone700 },
  barGreen: { backgroundColor: rgba(tw.emerald500, 0.8) },
  legend: { marginTop: 6, flexDirection: 'row', justifyContent: 'space-between' },
  legendText: arbitraryText(10),
  numbersRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  numbersLabel: { ...arbitraryText(10), textTransform: 'uppercase', letterSpacing: 0.5, color: rgba(tw.white, 0.35) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flexShrink: 1 },
  // `inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[11px] font-bold`
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 9999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  chip_red: { borderColor: rgba(tw.rose400, 0.5), backgroundColor: rgba(tw.rose500, 0.15) },
  chip_black: { borderColor: rgba(tw.stone400, 0.4), backgroundColor: tw.stone800 },
  chip_green: { borderColor: rgba(tw.emerald400, 0.5), backgroundColor: rgba(tw.emerald500, 0.15) },
  chipText_red: { color: tw.rose200 },
  chipText_black: { color: tw.stone200 },
  chipText_green: { color: tw.emerald200 },
  chipNumber: { ...arbitraryText(11), fontFamily: MONO_FONT },
  chipCount: { ...arbitraryText(9), opacity: 0.6 },
}));
