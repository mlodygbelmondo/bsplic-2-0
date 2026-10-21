import {
  Easing,
  withDelay,
  withSpring,
  withTiming,
  type EntryExitAnimationFunction,
} from 'react-native-reanimated';

/**
 * framer-motion defaults used by the casino cards: `x`/`y` animate with an
 * under-damped spring (stiffness 500, damping 25), opacity with a 0.3 s
 * `[0.25, 0.1, 0.35, 1]` ease. Reanimated skips these under Reduce Motion.
 */
const OPACITY_EASING = Easing.bezier(0.25, 0.1, 0.35, 1);
const FRAMER_SPRING = { stiffness: 500, damping: 25, mass: 1 } as const;

interface FadeSlideOptions {
  x?: number;
  y?: number;
  delayMs?: number;
  spring?: { stiffness: number; damping: number; mass?: number };
}

/** `initial={{ opacity: 0, x, y }} animate={{ opacity: 1, x: 0, y: 0 }}` as a Reanimated entering animation. */
export function fadeSlideIn({ x = 0, y = 0, delayMs = 0, spring = FRAMER_SPRING }: FadeSlideOptions): EntryExitAnimationFunction {
  return () => {
    'worklet';
    return {
      initialValues: { opacity: 0, transform: [{ translateX: x }, { translateY: y }] },
      animations: {
        opacity: withDelay(delayMs, withTiming(1, { duration: 300, easing: OPACITY_EASING })),
        transform: [
          { translateX: withDelay(delayMs, withSpring(0, spring)) },
          { translateY: withDelay(delayMs, withSpring(0, spring)) },
        ],
      },
    };
  };
}
