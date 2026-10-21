import { Image } from 'expo-image';
import { router, useIsFocused } from 'expo-router';
import { ArrowLeft, AudioLines, History, Info, Minus, Plus, RotateCw, VolumeX } from 'lucide-react-native';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import {
  AppState,
  Keyboard,
  Platform,
  Pressable,
  TextInput,
  useWindowDimensions,
  View,
  type AppStateStatus,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { useBootHold } from '@/features/boot/boot-store';
import { CasinoShell } from '@/features/casino/shared/CasinoShell';
import { OFFLINE_WRITE_MESSAGE, useIsOffline } from '@/lib/connectivity';
import { useAppActive } from '@/lib/focus';
import { haptics } from '@/lib/haptics';
import { useLiteMotion, useReducedMotion } from '@/lib/motion';
import { usePreferences } from '@/lib/preferences';
import { toast } from '@/lib/toast';
import { createStyles, fauxItalic } from '@/theme';
import { Text } from '@/ui';
import { SLOT_ART } from './art';
import {
  addToSession,
  BONUS_AUTOPLAY_DELAY,
  deriveMachine,
  frameDuration,
  idleFrame,
  INVALID_STAKE_MESSAGE,
  isSlotGame,
  money,
  netTone,
  resultLabel,
  shouldAutoplayBonus,
  signedMoney,
  SLOT_GAME_IDS,
  SLOT_GAMES,
  steppedStake,
  type NetTone,
  type SlotGame,
  type SlotSpin,
} from './model';
import { SlotBoard } from './SlotBoard';
import { SLOT_COLORS, SLOT_THEMES } from './slot-theme';
import { playSlotTone, releaseSlotTones } from './sound';
import { useSlotGame } from './useSlotGame';

const goToLobby = () => router.dismissTo('/casino');

/** `/casino/slots/:game` (web `SlotsPage`). Unknown games show the web's not-found line. */
export function SlotsScreen({ game }: { game: string | undefined }) {
  return <CasinoShell>{isSlotGame(game) ? <SlotMachine key={game} game={game} /> : <UnknownGame />}</CasinoShell>;
}

function UnknownGame() {
  const styles = useStyles();
  return (
    <View style={styles.unknown}>
      <Text style={styles.unknownText}>
        Nie ma takiej gry.{' '}
        <Text accessibilityRole="link" onPress={goToLobby} style={styles.unknownText}>
          Wróć do lobby
        </Text>
      </Text>
    </View>
  );
}

interface Playback {
  result: SlotSpin | null;
  frameIndex: number;
  animating: boolean;
}

const IDLE_PLAYBACK: Playback = { result: null, frameIndex: 0, animating: false };

function SlotMachine({ game }: { game: SlotGame }) {
  const styles = useStyles();
  const look = GAME_STYLES[game];
  const config = SLOT_GAMES[game];
  const theme = SLOT_THEMES[game];
  const { state, spin, busy, pending, error, balance } = useSlotGame(game);
  const reducedMotion = useReducedMotion();
  const liteMotion = useLiteMotion();
  const offline = useIsOffline();
  const focused = useIsFocused();
  const appActive = useAppActive();
  const sound = usePreferences((s) => s.casinoSound);
  const { width, height } = useWindowDimensions();
  const [stakeInput, setStakeInput] = useState('5');
  const [playback, setPlayback] = useState<Playback>(IDLE_PLAYBACK);
  const [session, setSession] = useState({ spins: 0, net: 0 });
  const [bonusPaused, setBonusPaused] = useState(() => AppState.currentState !== 'active');
  const [stopped, setStopped] = useState(false);
  const localLock = useRef(false);
  const mounted = useRef(true);
  useBootHold(state.isPending);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      releaseSlotTones();
    };
  }, []);

  const { result, frameIndex, animating } = playback;
  // The last confirmed spin takes precedence over an older state refetch.
  const freeSpins = result?.freeSpins ?? state.data?.freeSpins ?? 0;
  const bonusStake = result?.stake ?? state.data?.bonusStake;
  const view = deriveMachine({
    stakeInput,
    freeSpins,
    bonusStake,
    pending,
    balance,
    busy,
    animating,
    stopped,
    stateReady: Boolean(state.data),
    stateError: state.isError,
    offline,
  });
  const frame = result?.frames[frameIndex] ?? idleFrame(game);
  const history = state.data?.history ?? [];

  // Cascade playback: each frame stays up for the web's duration, then the next drops in.
  useEffect(() => {
    const shown = playback.result;
    if (!playback.animating || !shown) return;
    const current = shown.frames[playback.frameIndex];
    const timeout = setTimeout(
      () => {
        const nextIndex = playback.frameIndex + 1;
        if (nextIndex < shown.frames.length) {
          if (shown.frames[nextIndex].groups.length > 0) haptics.light();
          setPlayback({ ...playback, frameIndex: nextIndex });
        } else {
          localLock.current = false;
          if (shown.net > 0) haptics.success();
          setPlayback({ ...playback, animating: false });
        }
      },
      frameDuration(current.groups.length, reducedMotion),
    );
    return () => clearTimeout(timeout);
  }, [playback, reducedMotion]);

  // Background: pause the bonus (web pauses on a hidden tab). Foreground: show
  // the settled result instead of replaying cascades; the state query refetches.
  const onAppStateChange = useEffectEvent((status: AppStateStatus) => {
    if (status !== 'active') {
      setBonusPaused(true);
      return;
    }
    if (playback.animating && playback.result) {
      localLock.current = false;
      setPlayback({ ...playback, frameIndex: playback.result.frames.length - 1, animating: false });
    }
  });
  useEffect(() => {
    const subscription = AppState.addEventListener('change', onAppStateChange);
    return () => subscription.remove();
  }, []);

  const handleSpin = async () => {
    if (view.disabled || stopped || localLock.current) return;
    if (offline) {
      toast.error(OFFLINE_WRITE_MESSAGE);
      return;
    }
    if (view.actualStake === null) {
      toast.error(INVALID_STAKE_MESSAGE);
      return;
    }
    localLock.current = true;
    Keyboard.dismiss();
    playSlotTone('spin');
    const next = await spin(view.actualStake, freeSpins > 0);
    if (!mounted.current) return;
    if (!next) {
      setBonusPaused(true);
      localLock.current = false;
      haptics.error();
      return;
    }
    const foreground = AppState.currentState === 'active';
    setPlayback({ result: next, frameIndex: foreground ? 0 : next.frames.length - 1, animating: foreground });
    if (!foreground) localLock.current = false;
    setSession((previous) => addToSession(previous, next.net));
    if (foreground) {
      haptics.medium();
      if (next.net > 0) playSlotTone('win');
    }
  };

  const autoplay = shouldAutoplayBonus({
    freeSpins,
    paused: bonusPaused,
    stopped,
    disabled: view.disabled,
    pending: Boolean(pending),
    error: Boolean(error),
    stateReady: Boolean(state.data),
    stateError: state.isError,
    visible: focused && appActive && !offline,
  });
  const autoSpin = useEffectEvent(() => {
    if (AppState.currentState === 'active') void handleSpin();
  });
  useEffect(() => {
    if (!autoplay) return;
    const timer = setTimeout(autoSpin, BONUS_AUTOPLAY_DELAY);
    return () => clearTimeout(timer);
  }, [autoplay]);

  const toggleBonus = () => {
    haptics.selection();
    setBonusPaused((paused) => !paused);
    if (bonusPaused && (error || pending)) void handleSpin();
  };

  const machineWidth = Math.min(width - 24, 520);
  const boardWidth = machineWidth - 24;
  const boardHeight = Math.max(height <= 600 ? 160 : 180, Math.min(((width - 58) * 5) / 6, height - 450));
  const titleSize = Math.min(30, Math.max(24, width * 0.075));
  const step = result ? frameIndex + session.spins * 12 : 0;

  return (
    <KeyboardAwareScrollView
      style={look.page}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      bottomOffset={24}
    >
      <Atmosphere game={game} />

      <View style={styles.topline}>
        <Pressable accessibilityRole="link" onPress={goToLobby} hitSlop={10} style={styles.back}>
          <ArrowLeft size={17} color={theme.ink} />
          <Text style={[styles.backText, look.ink]}>Wszystkie gry</Text>
        </Pressable>
        <View style={styles.toplineActions}>
          <Pressable
            accessibilityRole="togglebutton"
            accessibilityLabel={sound ? 'Wyłącz dźwięk' : 'Włącz dźwięk'}
            accessibilityState={{ checked: sound }}
            hitSlop={4}
            onPress={() => {
              haptics.selection();
              usePreferences.getState().setCasinoSound(!sound);
            }}
            style={styles.iconButton}
          >
            {sound ? <AudioLines size={20} color={theme.ink} /> : <VolumeX size={20} color={theme.ink} />}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Zasady i wypłaty"
            hitSlop={4}
            onPress={() => router.push({ pathname: '/sheets/slot-rules', params: { game } })}
            style={[styles.iconButton, styles.rulesButton]}
          >
            <Info size={18} color={theme.ink} />
            <Text style={[styles.rulesText, look.ink]}>Zasady</Text>
          </Pressable>
        </View>
      </View>

      <Text
        accessibilityRole="header"
        style={[
          styles.title,
          { fontSize: titleSize, lineHeight: titleSize * 1.15, color: theme.title },
          theme.titleItalic && fauxItalic,
        ]}
      >
        {config.title}
      </Text>

      <View style={styles.layout}>
        <View accessibilityLabel={config.title} style={[styles.machine, look.machine, { width: machineWidth }]}>
          <View style={styles.machineTop}>
            <View style={styles.machineStat}>
              <Text style={[styles.statLabel, look.accent]}>{freeSpins > 0 ? 'DARMOWE OBROTY' : 'PLANSZA'}</Text>
              <Text style={styles.statValue}>{freeSpins > 0 ? freeSpins : '6 × 5'}</Text>
            </View>
            <Text style={styles.roundStatus}>{busy ? 'Losowanie…' : animating ? `Kaskada ${frameIndex + 1}` : ''}</Text>
            <View style={[styles.machineStat, styles.machineStatEnd]}>
              <Text style={[styles.statLabel, look.accent]}>MNOŻNIK</Text>
              <Text style={styles.statValue}>×{frame.multiplier}</Text>
            </View>
          </View>

          <SlotBoard
            game={game}
            frame={frame}
            spinning={busy}
            step={step}
            width={boardWidth}
            height={boardHeight}
            reducedMotion={reducedMotion}
            liteMotion={liteMotion}
          />

          {freeSpins > 0 ? (
            <View style={styles.bonusBar}>
              <Text style={styles.bonusText}>{bonusPaused ? 'Bonus wstrzymany' : 'Bonus gra automatycznie'}</Text>
              <Pressable
                accessibilityRole="button"
                disabled={stopped}
                onPress={toggleBonus}
                style={[styles.iconButton, styles.bonusButton, stopped && styles.disabled]}
              >
                <Text style={styles.bonusText}>{bonusPaused ? 'Wznów bonus' : 'Pauza bonusu'}</Text>
              </Pressable>
            </View>
          ) : null}

          <View accessibilityRole="summary" accessibilityLiveRegion="polite" style={styles.result}>
            {busy ? (
              <Text style={[styles.resultLabel, height <= 600 && styles.resultLabelSmall]}>Losowanie…</Text>
            ) : animating ? (
              <>
                <Text style={[styles.resultLabel, height <= 600 && styles.resultLabelSmall]}>Wypłata kaskady</Text>
                <Text style={[styles.resultValue, look.ink]}>{money(frame.payout)}</Text>
              </>
            ) : result ? (
              <>
                <Text style={[styles.resultLabel, height <= 600 && styles.resultLabelSmall]}>
                  {resultLabel(result.net)} netto · wypłata {money(result.payout)}
                </Text>
                <Text style={[styles.resultValue, look.ink, TONE_STYLES[netTone(result.net)]]}>{signedMoney(result.net)}</Text>
                {result.luckyShot ? <Text style={[styles.resultNote, look.accent]}>Lucky shot · wypłata ×200</Text> : null}
                {result.awardedFreeSpins > 0 ? (
                  <Text style={[styles.resultNote, look.accent]}>+{result.awardedFreeSpins} darmowych obrotów</Text>
                ) : null}
              </>
            ) : (
              <Text style={[styles.resultLabel, height <= 600 && styles.resultLabelSmall]}>{config.rule}</Text>
            )}
          </View>

          <View style={styles.controls}>
            <View style={styles.stake}>
              <Text style={styles.stakeLabel}>STAWKA</Text>
              <View style={styles.stakeRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Zmniejsz stawkę"
                  disabled={!view.canDecrease}
                  hitSlop={7}
                  onPress={() => {
                    haptics.selection();
                    setStakeInput(steppedStake(view.parsedStake, -1));
                  }}
                  style={[styles.stakeButton, !view.canDecrease && styles.disabled]}
                >
                  <Minus size={16} color={theme.ink} />
                </Pressable>
                <TextInput
                  accessibilityLabel="STAWKA"
                  value={view.stakeText}
                  onChangeText={setStakeInput}
                  editable={!view.stakeLocked}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  keyboardAppearance="dark"
                  maxFontSizeMultiplier={1.35}
                  style={[styles.stakeInput, look.ink, view.stakeInputInvalid && styles.negative]}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Zwiększ stawkę"
                  disabled={!view.canIncrease}
                  hitSlop={7}
                  onPress={() => {
                    haptics.selection();
                    setStakeInput(steppedStake(view.parsedStake, 1));
                  }}
                  style={[styles.stakeButton, !view.canIncrease && styles.disabled]}
                >
                  <Plus size={16} color={theme.ink} />
                </Pressable>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={view.spinLabel}
              accessibilityState={{ disabled: !view.canSpin, busy }}
              disabled={!view.canSpin}
              onPress={() => void handleSpin()}
              style={({ pressed }) => [styles.spin, look.spin, pressed && styles.spinPressed, !view.canSpin && styles.disabled]}
            >
              <SpinIcon busy={busy} color={theme.spinInk} />
              <Text style={[styles.spinText, look.spinText]}>{view.spinLabel}</Text>
            </Pressable>
          </View>

          <View style={styles.wallet}>
            <View style={styles.walletItem}>
              <Text style={styles.walletLabel}>Saldo</Text>
              <Text style={styles.walletValue}>{money(balance)}</Text>
            </View>
            <View style={styles.walletItem}>
              <Text style={styles.walletLabel}>Koszt obrotu</Text>
              <Text style={styles.walletValue}>{money(view.spinCost)}</Text>
            </View>
          </View>
          {offline ? (
            <Text accessibilityRole="alert" style={[styles.offline, look.ink]}>
              {OFFLINE_WRITE_MESSAGE}
            </Text>
          ) : null}
        </View>

        <View style={[styles.session, { width: machineWidth }]}>
          <View style={styles.sessionTop}>
            <View style={styles.sessionSummary}>
              <View style={styles.sessionHeading}>
                <History size={16} color={SLOT_COLORS.muted} />
                <Text style={styles.sessionHeadingText}>TA SESJA</Text>
              </View>
              <Text style={[styles.sessionNet, look.ink, TONE_STYLES[netTone(session.net)]]}>{signedMoney(session.net)}</Text>
              <Text style={styles.sessionNote}>Bilans netto · {session.spins} obrotów</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={view.disabled || stopped}
              onPress={() => {
                haptics.selection();
                setStopped(true);
              }}
              style={[styles.stop, (view.disabled || stopped) && styles.disabled]}
            >
              <Text style={[styles.stopText, look.ink]}>{stopped ? 'Sesja zakończona' : 'Zakończ sesję'}</Text>
            </Pressable>
          </View>
          {stopped ? (
            <View accessibilityRole="summary" style={styles.sessionEnded}>
              <Text accessibilityRole="link" onPress={goToLobby} style={[styles.sessionEndedLink, look.accent]}>
                Wróć do lobby
              </Text>
            </View>
          ) : null}
          <View style={styles.history}>
            <Text style={styles.historyTitle}>Ostatnie obroty</Text>
            {history.length === 0 ? (
              <Text style={styles.historyEmpty}>Brak obrotów</Text>
            ) : (
              history.slice(0, 3).map((item) => (
                <View key={item.id} style={styles.historyRow}>
                  <Text style={[styles.historyStake, look.ink]}>
                    {item.charged === 0 ? 'Darmowy' : `Stawka ${money(item.stake)}`}
                  </Text>
                  <Text style={[styles.historyNet, look.ink, TONE_STYLES[netTone(item.net)]]}>{signedMoney(item.net)}</Text>
                </View>
              ))
            )}
          </View>
        </View>
      </View>

      {state.isPending ? (
        <Text accessibilityRole="progressbar" style={[styles.message, look.ink]}>
          Ładowanie…
        </Text>
      ) : null}
      {state.isError ? (
        <Text accessibilityRole="alert" style={[styles.message, look.ink]}>
          Nie udało się wczytać gry.{' '}
          <Text accessibilityRole="button" onPress={() => void state.refetch()} style={[styles.messageAction, look.ink]}>
            Spróbuj ponownie
          </Text>
        </Text>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={[styles.message, look.ink]}>
          {error}
        </Text>
      ) : null}
    </KeyboardAwareScrollView>
  );
}

