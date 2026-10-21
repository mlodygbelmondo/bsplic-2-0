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

/** Web `<Loader2 className="animate-spin" />` (1 s linear turn). */
export function Spinner({ size, color }: { size: number; color: string }) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.set(withRepeat(withTiming(360, { duration: 1000, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(rotation);
  }, [rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.get()}deg` }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Loader2 size={size} color={color} />
    </Animated.View>
  );
}
