import { useState, type ComponentRef, type Ref } from 'react';
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
  // Reanimated drops backgroundImage/boxShadow from function styles on animated
  // components, so resolve pressed-state styles here and pass a static array.
  const [pressed, setPressed] = useState(false);
  const resolvedStyle =
    typeof style === 'function' ? style({ pressed } as PressableStateCallbackType) : style;

  return (
    <AnimatedPressable
      ref={ref}
      disabled={disabled}
      onPressIn={(event) => {
        if (!reduced) scale.set(withTiming(scaleTo, { duration: 150 }));
        if (typeof style === 'function') setPressed(true);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.set(withTiming(1, { duration: 150 }));
        if (typeof style === 'function') setPressed(false);
        onPressOut?.(event);
      }}
      style={[resolvedStyle, animatedStyle]}
      {...props}
    />
  );
}
