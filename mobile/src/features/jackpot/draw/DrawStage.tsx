import { CheckCircle2, Gift, Play, RotateCcw } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { hsl } from '@/theme';
import { PressScale, Text } from '@/ui';

import { SpinningLoader } from '../components/SpinningLoader';
import { getPoolTicketNumbers, getStartButtonLabel, getWinnerTicketLabel, type ReplayPhase } from '../lib/drawModel';
import type { DailyJackpotDraw } from '../types';
import { CylinderStage } from './CylinderStage';
import { DRAW_COLORS, fade, REM } from './tokens';

const STAGE_PADDING = 0.65 * REM;
const REPLAY_TEXT = hsl(0, 0, 78);
const REPLAY_TEXT_PRESSED = hsl(0, 0, 96);

interface DrawStageProps {
  draw: DailyJackpotDraw;
  phase: ReplayPhase;
  /** Width of `.jackpot-draw-stage` (the shell content width). */
  width: number;
  prizeLabel: string;
  canClaim: boolean;
  claiming: boolean;
  /** Offline: the claim button is disabled and says so. */
  claimBlockedLabel: string | null;
  rewardStateLabel: string | null;
  reducedMotion: boolean;
  lite: boolean;
  onStart: () => void;
  onClaim: () => void;
}

/** `.jackpot-draw-stage--cylinder`: title, ticket drum, result and the replay actions. */
export function DrawStage({
  draw,
  phase,
  width,
  prizeLabel,
  canClaim,
  claiming,
  claimBlockedLabel,
  rewardStateLabel,
  reducedMotion,
  lite,
  onStart,
  onClaim,
}: DrawStageProps) {
  const revealed = phase === 'revealed';
  const claimDisabled = claiming || claimBlockedLabel !== null;
  const claimLabel = claimBlockedLabel ?? 'Odbierz nagrodę';

  return (
    <View style={styles.stage} accessibilityLiveRegion="polite">
      <View style={styles.title} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text style={styles.titleMark}>◆</Text>
        <Text style={styles.titleText}>Tickety w puli</Text>
        <Text style={styles.titleMark}>◆</Text>
      </View>

      <CylinderStage
        phase={phase}
        ticketNumbers={getPoolTicketNumbers(draw)}
        winningTicketNumber={draw.winningTicketNumber}
        winnerTicketLabel={getWinnerTicketLabel(draw.winningTicketNumber)}
        width={width - 2 - STAGE_PADDING * 2}
        reducedMotion={reducedMotion}
        lite={lite}
      />

      {revealed ? (
        <StageResult winnerName={draw.winnerUsername ?? 'zwycięzca'} prizeLabel={prizeLabel} reducedMotion={reducedMotion} />
      ) : null}

      <View style={styles.actions}>
        {phase === 'intro' ? (
          <PressScale
            scaleTo={0.97}
            accessibilityRole="button"
            onPress={onStart}
            style={[styles.action, styles.primary]}
          >
            <Play size={REM} color={hsl(0, 0, 100)} />
            <Text style={styles.primaryText}>{getStartButtonLabel(draw)}</Text>
          </PressScale>
        ) : null}

        {phase === 'drawing' ? (
          <View style={[styles.action, styles.status]} accessibilityRole="progressbar" accessibilityLabel="Losowanie trwa">
            <SpinningLoader size={REM} color={DRAW_COLORS.goldSoft} />
            <Text style={styles.statusText}>Losowanie trwa</Text>
          </View>
        ) : null}

        {revealed && canClaim ? (
          <PressScale
            scaleTo={0.97}
            accessibilityRole="button"
            accessibilityLabel={claimLabel}
            accessibilityState={{ disabled: claimDisabled, busy: claiming }}
            disabled={claimDisabled}
            onPress={onClaim}
            style={[styles.claim, claimDisabled && styles.disabled]}
          >
            {claiming ? (
              <SpinningLoader size={REM} color={DRAW_COLORS.hotText} />
            ) : (
              <Gift size={REM} color={DRAW_COLORS.hotText} />
            )}
            <Text style={styles.claimText}>{claimLabel}</Text>
          </PressScale>
        ) : null}

        {revealed && rewardStateLabel ? (
          <View style={[styles.action, styles.status]}>
            <CheckCircle2 size={REM} color={DRAW_COLORS.goldSoft} />
            <Text style={styles.statusText}>{rewardStateLabel}</Text>
          </View>
        ) : null}

        {revealed ? (
          <Pressable
            accessibilityRole="button"
            onPress={onStart}
            style={({ pressed }) => [styles.replay, pressed && styles.replayPressed]}
          >
            {({ pressed }) => (
              <>
                <RotateCcw size={REM} color={pressed ? REPLAY_TEXT_PRESSED : REPLAY_TEXT} />
                <Text style={[styles.replayText, pressed && styles.replayTextPressed]}>Obejrzyj ponownie</Text>
              </>
            )}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** `.jackpot-stage-result`: who won and how much (280 ms fade). */
function StageResult({
  winnerName,
  prizeLabel,
  reducedMotion,
}: {
  winnerName: string;
  prizeLabel: string;
  reducedMotion: boolean;
}) {
  const opacity = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) return;
    opacity.set(withTiming(1, { duration: 280, easing: Easing.bezier(0, 0, 0.58, 1) }));
  }, [reducedMotion, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <Animated.View style={[styles.result, style]}>
      <Text style={styles.resultTitle} accessibilityRole="header">
        Wygrywa {winnerName}
      </Text>
      <Text style={styles.resultPrize}>
        Wygrana <Text style={styles.resultAmount}>{prizeLabel}</Text>
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stage: {
    minHeight: 18 * REM,
    gap: 0.85 * REM,
    padding: STAGE_PADDING,
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
  title: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 0.7 * REM },
  titleMark: { color: hsl(39, 100, 58), fontSize: 0.75 * REM, lineHeight: 0.75 * REM * 1.5 },
  titleText: {
    color: hsl(39, 100, 66),
    fontSize: 0.68 * REM,
    lineHeight: 0.68 * REM * 1.5,
    fontWeight: '800',
    letterSpacing: 0.12 * 0.68 * REM,
    textTransform: 'uppercase',
  },
  result: { alignItems: 'center', gap: 0.2 * REM },
  resultTitle: {
    color: DRAW_COLORS.heading,
    fontSize: 1.05 * REM,
    lineHeight: 1.05 * REM * 1.15,
    fontWeight: '900',
    textAlign: 'center',
  },
  resultPrize: {
    color: hsl(0, 0, 74),
    fontSize: 0.8 * REM,
    lineHeight: 0.8 * REM * 1.5,
    fontWeight: '800',
    textAlign: 'center',
  },
  resultAmount: { color: hsl(43, 100, 62), fontWeight: '900' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 0.65 * REM },
  action: {
    width: '100%',
    minHeight: 2.7 * REM,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0.55 * REM,
    borderRadius: 0.6 * REM,
    paddingVertical: 0.55 * REM,
    paddingHorizontal: 0.9 * REM,
  },
  primary: {
    backgroundImage: `linear-gradient(180deg, ${hsl(354, 100, 57)}, ${hsl(353, 91, 45)})`,
    boxShadow: `0px 18px 36px ${hsl(353, 95, 43, 0.3)}, inset 0px 1px 0px ${hsl(0, 0, 100, 0.2)}`,
  },
  primaryText: { color: hsl(0, 0, 100), fontSize: 0.78 * REM, lineHeight: 1.25 * REM, fontWeight: '800' },
  status: { borderWidth: 1, borderColor: DRAW_COLORS.goldBorder, backgroundColor: hsl(0, 0, 7, 0.78) },
  statusText: { color: DRAW_COLORS.goldSoft, fontSize: 0.78 * REM, lineHeight: 0.78 * REM * 1.5, fontWeight: '800' },
  claim: {
    width: '100%',
    minHeight: 2.35 * REM,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0.5 * REM,
    borderRadius: 0.55 * REM,
    backgroundImage: `linear-gradient(180deg, ${hsl(43, 100, 60)}, ${hsl(32, 100, 50)})`,
  },
  disabled: { opacity: 0.5 },
  claimText: { color: DRAW_COLORS.hotText, fontSize: 0.78 * REM, lineHeight: 1.25 * REM, fontWeight: '900' },
  replay: {
    width: '100%',
    minHeight: 2.5 * REM,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0.5 * REM,
    borderWidth: 1,
    borderColor: hsl(0, 0, 100, 0.12),
    borderRadius: 0.55 * REM,
    paddingVertical: 0.5 * REM,
    paddingHorizontal: 0.9 * REM,
    backgroundColor: hsl(0, 0, 3, 0.58),
  },
  replayPressed: { borderColor: hsl(43, 100, 60, 0.42) },
  replayText: { color: REPLAY_TEXT, fontSize: 0.78 * REM, lineHeight: 0.78 * REM * 1.5, fontWeight: '800' },
  replayTextPressed: { color: REPLAY_TEXT_PRESSED },
});
