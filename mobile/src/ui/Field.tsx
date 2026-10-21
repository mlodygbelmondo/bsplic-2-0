import type { ComponentRef, ReactNode, Ref } from 'react';
import { TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';

import { createStyles, useTheme } from '@/theme';
import { Text } from './Text';

export interface FieldProps extends TextInputProps {
  label?: string;
  /** Element at the trailing edge (e.g. show-password toggle). */
  trailing?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  /**
   * `filled` = the login field (`bg-muted rounded-xl px-4 pt-2.5 pb-2`, label inside),
   * `outline` = shadcn Input (`h-10 rounded-md border border-input px-3`).
   */
  variant?: 'filled' | 'outline';
}

export function Field({
  label,
  trailing,
  containerStyle,
  variant = 'outline',
  style,
  ref,
  ...props
}: FieldProps & { ref?: Ref<ComponentRef<typeof TextInput>> }) {
  const styles = useStyles();
  const { colors } = useTheme();
  if (variant === 'filled') {
    return (
      <View style={[styles.filled, containerStyle]}>
        {label ? (
          <Text size="xs" color="mutedForeground" style={{ marginBottom: 2 }}>
            {label}
          </Text>
        ) : null}
        <View style={styles.row}>
          <TextInput
            ref={ref}
            placeholderTextColor={colors.mutedForeground}
            style={[styles.filledInput, style]}
            {...props}
          />
          {trailing}
        </View>
      </View>
    );
  }
  return (
    <View style={[{ gap: 8 }, containerStyle]}>
      {label ? (
        <Text weight="500">{label}</Text>
      ) : null}
      <View style={[styles.outline, styles.row]}>
        <TextInput ref={ref} placeholderTextColor={colors.mutedForeground} style={[styles.outlineInput, style]} {...props} />
        {trailing}
      </View>
    </View>
  );
}

const useStyles = createStyles(({ colors, radius }) => ({
  row: { flexDirection: 'row', alignItems: 'center' },
  filled: {
    backgroundColor: colors.muted,
    borderRadius: 12,
    borderCurve: 'continuous',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
  },
  filledInput: {
    flex: 1,
    padding: 0,
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '500',
    color: colors.foreground,
  },
  outline: {
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.input,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
  },
  outlineInput: {
    flex: 1,
    padding: 0,
    fontFamily: 'Inter',
    fontSize: 16,
    color: colors.foreground,
  },
}));
