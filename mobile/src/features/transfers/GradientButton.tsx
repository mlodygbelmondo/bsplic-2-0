import type { ReactNode } from 'react';
import { View } from 'react-native';

import { haptics } from '@/lib/haptics';
import { createStyles } from '@/theme';
import { PressScale, Text } from '@/ui';

/** Web `Button` with `h-11 w-full gradient-primary font-bold` (wallet CTAs). */
export function GradientButton({
  label,
  icon,
  disabled,
  onPress,
}: {
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      style={[styles.button, disabled && styles.disabled]}
    >
      <View style={styles.row}>
        {icon}
        <Text weight="700" color="primaryForeground">
          {label}
        </Text>
      </View>
    </PressScale>
  );
}

const useStyles = createStyles(({ gradients, radius }) => ({
  button: {
    height: 44,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    backgroundImage: gradients.primary,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  disabled: { opacity: 0.5 },
}));
