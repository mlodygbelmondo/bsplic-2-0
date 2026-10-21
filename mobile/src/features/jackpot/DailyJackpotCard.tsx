import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ArrowRight, Clock3, Info, Ticket, Users } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { OFFLINE_WRITE_MESSAGE, useIsOffline } from '@/lib/connectivity';
import { haptics } from '@/lib/haptics';
import { useLiteMotion } from '@/lib/motion';
import { createStyles, hsl } from '@/theme';
import { PressScale, Skeleton, Text } from '@/ui';

import { JACKPOT_PRIZES_IMAGE } from './assets';
import { JackpotBuyModal } from './components/JackpotBuyModal';
import { JackpotInfoDialog } from './components/JackpotInfoDialog';
import { SpinningLoader } from './components/SpinningLoader';
import { useDailyJackpot } from './hooks/useDailyJackpot';
import { getCountdownMs, getDailyJackpotCardModel } from './lib/cardModel';
import {
  formatCountdown,
  formatJackpotAmount,
  formatJackpotHeroAmount,
  getDrawTimeLabel,
} from './lib/jackpotFormat';

const REM = 16;
const INFO_TITLE = 'Skąd bierze się Jackpot?';

const HOT_TEXT = hsl(24, 14, 8);
const DISABLED_TEXT = hsl(0, 0, 100, 0.82);
const STAT_ICON = hsl(48, 100, 57);
const STATE_TEXT = hsl(0, 0, 96);

/**
 * Daily jackpot card at the top of the sportsbook list (web `DailyJackpotCard`
 * + `useDailyJackpot`, phone layout of `dailyJackpotCard.css`). Owns its data.
 */
