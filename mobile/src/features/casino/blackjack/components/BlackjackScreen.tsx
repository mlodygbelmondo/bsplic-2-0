import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { KeyboardAwareScrollView, type KeyboardAwareScrollViewRef } from 'react-native-keyboard-controller';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBalance, useProfile, useUserId } from '@/features/auth/auth-store';
import { useBootHold } from '@/features/boot/boot-store';
import { CasinoShell } from '@/features/casino/shared/CasinoShell';
import { OFFLINE_WRITE_MESSAGE } from '@/lib/connectivity';
import { useReducedMotion } from '@/lib/motion';
import { toast } from '@/lib/toast';
import { createStyles } from '@/theme';
import { Text } from '@/ui';
import { BLACKJACK_TABLE_IMAGE } from '../assets';
import { useBlackjackTable } from '../hooks/useBlackjackTable';
import { readLastStake, storeLastStake } from '../lastStake';
import { isSettledStatus } from '../logic/game';
import { deriveBlackjackView, parseStakeInput } from '../logic/view';
import { BettingPanel } from './BettingPanel';
import { InsuranceControls, PlayingControls } from './DecisionControls';
import { enterUpLoading } from './motion';
import { PlayerHands } from './PlayerHands';
import { ResultPanel } from './ResultPanel';
import { DealerArea, ShoeInfo } from './TableTop';
import { black, white } from './tokens';
import { WinConfetti } from './WinConfetti';

/** blackjack-mobile.css: compact table below 700 px of height during decisions. */
const SHORT_SCREEN_HEIGHT = 700;

/** `/casino/blackjack` (web `CasinoBlackjackPage` + `BlackjackGame`). */
export function BlackjackScreen() {
  const userId = useUserId();
  const hasProfile = useProfile() !== null;
  return (
    <CasinoShell>{userId && hasProfile ? <BlackjackTable key={userId} userId={userId} /> : null}</CasinoShell>
  );
}

function BlackjackTable({ userId }: { userId: string }) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const balance = Number(useBalance());
  const { game, state, celebration, offline } = useBlackjackTable(userId);
  const view = deriveBlackjackView(state);
  const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);
  const [betInput, setBetInput] = useState(readLastStake);
  const [barHeight, setBarHeight] = useState(0);
  const [confettiShown, setConfettiShown] = useState(0);

  useBootHold(state.isLoading);

  const { isDecisionState } = view;
  const compact = isDecisionState && height < SHORT_SCREEN_HEIGHT;

  // A decision starts at the top of the table, like the web scrollIntoView.
  useEffect(() => {
    if (isDecisionState && !state.isLoading) scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [isDecisionState, state.isLoading]);

  const parsedBet = parseStakeInput(betInput);
  const isBetValid = Number.isFinite(parsedBet) && parsedBet > 0 && parsedBet <= balance;
  const lastStake = Number(readLastStake());
  const canRepeatStake = Number.isFinite(lastStake) && lastStake > 0 && lastStake <= balance;
  const busy = state.isSyncing || state.isDealing || state.isResolving || state.isRevealing;
  const offlineMessage = offline ? OFFLINE_WRITE_MESSAGE : null;

  /** Writes are never queued offline. */
  const blockedOffline = () => {
    if (!offline) return false;
    toast.error(OFFLINE_WRITE_MESSAGE);
    return true;
  };

  const handleStartGame = (amount: number) => {
    if (busy || blockedOffline()) return;
    storeLastStake(amount);
    setBetInput(String(amount));
    void game.startGame(amount);
  };

  const handlePlayAgain = () => {
    if (!canRepeatStake) {
      game.resetGame();
      return;
    }
    handleStartGame(lastStake);
  };

  const runAction = (action: () => Promise<void>) => () => {
    if (blockedOffline()) return;
    void action();
  };

  if (state.isLoading) {
    return (
      <View style={styles.root}>
        <TableBackground />
        <View style={styles.loading}>
          <Animated.View entering={enterUpLoading} style={styles.loadingPill}>
            <Text size="sm" weight="600" style={styles.loadingText}>
              Wczytywanie stołu...
            </Text>
          </Animated.View>
        </View>
      </View>
    );
  }

  const decisionMessage = offlineMessage ?? state.actionMessage ?? `Twoja decyzja · ${view.decisionValue} pkt`;

  return (
    <View style={styles.root}>
      <TableBackground />
      <KeyboardAwareScrollView
        ref={scrollRef}
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 16 + (isDecisionState ? barHeight : 0) },
        ]}
      >
        <View style={[styles.game, compact && styles.gameCompact]}>
          <View style={styles.tableTop}>
            {state.tableInfo ? (
              <ShoeInfo tableInfo={state.tableInfo} shoeTotalCards={view.shoeTotalCards} compact={compact} />
            ) : null}
            {state.dealerHand.length > 0 ? (
              <DealerArea
                slots={view.dealerSlots}
                value={view.dealerValue}
                holeHidden={view.dealerHoleHidden}
                compact={compact}
              />
            ) : null}
          </View>

          <View style={styles.hands}>
            <PlayerHands
              hands={view.hands}
              activeHandIndex={state.activeHandIndex}
              isDecisionState={isDecisionState}
              isSettled={view.isSettled}
              stake={state.stake}
              compact={compact}
            />
          </View>

          {state.status === 'betting' ? (
            <BettingPanel
              betInput={betInput}
              onBetInputChange={setBetInput}
              parsedBet={parsedBet}
              balance={balance}
              isBetValid={isBetValid}
              isDealing={state.isDealing}
              isSyncing={state.isSyncing}
              actionMessage={state.actionMessage}
              offlineMessage={offlineMessage}
              wide={width >= 380}
              onStart={() => {
                if (isBetValid) handleStartGame(parsedBet);
              }}
            />
          ) : null}

          {isSettledStatus(state.status) ? (
            <ResultPanel
              status={state.status}
              title={view.resultTitle}
              showSplitResult={view.showSplitResult}
              netResult={view.netResult}
              totalPayout={view.totalPayout}
              splitWins={view.splitWins}
              splitLosses={view.splitLosses}
              splitPushes={view.splitPushes}
              insurancePayout={state.insurancePayout}
              playAgainLabel={canRepeatStake ? `Graj ponownie (${lastStake.toFixed(0)} zł)` : 'Graj ponownie'}
              playAgainDisabled={state.isDealing || offline}
              offlineMessage={offlineMessage}
              onPlayAgain={handlePlayAgain}
              onChangeStake={() => game.resetGame()}
            />
          ) : null}
        </View>
      </KeyboardAwareScrollView>

      {isDecisionState ? (
        <View
          style={[styles.bar, { bottom: insets.bottom }]}
          onLayout={(event) => setBarHeight(event.nativeEvent.layout.height)}
        >
          {state.status === 'insurance' ? (
            <InsuranceControls
              insuranceStake={state.insuranceStake}
              message={offlineMessage ?? state.actionMessage}
              canTakeInsurance={view.canTakeInsurance}
              affordable={state.insuranceStake <= balance}
              resolving={state.isResolving || offline}
              onTake={runAction(game.takeInsurance)}
              onDecline={runAction(game.declineInsurance)}
            />
          ) : (
            <PlayingControls
              message={decisionMessage}
              locked={view.actionsLocked || offline}
              canSplit={view.canSplit}
              canDoubleDown={view.canDoubleDown}
              stakeAffordable={view.activeStake <= balance}
              onHit={runAction(game.hit)}
              onStand={runAction(game.stand)}
              onSplit={runAction(game.split)}
              onDoubleDown={runAction(game.doubleDown)}
            />
          )}
        </View>
      ) : null}

      {celebration > confettiShown && !reducedMotion ? (
        <WinConfetti key={celebration} onDone={() => setConfettiShown(celebration)} />
      ) : null}
    </View>
  );
}

