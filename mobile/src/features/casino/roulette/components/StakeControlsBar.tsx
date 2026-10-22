import { router } from 'expo-router';
import { ChevronUp } from 'lucide-react-native';
import { memo } from 'react';
import { View } from 'react-native';

import { useBalance } from '@/features/auth/auth-store';
import { OFFLINE_WRITE_MESSAGE, useIsOffline } from '@/lib/connectivity';
import { createStyles } from '@/theme';
import { PressScale, Text } from '@/ui';

import { rgba, tw } from '../../shared/casinoTheme';
import {
  getRouletteBetSummary,
  getRoulettePotentialWin,
  getRouletteStakeStatusLine,
  getRouletteSubmitHint,
} from '../lib/rouletteGame';
import { submitRouletteBet } from '../state/actions';
import { useRouletteSession } from '../state/sessionStore';
import { useRouletteTable } from '../state/tableStore';

/**
 * Fixed bar above the tab bar (web mobile `StakeDrawer` controls): the stake
 * button that opens `/sheets/roulette-stake`, "Postaw zakład" and the status
 * line. Bets are never queued offline.
 */
export const StakeControlsBar = memo(function StakeControlsBar() {
  const styles = useStyles();
  const offline = useIsOffline();
  const balance = Number(useBalance());
  const betType = useRouletteSession((state) => state.betType);
  const betValue = useRouletteSession((state) => state.betValue);
  const stake = useRouletteSession((state) => state.stake);
  const isLoading = useRouletteTable((state) => state.isLoading);
  const isPlacingBet = useRouletteTable((state) => state.isPlacingBet);

  const selection = { betType, betValue, stake, balance };
  const submitHint = getRouletteSubmitHint(selection);
  const potentialWin = getRoulettePotentialWin(selection);
  const parsedStake = Number(stake);
  // Betting stays open while the wheel spins: the bet queues into the next round.
  const disabled = isLoading || isPlacingBet || submitHint !== null || offline;
  const statusLine = offline
    ? OFFLINE_WRITE_MESSAGE
    : getRouletteStakeStatusLine(submitHint, getRouletteBetSummary(betType, betValue), potentialWin);

  return (
    <View style={styles.bar}>
      <View style={styles.row}>
        <PressScale
          scaleTo={0.97}
          accessibilityRole="button"
          accessibilityLabel="Zmień stawkę ruletki"
          accessibilityValue={{ text: parsedStake > 0 ? `${parsedStake.toFixed(2)} zł` : 'Ustaw' }}
          onPress={() => router.push('/sheets/roulette-stake')}
          style={styles.stakeButton}
        >
          <View>
            <Text size="xs" style={styles.stakeLabel}>
              Stawka
            </Text>
            <Text size="base" weight="700" tabular style={styles.stakeValue}>
              {parsedStake > 0 ? `${parsedStake.toFixed(2)} zł` : 'Ustaw'}
            </Text>
          </View>
          <ChevronUp size={16} color={tw.white} />
        </PressScale>
        <PressScale
          scaleTo={0.98}
          accessibilityRole="button"
          accessibilityLabel={isPlacingBet ? 'Przyjmowanie…' : 'Postaw zakład'}
          accessibilityHint={disabled && !isPlacingBet ? statusLine : undefined}
          accessibilityState={{ disabled, busy: isPlacingBet }}
          disabled={disabled}
          onPress={() => void submitRouletteBet()}
          style={[styles.submit, disabled && styles.submitDisabled]}
        >
          <Text size="base" weight="700" numberOfLines={1} adjustsFontSizeToFit style={styles.submitText}>
            {isPlacingBet ? 'Przyjmowanie…' : 'Postaw zakład'}
          </Text>
        </PressScale>
      </View>
      <Text
        size="xs"
        numberOfLines={1}
        align="center"
        accessibilityLiveRegion="polite"
        style={styles.status}
      >
        {statusLine}
      </Text>
    </View>
  );
});

const useStyles = createStyles(() => ({
  // `border-t border-white/15 bg-[#0b1713] px-3 py-2`
  bar: {
    borderTopWidth: 1,
    borderTopColor: rgba(tw.white, 0.15),
    backgroundColor: '#0b1713',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  row: { width: '100%', maxWidth: 512, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 12 },
  // `flex min-h-12 min-w-24 items-center justify-between gap-3 rounded-xl border border-white/20 px-3`
  stakeButton: {
    minHeight: 48,
    minWidth: 96,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: rgba(tw.white, 0.2),
    paddingHorizontal: 12,
  },
  stakeLabel: { color: rgba(tw.white, 0.7) },
  stakeValue: { color: tw.white },
  // `h-12 min-w-0 flex-1 rounded-xl bg-amber-400 text-base font-bold text-black`
  submit: {
    height: 48,
    minWidth: 0,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: tw.amber400,
    paddingHorizontal: 16,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: tw.black },
  status: { width: '100%', maxWidth: 512, alignSelf: 'center', marginTop: 4, color: rgba(tw.white, 0.8) },
}));
