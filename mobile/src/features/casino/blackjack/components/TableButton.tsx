import type { StyleProp, ViewStyle } from 'react-native';

import { createStyles } from '@/theme';
import { PressScale, Text } from '@/ui';
import { amberButton, bj, white } from './tokens';

export type TableButtonTone = 'amber' | 'glass' | 'sky';

interface TableButtonProps {
  label: string;
  onPress: () => void;
  tone: TableButtonTone;
  disabled?: boolean;
  /** `rounded-2xl` (16) for the action grid, `rounded-xl` (12) elsewhere. */
  radius?: 12 | 16;
  /** Web Button default `text-sm`; the action grid uses `text-base`. */
  size?: 'sm' | 'base';
  bold?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * The table's 48 pt buttons (web shadcn `Button` with casino overrides):
 * amber gradient CTA, translucent glass, or the sky insurance button.
 */
export function TableButton({
  label,
  onPress,
  tone,
  disabled = false,
  radius = 16,
  size = 'base',
  bold = false,
  style,
}: TableButtonProps) {
  const styles = useStyles();
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.base, radius === 12 ? styles.radius12 : styles.radius16, styles[tone], disabled && styles.disabled, style]}
    >
      <Text
        size={size}
        weight={bold ? '700' : '500'}
        numberOfLines={1}
        style={tone === 'amber' ? styles.amberText : tone === 'sky' ? styles.skyText : styles.glassText}
      >
        {label}
      </Text>
    </PressScale>
  );
}

const useStyles = createStyles(() => ({
  base: {
    height: 48,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: 'continuous',
  },
  radius12: { borderRadius: 12 },
  radius16: { borderRadius: 16 },
  amber: { ...amberButton },
  // `border border-white/20 bg-white/10`
  glass: { borderWidth: 1, borderColor: white(0.2), backgroundColor: white(0.1) },
  // `border-sky-400/50 bg-sky-500/20`
  sky: { borderWidth: 1, borderColor: 'rgba(56, 189, 248, 0.5)', backgroundColor: 'rgba(14, 165, 233, 0.2)' },
  disabled: { opacity: 0.5 },
  amberText: { color: bj.black },
  glassText: { color: bj.white },
  skyText: { color: bj.sky50 },
}));
