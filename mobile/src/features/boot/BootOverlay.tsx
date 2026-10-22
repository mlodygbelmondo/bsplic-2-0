import RNMaskedView, { type MaskedViewProps } from '@react-native-masked-view/masked-view';
import { Canvas, Group, Path, Skia } from '@shopify/react-native-skia';
import { useEffect, useMemo, type ComponentType } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useReducedMotion } from '@/lib/motion';
import { fauxItalic, fonts, hsl } from '@/theme';
import { hideNativeSplash, onBootOverlayHidden, PHASE_MESSAGES, useBootStore } from './boot-store';

// The class typings of masked-view predate React 19's JSX types.
const MaskedView = RNMaskedView as unknown as ComponentType<MaskedViewProps>;

const BG = '#0f0e16';
const GOLD = hsl(46, 98, 54);
const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);
const SEGMENT_DEG = 9.73;

/**
 * Native port of the web `#initial-splash`: a spinning roulette wheel around
 * the shimmering “BSPLIC 2.0” wordmark, a progress bar and rotating status
 * copy. Its first frame matches the static native splash image exactly.
 */
export function BootOverlay() {
  const visible = useBootStore((s) => s.visible);
  if (!visible) return null;
  return <BootOverlayContent />;
}

function BootOverlayContent() {
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const leaving = useBootStore((s) => s.leaving);
  const reopened = useBootStore((s) => s.reopened);
  const phase = useBootStore((s) => s.phase);
  const messageIndex = useBootStore((s) => s.messageIndex);
  const progress = useBootStore((s) => s.progress);

  const wheel = Math.min(width * 0.84, 330);
  const message = PHASE_MESSAGES[phase][messageIndex % PHASE_MESSAGES[phase].length];
  const duration = (ms: number) => (reduced ? 0 : ms);

  // Container fade (in on reopen, out when leaving).
  const opacity = useSharedValue(reopened ? 0 : 1);
  useEffect(() => {
    if (leaving) {
      opacity.set(
        withDelay(
          120,
          withTiming(0, { duration: duration(350) }, (finished) => {
            if (finished) scheduleOnRN(onBootOverlayHidden);
          }),
        ),
      );
    } else if (reopened) {
      opacity.set(withTiming(1, { duration: duration(300) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving, reopened]);
  const containerStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  // Wheel pop-in, ring spin (7 s), ball counter-spin (2.2 s).
  const pop = useSharedValue(0);
  const spin = useSharedValue(0);
  const ball = useSharedValue(0);
  useEffect(() => {
    pop.set(withTiming(1, { duration: duration(900), easing: EASE_OUT_EXPO }));
    if (!reduced) {
      spin.set(withRepeat(withTiming(360, { duration: 7000, easing: Easing.linear }), -1, false));
      ball.set(withRepeat(withTiming(-360, { duration: 2200, easing: Easing.linear }), -1, false));
    }
    return () => {
      cancelAnimation(spin);
      cancelAnimation(ball);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);
  const wheelStyle = useAnimatedStyle(() => ({
    opacity: pop.get(),
    transform: [{ scale: 0.9 + 0.1 * pop.get() }],
  }));
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.get()}deg` }] }));
  const ballStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${ball.get()}deg` }] }));

  // Glow fade-in (1 s).
  const glow = useSharedValue(0);
  useEffect(() => {
    glow.set(withTiming(1, { duration: duration(1000) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.get() }));

  // Wordmark shimmer: background-position 100% → 0% over 55% of 2.6 s, after 0.6 s.
  const shimmer = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    shimmer.set(withDelay(
      600,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1430, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1170 }),
          withTiming(0, { duration: 0 }),
        ),
        -1,
        false,
      ),
    ));
    return () => cancelAnimation(shimmer);
  }, [reduced, shimmer]);
  const WORDMARK_WIDTH = 230;
  const shimmerStyle = useAnimatedStyle(() => ({
    // A 250%-wide gradient sliding from its right edge to its left edge.
    transform: [{ translateX: -WORDMARK_WIDTH * 1.5 * (1 - shimmer.get()) }],
  }));
  const wordmarkScale = useSharedValue(1);
  useEffect(() => {
    if (leaving) wordmarkScale.set(withTiming(1.08, { duration: duration(600), easing: EASE_OUT_EXPO }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving]);
  const wordmarkStyle = useAnimatedStyle(() => ({ transform: [{ scale: wordmarkScale.get() }] }));

  // Progress bar.
  const bar = useSharedValue(progress);
  useEffect(() => {
    bar.set(withTiming(progress, { duration: duration(500), easing: Easing.bezier(0.2, 0.8, 0.2, 1) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress]);
  const barStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: bar.get() }] }));

  // Below-block rise (0.6 s after 0.12 s).
  const rise = useSharedValue(0);
  useEffect(() => {
    rise.set(withDelay(duration(120), withTiming(1, { duration: duration(600), easing: EASE_OUT_EXPO })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const riseStyle = useAnimatedStyle(() => ({
    opacity: rise.get(),
    transform: [{ translateY: 10 * (1 - rise.get()) }],
  }));

  const ringPath = useMemo(() => buildRingSegments(wheel - 8, 25), [wheel]);

  return (
    <Animated.View
      pointerEvents={leaving ? 'none' : 'auto'}
      style={[StyleSheet.absoluteFill, styles.root, containerStyle]}
      onLayout={hideNativeSplash}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.glow, glowStyle]} />

      <View style={styles.center}>
        <Animated.View style={[{ width: wheel, height: wheel }, wheelStyle]}>
          <View style={[StyleSheet.absoluteFill, styles.wheelOuter]} />
          <Animated.View style={[styles.ringBox, { width: wheel - 8, height: wheel - 8 }, ringStyle]}>
            <Canvas style={{ width: wheel - 8, height: wheel - 8 }}>
              <Group>
                <Path path={ringPath.green} color="#0f8a43" />
                <Path path={ringPath.red} color="#c1121f" />
                <Path path={ringPath.black} color="#17141d" />
              </Group>
            </Canvas>
          </Animated.View>
          <View style={[styles.wheelInner, { width: wheel - 62, height: wheel - 62, borderRadius: wheel }]} />
          <Animated.View style={[StyleSheet.absoluteFill, ballStyle]}>
            <View style={styles.ball} />
          </Animated.View>
        </Animated.View>

        <Animated.View style={[styles.wordmarkBox, wordmarkStyle]}>
          <MaskedView
            style={{ width: WORDMARK_WIDTH, height: 46 }}
            maskElement={
              <View style={styles.maskCenter}>
                <Text style={styles.wordmark} numberOfLines={1}>
                  BSPLIC{' '}2.0
                </Text>
              </View>
            }
          >
            <Animated.View style={[{ width: WORDMARK_WIDTH * 2.5, height: 46 }, styles.wordmarkGradient, shimmerStyle]} />
          </MaskedView>
        </Animated.View>
      </View>

      <Animated.View style={[styles.below, { top: '50%', marginTop: Math.min(width * 0.42, 165) + 22 }, riseStyle]}>
        <View style={styles.track}>
          <Animated.View style={[styles.bar, barStyle]} />
        </View>
        <Animated.Text key={message} entering={reduced ? undefined : FadeIn.duration(260)} style={styles.status}>
          {message}
        </Animated.Text>
      </Animated.View>
    </Animated.View>
  );
}

/** Builds the ring as filled annular sectors: one green pocket, then red/black alternating. */
function buildRingSegments(size: number, thickness: number) {
  const outer = size / 2;
  const inner = outer - thickness;
  const c = size / 2;
  const green = Skia.PathBuilder.Make();
  const red = Skia.PathBuilder.Make();
  const black = Skia.PathBuilder.Make();
  const sector = (path: ReturnType<typeof Skia.PathBuilder.Make>, fromDeg: number, sweepDeg: number) => {
    // CSS conic 0° is 12 o'clock; Skia arcs start at 3 o'clock.
    const start = fromDeg - 90;
    path.addArc({ x: c - outer, y: c - outer, width: outer * 2, height: outer * 2 }, start, sweepDeg);
    path.arcToOval({ x: c - inner, y: c - inner, width: inner * 2, height: inner * 2 }, start + sweepDeg, -sweepDeg, false);
    path.close();
  };
  sector(green, -SEGMENT_DEG / 2, SEGMENT_DEG);
  let angle = SEGMENT_DEG / 2;
  let isRed = true;
  while (angle < 360 - SEGMENT_DEG / 2 - 0.01) {
    const sweep = Math.min(SEGMENT_DEG, 360 - SEGMENT_DEG / 2 - angle);
    sector(isRed ? red : black, angle, sweep);
    angle += SEGMENT_DEG;
    isRed = !isRed;
  }
  return { green: green.build(), red: red.build(), black: black.build() };
}

const styles = StyleSheet.create({
  root: { backgroundColor: BG, zIndex: 9999, overflow: 'hidden' },
  glow: {
    backgroundImage: `radial-gradient(circle at 50% 50%, ${hsl(355, 100, 42, 0.28)}, transparent 58%)`,
  },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  wheelOuter: {
    borderRadius: 9999,
    borderWidth: 2,
    borderColor: hsl(46, 90, 58, 0.8),
    boxShadow: `0px 0px 42px ${hsl(355, 100, 45, 0.35)}, inset 0px 0px 22px ${hsl(46, 90, 50, 0.18)}`,
  },
  ringBox: { position: 'absolute', left: 4, top: 4 },
  wheelInner: {
    position: 'absolute',
    left: 31,
    top: 31,
    borderWidth: 1,
    borderColor: hsl(46, 90, 58, 0.45),
  },
  ball: {
    position: 'absolute',
    left: '50%',
    top: 36,
    width: 9,
    height: 9,
    marginLeft: -4.5,
    borderRadius: 4.5,
    backgroundImage: 'radial-gradient(circle at 35% 30%, #ffffff, #c9c9d2 60%, #7c7c88)',
    boxShadow: '0px 0px 10px rgba(255, 255, 255, 0.55)',
  },
  wordmarkBox: { position: 'absolute' },
  maskCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  wordmark: {
    fontFamily: fonts.family,
    fontSize: 38,
    fontWeight: '900',
    ...fauxItalic,
    letterSpacing: -1.14,
    lineHeight: 42,
    color: '#000',
  },
  wordmarkGradient: {
    backgroundImage: `linear-gradient(110deg, #ffffff 30%, ${hsl(46, 98, 64)} 41%, ${hsl(355, 100, 62)} 47%, #ffffff 58%)`,
  },
  below: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  track: {
    width: 156,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
  },
  bar: {
    width: '100%',
    height: '100%',
    transformOrigin: 'left',
    backgroundImage: `linear-gradient(90deg, ${hsl(46, 80, 45)}, ${GOLD})`,
  },
  status: {
    minHeight: 18,
    fontFamily: fonts.family,
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.13,
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.62)',
  },
});
