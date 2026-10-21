import { memo, useEffect, useState } from 'react';
import { View } from 'react-native';

import { createStyles } from '@/theme';
import { Text } from '@/ui';

import { arbitraryText, MONO_FONT, rgba, tw } from '../../shared/casinoTheme';
import { formatRouletteCountdown, getRouletteCountdownTargetMs } from '../lib/roulette';
import { selectIsIdle, useRouletteTable } from '../state/tableStore';

/** Whole seconds left until the round's next deadline, or 0 without one (web `countdownMs` ticker). */
function secondsLeft(targetMs: number | null): number {
  if (!targetMs) return 0;
  return Math.ceil(Math.max(0, targetMs - Date.now()) / 1000);
}

/**
 * Countdown card above the wheel (web `roulette-mobile-countdown`). Its 1 s
 * ticker lives here, so only this card re-renders every second.
 */
export const MobileCountdown = memo(function MobileCountdown() {
  const styles = useStyles();
  const isIdle = useRouletteTable(selectIsIdle);
  const phase = useRouletteTable((state) => state.currentRound?.phase ?? 'waiting');
  const roundNumber = useRouletteTable((state) => state.currentRound?.round_number ?? null);
  const targetMs = useRouletteTable((state) =>
    state.currentRound ? getRouletteCountdownTargetMs(state.currentRound) : null,
  );
  const [seconds, setSeconds] = useState(() => secondsLeft(targetMs));

  useEffect(() => {
    // Re-render only when the displayed second changes.
    const update = () => setSeconds(secondsLeft(targetMs));
    update();
    if (!targetMs) return;
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [targetMs]);

  const label = isIdle ? 'Czeka na zakład' : phase === 'spinning' ? 'Wynik za' : 'Spin za';
  const countdown = isIdle ? '--:--' : formatRouletteCountdown(seconds * 1000);
  const round = roundNumber !== null ? `#${roundNumber}` : '#--';

  return (
    <View
      accessible
      accessibilityRole="timer"
      accessibilityLabel={`${label} ${countdown}, runda ${round}`}
      style={styles.card}
    >
      <View style={styles.row}>
        <View style={styles.labels}>
          <Text weight="600" numberOfLines={1} style={styles.label}>
            {label}
          </Text>
          <Text style={styles.round}>{round}</Text>
        </View>
        <Text size="lg" weight="900" tabular style={styles.countdown}>
          {countdown}
        </Text>
      </View>
    </View>
  );
});

const useStyles = createStyles(() => ({
  // `rounded-2xl border border-white/10 bg-black/45 px-3 py-2 shadow-lg backdrop-blur-sm`
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: rgba(tw.white, 0.1),
    backgroundColor: rgba(tw.black, 0.45),
    paddingHorizontal: 12,
    paddingVertical: 8,
    boxShadow: '0px 10px 15px -3px rgba(0, 0, 0, 0.1), 0px 4px 6px -4px rgba(0, 0, 0, 0.1)',
  },
  row: { minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  labels: { flexShrink: 1, minWidth: 0 },
  // `text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200/70`
  label: { ...arbitraryText(11), textTransform: 'uppercase', letterSpacing: 1.98, color: rgba(tw.amber200, 0.7) },
  round: { ...arbitraryText(11), fontFamily: MONO_FONT, color: rgba(tw.white, 0.45) },
  // `font-mono text-lg font-black tabular-nums text-white`
  countdown: { fontFamily: MONO_FONT, color: tw.white, flexShrink: 0 },
}));
