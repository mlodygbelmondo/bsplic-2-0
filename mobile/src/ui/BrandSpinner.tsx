import { Canvas, Circle, SweepGradient, vec, BlurMask } from '@shopify/react-native-skia';
import { useEffect } from 'react';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotion } from '@/lib/motion';
import { hsl } from '@/theme';

const RING_COLORS = [
  'rgba(0,0,0,0)',
  hsl(355, 100, 47, 0.06),
  hsl(355, 100, 47, 0.55),
  hsl(355, 100, 52),
  hsl(46, 98, 54),
];
const RING_POSITIONS = [0, 0.24, 0.62, 0.88, 1];
const GOLD = hsl(46, 98, 56);

/**
 * Web `.brand-spinner`: a red arc chasing a glowing gold head, like a ball
 * around a roulette wheel. 44 px (`md`) or 28 px (`sm`), 0.9 s per turn.
 */
export function BrandSpinner({ size = 'md' }: { size?: 'md' | 'sm' }) {
  const reduced = useReducedMotion();
  const box = size === 'sm' ? 28 : 44;
  const stroke = size === 'sm' ? 3 : 4;
  const dot = box * 0.2;
  // The dot sits at top: -3.5% and spills over the box; pad the canvas for it and the glow.
  const pad = 8;
  const canvas = box + pad * 2;
  const c = canvas / 2;
  const r = box / 2 - stroke / 2;

  const rotation = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    rotation.set(withRepeat(withTiming(360, { duration: 900, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(rotation);
  }, [reduced, rotation]);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.get()}deg` }] }));

  return (
    <Animated.View style={[{ width: canvas, height: canvas, margin: -pad }, animatedStyle]}>
      <Canvas style={{ width: canvas, height: canvas }}>
        {/* Sweep starts at 3 o'clock in Skia; rotate -90° so it starts at 12 like CSS conic. */}
        <Circle cx={c} cy={c} r={r} style="stroke" strokeWidth={stroke} transform={[{ rotate: -Math.PI / 2 }]} origin={vec(c, c)}>
          <SweepGradient c={vec(c, c)} colors={RING_COLORS} positions={RING_POSITIONS} />
        </Circle>
        <Circle cx={c} cy={pad - box * 0.035 + dot / 2} r={dot / 2} color={GOLD}>
          <BlurMask blur={4} style="solid" />
        </Circle>
      </Canvas>
    </Animated.View>
  );
}
