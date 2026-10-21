import { ArrowDownUp, ArrowUpDown, Hash, Palette, type LucideIcon } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { createStyles } from '@/theme';
import { Text } from '@/ui';
import type { RouletteBetType } from '@/types/database';

import { fadeSlideIn } from '../../shared/motion';
import { rgba, tw } from '../../shared/casinoTheme';
import { getRouletteBetTypeLabel, getRouletteBetValueOptions, getRouletteColor } from '../lib/roulette';
import { getWinningOptionValue } from '../lib/rouletteGame';
import { rouletteSession, useRouletteSession } from '../state/sessionStore';
import { useRouletteTable } from '../state/tableStore';

const BET_TYPES: { type: RouletteBetType; Icon: LucideIcon; desc: string }[] = [
  { type: 'straight', Icon: Hash, desc: 'x36' },
  { type: 'color', Icon: Palette, desc: 'x2' },
  { type: 'parity', Icon: ArrowUpDown, desc: 'x2' },
  { type: 'range', Icon: ArrowDownUp, desc: 'x2' },
];

/** `transition={{ type: 'spring', stiffness: 760, damping: 44 }}` with `initial={{ opacity: 0, x: 16 }}`. */
const VALUE_GRID_ENTERING = fadeSlideIn({ x: 16, spring: { stiffness: 760, damping: 44 } });

type ValueTone = 'green' | 'red' | 'black' | 'muted';

function getValueTone(betType: RouletteBetType, value: string): ValueTone {
  if (betType === 'straight') return getRouletteColor(Number(value));
  if (betType === 'color') return value === 'red' ? 'red' : 'black';
  return 'muted';
}

/** Splits the options into grid rows (`grid-cols-5` / `grid-cols-2`). */
function toRows<T>(items: T[], columns: number): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += columns) rows.push(items.slice(index, index + columns));
  return rows;
}

