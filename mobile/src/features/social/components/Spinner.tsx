import { Loader2 } from 'lucide-react-native';
import { useEffect } from 'react';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

/** Lucide `Loader2` with Tailwind `animate-spin` (1 s linear, infinite). */
export function Spinner({ size, color }: { size: number; color: string }) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.set(withRepeat(withTiming(1, { duration: 1000, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(rotation);
  }, [rotation]);

  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.get() * 360}deg` }] }));

  return (
    <Animated.View style={style} accessibilityRole="progressbar">
      <Loader2 size={size} color={color} />
    </Animated.View>
  );
}
