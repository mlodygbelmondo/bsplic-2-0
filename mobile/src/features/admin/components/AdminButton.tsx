import type { ReactNode } from 'react';
import { View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { haptics } from '@/lib/haptics';
import { createStyles, useTheme } from '@/theme';
import { PressScale, Text } from '@/ui';

export type AdminButtonTone = 'gradient' | 'secondary' | 'outline' | 'ghost' | 'ghostDestructive';

interface AdminButtonProps {
  label?: string;
  /** Element rendered before the label (lucide icon or spinner). */
  icon?: ReactNode;
  tone: AdminButtonTone;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  /** Tailwind weight of the label (`font-medium` = 500 by default). */
  weight?: TextStyle['fontWeight'];
  size?: 'sm' | 'base';
  style?: StyleProp<ViewStyle>;
}

/**
 * shadcn `Button` (`rounded-md`) with the admin panel's `min-h-11` and
 * `gradient-primary` overrides, so each call site keeps the web's exact label
 * weight. Cards pass `rounded-lg` through `style`.
 */
export function AdminButton({
  label,
  icon,
  tone,
  onPress,
  disabled,
  accessibilityLabel,
  weight = '500',
  size = 'sm',
  style,
}: AdminButtonProps) {
  const styles = useStyles();
  const textColor = useToneTextColor(tone);

  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      style={[styles.base, styles[tone], disabled && styles.disabled, style]}
    >
      <View style={styles.row}>
        {icon}
        {label ? (
          <Text size={size} weight={weight} style={{ color: textColor }} numberOfLines={1}>
            {label}
          </Text>
        ) : null}
      </View>
    </PressScale>
  );
}

export function useToneTextColor(tone: AdminButtonTone): string {
  const { colors } = useTheme();
  switch (tone) {
    case 'gradient':
      return colors.primaryForeground;
    case 'secondary':
      return colors.secondaryForeground;
    case 'ghostDestructive':
      return colors.destructive;
    default:
      return colors.foreground;
  }
}

const useStyles = createStyles(({ colors, gradients, radius }) => ({
  base: {
    minHeight: 44,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  gradient: {
    backgroundColor: colors.primary,
    backgroundImage: gradients.primary,
    boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)',
  },
  secondary: { backgroundColor: colors.secondary },
  outline: { borderWidth: 1, borderColor: colors.input, backgroundColor: colors.background },
  ghost: {},
  ghostDestructive: { backgroundColor: 'transparent' },
  disabled: { opacity: 0.5 },
}));