export function DailyJackpotCard() {
  const styles = useStyles();
  const { snapshot, receivedAt, loading, buying, balance, active, buyTickets, prefetchDraw } = useDailyJackpot();
  const offline = useIsOffline();
  const collecting = snapshot?.status === 'collecting';
  const now = useSecondTicker(collecting && active, receivedAt);
  const [buyModalOpen, setBuyModalOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  if (loading && !snapshot) {
    return (
      <View style={styles.skeletonCard}>
        <Skeleton width={8 * REM} height={1.25 * REM} radius={4} />
        <Skeleton width={11 * REM} height={2 * REM} radius={4} style={styles.skeletonAmount} />
      </View>
    );
  }

  if (!snapshot?.poolId) return null;

  const poolId = snapshot.poolId;
  const model = getDailyJackpotCardModel(snapshot, balance, buying);
  const blockedOffline = offline && model.canBuy && !model.actionIsDraw;
  const actionEnabled = model.actionEnabled && !blockedOffline;
  const countdownMs = getCountdownMs(snapshot, receivedAt, now);
  const countdownLabel = countdownMs === null ? '00:00:00' : formatCountdown(countdownMs);
  const buttonLabel = blockedOffline ? OFFLINE_WRITE_MESSAGE : model.buttonLabel;
  const buttonTextColor = actionEnabled ? HOT_TEXT : DISABLED_TEXT;

  const handlePrimaryAction = () => {
    if (model.actionIsDraw) {
      haptics.selection();
      router.push({ pathname: '/jackpot/draw/[roundId]', params: { roundId: poolId } });
      return;
    }
    // Purchases are confirmed in a dialog before anything is charged.
    if (model.canBuy && !offline) {
      haptics.selection();
      setBuyModalOpen(true);
    }
  };

  const ticketsAccessibility =
    model.userTicketCount > 0 ? `Masz ${model.userTicketCount}/${snapshot.maxTicketsPerPlayer} ticketów` : undefined;

  return (
    <View style={styles.card} accessibilityLabel="Jackpot Dnia">
      <View pointerEvents="none" style={styles.stripes} />
      <View pointerEvents="none" style={styles.shine} />
      <Embers />
      <FloatingArt />

      <View style={styles.copy}>
        <View style={styles.amountHeading}>
          <Text style={styles.amountLabel}>Pula</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={INFO_TITLE}
            hitSlop={13}
            onPress={() => {
              haptics.selection();
              setInfoOpen(true);
            }}
            style={({ pressed }) => [styles.infoTrigger, pressed && styles.infoTriggerPressed]}
          >
            <Info size={0.75 * REM} color={hsl(0, 0, 86)} />
          </Pressable>
        </View>
        <Text
          style={styles.amount}
          accessibilityLabel={`${formatJackpotHeroAmount(snapshot.prizeAmount)} Jackpot Dnia. ${formatJackpotAmount(snapshot.prizeAmount)}. Minimum ${snapshot.minUniqueUsers} graczy`}
        >
          {formatJackpotHeroAmount(snapshot.prizeAmount)}
        </Text>
      </View>

      <View
        style={styles.state}
        accessibilityLiveRegion="polite"
        accessible
        accessibilityLabel={collecting ? `${getDrawTimeLabel(snapshot.drawScheduledAt, snapshot.serverNow)}, ${countdownLabel}` : model.statusLabel}
      >
        <Clock3 size={0.9 * REM} color={STATE_TEXT} style={styles.stateIcon} />
        {collecting ? (
          <Text style={styles.countdown}>{countdownLabel}</Text>
        ) : (
          <Text style={styles.stateLabel} numberOfLines={1}>
            {model.statusLabel}
          </Text>
        )}
      </View>

      <View style={styles.stats} accessibilityLabel="Dane jackpotu">
        <Stat icon={<Ticket size={0.78 * REM} color={STAT_ICON} />} label="Cena" value={formatJackpotHeroAmount(snapshot.ticketPrice)} />
        <Stat
          icon={<Users size={0.78 * REM} color={STAT_ICON} />}
          label="Twoje tickety"
          value={model.currentUserTicketLabel ?? `${model.userTicketCount} / ${snapshot.maxTicketsPerPlayer}`}
          accessibilityHint={ticketsAccessibility}
        />
        <Stat icon={<Ticket size={0.78 * REM} color={STAT_ICON} />} label="Limit" value={`Maks. ${snapshot.maxTicketsPerPlayer}`} last />
      </View>

      {snapshot.status === 'rolled_over' ? (
        <Text style={styles.note}>Za mało uczestników. Ticket zwrócony, pula przechodzi na jutro.</Text>
      ) : null}

      <PressScale
        scaleTo={0.97}
        accessibilityRole="button"
        accessibilityLabel={model.ticketLimitReached ? `${buttonLabel} ${model.legacyLimitLabel}` : buttonLabel}
        accessibilityState={{ disabled: !actionEnabled, busy: buying }}
        disabled={!actionEnabled}
        onPressIn={model.actionIsDraw ? () => prefetchDraw(poolId) : undefined}
        onPress={handlePrimaryAction}
        style={[styles.button, actionEnabled ? styles.buttonHot : styles.buttonDisabled]}
      >
        {buying && !model.actionIsDraw ? <SpinningLoader size={REM} color={buttonTextColor} /> : null}
        <Text style={[styles.buttonText, { color: buttonTextColor }]} numberOfLines={1}>
          {buttonLabel}
        </Text>
        {model.actionIsDraw ? <ArrowRight size={REM} color={buttonTextColor} /> : null}
      </PressScale>

      <JackpotInfoDialog open={infoOpen} onClose={() => setInfoOpen(false)} />
      <JackpotBuyModal
        open={buyModalOpen}
        onOpenChange={setBuyModalOpen}
        ticketPrice={snapshot.ticketPrice}
        prizeAmount={snapshot.prizeAmount}
        balance={balance}
        currentTicketCount={model.userTicketCount}
        maxTicketsPerPlayer={snapshot.maxTicketsPerPlayer}
        minUniqueUsers={snapshot.minUniqueUsers}
        drawTimeLabel={getDrawTimeLabel(snapshot.drawScheduledAt, snapshot.serverNow)}
        buying={buying}
        offline={offline}
        onConfirm={buyTickets}
      />
    </View>
  );
}

function Stat({
  icon,
  label,
  value,
  last,
  accessibilityHint,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  last?: boolean;
  accessibilityHint?: string;
}) {
  const styles = useStyles();
  return (
    <View style={[styles.stat, last && styles.statLast]} accessible accessibilityLabel={`${label} ${value}`} accessibilityHint={accessibilityHint}>
      <View style={styles.statIcon}>
        <View pointerEvents="none" style={styles.statIconGlow} />
        {icon}
      </View>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

/** Re-renders on every whole second since `receivedAt` while enabled (the countdown is data, not motion). */
function useSecondTicker(enabled: boolean, receivedAt: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      const intoSecond = (((current - receivedAt) % 1000) + 1000) % 1000;
      timer = setTimeout(tick, 1000 - intoSecond + 8);
    };
    timer = setTimeout(tick, 0);
    return () => clearTimeout(timer);
  }, [enabled, receivedAt]);
  return now;
}

/** `.daily-jackpot-card__embers`: two dot grids drifting -5rem/3rem over 18 s. */
function Embers() {
  const styles = useStyles();
  const lite = useLiteMotion();
  const drift = useSharedValue(0);

  useEffect(() => {
    if (lite) {
      cancelAnimation(drift);
      drift.set(0);
      return;
    }
    drift.set(0);
    drift.set(withRepeat(withTiming(1, { duration: 18_000, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(drift);
  }, [lite, drift]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -5 * REM * drift.get() }, { translateY: 3 * REM * drift.get() }],
  }));

  return <Animated.View pointerEvents="none" style={[styles.embers, animatedStyle]} />;
}