/** Felt artwork with the web's warm top glow and darkening gradient. */
function TableBackground() {
  const styles = useStyles();
  return (
    <>
      <Image source={BLACKJACK_TABLE_IMAGE} style={styles.fill} contentFit="cover" transition={0} />
      <View pointerEvents="none" style={[styles.fill, styles.overlay]} />
    </>
  );
}

const FILL = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } as const;

const useStyles = createStyles(() => ({
  root: { flex: 1, overflow: 'hidden' },
  fill: FILL,
  overlay: {
    backgroundImage:
      'radial-gradient(circle at 50% 0%, rgba(251, 191, 36, 0.08), transparent 35%), linear-gradient(180deg, rgba(22, 5, 9, 0.18), rgba(22, 5, 9, 0.35) 58%, rgba(22, 5, 9, 0.6))',
  },
  // `flex flex-col gap-3 px-3 pt-3`
  content: { flexGrow: 1, paddingHorizontal: 12, paddingTop: 12 },
  // `blackjack-game relative flex flex-1 flex-col gap-4 px-1 pb-2`
  game: { flex: 1, gap: 16, paddingHorizontal: 4, paddingBottom: 8 },
  gameCompact: { gap: 8 },
  // `flex flex-col items-center justify-center gap-2 overflow-hidden`
  tableTop: { alignItems: 'center', justifyContent: 'center', gap: 8, overflow: 'hidden' },
  hands: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  // `fixed inset-x-0 z-40 border-t border-white/15 bg-[#211014] px-3 py-3`
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 40,
    borderTopWidth: 1,
    borderTopColor: white(0.15),
    backgroundColor: '#211014',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  // `rounded-2xl border border-white/10 bg-black/35 px-5 py-4 text-sm font-semibold text-white/80`
  loadingPill: {
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: white(0.1),
    backgroundColor: black(0.35),
    paddingHorizontal: 20,
    paddingVertical: 16,
    boxShadow: '0px 0px 30px rgba(255, 255, 255, 0.08)',
  },
  loadingText: { color: white(0.8) },
}));
