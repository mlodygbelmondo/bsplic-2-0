import { Check, RotateCcw, X } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useShallow } from 'zustand/react/shallow';

import { OFFLINE_WRITE_MESSAGE, useIsOffline } from '@/lib/connectivity';
import { toast } from '@/lib/toast';
import { createStyles } from '@/theme';
import { Text } from '@/ui';
import type { RouletteBetRecord, RouletteColor } from '@/types/database';

import { arbitraryText, MONO_FONT, rgba, tw } from '../../shared/casinoTheme';
import { fadeSlideIn } from '../../shared/motion';
import {
  formatRouletteBetValue,
  getRouletteBetTypeLabel,
  getRouletteColorLabel,
  getRoulettePayoutMultiplier,
} from '../lib/roulette';
import { getBetChipColor, getRepeatBetsLabel } from '../lib/rouletteGame';
import { repeatRouletteBets } from '../state/actions';
import { useRouletteSession } from '../state/sessionStore';
import { useRouletteTable } from '../state/tableStore';

const STRIP_ENTERING = fadeSlideIn({ y: 8 });

/** Web `MyBetsStrip`: the player's bets in the open round, or the last result with "Powtórz". */
export const MyBetsStrip = memo(function MyBetsStrip() {
  const styles = useStyles();
  const offline = useIsOffline();
  const liveBets = useRouletteTable(useShallow((state) => state.activeBets.filter((bet) => bet.is_win === null)));
  const lastSettled = useRouletteSession((state) => state.lastSettled);
  const isRepeating = useRouletteSession((state) => state.isRepeating);

  const settledBets = lastSettled?.bets ?? [];
  const mode = liveBets.length > 0 ? 'live' : settledBets.length > 0 ? 'result' : null;
  if (!mode) return null;

  const maxWin = liveBets.reduce((sum, bet) => sum + bet.stake * getRoulettePayoutMultiplier(bet.bet_type), 0);
  const totalPayout = settledBets.reduce((sum, bet) => sum + bet.payout, 0);
  const resultNumber = lastSettled?.winningNumber ?? null;
  const resultColor = lastSettled?.winningColor ?? null;

  const onRepeat = () => {
    if (offline) {
      toast.error(OFFLINE_WRITE_MESSAGE);
      return;
    }
    void repeatRouletteBets();
  };

  return (
    <Animated.View entering={STRIP_ENTERING} style={styles.strip}>
      <View style={styles.header}>
        {mode === 'live' ? (
          <>
            <Text weight="600" style={styles.liveLabel}>
              Grasz w tej rundzie
            </Text>
            <Text size="xs" weight="700" style={[styles.mono, styles.emerald]}>
              max → {maxWin.toFixed(2)} zł
            </Text>
          </>
        ) : (
          <>
            <Text size="xs" weight="700" style={styles.resultLabel}>
              Wypadło <Text style={styles.mono}>{resultNumber ?? '?'}</Text>{' '}
              {resultColor ? getRouletteColorLabel(resultColor) : ''}
            </Text>
            {totalPayout > 0 ? (
              <Text size="xs" weight="700" style={[styles.mono, styles.emerald]}>
                +{totalPayout.toFixed(2)} zł
              </Text>
            ) : (
              <Text weight="600" style={styles.noHit}>
                bez trafienia
              </Text>
            )}
          </>
        )}
      </View>

      <View style={styles.chips}>
        {(mode === 'live' ? liveBets : settledBets).map((bet) => (
          <BetChip key={bet.id} bet={bet} settled={mode === 'result'} />
        ))}

        {mode === 'result' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={getRepeatBetsLabel(settledBets.length, isRepeating)}
            accessibilityHint={offline ? OFFLINE_WRITE_MESSAGE : undefined}
            accessibilityState={{ disabled: isRepeating || offline, busy: isRepeating }}
            disabled={isRepeating}
            onPress={onRepeat}
            hitSlop={{ top: 10, bottom: 10 }}
            style={[styles.repeat, (isRepeating || offline) && styles.disabled]}
          >
            <RotateCcw size={12} color={tw.amber200} />
            <Text weight="700" style={styles.repeatText}>
              {isRepeating ? 'Stawiam…' : 'Powtórz'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
});

type ChipTone = RouletteColor | 'neutral';

function BetChip({ bet, settled }: { bet: RouletteBetRecord; settled: boolean }) {
  const styles = useStyles();
  const chipColor = getBetChipColor(bet.bet_type, bet.bet_value);
  const tone: ChipTone = chipColor ?? 'neutral';
  const isWin = bet.is_win === true;

  return (
    <View
      style={[
        styles.chip,
        styles[`chip_${tone}`],
        settled && !isWin && styles.chipLost,
        settled && isWin && styles.chipWon,
      ]}
    >
      {settled ? (
        isWin ? (
          <Check size={12} color={tw.emerald300} />
        ) : (
          <X size={12} color={rgba(tw.white, 0.45)} />
        )
      ) : chipColor ? (
        <View style={[styles.dot, styles[`dot_${chipColor}`]]} />
      ) : null}
      <Text weight="600" style={[styles.chipText, styles[`chipText_${tone}`], settled && isWin && styles.chipTextWon]}>
        {getRouletteBetTypeLabel(bet.bet_type)}: {formatRouletteBetValue(bet.bet_type, bet.bet_value)}
      </Text>
      <Text
        weight="600"
        style={[styles.chipText, styles.mono, styles[`chipText_${tone}`], settled && isWin && styles.chipTextWon]}
      >
        {settled && isWin ? `+${bet.payout.toFixed(2)}` : bet.stake.toFixed(2)}
      </Text>
    </View>
  );
}

const useStyles = createStyles(() => ({
  // `rounded-2xl border border-white/10 bg-black/40 px-3.5 py-3`
  strip: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: rgba(tw.white, 0.1),
    backgroundColor: rgba(tw.black, 0.4),
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  header: { marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  // `text-[10px] font-semibold uppercase tracking-[0.25em] text-white/40`
  liveLabel: {
    ...arbitraryText(10),
    textTransform: 'uppercase',
    letterSpacing: 2.5,
    color: rgba(tw.white, 0.4),
    flexShrink: 1,
  },
  resultLabel: { color: rgba(tw.white, 0.85), flexShrink: 1 },
  mono: { fontFamily: MONO_FONT },
  emerald: { color: tw.emerald300 },
  noHit: { ...arbitraryText(10), textTransform: 'uppercase', letterSpacing: 0.5, color: rgba(tw.white, 0.35) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  // `inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold`
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 9999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chip_red: { borderColor: rgba(tw.rose400, 0.4), backgroundColor: rgba(tw.rose500, 0.1) },
  chip_black: { borderColor: rgba(tw.white, 0.25), backgroundColor: rgba(tw.white, 0.06) },
  chip_green: { borderColor: rgba(tw.emerald400, 0.4), backgroundColor: rgba(tw.emerald500, 0.1) },
  chip_neutral: { borderColor: rgba(tw.amber300, 0.25), backgroundColor: rgba(tw.amber300, 0.1) },
  chipLost: { opacity: 0.45 },
  chipWon: {
    borderColor: rgba(tw.emerald400, 0.6),
    backgroundColor: rgba(tw.emerald500, 0.15),
    boxShadow: '0px 0px 14px rgba(16, 185, 129, 0.25)',
  },
  chipText: arbitraryText(11),
  chipText_red: { color: tw.rose200 },
  chipText_black: { color: tw.stone200 },
  chipText_green: { color: tw.emerald200 },
  chipText_neutral: { color: tw.amber100 },
  chipTextWon: { color: tw.emerald100 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dot_red: { backgroundColor: tw.rose500 },
  dot_black: { borderWidth: 1, borderColor: tw.stone500, backgroundColor: tw.stone900 },
  dot_green: { backgroundColor: tw.emerald500 },
  // `ml-auto inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1`
  repeat: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: rgba(tw.amber400, 0.4),
    backgroundColor: rgba(tw.amber400, 0.1),
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  repeatText: { ...arbitraryText(11), color: tw.amber200 },
  disabled: { opacity: 0.5 },
}));
