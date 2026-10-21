import { View } from 'react-native';

import { formatRouletteBetValue, getRouletteBetTypeLabel } from '@/features/casino/roulette/lib/roulette';
import { createStyles } from '@/theme';
import type { SocialFeedItem } from '@/types/database';
import { Text } from '@/ui';
import { social } from './socialColors';

const NUMBER_STYLES = {
  red: ['numberRed', 'numberRedText'],
  black: ['numberBlack', 'numberBlackText'],
  green: ['numberGreen', 'numberGreenText'],
} as const;

/**
 * Roulette share body of a feed card (web `CasinoContent`). Casino items are
 * always won in SQL, so the payout line is always green.
 */
export function CasinoContent({ item }: { item: SocialFeedItem }) {
  const styles = useStyles();
  const betType = item.casino_bet_type ?? 'straight';
  const stake = (item.casino_stake ?? 0).toFixed(2);
  const hasWinningNumber = typeof item.casino_winning_number === 'number';
  const [circle, circleText] = NUMBER_STYLES[item.casino_winning_color ?? 'green'];

  return (
    <View style={styles.wrapper}>
      <View style={styles.box}>
        <View style={styles.left}>
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Ruletka</Text>
            </View>
            {item.casino_round_number ? <Text style={styles.round}>Runda #{item.casino_round_number}</Text> : null}
          </View>
          <Text numberOfLines={1} style={styles.bet}>
            {getRouletteBetTypeLabel(betType)}: {formatRouletteBetValue(betType, item.casino_bet_value ?? '')}
          </Text>
          <Text style={styles.detail}>
            {hasWinningNumber
              ? `Numer: ${item.casino_winning_number} • Stawka ${stake} zł`
              : `Wynik niedostępny • Stawka ${stake} zł`}
          </Text>
        </View>
        {hasWinningNumber ? (
          <View style={[styles.number, styles[circle]]}>
            <Text tabular style={[styles.numberText, styles[circleText]]}>
              {item.casino_winning_number}
            </Text>
          </View>
        ) : (
          <View style={styles.noNumber}>
            <Text style={styles.noNumberText}>Brak</Text>
          </View>
        )}
        <View style={styles.right}>
          <Text tabular style={styles.stake}>
            {stake} zł
          </Text>
          <Text tabular style={styles.payout}>
            +{(item.casino_payout ?? 0).toFixed(2)} zł
          </Text>
        </View>
      </View>
    </View>
  );
}

const useStyles = createStyles(({ colors }) => ({
  // `px-3 py-2`.
  wrapper: { paddingHorizontal: 12, paddingVertical: 8 },
  // `.social-casino-content` on phones: margin 0 0.75rem 0.5rem, border, radius 0.75rem, muted,
  // p 0.75rem; `flex items-center justify-between gap-3`.
  box: {
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: 1,
    borderColor: social.border,
    borderRadius: 12,
    backgroundColor: social.muted,
  },
  left: { flex: 1, minWidth: 0 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: social.primarySoft },
  badgeText: { fontSize: 10, lineHeight: 20, fontWeight: '700', color: social.primary },
  round: { fontSize: 12, lineHeight: 16, fontWeight: '500', color: social.mutedForeground },
  bet: { marginTop: 4, fontSize: 14, lineHeight: 20, fontWeight: '500', color: social.foreground },
  detail: { fontSize: 12, lineHeight: 16, color: social.mutedForeground },
  // `h-10 w-10 rounded-full border-2 text-base font-black`.
  number: {
    width: 40,
    height: 40,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    borderWidth: 2,
  },
  numberText: { fontSize: 16, lineHeight: 24, fontWeight: '900' },
  // red-400 / red-500 at 30% and 10%.
  numberRed: { borderColor: 'rgba(239, 68, 68, 0.3)', backgroundColor: 'rgba(239, 68, 68, 0.1)' },
  numberRedText: { color: '#f87171' },
  // stone-300 / stone-500.
  numberBlack: { borderColor: 'rgba(120, 113, 108, 0.3)', backgroundColor: 'rgba(120, 113, 108, 0.1)' },
  numberBlackText: { color: '#d6d3d1' },
  // emerald-400 / emerald-500.
  numberGreen: { borderColor: 'rgba(16, 185, 129, 0.3)', backgroundColor: 'rgba(16, 185, 129, 0.1)' },
  numberGreenText: { color: '#34d399' },
  // `h-10 min-w-10 border-border/70 bg-background px-2 text-[10px] font-semibold`.
  noNumber: {
    height: 40,
    minWidth: 40,
    paddingHorizontal: 8,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: social.borderSoft,
    backgroundColor: social.background,
  },
  noNumberText: { fontSize: 10, lineHeight: 20, fontWeight: '600', color: social.mutedForeground },
  right: { flexShrink: 0, alignItems: 'flex-end' },
  stake: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: social.foreground },
  payout: { fontSize: 12, lineHeight: 16, fontWeight: '500', color: colors.success },
}));
