import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { haptics } from '@/lib/haptics';
import { createStyles, useTheme, type Palette } from '@/theme';
import { PressScale } from './PressScale';
import { Text } from './Text';

export type ButtonVariant = 'default' | 'gradient' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
export type ButtonSize = 'default' | 'sm' | 'lg' | 'xl' | 'icon';

export interface ButtonProps {
  children?: ReactNode;
  label?: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  /** Lucide icon element rendered before the label. */
  icon?: ReactNode;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  /** Selection haptic on press (default true). */
  haptic?: boolean;
}

const HEIGHT: Record<ButtonSize, number> = { default: 40, sm: 36, lg: 44, xl: 48, icon: 40 };
const PAD_X: Record<ButtonSize, number> = { default: 16, sm: 12, lg: 32, xl: 24, icon: 0 };

/** shadcn `Button` variants plus `gradient` (web `.gradient-primary` CTAs). */
export function Button({
  children,
  label,
  onPress,
  variant = 'default',
  size = 'default',
  disabled,
  loading,
  icon,
  fullWidth,
  style,
  accessibilityLabel,
  haptic = true,
}: ButtonProps) {
  const styles = useStyles();
  const palette = useTheme();
  const tone = toneFor(variant, palette);
  const inactive = disabled || loading;

  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={() => {
        if (haptic) haptics.selection();
        onPress?.();
      }}
      style={[
        styles.base,
        { height: HEIGHT[size], paddingHorizontal: PAD_X[size] },
        size === 'icon' && { width: HEIGHT.icon },
        fullWidth && styles.fullWidth,
        tone.container,
        inactive && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={tone.text} />
      ) : (
        <View style={styles.row}>
          {icon}
          {label ? (
            <Text size={size === 'xl' || size === 'lg' ? 'base' : 'sm'} weight={variant === 'gradient' ? '700' : '500'} style={{ color: tone.text }}>
              {label}
            </Text>
          ) : null}
          {children}
        </View>
      )}
    </PressScale>
  );
}

function toneFor(variant: ButtonVariant, { colors, gradients }: Palette): { container: ViewStyle; text: string } {
  switch (variant) {
    case 'gradient':
      return { container: { backgroundImage: gradients.primary, boxShadow: '0px 10px 15px -3px rgba(0, 0, 0, 0.1), 0px 4px 6px -4px rgba(0, 0, 0, 0.1)' }, text: colors.primaryForeground };
    case 'destructive':
      return { container: { backgroundColor: colors.destructive }, text: colors.destructiveForeground };
    case 'outline':
      return { container: { borderWidth: 1, borderColor: colors.input, backgroundColor: colors.background }, text: colors.foreground };
    case 'secondary':
      return { container: { backgroundColor: colors.secondary }, text: colors.secondaryForeground };
    case 'ghost':
      return { container: {}, text: colors.foreground };
    case 'link':
      return { container: {}, text: colors.primary };
    default:
      return { container: { backgroundColor: colors.primary }, text: colors.primaryForeground };
  }
}

const useStyles = createStyles(({ radius }) => ({
  base: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: 'continuous',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fullWidth: { alignSelf: 'stretch' },
  disabled: { opacity: 0.5 },
}));

export const buttonStyles = StyleSheet.create({ flex: { flex: 1 } });
