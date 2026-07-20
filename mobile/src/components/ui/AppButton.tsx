import { ActivityIndicator, StyleSheet, View, type PressableProps } from 'react-native';

import { useAppTheme } from '@/hooks/use-app-theme';

import { AccessiblePressable } from './AccessiblePressable';
import { AppText } from './AppText';

export type AppButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';

export interface AppButtonProps extends Omit<PressableProps, 'children'> {
  children: React.ReactNode;
  variant?: AppButtonVariant;
  loading?: boolean;
  leftAccessory?: React.ReactNode;
  rightAccessory?: React.ReactNode;
  fullWidth?: boolean;
}

export function AppButton({
  children,
  variant = 'primary',
  loading = false,
  disabled,
  leftAccessory,
  rightAccessory,
  fullWidth = false,
  style,
  ...props
}: AppButtonProps) {
  const { tokens } = useAppTheme();
  const backgroundColor = {
    primary: tokens.colors.primary,
    secondary: tokens.colors.secondary,
    outline: 'transparent',
    ghost: 'transparent',
    danger: tokens.colors.destructive,
  }[variant];
  const foregroundColor =
    variant === 'primary' || variant === 'danger'
      ? tokens.colors.primaryForeground
      : tokens.colors.foreground;

  return (
    <AccessiblePressable
      {...props}
      disabled={disabled || loading}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor, borderRadius: tokens.radii.medium },
        variant === 'outline' && { borderColor: tokens.colors.border, borderWidth: 1 },
        fullWidth && styles.fullWidth,
        (disabled || loading) && styles.disabled,
        pressed && !disabled && !loading && styles.pressed,
        typeof style === 'function' ? style({ pressed }) : style,
      ]}
    >
      <View style={styles.content}>
        {loading ? <ActivityIndicator color={foregroundColor} size="small" /> : leftAccessory}
        <AppText variant="label" style={{ color: foregroundColor }}>
          {children}
        </AppText>
        {!loading && rightAccessory}
      </View>
    </AccessiblePressable>
  );
}

const styles = StyleSheet.create({
  button: { paddingHorizontal: 16, paddingVertical: 11, justifyContent: 'center' },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.84, transform: [{ scale: 0.98 }] },
  fullWidth: { width: '100%' },
});
