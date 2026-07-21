import { useState } from 'react';
import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { MINIMUM_TOUCH_TARGET } from '@/constants/mobile-theme';

export interface AccessiblePressableProps extends PressableProps {
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
}

export function AccessiblePressable({ style, hitSlop = 6, onPressIn, onPressOut, ...props }: AccessiblePressableProps) {
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={hitSlop}
      {...props}
      onPressIn={(event) => {
        setPressed(true);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        onPressOut?.(event);
      }}
      style={StyleSheet.flatten([
        { minWidth: MINIMUM_TOUCH_TARGET, minHeight: MINIMUM_TOUCH_TARGET },
        typeof style === 'function' ? style({ pressed }) : style,
      ])}
    />
  );
}
