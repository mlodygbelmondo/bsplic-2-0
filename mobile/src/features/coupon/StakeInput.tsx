import { useState } from 'react';
import { TextInput, type TextInputProps } from 'react-native';

import { createStyles, useTheme } from '@/theme';

import { normalizeStakeInput } from './placement';

interface StakeInputProps extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  value: string;
  onChangeValue: (value: string) => void;
  /** `single` = per-bet input (`h-8 font-semibold`), `ako` = coupon stake (`h-9 font-bold`). */
  variant: 'single' | 'ako';
}

/**
 * Web stake `Input` (`type="number"`, `bg-muted border-border text-center`,
 * 16px so nothing zooms, select-all on focus, focus ring).
 */
export function StakeInput({ value, onChangeValue, variant, style, onFocus, onBlur, ...props }: StakeInputProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <TextInput
      value={value}
      onChangeText={(text) => onChangeValue(normalizeStakeInput(text))}
      keyboardType="decimal-pad"
      returnKeyType="done"
      selectTextOnFocus
      maxFontSizeMultiplier={1.35}
      placeholderTextColor={colors.mutedForeground}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      style={[styles.base, variant === 'ako' ? styles.ako : styles.single, focused && styles.focused, style]}
      {...props}
    />
  );
}

const useStyles = createStyles(({ colors, radius }) => ({
  base: {
    borderRadius: radius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
    paddingHorizontal: 12,
    paddingVertical: 0,
    fontFamily: 'Inter',
    fontSize: 16,
    color: colors.foreground,
    textAlign: 'center',
  },
  single: { height: 32, fontWeight: '600' },
  ako: { height: 36, fontWeight: '700' },
  // shadcn `focus-visible:ring-2 ring-ring ring-offset-2`.
  focused: { outlineWidth: 2, outlineStyle: 'solid', outlineColor: colors.ring, outlineOffset: 2 },
}));
