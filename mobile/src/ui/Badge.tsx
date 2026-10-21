import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';
import { Text } from './Text';

export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';

/** shadcn `Badge`: `rounded-full border px-2.5 py-0.5 text-xs font-semibold`. */
export function Badge({
  children,
  variant = 'default',
  style,
}: {
  children: ReactNode;
  variant?: BadgeVariant;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const tone = {
    default: [colors.primary, colors.primaryForeground],
    secondary: [colors.secondary, colors.secondaryForeground],
    destructive: [colors.destructive, colors.destructiveForeground],
    outline: ['transparent', colors.foreground],
    success: [colors.success, colors.successForeground],
    warning: [colors.warning, colors.warningForeground],
  }[variant];
  return (
    <View
      style={[
        {
          borderRadius: 999,
          borderWidth: 1,
          borderColor: variant === 'outline' ? colors.border : 'transparent',
          backgroundColor: tone[0],
          paddingHorizontal: 10,
          paddingVertical: 2,
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      {typeof children === 'string' ? (
        <Text size="xs" weight="600" style={{ color: tone[1] }}>
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}
