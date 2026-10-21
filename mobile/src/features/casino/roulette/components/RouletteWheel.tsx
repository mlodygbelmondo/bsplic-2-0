import { memo, useEffect, useRef, useState } from 'react';
import { AppState, useWindowDimensions } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type EntryExitAnimationFunction,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { createStyles } from '@/theme';

import { casinoHaptics } from '../../shared/audio';
import {
  INITIAL_BALL_MOTION,
  nextBallMotion,
  ROULETTE_BALL_SETTLE_DELAY_MS,
  ROULETTE_BALL_SETTLE_DURATION_MS,
  ROULETTE_BALL_SETTLED_TOP,
  ROULETTE_BALL_SPINNING_TOP_END,
  ROULETTE_BALL_SPINNING_TOP_START,
  type BallSpin,
} from '../lib/ballMotion';
import { getRouletteBallAngleOffset } from '../lib/rouletteWheel';
import { useRouletteTable } from '../state/tableStore';
import { WheelArt, wheelGlowGradient } from './WheelArt';

const SPIN_EASING = Easing.bezier(0.2, 0.8, 0.25, 1);
const SETTLE_EASING = Easing.bezier(0.18, 0.72, 0.2, 1);
/** `bg-red-950/25` at rest, `/60` while the ball runs (`transition-colors duration-700`). */
const GLOW_IDLE = 0.25;
const GLOW_SPINNING = 0.6;
const GLOW_FADE_MS = 700;

/** framer `initial={{ opacity: 0, scale: 0.92 }}`, `transition={{ delay: 0.1, type: 'spring', stiffness: 100 }}`. */
const wheelEntering: EntryExitAnimationFunction = () => {
  'worklet';
  const spring = { stiffness: 100, damping: 10, mass: 1 };
  return {
    initialValues: { opacity: 0, transform: [{ scale: 0.92 }] },
    animations: {
      opacity: withDelay(100, withSpring(1, { ...spring, overshootClamping: true })),
      transform: [{ scale: withDelay(100, withSpring(1, spring)) }],
    },
  };
};

function onBallSettled() {
  casinoHaptics.ballSettled();
}

/**
 * The live wheel (web `RouletteWheel`). The artwork is static; the ball orbits
 * it on the UI thread and lands on the server's winning number using the web's
 * pocket angles and per-number calibration offsets.
 */