/** `.daily-jackpot-card__art`: prize artwork floating 0.6rem up with a 1.2° tilt every 5.5 s. */
function FloatingArt() {
  const styles = useStyles();
  const lite = useLiteMotion();
  const float = useSharedValue(0);

  useEffect(() => {
    if (lite) {
      cancelAnimation(float);
      float.set(0);
      return;
    }
    float.set(withRepeat(withTiming(1, { duration: 2750, easing: Easing.bezier(0.42, 0, 0.58, 1) }), -1, true));
    return () => cancelAnimation(float);
  }, [lite, float]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -0.6 * REM * float.get() }, { rotate: `${1.2 * float.get()}deg` }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.art, animatedStyle]}>
      <Image source={JACKPOT_PRIZES_IMAGE} style={styles.artImage} contentFit="contain" accessible={false} />
    </Animated.View>
  );
}

const fade = (h: number, s: number, l: number) => hsl(h, s, l, 0);

const useStyles = createStyles(({ colors }) => ({
  skeletonCard: {
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 16,
    boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)',
  },
  skeletonAmount: { marginTop: 12 },
  card: {
    position: 'relative',
    height: 12.1 * REM,
    marginBottom: REM,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: hsl(0, 84, 52, 0.64),
    borderRadius: 0.75 * REM,
    paddingVertical: 0.9 * REM,
    paddingHorizontal: REM,
    backgroundImage: [
      `radial-gradient(${56 * REM}px ${24 * REM}px at 74% 44%, ${hsl(18, 100, 45, 0.3)}, ${fade(18, 100, 45)} 62%)`,
      `radial-gradient(${24 * REM}px ${14 * REM}px at 12% 5%, ${hsl(0, 92, 45, 0.34)}, ${fade(0, 92, 45)} 58%)`,
      `linear-gradient(110deg, ${hsl(0, 0, 1)}, ${hsl(350, 82, 4)} 56%, ${hsl(0, 0, 1)})`,
    ].join(', '),
    boxShadow: `inset 0px 1px 0px ${hsl(0, 0, 100, 0.09)}, inset 0px 0px 50px ${hsl(0, 92, 50, 0.16)}`,
  },
  stripes: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage: [
      `linear-gradient(110deg, ${fade(0, 91, 54)} 40%, ${hsl(0, 91, 54, 0.3)} 41%, ${fade(0, 91, 54)} 43%)`,
      `linear-gradient(145deg, ${fade(43, 100, 54)} 72%, ${hsl(43, 100, 54, 0.24)} 73%, ${fade(43, 100, 54)} 75%)`,
    ].join(', '),
    backgroundSize: `${10 * REM}px ${5.8 * REM}px, ${8 * REM}px ${4.8 * REM}px`,
    backgroundRepeat: 'repeat',
    opacity: 0.2,
    mixBlendMode: 'screen',
  },
  shine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage: [
      `linear-gradient(90deg, ${hsl(0, 0, 100, 0.04)}, ${fade(0, 0, 100)} 34%)`,
      `radial-gradient(${22 * REM}px ${14 * REM}px at 82% 30%, ${hsl(44, 100, 58, 0.22)}, ${fade(44, 100, 58)} 70%)`,
    ].join(', '),
  },
  embers: {
    position: 'absolute',
    top: '-10%',
    left: '-10%',
    right: '-10%',
    bottom: '-10%',
    backgroundImage: [
      `radial-gradient(circle, ${hsl(0, 98, 58, 0.9)} 0px 2px, ${fade(0, 98, 58)} 3px)`,
      `radial-gradient(circle, ${hsl(38, 100, 57, 0.85)} 0px 1.5px, ${fade(38, 100, 57)} 2px)`,
    ].join(', '),
    backgroundPosition: '8% 22%, 72% 16%',
    backgroundSize: `${8 * REM}px ${5 * REM}px, ${11 * REM}px ${7 * REM}px`,
    backgroundRepeat: 'repeat',
    opacity: 0.34,
  },
  copy: { position: 'relative', zIndex: 2, maxWidth: '64%' },
  // Inline-flex heading on a 1.5 line box: the row sits 5.7 px below the line top.
  amountHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 0.25 * REM,
    marginTop: 5.7,
    marginBottom: 0.7,
  },
  amountLabel: {
    color: hsl(0, 0, 82),
    fontSize: 0.56 * REM,
    lineHeight: 0.56 * REM,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  infoTrigger: {
    width: 1.1 * REM,
    height: 1.1 * REM,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: hsl(0, 0, 82, 0.34),
    borderRadius: 999,
  },
  infoTriggerPressed: { borderColor: hsl(0, 0, 88, 0.48), backgroundColor: hsl(0, 0, 100, 0.06) },
  amount: {
    marginTop: 0.18 * REM,
    color: hsl(0, 0, 98),
    fontSize: 2 * REM,
    lineHeight: 2 * REM * 0.95,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  state: {
    position: 'absolute',
    top: 0.92 * REM,
    right: 0.82 * REM,
    zIndex: 3,
    height: 1.56 * REM,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0.38 * REM,
    paddingHorizontal: 0.48 * REM,
    borderWidth: 1,
    borderColor: hsl(0, 95, 64, 0.72),
    borderRadius: 999,
    backgroundColor: hsl(0, 0, 3, 0.78),
    boxShadow: `inset 0px 1px 0px ${hsl(0, 0, 100, 0.08)}`,
  },
  stateIcon: { transform: [{ translateY: -0.5 }] },
  countdown: {
    color: STATE_TEXT,
    fontSize: 0.66 * REM,
    lineHeight: 0.66 * REM * 1.2,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  stateLabel: {
    color: STATE_TEXT,
    fontSize: 0.64 * REM,
    lineHeight: 0.64 * REM * 1.2,
    fontWeight: '700',
  },
  art: {
    position: 'absolute',
    right: -2.6 * REM,
    top: 3.15 * REM,
    zIndex: 1,
    width: '66%',
    height: 5.8 * REM,
    opacity: 0.46,
  },
  artImage: { width: '100%', height: '100%' },
  stats: {
    position: 'absolute',
    left: REM,
    right: REM,
    bottom: 3.28 * REM,
    zIndex: 3,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: hsl(0, 0, 100, 0.18),
    borderRadius: 0.75 * REM,
    backgroundColor: hsl(0, 0, 4, 0.55),
  },
  stat: {
    flex: 1,
    minHeight: 2.42 * REM,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0.08 * REM,
    paddingVertical: 0.25 * REM,
    paddingHorizontal: 0.26 * REM,
    borderRightWidth: 1,
    borderRightColor: hsl(0, 0, 100, 0.12),
  },
  statLast: { borderRightWidth: 0 },
  statIcon: { width: 0.78 * REM, height: 0.78 * REM, alignItems: 'center', justifyContent: 'center' },
  // drop-shadow(0 0 8px hsl(43 100% 55% / 0.36)) around the icon.
  statIconGlow: {
    position: 'absolute',
    width: 0.78 * REM + 16,
    height: 0.78 * REM + 16,
    backgroundImage: `radial-gradient(circle closest-side, ${hsl(43, 100, 55, 0.26)}, ${fade(43, 100, 55)})`,
  },
  statLabel: {
    color: hsl(0, 0, 91),
    fontSize: 0.46 * REM,
    lineHeight: 0.46 * REM * 1.15,
    fontWeight: '700',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  statValue: {
    color: hsl(0, 0, 100),
    fontSize: 0.66 * REM,
    lineHeight: 0.66 * REM * 1.12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  note: {
    position: 'absolute',
    left: 2 * REM,
    right: 0,
    bottom: 0.55 * REM,
    zIndex: 5,
    color: hsl(43, 100, 82),
    fontSize: 0.82 * REM,
    lineHeight: 0.82 * REM * 1.5,
    fontWeight: '800',
  },
  button: {
    position: 'absolute',
    left: REM,
    right: REM,
    bottom: 0.58 * REM,
    zIndex: 4,
    minHeight: 2.2 * REM,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0.48 * REM,
    borderRadius: 0.6 * REM,
    paddingVertical: 0.55 * REM,
    paddingHorizontal: 0.85 * REM,
  },
  buttonHot: {
    backgroundImage: `linear-gradient(180deg, ${hsl(43, 100, 60)}, ${hsl(32, 100, 50)})`,
    boxShadow: `inset 0px 1px 0px ${hsl(0, 0, 100, 0.35)}`,
  },
  // shadcn `disabled:opacity-50` stays on top of the custom disabled colors.
  buttonDisabled: {
    backgroundColor: hsl(0, 0, 100, 0.24),
    boxShadow: `inset 0px 1px 0px ${hsl(0, 0, 100, 0.08)}`,
    opacity: 0.5,
  },
  // `text-sm` keeps its 1.25rem line height under the custom font size.
  buttonText: { fontSize: 0.78 * REM, lineHeight: 1.25 * REM, fontWeight: '800' },
}));
