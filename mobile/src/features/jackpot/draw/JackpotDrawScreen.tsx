import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Ticket, Volume2, VolumeX } from 'lucide-react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { authActions, useUserId } from '@/features/auth/auth-store';
import { useBootHold } from '@/features/boot/boot-store';
import { OFFLINE_WRITE_MESSAGE, useIsOffline } from '@/lib/connectivity';
import { getErrorMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { useLiteMotion, useReducedMotion } from '@/lib/motion';
import { queryClient } from '@/lib/query-client';
import { toast } from '@/lib/toast';
import { hsl } from '@/theme';
import { Text } from '@/ui';

import { JACKPOT_PAGE_BACKGROUND_IMAGE } from '../assets';
import { SpinningLoader } from '../components/SpinningLoader';
import { claimDailyJackpotReward, getDailyJackpotDraw, revealDailyJackpotDraw } from '../api/jackpot';
import { jackpotDrawQueryKey, jackpotDrawQueryOptions, JACKPOT_STATE_QUERY_ROOT } from '../api/queries';
import {
  canClaimReward,
  canReuseRevealedDraw,
  DRAWING_FLIGHT_MS,
  getCurrentUserTicketLabels,
  getRewardStateLabel,
  hasVisibleWinnerDetails,
  REDUCED_MOTION_FLIGHT_MS,
  type ReplayPhase,
} from '../lib/drawModel';
import { jackpotAudio, useJackpotSound } from '../lib/jackpotAudio';
import {
  formatDrawDate,
  formatDrawDateNumeric,
  formatJackpotAmount,
  formatJackpotHeroAmount,
  formatPolishCount,
} from '../lib/jackpotFormat';
import type { DailyJackpotDraw } from '../types';
import { DrawRoster } from './DrawRoster';
import { DrawStage } from './DrawStage';
import { DRAW_COLORS, fade, getDrawLayout, REM } from './tokens';
import { WinnerConfetti } from './WinnerConfetti';

const FILL = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } as const;

interface ReplayRun {
  id: number;
  startedAt: number;
  duration: number;
  reveal: Promise<DailyJackpotDraw>;
  timer: ReturnType<typeof setTimeout> | null;
}

function closeDraw() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/**
 * `/jackpot/draw/:roundId` (web `JackpotDrawPage`). The route param is the
 * pool id. The draw is loaded fresh on every visit; the replay phase lives in
 * local state and resyncs from the server when the app returns to the foreground.
 */
