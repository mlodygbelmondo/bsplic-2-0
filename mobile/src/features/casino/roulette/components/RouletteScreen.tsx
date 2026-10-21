import { Image } from 'expo-image';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useProfile, useUserId } from '@/features/auth/auth-store';
import { useBootHold } from '@/features/boot/boot-store';
import { createStyles } from '@/theme';
import { Text } from '@/ui';

import { CasinoShell } from '../../shared/CasinoShell';
import { casinoImages } from '../../shared/casinoImages';
import { rgba, tw } from '../../shared/casinoTheme';
import { fadeSlideIn } from '../../shared/motion';
import { useRouletteTable } from '../state/tableStore';
import { useRouletteTableSync } from '../state/useRouletteTableSync';
import { BettingPanel } from './BettingPanel';
import { MobileCountdown } from './MobileCountdown';
import { MyBetsStrip } from './MyBetsStrip';
import { RecentSpinsCarousel } from './RecentSpinsCarousel';
import { RecentWinsFeed } from './RecentWinsFeed';
import { RouletteStatsCard } from './RouletteStatsCard';
import { RouletteWheel } from './RouletteWheel';
import { RoundParticipantsList } from './RoundParticipantsList';
import { SoundToggle } from './SoundToggle';
import { StakeControlsBar } from './StakeControlsBar';
import { WinBanner } from './WinBanner';
import { WinConfetti } from './WinConfetti';

const MESSAGE_ENTERING = fadeSlideIn({ y: 10 });

/** `/casino/roulette` (web `CasinoRoulettePage` + `CasinoLobby` + `RouletteGame`, mobile layout). */
export function RouletteScreen() {
  const userId = useUserId();
  const hasProfile = useProfile() !== null;
  return <CasinoShell>{userId && hasProfile ? <RouletteTable key={userId} userId={userId} /> : null}</CasinoShell>;
}

function RouletteTable({ userId }: { userId: string }) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [barHeight, setBarHeight] = useState(0);
  const isLoading = useRouletteTable((state) => state.isLoading);
  useRouletteTableSync(userId);
  useBootHold(isLoading);

  return (
    <View style={styles.root}>
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.shell}>
          <Image
            source={casinoImages.rouletteTable}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            contentPosition="center"
            cachePolicy="memory"
            accessible={false}
          />
          <View pointerEvents="none" style={styles.shellOverlay} />
          <View style={[styles.page, { paddingBottom: 40 + barHeight + insets.bottom }]}>
            <TableMessage />
            <View style={styles.table}>
              <View style={styles.centerStage}>
                <SoundToggle />
                <MobileCountdown />
                <RouletteWheel />
                <BettingPanel />
                <MyBetsStrip />
              </View>
              <View style={styles.rail}>
                <RoundParticipantsList />
                <RecentSpinsCarousel />
                <RouletteStatsCard />
                <RecentWinsFeed />
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      <View
        style={[styles.bar, { bottom: insets.bottom }]}
        onLayout={(event) => setBarHeight(Math.round(event.nativeEvent.layout.height))}
      >
        <StakeControlsBar />
      </View>
      <WinBanner />
      <WinConfetti />
    </View>
  );
}

function TableMessage() {
  const styles = useStyles();
  const message = useRouletteTable((state) => state.tableMessage);
  if (!message) return null;
  return (
    <Animated.View entering={MESSAGE_ENTERING} accessibilityLiveRegion="polite" style={styles.message}>
      <Text style={styles.messageText}>{message}</Text>
    </Animated.View>
  );
}

const useStyles = createStyles(() => ({
  root: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  // `casino-roulette-shell relative min-h-full overflow-hidden bg-cover bg-center`
  shell: { flexGrow: 1, overflow: 'hidden' },
  shellOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundImage:
      'radial-gradient(circle at top, rgba(251, 191, 36, 0.14), transparent 35%), linear-gradient(180deg, rgba(3, 16, 10, 0.2), rgba(3, 16, 10, 0.38) 55%, rgba(3, 16, 10, 0.68))',
  },
  // `p-4 pt-1.5 pb-10` + `space-y-5`
  page: { paddingHorizontal: 16, paddingTop: 6, gap: 20 },
  // `grid gap-5`: center stage first, then the left rail on phones.
  table: { gap: 20 },
  centerStage: { gap: 8 },
  rail: { gap: 20 },
  // `rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100`
  message: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: rgba(tw.amber400, 0.2),
    backgroundColor: rgba(tw.amber500, 0.1),
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  messageText: { color: tw.amber100 },
  bar: { position: 'absolute', left: 0, right: 0, zIndex: 40 },
}));