/** `.slots-atmosphere`: the game art behind the page with its fade. */
function Atmosphere({ game }: { game: SlotGame }) {
  const styles = useStyles();
  const theme = SLOT_THEMES[game];
  return (
    <View pointerEvents="none" style={theme.atmosphere === 'top' ? styles.atmosphereTop : styles.atmosphereCover}>
      <Image source={SLOT_ART[game]} contentFit="cover" contentPosition="top center" style={styles.fill} />
      <View style={[styles.fill, { backgroundImage: theme.atmosphereGradient }]} />
    </View>
  );
}

/** Spin button icon; spins while the server draws (Tailwind `animate-spin`). */
function SpinIcon({ busy, color }: { busy: boolean; color: string }) {
  const rotation = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(rotation);
    rotation.set(0);
    if (!busy) return;
    rotation.set(withRepeat(withTiming(360, { duration: 1000, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(rotation);
  }, [busy, rotation]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.get()}deg` }] }));
  return (
    <Animated.View style={style}>
      <RotateCw size={24} color={color} />
    </Animated.View>
  );
}

const TONE_STYLES: Record<NetTone, TextStyle | undefined> = {
  positive: { color: SLOT_COLORS.positive },
  negative: { color: SLOT_COLORS.negative },
  neutral: undefined,
};

interface GameStyles {
  page: ViewStyle;
  ink: TextStyle;
  accent: TextStyle;
  machine: ViewStyle;
  spin: ViewStyle;
  spinText: TextStyle;
}

/** Per-game colors, built once (slots look the same in both app themes). */
const GAME_STYLES = Object.fromEntries(
  SLOT_GAME_IDS.map((id) => {
    const theme = SLOT_THEMES[id];
    const styles: GameStyles = {
      page: { flex: 1, backgroundColor: theme.page },
      ink: { color: theme.ink },
      accent: { color: theme.accent },
      machine: { backgroundImage: theme.machineBackground, borderColor: theme.machineBorder, boxShadow: theme.machineShadow },
      spin: {
        backgroundImage: theme.spinBackground,
        borderColor: theme.spinBorder,
        boxShadow: theme.spinShadow,
      },
      spinText: { color: theme.spinInk },
    };
    return [id, styles];
  }),
) as Record<SlotGame, GameStyles>;

const SERIF = Platform.select({ ios: 'Georgia', default: 'serif' });

const useStyles = createStyles(() => ({
  content: { flexGrow: 1, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 32 },
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  atmosphereTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 850 },
  atmosphereCover: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  unknown: { padding: 32 },
  unknownText: { fontSize: 16, lineHeight: 24, color: '#ffffff' },
  topline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 2,
  },
  back: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36 },
  backText: { fontSize: 12, lineHeight: 18 },
  toplineActions: { flexDirection: 'row', gap: 8 },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: SLOT_COLORS.iconBorder,
    backgroundColor: SLOT_COLORS.iconBackground,
  },
  rulesButton: { width: 'auto', flexDirection: 'row', gap: 6, paddingHorizontal: 12, borderRadius: 999 },
  rulesText: { fontSize: 12, lineHeight: 18, letterSpacing: 1.4 },
  title: {
    marginTop: 7,
    marginBottom: 15,
    textAlign: 'center',
    fontFamily: SERIF,
    fontWeight: '900',
    letterSpacing: -1.8,
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 18,
  },
  layout: { alignItems: 'center', gap: 24 },
  machine: { borderRadius: 20, borderWidth: 2, padding: 10 },
  machineTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
    paddingHorizontal: 4,
    paddingBottom: 7,
  },
  machineStat: { gap: 3 },
  machineStatEnd: { alignItems: 'flex-end' },
  statLabel: { fontSize: 8, lineHeight: 12, letterSpacing: 1.2 },
  statValue: { fontSize: 17, lineHeight: 25, fontWeight: '700', color: '#ffffff', fontVariant: ['tabular-nums'] },
  roundStatus: { fontSize: 12, lineHeight: 18, color: SLOT_COLORS.muted },
  bonusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bonusText: { fontSize: 14, lineHeight: 20, color: SLOT_COLORS.amber300 },
  bonusButton: { width: 'auto', paddingHorizontal: 12, borderRadius: 999 },
  result: { minHeight: 55, alignItems: 'center', justifyContent: 'center', paddingVertical: 7, paddingHorizontal: 4 },
  resultLabel: { fontSize: 10, lineHeight: 15, color: SLOT_COLORS.muted, textAlign: 'center' },
  resultLabelSmall: { fontSize: 9, lineHeight: 13.5 },
  resultValue: { fontSize: 20, lineHeight: 27, fontWeight: '700', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  resultNote: { fontSize: 11, lineHeight: 16.5, textAlign: 'center' },
  controls: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  stake: {
    flex: 1,
    minWidth: 0,
    padding: 5,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: SLOT_COLORS.iconBorder,
    backgroundColor: SLOT_COLORS.panelBackground,
  },
  stakeLabel: { fontSize: 8, lineHeight: 12, letterSpacing: 1.5, color: SLOT_COLORS.dim, textAlign: 'center' },
  stakeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stakeButton: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  stakeInput: {
    width: 45,
    padding: 0,
    textAlign: 'center',
    fontFamily: 'Inter',
    fontSize: 18,
    fontWeight: '800',
  },
  negative: { color: SLOT_COLORS.negative },
  spin: {
    flex: 1.4,
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  spinPressed: { transform: [{ translateY: 3 }] },
  spinText: { fontSize: 11, lineHeight: 16.5, fontWeight: '900', letterSpacing: 0.6 },
  disabled: { opacity: 0.45 },
  wallet: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    paddingTop: 13,
    paddingHorizontal: 2,
    paddingBottom: 2,
  },
  walletItem: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  walletLabel: { fontSize: 9, lineHeight: 13.5, color: SLOT_COLORS.dim },
  walletValue: { fontSize: 11, lineHeight: 16.5, fontWeight: '700', color: '#ffffff', fontVariant: ['tabular-nums'] },
  offline: { fontSize: 11, lineHeight: 16.5, textAlign: 'center', paddingTop: 8 },
  session: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: SLOT_COLORS.sessionBorder,
    backgroundColor: SLOT_COLORS.panelBackground,
  },
  sessionTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  sessionSummary: { flex: 1 },
  sessionHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sessionHeadingText: { fontSize: 9, lineHeight: 13.5, letterSpacing: 1.5, color: SLOT_COLORS.muted },
  sessionNet: { marginTop: 6, fontSize: 25, lineHeight: 37.5, fontWeight: '700', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  sessionNote: { fontSize: 10, lineHeight: 17, color: SLOT_COLORS.muted },
  stop: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: SLOT_COLORS.stopBorder },
  stopText: { fontSize: 12, lineHeight: 18 },
  sessionEnded: { paddingTop: 12 },
  sessionEndedLink: { fontSize: 12, lineHeight: 19.2, textDecorationLine: 'underline' },
  history: { marginTop: 18 },
  historyTitle: { fontSize: 11, lineHeight: 16.5, color: SLOT_COLORS.dim, marginBottom: 10 },
  historyEmpty: { fontSize: 12, lineHeight: 20.4, color: SLOT_COLORS.muted },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: SLOT_COLORS.historyDivider,
  },
  historyStake: { fontSize: 10, lineHeight: 15 },
  historyNet: { fontSize: 12, lineHeight: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  message: { marginVertical: 20, textAlign: 'center', fontSize: 13, lineHeight: 19.5 },
  messageAction: { fontSize: 13, lineHeight: 19.5, textDecorationLine: 'underline' },
}));
