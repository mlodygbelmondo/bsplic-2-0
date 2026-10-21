import { Canvas, ColorMatrix, Image as SkiaImage, Shadow, useImage } from '@shopify/react-native-skia';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';

import { hsl } from '@/theme';
import { Text } from '@/ui';

import { JACKPOT_WINNING_TICKET_IMAGE } from '../assets';
import { sampleWinningTicketPop } from '../lib/keyframes';
import { DRAW_COLORS, REM } from './tokens';

const WINNING_TICKET_ASPECT = 1213 / 647;
// drop-shadow(0 1.4rem 1.8rem …) (σ 14.4) and the 1.7rem gold glow (σ 13.6).
const PAD = { x: 44, top: 42, bottom: 68 };

/**
 * `.jackpot-stage-reveal__ticket-wrap`: the winning ticket art with its number,
 * popping in over 700 ms (`jackpot-winning-ticket-pop`).
 */
export function WinningTicket({
  label,
  width,
  reducedMotion,
}: {
  label: string;
  width: number;
  reducedMotion: boolean;
}) {
  const art = useImage(JACKPOT_WINNING_TICKET_IMAGE);
  const height = width / 1.88;
  const artWidth = Math.min(width, height * WINNING_TICKET_ASPECT);
  const artHeight = artWidth / WINNING_TICKET_ASPECT;
  // The global reduced-motion rule on the web collapses the pop to its end state.
  const pop = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) return;
    pop.set(withTiming(1, { duration: 700, easing: Easing.linear }));
  }, [reducedMotion, pop]);

  const popStyle = useAnimatedStyle(() => {
    const pose = sampleWinningTicketPop(pop.get(), REM);
    return {
      opacity: pose.opacity,
      transform: [{ translateY: pose.translateY }, { scale: pose.scale }, { rotate: `${pose.rotate}deg` }],
    };
  });
  const brightness = useDerivedValue(() => {
    const b = sampleWinningTicketPop(pop.get(), REM).brightness;
    return [b, 0, 0, 0, 0, 0, b, 0, 0, 0, 0, 0, b, 0, 0, 0, 0, 0, 1, 0];
  });

  return (
    <Animated.View style={[{ width, height }, styles.wrap, popStyle]}>
      <Canvas
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: -PAD.x,
          top: -PAD.top,
          width: width + PAD.x * 2,
          height: height + PAD.top + PAD.bottom,
        }}
      >
        <SkiaImage
          image={art}
          x={PAD.x + (width - artWidth) / 2}
          y={PAD.top + (height - artHeight) / 2}
          width={artWidth}
          height={artHeight}
          fit="contain"
        >
          <ColorMatrix matrix={brightness} />
          {/* Skia applies the last filter first: dark shadow, then the gold glow (CSS order). */}
          <Shadow dx={0} dy={0} blur={0.85 * REM} color={hsl(39, 100, 55, 0.34)} />
          <Shadow dx={0} dy={1.4 * REM} blur={0.9 * REM} color={hsl(0, 0, 0, 0.62)} />
        </SkiaImage>
      </Canvas>
      <View style={styles.copy}>
        <Text style={styles.label}>Zwycięski ticket</Text>
        <Text style={styles.number}>{label}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  copy: { alignItems: 'center', gap: 0.22 * REM, transform: [{ translateY: 0.1 * REM }] },
  label: {
    color: hsl(27, 38, 17, 0.74),
    fontSize: 0.62 * REM,
    lineHeight: 0.62 * REM * 1.5,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  number: {
    color: DRAW_COLORS.ticketInk,
    fontSize: 1.42 * REM,
    lineHeight: 1.42 * REM,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    textShadowColor: hsl(46, 100, 78, 0.72),
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
  },
});