export function JackpotDrawScreen() {
  const { roundId } = useLocalSearchParams<{ roundId: string }>();
  const poolId = typeof roundId === 'string' && roundId.length > 0 ? roundId : null;
  const currentUserId = useUserId();
  const offline = useIsOffline();
  const reducedMotion = useReducedMotion();
  const lite = useLiteMotion();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const layout = getDrawLayout(windowWidth);
  const { soundEnabled, toggleSound } = useJackpotSound();

  const query = useQuery({ ...jackpotDrawQueryOptions(poolId ?? ''), enabled: poolId !== null });
  const [localDraw, setLocalDraw] = useState<DailyJackpotDraw | null>(null);
  const [phase, setPhase] = useState<ReplayPhase>('intro');
  const [claiming, setClaiming] = useState(false);
  const [confettiKey, setConfettiKey] = useState(0);
  const [rosterExpanded, setRosterExpanded] = useState(false);
  const phaseRef = useRef<ReplayPhase>('intro');
  const runRef = useRef<ReplayRun | null>(null);
  const runIdRef = useRef(0);
  const claimingRef = useRef(false);
  const mountedRef = useRef(true);
  const foregroundRef = useRef<() => void>(() => undefined);

  const draw = localDraw ?? query.data ?? null;
  const loading = poolId !== null && query.isPending && query.fetchStatus === 'fetching';
  useBootHold(loading);

  const setPhaseState = (next: ReplayPhase) => {
    phaseRef.current = next;
    setPhase(next);
  };

  useEffect(() => {
    if (!query.error) return;
    toast.error(getErrorMessage(query.error, 'Nie udało się wczytać losowania'));
  }, [query.error, query.errorUpdatedAt]);

  // Live state is never kept: drop the draw when the screen closes and let the
  // home card refetch (viewing a draw can advance the daily pool).
  useEffect(() => {
    mountedRef.current = true;
    jackpotAudio.prepareDraw();
    return () => {
      mountedRef.current = false;
      if (runRef.current?.timer) clearTimeout(runRef.current.timer);
      runRef.current = null;
      jackpotAudio.releaseDraw();
      if (poolId) queryClient.removeQueries({ queryKey: jackpotDrawQueryKey(poolId) });
      void queryClient.invalidateQueries({ queryKey: JACKPOT_STATE_QUERY_ROOT });
    };
  }, [poolId]);

  /** Web `celebrateJackpotReveal`: the reveal sound for everyone, fanfare and confetti for the winner. */
  const celebrate = (isCurrentUserWinner: boolean) => {
    jackpotAudio.playReveal(isCurrentUserWinner);
    if (isCurrentUserWinner) {
      haptics.success();
      if (!reducedMotion) setConfettiKey((key) => key + 1);
    } else {
      haptics.light();
    }
  };

  const finishRun = (runId: number) => {
    const current = runRef.current;
    if (!current || current.id !== runId) return;
    if (current.timer) clearTimeout(current.timer);
    current.timer = null;

    current.reveal
      .then((revealed) => {
        if (!mountedRef.current || runRef.current?.id !== runId) return;
        runRef.current = null;
        setLocalDraw(revealed);
        setPhaseState('revealed');
        celebrate(revealed.currentUserIsWinner);
      })
      .catch((error: unknown) => {
        if (!mountedRef.current || runRef.current?.id !== runId) return;
        runRef.current = null;
        haptics.error();
        toast.error(getErrorMessage(error, 'Nie udało się odsłonić wyniku'));
        setPhaseState('intro');
      });
  };

  // From the intro or, after a reveal, "Obejrzyj ponownie" (which reuses the revealed draw).
  const startReplay = () => {
    if (!draw || phaseRef.current === 'drawing') return;
    setPhaseState('drawing');
    haptics.medium();

    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    const duration = reducedMotion ? REDUCED_MOTION_FLIGHT_MS : DRAWING_FLIGHT_MS;
    const reveal = canReuseRevealedDraw(draw)
      ? Promise.resolve(draw)
      : revealDailyJackpotDraw(draw.poolId).then((revealed) => {
          if (!hasVisibleWinnerDetails(revealed)) {
            throw new Error('Nie udało się odsłonić pełnego wyniku');
          }
          // Like the web, the drum gets the winner as soon as it is known.
          if (mountedRef.current && runRef.current?.id === runId) setLocalDraw(revealed);
          return revealed;
        });
    reveal.catch(() => undefined);

    runRef.current = {
      id: runId,
      startedAt: Date.now(),
      duration,
      reveal,
      timer: setTimeout(() => finishRun(runId), duration),
    };
  };

  const claimReward = async () => {
    if (!draw || claimingRef.current || offline) return;
    claimingRef.current = true;
    setClaiming(true);
    haptics.medium();
    try {
      const result = await claimDailyJackpotReward(draw.poolId);
      if (mountedRef.current) {
        setLocalDraw((current) =>
          current
            ? {
                ...current,
                rewardClaimedAt: result.rewardClaimedAt,
                rewardAutoCreditedAt: result.rewardAutoCreditedAt,
                rewardCreditStatus: result.rewardCreditStatus,
              }
            : current,
        );
      }
      authActions.updateProfileBalance(result.balanceAfter);
      await authActions.refreshProfile();
      haptics.success();
      toast.success(result.alreadyCredited ? 'Nagroda była już dodana' : `Odebrano ${formatJackpotAmount(result.amount)}`, {
        position: 'bottom-center',
      });
    } catch (error) {
      haptics.error();
      toast.error(getErrorMessage(error, 'Nie udało się odebrać nagrody'));
    } finally {
      claimingRef.current = false;
      if (mountedRef.current) setClaiming(false);
    }
  };

  // Back from the background: never trust that timers kept running. A finished
  // drawing jumps straight to the result (the drum follows the clock); otherwise resync.
  const onForeground = () => {
    const current = runRef.current;
    if (phaseRef.current === 'drawing' && current) {
      const elapsed = Date.now() - current.startedAt;
      if (elapsed >= current.duration) {
        finishRun(current.id);
      } else {
        if (current.timer) clearTimeout(current.timer);
        current.timer = setTimeout(() => finishRun(current.id), current.duration - elapsed);
      }
      return;
    }
    if (!poolId) return;
    if (phaseRef.current === 'intro') {
      void query.refetch();
      return;
    }
    getDailyJackpotDraw(poolId)
      .then((fresh) => {
        if (!mountedRef.current) return;
        // `get_daily_jackpot_draw` hides the winner; keep it and take the reward
        // state, unless a claim finished while this request was in flight.
        setLocalDraw((existing) =>
          existing && existing.rewardCreditStatus === 'pending'
            ? {
                ...existing,
                rewardClaimedAt: fresh.rewardClaimedAt,
                rewardAutoCreditedAt: fresh.rewardAutoCreditedAt,
                rewardCreditStatus: fresh.rewardCreditStatus,
              }
            : existing,
        );
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    foregroundRef.current = onForeground;
  });

  useEffect(() => {
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && previous !== 'active') foregroundRef.current();
      previous = state;
    });
    return () => subscription.remove();
  }, []);

  const background = (
    <>
      <Image source={JACKPOT_PAGE_BACKGROUND_IMAGE} style={StyleSheet.absoluteFill} contentFit="cover" />
      <View pointerEvents="none" style={styles.backgroundTint} />
    </>
  );

  if (loading || !draw) {
    // The modal has no swipe-to-dismiss: the back button stays while it loads or fails.
    let message = 'Nie znaleziono tego losowania.';
    if (query.isPending && query.fetchStatus === 'paused') message = 'Brak połączenia. Wczytamy losowanie, gdy wrócisz online.';
    else if (query.isError) message = 'Nie udało się wczytać losowania.';
    return (
      <View style={styles.page}>
        {background}
        <View style={{ paddingTop: insets.top }}>
          <View style={styles.topbar}>
            <BackButton />
          </View>
          {loading ? (
            <View style={styles.loading} accessibilityRole="progressbar">
              <SpinningLoader size={1.25 * REM} color={DRAW_COLORS.goldSoft} />
              <Text style={styles.loadingText}>Ładowanie losowania</Text>
            </View>
          ) : (
            <View style={styles.message}>
              <Text style={[styles.loadingText, styles.messageText]}>{message}</Text>
              {query.isError ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void query.refetch()}
                  style={({ pressed }) => [styles.retry, pressed && styles.retryPressed]}
                >
                  <Text style={styles.loadingText}>Spróbuj ponownie</Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </View>
      </View>
    );
  }

  const numericDrawDate = formatDrawDateNumeric(draw.poolDate);
  const participantCountLabel = formatPolishCount(draw.participantCount, 'gracz', 'gracze', 'graczy');
  const ticketCountLabel = formatPolishCount(draw.ticketCount, 'los', 'losy', 'losów');
  const prizeAmountLabel = formatJackpotHeroAmount(draw.prizeAmount);

  const shell = (topbarEnd: ReactNode, children: ReactNode) => (
    <View style={styles.page}>
      {background}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View
          style={[
            styles.shell,
            { width: layout.shellWidth, paddingTop: 0.9 * REM + insets.top, paddingBottom: 0.9 * REM + insets.bottom },
          ]}
        >
          <View style={styles.topbar}>
            <BackButton />
            {topbarEnd}
          </View>
          {children}
        </View>
      </ScrollView>
      {confettiKey > 0 ? <WinnerConfetti fireKey={confettiKey} /> : null}
    </View>
  );
  const topbarTitle = <Text style={styles.topbarTitle}>Losowanie z {numericDrawDate}</Text>;

  if (draw.status === 'rolled_over') {
    return shell(
      topbarTitle,
      <>
        <View style={styles.hero}>
          <View>
            <Text style={styles.heroTitle} accessibilityRole="header">
              Pula przeszła na kolejny dzień
            </Text>
            <Text style={styles.heroText}>
              {formatDrawDate(draw.poolDate)}, pula <Text style={styles.heroStrong}>{prizeAmountLabel}</Text>
            </Text>
          </View>
          <View style={styles.meta} accessibilityLabel="Dane rundy">
            <View style={styles.metaRow}>
              <MetaCell label="Graczy" value={String(draw.participantCount)} accessibilityLabel={participantCountLabel} />
              <MetaCell label="Ticketów" value={String(draw.ticketCount)} accessibilityLabel={ticketCountLabel} />
            </View>
            <View style={styles.metaRow}>
              <MetaCell label="Finał" value="20:00" />
              <View style={styles.metaSpacer} />
            </View>
          </View>
        </View>

        <View style={styles.stage}>
          <View style={styles.resultCenter}>
            <View style={styles.result} accessibilityLiveRegion="polite">
              <View style={styles.resultIcon}>
                <Ticket size={1.75 * REM} color={hsl(24, 12, 10)} />
              </View>
              <Text style={styles.resultLabel}>Brak losowania</Text>
              <Text style={styles.resultTitle} accessibilityRole="header">
                Pula została przeniesiona
              </Text>
              <Text style={styles.resultText}>Tickety z tej rundy zostały rozliczone bez reveal i claim.</Text>
            </View>
          </View>
        </View>
      </>,
    );
  }

  const currentUserTicketLabels = getCurrentUserTicketLabels(draw, currentUserId);

  return shell(
    <View style={styles.topbarEnd}>
      {topbarTitle}
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel="Dźwięki losowania"
        accessibilityState={{ checked: soundEnabled }}
        hitSlop={4}
        onPress={() => {
          haptics.selection();
          toggleSound();
        }}
        style={({ pressed }) => [styles.sound, pressed && styles.backPressed]}
      >
        {soundEnabled ? (
          <Volume2 size={REM} color={hsl(43, 100, 62)} />
        ) : (
          <VolumeX size={REM} color={hsl(0, 0, 52)} />
        )}
      </Pressable>
    </View>,
    <>
      <View style={styles.hero} accessibilityLabel="Dane losowania">
        <View style={styles.meta} accessibilityLabel="Dane rundy">
          <View style={styles.metaRow}>
            <MetaCell label="Pula" value={prizeAmountLabel} />
            <MetaCell label="Data losowania" value={formatDrawDate(draw.poolDate)} small="20:00" />
          </View>
          <View style={styles.metaRow}>
            <MetaCell label="Graczy" value={String(draw.participantCount)} accessibilityLabel={participantCountLabel} />
            <MetaCell label="Ticketów" value={String(draw.ticketCount)} accessibilityLabel={ticketCountLabel} />
          </View>
        </View>
      </View>

      {currentUserTicketLabels.length > 0 ? (
        <View style={styles.userTickets} accessible accessibilityLabel={`Twoje numery ticketów: ${currentUserTicketLabels.join(' ')}`}>
          <Text style={styles.userTicketsLabel}>Twoje tickety</Text>
          <Text style={styles.userTicketsValue}>{currentUserTicketLabels.join(' ')}</Text>
        </View>
      ) : null}

      <View style={styles.replayLayout}>
        <DrawStage
          draw={draw}
          phase={phase}
          width={layout.contentWidth}
          prizeLabel={prizeAmountLabel}
          canClaim={canClaimReward(draw, phase)}
          claiming={claiming}
          claimBlockedLabel={offline ? OFFLINE_WRITE_MESSAGE : null}
          rewardStateLabel={getRewardStateLabel(draw)}
          reducedMotion={reducedMotion}
          lite={lite}
          onStart={startReplay}
          onClaim={() => void claimReward()}
        />
        <DrawRoster
          participants={draw.participants}
          participantCount={draw.participantCount}
          expanded={rosterExpanded}
          onToggle={() => setRosterExpanded((expanded) => !expanded)}
          windowHeight={windowHeight}
        />
      </View>
    </>,
  );
}

function BackButton() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Wróć do poprzedniego widoku"
      hitSlop={6}
      onPress={() => {
        haptics.selection();
        closeDraw();
      }}
      style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
    >
      <ArrowLeft size={REM} color={DRAW_COLORS.gold} />
    </Pressable>
  );
}