/** Web `BettingPanel` (mobile layout: type grid, then the value grid). */
export const BettingPanel = memo(function BettingPanel() {
  const styles = useStyles();
  const betType = useRouletteSession((state) => state.betType);
  const betValue = useRouletteSession((state) => state.betValue);
  const animateValues = useRouletteSession((state) => state.betTypeChanged);
  const winningNumber = useRouletteTable((state) =>
    state.currentRound?.phase === 'settled' ? state.currentRound.winning_number : null,
  );
  const winningOptionValue = betType && winningNumber !== null ? getWinningOptionValue(betType, winningNumber) : null;
  // `grid-cols-5 sm:grid-cols-6` for numbers, `grid-cols-2` otherwise.
  const { width } = useWindowDimensions();
  const columns = betType === 'straight' ? (width >= 640 ? 6 : 5) : 2;

  return (
    <View style={styles.panel}>
      <View style={styles.card}>
        <Text weight="600" style={styles.cardTitle}>
          Typ zakładu
        </Text>
        <View style={styles.typeGrid}>
          {BET_TYPES.map(({ type, Icon, desc }) => {
            const active = betType === type;
            const label = getRouletteBetTypeLabel(type);
            return (
              <Pressable
                key={type}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${label}, ${desc}`}
                onPress={() => rouletteSession.setBetType(type)}
                style={[styles.typeButton, active ? styles.typeButtonActive : styles.typeButtonIdle]}
              >
                <View style={[styles.typeIcon, active ? styles.typeIconActive : styles.typeIconIdle]}>
                  <Icon size={16} color={active ? tw.amber300 : rgba(tw.white, 0.5)} />
                </View>
                <View style={styles.typeText}>
                  <Text weight="600" style={active ? styles.typeLabelActive : styles.typeLabel}>
                    {label}
                  </Text>
                  <Text size="xs" style={styles.typeDesc}>
                    {desc}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      {betType ? (
        <View style={[styles.card, styles.valueCard]}>
          <Animated.View key={betType} entering={animateValues ? VALUE_GRID_ENTERING : undefined}>
            <View style={styles.valueHeader}>
              <Text weight="600" style={styles.cardTitleInline}>
                Wartość
              </Text>
              <Text size="xs" weight="700" style={styles.payout}>
                wypłata {betType === 'straight' ? 'x36' : 'x2'}
              </Text>
            </View>
            <View style={styles.valueGrid}>
              {toRows(getRouletteBetValueOptions(betType), columns).map((row) => (
                <View key={row[0].value} style={styles.valueRow}>
                  {row.map((option) => (
                    <ValueButton
                      key={option.value}
                      label={option.label}
                      value={option.value}
                      tone={getValueTone(betType, option.value)}
                      selected={betValue === option.value}
                      winning={winningOptionValue === option.value}
                    />
                  ))}
                  {Array.from({ length: columns - row.length }, (_, index) => (
                    <View key={`empty-${index}`} style={styles.valueCell} />
                  ))}
                </View>
              ))}
            </View>
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
});

const ValueButton = memo(function ValueButton({
  label,
  value,
  tone,
  selected,
  winning,
}: {
  label: string;
  value: string;
  tone: ValueTone;
  selected: boolean;
  winning: boolean;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={() => rouletteSession.setBetValue(value)}
      style={[
        styles.valueCell,
        styles.value,
        styles[`value_${tone}`],
        selected && styles.valueSelected,
        winning && styles.valueWinning,
        winning && !selected && styles.valueWinningNoOffset,
      ]}
    >
      <Text
        size="base"
        weight={tone === 'muted' ? '600' : '700'}
        align="center"
        style={styles[`valueText_${tone}`]}
      >
        {label}
      </Text>
    </Pressable>
  );
});

const GRID_GAP = 8;

const useStyles = createStyles(() => ({
  panel: { gap: 12 },
  // `rounded-2xl bg-black/55 p-3`
  card: { borderRadius: 16, backgroundColor: rgba(tw.black, 0.55), padding: 12 },
  valueCard: { overflow: 'hidden' },
  cardTitle: { marginBottom: 12, color: rgba(tw.white, 0.8) },
  cardTitleInline: { color: rgba(tw.white, 0.8) },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  // `flex items-center gap-2 rounded-xl border p-2.5`
  typeButton: {
    flexBasis: '45%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
  },
  typeButtonActive: {
    borderColor: rgba(tw.amber500, 0.5),
    backgroundColor: rgba(tw.amber500, 0.1),
    boxShadow: '0px 0px 20px rgba(245, 158, 11, 0.12)',
  },
  typeButtonIdle: { borderColor: rgba(tw.white, 0.1), backgroundColor: rgba(tw.white, 0.02) },
  typeIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  typeIconActive: { backgroundColor: rgba(tw.amber500, 0.2) },
  typeIconIdle: { backgroundColor: rgba(tw.white, 0.05) },
  typeText: { flexShrink: 1, minWidth: 0 },
  typeLabel: { color: rgba(tw.white, 0.8) },
  typeLabelActive: { color: tw.amber200 },
  typeDesc: { color: rgba(tw.white, 0.7) },
  valueHeader: { marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  payout: { color: tw.amber200 },
  valueGrid: { gap: GRID_GAP },
  valueRow: { flexDirection: 'row', gap: GRID_GAP },
  valueCell: { flex: 1, minWidth: 0 },
  // `min-h-11 rounded-lg border px-1 py-2 text-base font-semibold`
  value: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  value_green: { borderColor: rgba(tw.emerald300, 0.4), backgroundColor: rgba(tw.emerald500, 0.2) },
  value_red: { borderColor: rgba(tw.red300, 0.3), backgroundColor: rgba(tw.red600, 0.25) },
  value_black: { borderColor: rgba(tw.white, 0.15), backgroundColor: rgba(tw.black, 0.5) },
  value_muted: { borderColor: rgba(tw.white, 0.1), backgroundColor: rgba(tw.white, 0.03) },
  valueText_green: { color: tw.emerald50 },
  valueText_red: { color: tw.red50 },
  valueText_black: { color: tw.white },
  valueText_muted: { color: rgba(tw.white, 0.7) },
  // `ring-2 ring-amber-300 ring-offset-1 ring-offset-black shadow-[0_0_12px_rgba(245,158,11,0.25)]`
  valueSelected: {
    outlineWidth: 2,
    outlineColor: tw.amber300,
    outlineOffset: 1,
    outlineStyle: 'solid',
    boxShadow: '0px 0px 12px rgba(245, 158, 11, 0.25)',
  },
  // `ring-2 ring-emerald-300/90 shadow-[0_0_16px_rgba(16,185,129,0.45)]`
  valueWinning: {
    outlineWidth: 2,
    outlineColor: rgba(tw.emerald300, 0.9),
    outlineStyle: 'solid',
    boxShadow: '0px 0px 16px rgba(16, 185, 129, 0.45)',
  },
  valueWinningNoOffset: { outlineOffset: 0 },
}));
