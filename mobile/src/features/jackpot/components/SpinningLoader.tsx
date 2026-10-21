import { Loader2 } from 'lucide-react-native';
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

/** Lucide `Loader2` with Tailwind `animate-spin` (1 s linear), still under reduced motion like the web. */
export function SpinningLoader({ size, color }: { size: number; color: string }) {
  const reduced = useReducedMotion();
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    rotation.set(withRepeat(withTiming(360, { duration: 1000, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(rotation);
  }, [reduced, rotation]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.get()}deg` }] }));

  return (
    <Animated.View style={[{ width: size, height: size }, animatedStyle]}>
      <Loader2 size={size} color={color} />
    </Animated.View>
  );
}
