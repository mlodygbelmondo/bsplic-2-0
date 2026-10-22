import { Volume2, VolumeX } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { haptics } from '@/lib/haptics';
import { usePreferences } from '@/lib/preferences';
import { createStyles } from '@/theme';
import { PressScale, Text } from '@/ui';
import type { BlackjackTableInfo } from '../api/blackjack';
import type { DealerSlot } from '../logic/view';
import { fadeIn } from './motion';
import { PlayingCard } from './PlayingCard';
import { black, white } from './tokens';

/** Mute toggle: the blackjack sound preference (web `bsplic.blackjack.muted`). */
function MuteButton() {
  const styles = useStyles();
  const soundOn = usePreferences((s) => s.blackjackSound);
  const setBlackjackSound = usePreferences((s) => s.setBlackjackSound);
  const Icon = soundOn ? Volume2 : VolumeX;
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={soundOn ? 'Wycisz dźwięki' : 'Włącz dźwięki'}
      onPress={() => {
        haptics.selection();
        setBlackjackSound(!soundOn);
      }}
      style={styles.mute}
    >
      <Icon size={14} color={white(0.8)} />
    </PressScale>
  );
}

/**
 * Shoe info (`blackjack-shoe-info`). On short phones during a decision only
 * the mute button stays, pinned to the top-right corner.
 */
export function ShoeInfo({
  tableInfo,
  shoeTotalCards,
  compact,
}: {
  tableInfo: BlackjackTableInfo;
  shoeTotalCards: number;
  compact: boolean;
}) {
  const styles = useStyles();
  if (compact) {
    return (
      <View style={styles.infoCompact}>
        <MuteButton />
      </View>
    );
  }
  return (
    <View style={styles.info}>
      <Text size="xs" weight="500" style={styles.infoText}>
        {tableInfo.deckCount} talie
      </Text>
      <Text size="xs" importantForAccessibility="no" accessibilityElementsHidden style={styles.bullet}>
        •
      </Text>
      <Text size="xs" weight="500" style={styles.infoText}>
        Pozostało {tableInfo.cardsRemaining}/{shoeTotalCards} kart
      </Text>
      <Text size="xs" importantForAccessibility="no" accessibilityElementsHidden style={styles.bullet}>
        •
      </Text>
      <Text size="xs" weight="500" style={styles.infoText}>
        Shoe #{tableInfo.shoeNumber}
      </Text>
      <MuteButton />
    </View>
  );
}

export function DealerArea({
  slots,
  value,
  holeHidden,
  compact,
}: {
  slots: DealerSlot[];
  value: number;
  holeHidden: boolean;
  compact: boolean;
}) {
  const styles = useStyles();
  return (
    <Animated.View entering={fadeIn} style={[styles.dealer, compact && styles.dealerCompact]}>
      <View style={styles.dealerLabel}>
        <Text size="sm" weight="500" style={styles.dealerLabelText}>
          Krupier: {value}
          {holeHidden ? ' + ?' : ''}
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.dealerRail}
        contentContainerStyle={[styles.dealerHand, compact && styles.dealerHandCompact]}
      >
        {slots.map(({ card, hidden, index, key }) => (
          <PlayingCard
            key={key}
            card={card}
            hidden={hidden}
            dealTarget="dealer"
            index={index}
            compact={compact}
            style={index > 0 ? styles.dealerOverlap : undefined}
          />
        ))}
      </ScrollView>
    </Animated.View>
  );
}

const useStyles = createStyles(() => ({
  // `flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-2 text-xs font-medium text-white/75`
  info: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 8,
    rowGap: 4,
    paddingHorizontal: 8,
  },
  infoCompact: { position: 'absolute', top: 0, right: 0, zIndex: 10 },
  infoText: { color: white(0.75) },
  bullet: { color: white(0.25) },
  // `ml-1 h-11 w-11 rounded-xl border border-white/20 bg-black/35`
  mute: {
    marginLeft: 4,
    width: 44,
    height: 44,
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: white(0.2),
    backgroundColor: black(0.35),
    alignItems: 'center',
    justifyContent: 'center',
  },
  // `flex min-h-[9rem] w-full flex-col items-center justify-center gap-2`
  dealer: { minHeight: 144, width: '100%', alignItems: 'center', justifyContent: 'center', gap: 8 },
  dealerCompact: { minHeight: 0 },
  // `rounded-full border border-white/10 bg-black/50 px-3 py-1`
  dealerLabel: {
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: white(0.1),
    backgroundColor: black(0.5),
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  dealerLabelText: { color: white(0.8) },
  dealerRail: { flexGrow: 0, maxWidth: '100%' },
  // `px-2 pb-2 -space-x-7`
  dealerHand: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 8, paddingBottom: 8 },
  dealerHandCompact: { paddingBottom: 0 },
  dealerOverlap: { marginLeft: -28 },
}));
