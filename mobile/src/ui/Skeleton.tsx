import { useEffect } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useLiteMotion } from '@/lib/motion';
import { createStyles } from '@/theme';

export interface SkeletonProps {
  width?: ViewStyle['width'];
  height?: ViewStyle['height'];
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/** Tailwind `animate-pulse rounded-md bg-muted` (2 s, opacity 1 → 0.5 → 1). */
export function Skeleton({ width, height = 16, radius, style }: SkeletonProps) {
  const styles = useStyles();
  const lite = useLiteMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (lite) {
      opacity.set(1);
      return;
    }
    opacity.set(withRepeat(
      withTiming(0.5, { duration: 1000, easing: Easing.bezier(0.4, 0, 0.6, 1) }),
      -1,
      true,
    ));
    return () => cancelAnimation(opacity);
  }, [lite, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return (
    <Animated.View
      style={[styles.base, { width, height }, radius !== undefined && { borderRadius: radius }, animatedStyle, style]}
    />
  );
}

const useStyles = createStyles(({ colors, radius }) => ({
  base: { backgroundColor: colors.muted, borderRadius: radius.md },
}));