export const RouletteWheel = memo(function RouletteWheel() {
  const styles = useStyles();
  const { width: windowWidth } = useWindowDimensions();
  const [size, setSize] = useState(0);

  const phase = useRouletteTable((state) => state.currentRound?.phase ?? 'waiting');
  const winningNumber = useRouletteTable((state) => state.currentRound?.winning_number ?? null);
  const spinStartedAt = useRouletteTable((state) => state.currentRound?.spin_started_at ?? null);
  const roundId = useRouletteTable((state) => state.currentRound?.id ?? null);

  const motion = useRef(INITIAL_BALL_MOTION);
  const visible = useSharedValue(0);
  const orbit = useSharedValue(0);
  const ballTop = useSharedValue(ROULETTE_BALL_SETTLED_TOP);
  const glow = useSharedValue(GLOW_IDLE);

  useEffect(() => {
    const restAt = (spin: BallSpin) => {
      cancelAnimation(orbit);
      cancelAnimation(ballTop);
      cancelAnimation(glow);
      visible.set(1);
      orbit.set(spin.targetRotation + getRouletteBallAngleOffset(spin.targetNumber));
      ballTop.set(ROULETTE_BALL_SETTLED_TOP);
      glow.set(GLOW_IDLE);
    };

    const { state, command } = nextBallMotion(
      motion.current,
      { phase, winningNumber, roundId, spinStartedAt },
      Date.now(),
    );
    motion.current = state;
    if (command.kind === 'none') return;
    if (command.kind === 'settle') {
      restAt(command.spin);
      return;
    }

    const { spin } = command;
    const offset = getRouletteBallAngleOffset(spin.targetNumber);
    cancelAnimation(orbit);
    cancelAnimation(ballTop);
    cancelAnimation(glow);
    visible.set(1);
    orbit.set(
      withSequence(
        withTiming(spin.fromRotation + offset, { duration: 0 }),
        withTiming(spin.targetRotation + offset, { duration: spin.durationMs, easing: SPIN_EASING }),
      ),
    );
    ballTop.set(
      withSequence(
        withTiming(ROULETTE_BALL_SPINNING_TOP_START, { duration: 0 }),
        withTiming(ROULETTE_BALL_SPINNING_TOP_END, { duration: spin.durationMs, easing: SPIN_EASING }),
        withTiming(ROULETTE_BALL_SPINNING_TOP_END, { duration: ROULETTE_BALL_SETTLE_DELAY_MS }, (finished) => {
          'worklet';
          if (finished) scheduleOnRN(onBallSettled);
        }),
        withTiming(ROULETTE_BALL_SETTLED_TOP, { duration: ROULETTE_BALL_SETTLE_DURATION_MS, easing: SETTLE_EASING }),
      ),
    );
    glow.set(
      withSequence(
        withTiming(GLOW_SPINNING, { duration: GLOW_FADE_MS }),
        withDelay(
          Math.max(0, spin.durationMs + ROULETTE_BALL_SETTLE_DELAY_MS - GLOW_FADE_MS),
          withTiming(GLOW_IDLE, { duration: GLOW_FADE_MS }),
        ),
      ),
    );
  }, [phase, winningNumber, roundId, spinStartedAt, visible, orbit, ballTop, glow]);

  // Back from the background after the ball should have landed: show it in
  // the pocket instead of replaying the queued settle steps late.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      const spin = motion.current.spin;
      if (next !== 'active' || !spin) return;
      if (Date.now() < spin.settlesAt + ROULETTE_BALL_SETTLE_DURATION_MS) return;
      cancelAnimation(orbit);
      cancelAnimation(ballTop);
      cancelAnimation(glow);
      orbit.set(spin.targetRotation + getRouletteBallAngleOffset(spin.targetNumber));
      ballTop.set(ROULETTE_BALL_SETTLED_TOP);
      glow.set(GLOW_IDLE);
    });
    return () => subscription.remove();
  }, [orbit, ballTop, glow]);

  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.get() }));
  const glowArt = wheelGlowGradient(size);
  const maxWidth = windowWidth >= 1280 ? 560 : windowWidth >= 640 ? 420 : undefined;

  return (
    <Animated.View
      entering={wheelEntering}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Koło ruletki"
      style={[styles.wheel, maxWidth ? { maxWidth } : null]}
      onLayout={(event) => setSize(Math.round(event.nativeEvent.layout.width))}
    >
      {size > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.glow,
            {
              left: size / 2 - glowArt.extent,
              top: size / 2 - glowArt.extent,
              width: glowArt.extent * 2,
              height: glowArt.extent * 2,
              backgroundImage: glowArt.backgroundImage,
            },
            glowStyle,
          ]}
        />
      ) : null}
      <WheelArt size={size} />
      {size > 0 ? <Ball size={size} visible={visible} orbit={orbit} top={ballTop} /> : null}
    </Animated.View>
  );
});

function Ball({
  size,
  visible,
  orbit,
  top,
}: {
  size: number;
  visible: SharedValue<number>;
  orbit: SharedValue<number>;
  top: SharedValue<number>;
}) {
  const styles = useStyles();
  // `clamp(8px, 2.8%, 16px)` of the wheel frame.
  const ballSize = Math.min(16, Math.max(8, size * 0.028));

  // Web: the ball sits at `top` inside a frame-sized layer rotated about its
  // center; the same point is placed directly here.
  const animatedStyle = useAnimatedStyle(() => {
    const rotation = orbit.get();
    const theta = (rotation * Math.PI) / 180;
    const radius = size * (0.5 - top.get());
    return {
      opacity: visible.get(),
      transform: [
        { translateX: size / 2 + radius * Math.sin(theta) - ballSize / 2 },
        { translateY: size / 2 - radius * Math.cos(theta) - ballSize / 2 },
        { rotate: `${rotation}deg` },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.ball, { width: ballSize, height: ballSize, borderRadius: ballSize / 2 }, animatedStyle]}
    />
  );
}

const useStyles = createStyles(() => ({
  wheel: { width: '100%', aspectRatio: 1, alignSelf: 'center' },
  glow: { position: 'absolute' },
  ball: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    backgroundImage: 'radial-gradient(circle at 35% 30%, #ffffff 0%, #fff7d6 30%, #d8b46a 58%, #7b4a18 100%)',
    boxShadow: '0px 0px 12px rgba(255, 246, 198, 0.85), 0px 5px 12px rgba(0, 0, 0, 0.55)',
  },
}));
