import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { createStyles } from '@/theme';
import { Text } from '@/ui';
import type { SettledStatus } from '../logic/game';
import { CountUpAmount } from './CountUpAmount';
import { enterScale, enterUpSmall } from './motion';
import { TableButton } from './TableButton';
import { black, bj, white } from './tokens';

interface ResultPanelProps {
  status: SettledStatus;
  title: string;
  showSplitResult: boolean;
  netResult: number;
  totalPayout: number;
  splitWins: number;
  splitLosses: number;
  splitPushes: number;
  insurancePayout: number;
  /** "Graj ponownie (N zł)" label, or plain "Graj ponownie" without a valid last stake. */
  playAgainLabel: string;
  playAgainDisabled: boolean;
  offlineMessage: string | null;
  onPlayAgain: () => void;
  onChangeStake: () => void;
}

/** Settled round: title, payout count-up, split summary, insurance payout and replay buttons. */
export function ResultPanel({
  status,
  title,
  showSplitResult,
  netResult,
  totalPayout,
  splitWins,
  splitLosses,
  splitPushes,
  insurancePayout,
  playAgainLabel,
  playAgainDisabled,
  offlineMessage,
  onPlayAgain,
  onChangeStake,
}: ResultPanelProps) {
  const styles = useStyles();
  const titleTone = showSplitResult
    ? styles.titleSplit
    : status === 'won'
      ? styles.titleWon
      : status === 'lost'
        ? styles.titleLost
        : styles.titlePush;

  return (
    <Animated.View entering={enterScale} style={styles.panel}>
      <Text size="3xl" weight="900" accessibilityRole="header" accessibilityLiveRegion="polite" style={[styles.title, titleTone]}>
        {title}
      </Text>
      {status === 'won' && netResult > 0 ? (
        <Animated.View entering={enterUpSmall}>
          <CountUpAmount value={netResult} prefix="+" style={styles.net} />
        </Animated.View>
      ) : null}
      {status === 'push' && totalPayout > 0 ? (
        <Animated.View entering={enterUpSmall} style={styles.refundRow}>
          <Text size="lg" weight="700" style={styles.refund}>
            Zwrot:{' '}
          </Text>
          <CountUpAmount value={totalPayout} style={styles.refundAmount} />
        </Animated.View>
      ) : null}
      {showSplitResult ? (
        <Animated.View entering={enterUpSmall} style={[styles.pill, styles.splitPill]}>
          <Text size="sm" weight="600" style={styles.splitText}>
            Wygrane: {splitWins} • Przegrane: {splitLosses} • Remisy: {splitPushes}
          </Text>
        </Animated.View>
      ) : null}
      {insurancePayout > 0 ? (
        <Animated.View entering={enterUpSmall} style={[styles.pill, styles.insurancePill]}>
          <Text size="sm" weight="600" style={styles.insuranceText}>
            Wypłata z ubezpieczenia: {insurancePayout.toFixed(2)} zł.
          </Text>
        </Animated.View>
      ) : null}
      {offlineMessage ? (
        <View style={styles.offline}>
          <Text size="xs" weight="600" style={styles.offlineText}>
            {offlineMessage}
          </Text>
        </View>
      ) : null}
      <View style={styles.buttons}>
        <TableButton
          label={playAgainLabel}
          tone="amber"
          radius={12}
          size="sm"
          bold
          disabled={playAgainDisabled}
          onPress={onPlayAgain}
        />
        <TableButton label="Zmień stawkę" tone="glass" radius={12} size="sm" onPress={onChangeStake} />
      </View>
    </Animated.View>
  );
}

const glow = (color: string, radius: number) => ({
  textShadowColor: color,
  textShadowOffset: { width: 0, height: 0 },
  textShadowRadius: radius,
});

const useStyles = createStyles(() => ({
  // `flex flex-col items-center gap-3 text-center`
  panel: { width: '100%', alignItems: 'center', gap: 12 },
  // `text-3xl font-black uppercase tracking-wider`
  title: { textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1.5 },
  titleSplit: { color: bj.amber200, ...glow('rgba(251, 191, 36, 0.28)', 15) },
  titleWon: { color: bj.green400, ...glow('rgba(74, 222, 128, 0.5)', 15) },
  titleLost: { color: bj.red400, ...glow('rgba(248, 113, 113, 0.5)', 15) },
  titlePush: { color: bj.gray300, ...glow('rgba(209, 213, 219, 0.5)', 15) },
  // `text-2xl font-black text-green-300`
  net: { color: bj.green300, fontSize: 24, fontWeight: '900', textAlign: 'center' },
  refundRow: { flexDirection: 'row', alignItems: 'center' },
  // `text-lg font-bold text-white/75`
  refund: { color: white(0.75) },
  refundAmount: { color: white(0.75), fontSize: 18, fontWeight: '700' },
  // `rounded-full border px-4 py-2 text-sm font-semibold`
  pill: { borderRadius: 9999, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 8 },
  splitPill: {
    borderColor: 'rgba(252, 211, 77, 0.25)',
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    boxShadow: '0px 0px 28px rgba(251, 191, 36, 0.12)',
  },
  splitText: { color: bj.amber50, textAlign: 'center' },
  insurancePill: {
    borderColor: 'rgba(125, 211, 252, 0.25)',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    boxShadow: '0px 0px 28px rgba(56, 189, 248, 0.12)',
  },
  insuranceText: { color: bj.sky50, textAlign: 'center' },
  offline: {
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: white(0.1),
    backgroundColor: black(0.35),
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  offlineText: { color: white(0.7) },
  // `flex w-full flex-col items-stretch justify-center gap-2`
  buttons: { width: '100%', alignSelf: 'stretch', gap: 8 },
}));
