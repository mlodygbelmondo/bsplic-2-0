import type { ComponentRef, Ref } from 'react';
import { Pressable, type PressableProps, type PressableStateCallbackType } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useReducedMotion } from '@/lib/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressScaleProps extends PressableProps {
  /** Pressed scale (web `.press-scale` = 0.94, `.odds-chip` = 0.95). */
  scaleTo?: number;
}

/** Pressable with the web's `.press-scale` feedback, animated on the UI thread. */
export function PressScale({
  scaleTo = 0.94,
  onPressIn,
  onPressOut,
  style,
  disabled,
  ref,
  ...props
}: PressScaleProps & { ref?: Ref<ComponentRef<typeof Pressable>> }) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <AnimatedPressable
      ref={ref}
      disabled={disabled}
      onPressIn={(event) => {
        if (!reduced) scale.set(withTiming(scaleTo, { duration: 150 }));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.set(withTiming(1, { duration: 150 }));
        onPressOut?.(event);
      }}
      style={(state: PressableStateCallbackType) => [typeof style === 'function' ? style(state) : style, animatedStyle]}
      {...props}
    />
  );
}