function MetaCell({
  label,
  value,
  small,
  accessibilityLabel,
}: {
  label: string;
  value: string;
  small?: string;
  accessibilityLabel?: string;
}) {
  return (
    <View style={styles.metaCell} accessible accessibilityLabel={`${label}: ${accessibilityLabel ?? value}${small ? ` ${small}` : ''}`}>
      <View pointerEvents="none" style={styles.metaGlow} />
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
      {small ? <Text style={styles.metaSmall}>{small}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#000' },
  backgroundTint: {
    ...FILL,
    backgroundImage: [
      `radial-gradient(${70 * REM}px ${34 * REM}px at 8% 10%, ${hsl(2, 84, 28, 0.42)}, ${fade(2, 84, 28)} 62%)`,
      `radial-gradient(${54 * REM}px ${36 * REM}px at 91% 6%, ${hsl(0, 93, 21, 0.32)}, ${fade(0, 93, 21)} 64%)`,
      `linear-gradient(180deg, ${hsl(0, 0, 0, 0.58)}, ${hsl(0, 0, 0, 0.78)})`,
    ].join(', '),
  },
  scrollContent: { flexGrow: 1, paddingTop: 0.7 * REM },
  shell: {
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: hsl(0, 0, 100, 0.14),
    borderRadius: REM,
    paddingHorizontal: 0.8 * REM,
    backgroundImage: [
      `linear-gradient(180deg, ${hsl(0, 0, 8, 0.78)}, ${hsl(0, 0, 2, 0.86)})`,
      `radial-gradient(${38 * REM}px ${18 * REM}px at 92% 0%, ${hsl(0, 86, 32, 0.28)}, ${fade(0, 86, 32)} 70%)`,
    ].join(', '),
    boxShadow: `0px 22px 70px ${hsl(0, 0, 0, 0.58)}, inset 0px 1px 0px ${hsl(0, 0, 100, 0.08)}`,
  },
  loading: {
    minHeight: 18 * REM,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0.6 * REM,
  },
  loadingText: { color: DRAW_COLORS.goldSoft, fontSize: 0.86 * REM, lineHeight: 0.86 * REM * 1.5, fontWeight: '800' },
  message: { minHeight: 18 * REM, alignItems: 'center', justifyContent: 'center', gap: REM, paddingHorizontal: 1.5 * REM },
  messageText: { textAlign: 'center' },
  retry: {
    paddingHorizontal: REM,
    paddingVertical: 0.5 * REM,
    borderRadius: 0.6 * REM,
    borderWidth: 1,
    borderColor: DRAW_COLORS.goldSoft,
  },
  retryPressed: { opacity: 0.7 },
  topbar: {
    minHeight: 2.2 * REM,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 0.8 * REM,
  },
  topbarTitle: {
    flexShrink: 1,
    color: DRAW_COLORS.muted,
    fontSize: 0.74 * REM,
    lineHeight: 0.74 * REM * 1.5,
    fontWeight: '800',
  },
  topbarEnd: { minWidth: 0, flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 0.6 * REM },
  sound: {
    width: 2.3 * REM,
    height: 2.3 * REM,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: hsl(0, 0, 100, 0.12),
    borderRadius: 999,
    backgroundColor: hsl(0, 0, 0, 0.36),
  },
  back: {
    width: 2.1 * REM,
    height: 2.1 * REM,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: hsl(0, 0, 100, 0.12),
    borderRadius: 999,
    backgroundColor: hsl(0, 0, 0, 0.36),
  },
  backPressed: { borderColor: hsl(43, 100, 60, 0.42), backgroundColor: hsl(0, 0, 100, 0.08) },
  hero: { gap: 0.6 * REM, paddingTop: 0.35 * REM, paddingBottom: 0.7 * REM },
  // max-width 22ch of Inter Black at 1.35rem.
  heroTitle: {
    maxWidth: 22 * 0.66 * 1.35 * REM,
    color: DRAW_COLORS.heading,
    fontSize: 1.35 * REM,
    lineHeight: 1.35 * REM * 1.05,
    fontWeight: '900',
  },
  heroText: {
    marginTop: 0.38 * REM,
    maxWidth: 31 * REM,
    color: hsl(0, 0, 76),
    fontSize: 0.78 * REM,
    lineHeight: 0.78 * REM * 1.3,
    fontWeight: '600',
  },
  heroStrong: { color: DRAW_COLORS.heading, fontWeight: '900' },
  meta: { gap: 0.36 * REM },
  metaRow: { flexDirection: 'row', gap: 0.36 * REM },
  metaSpacer: { flex: 1 },
  metaCell: {
    flex: 1,
    minHeight: 3.15 * REM,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: hsl(0, 0, 100, 0.1),
    borderRadius: 0.58 * REM,
    padding: 0.44 * REM,
    backgroundImage: `linear-gradient(180deg, ${hsl(0, 0, 7, 0.88)}, ${hsl(0, 0, 3, 0.88)})`,
  },
  // ::after: an 8rem red disc blurred by 10px in the bottom-right corner.
  metaGlow: {
    position: 'absolute',
    right: -3.5 * REM - 20,
    bottom: -3.6 * REM - 20,
    width: 8 * REM + 40,
    height: 8 * REM + 40,
    backgroundImage: `radial-gradient(circle closest-side, ${hsl(0, 92, 48, 0.14)} 52%, ${fade(0, 92, 48)} 100%)`,
  },
  metaLabel: {
    color: hsl(0, 0, 67),
    fontSize: 0.62 * REM,
    lineHeight: 0.62 * REM * 1.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  metaValue: {
    marginTop: 0.3 * REM,
    color: DRAW_COLORS.heading,
    fontSize: 0.9 * REM,
    lineHeight: 0.9 * REM * 1.1,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  metaSmall: {
    marginTop: 0.18 * REM,
    color: hsl(0, 0, 77),
    fontSize: 0.68 * REM,
    lineHeight: 0.68 * REM * 1.5,
    fontWeight: '700',
    textAlign: 'center',
  },
  userTickets: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0.5 * REM,
    marginTop: -0.08 * REM,
    marginBottom: 0.62 * REM,
    borderWidth: 1,
    borderColor: hsl(42, 100, 60, 0.28),
    borderRadius: 999,
    paddingVertical: 0.42 * REM,
    paddingHorizontal: 0.58 * REM,
    backgroundColor: hsl(0, 0, 4, 0.66),
    boxShadow: `inset 0px 1px 0px ${hsl(0, 0, 100, 0.06)}`,
  },
  userTicketsLabel: {
    color: hsl(0, 0, 75),
    fontSize: 0.68 * REM,
    lineHeight: 0.68 * REM * 1.15,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  userTicketsValue: {
    flexShrink: 1,
    color: hsl(42, 100, 62),
    fontSize: 0.78 * REM,
    lineHeight: 0.78 * REM * 1.15,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  replayLayout: { gap: 0.95 * REM },
  stage: {
    minHeight: 18 * REM,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: hsl(34, 70, 42, 0.16),
    borderRadius: 0.82 * REM,
    backgroundImage: [
      `radial-gradient(${38 * REM}px ${14 * REM}px at 50% 60%, ${hsl(35, 100, 54, 0.2)}, ${fade(35, 100, 54)} 72%)`,
      `radial-gradient(${24 * REM}px ${10 * REM}px at 50% 42%, ${hsl(36, 100, 56, 0.12)}, ${fade(36, 100, 56)} 72%)`,
      `linear-gradient(180deg, ${hsl(0, 0, 4, 0.76)}, ${hsl(0, 0, 1, 0.92)})`,
    ].join(', '),
    boxShadow: `inset 0px 1px 0px ${hsl(0, 0, 100, 0.08)}, inset 0px -28px 48px ${hsl(31, 96, 22, 0.16)}`,
  },
  resultCenter: { ...FILL, alignItems: 'center', justifyContent: 'center' },
  result: {
    zIndex: 7,
    width: '100%',
    maxWidth: 28 * REM,
    alignItems: 'center',
    gap: 0.45 * REM,
    borderWidth: 1,
    borderColor: hsl(43, 100, 60, 0.32),
    borderRadius: REM,
    padding: 1.4 * REM,
    backgroundColor: hsl(0, 0, 2, 0.72),
  },
  resultIcon: {
    width: 3.7 * REM,
    height: 3.7 * REM,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: REM,
    backgroundColor: hsl(43, 100, 58),
  },
  resultLabel: {
    color: hsl(43, 100, 82),
    fontSize: 0.78 * REM,
    lineHeight: 0.78 * REM * 1.5,
    fontWeight: '900',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  resultTitle: {
    color: hsl(0, 0, 100),
    fontSize: 2 * REM,
    lineHeight: 2 * REM * 1.05,
    fontWeight: '900',
    textAlign: 'center',
  },
  resultText: {
    color: hsl(0, 0, 78),
    fontSize: 0.95 * REM,
    lineHeight: 0.95 * REM * 1.5,
    fontWeight: '800',
    textAlign: 'center',
  },
});
