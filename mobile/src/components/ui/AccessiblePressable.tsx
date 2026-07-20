import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { MINIMUM_TOUCH_TARGET } from '@/constants/mobile-theme';

export interface AccessiblePressableProps extends PressableProps {
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
}

export function AccessiblePressable({ style, hitSlop = 6, ...props }: AccessiblePressableProps) {
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={hitSlop}
      {...props}
      style={(state) => [
        { minWidth: MINIMUM_TOUCH_TARGET, minHeight: MINIMUM_TOUCH_TARGET },
        typeof style === 'function' ? style(state) : style,
      ]}
    />
  );
}
