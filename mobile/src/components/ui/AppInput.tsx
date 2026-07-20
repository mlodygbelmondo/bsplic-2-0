import { forwardRef } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { useAppTheme } from '@/hooks/use-app-theme';

import { AppText } from './AppText';

export interface AppInputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
}

export const AppInput = forwardRef<TextInput, AppInputProps>(function AppInput(
  { label, error, helperText, style, editable = true, ...props },
  ref,
) {
  const { tokens } = useAppTheme();
  const describedText = error ?? helperText;

  return (
    <View style={styles.wrapper}>
      {label ? <AppText variant="label">{label}</AppText> : null}
      <TextInput
        ref={ref}
        {...props}
        editable={editable}
        accessibilityLabel={props.accessibilityLabel ?? label}
        accessibilityState={{ disabled: !editable }}
        placeholderTextColor={tokens.colors.mutedForeground}
        selectionColor={tokens.colors.primary}
        style={[
          styles.input,
          {
            backgroundColor: tokens.colors.backgroundElevated,
            borderColor: error ? tokens.colors.destructive : tokens.colors.input,
            borderRadius: tokens.radii.medium,
            color: tokens.colors.foreground,
          },
          !editable && styles.disabled,
          style,
        ]}
      />
      {describedText ? (
        <AppText variant="caption" tone={error ? 'danger' : 'muted'}>
          {describedText}
        </AppText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: { width: '100%', gap: 6 },
  input: { minHeight: 48, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 11, fontSize: 16 },
  disabled: { opacity: 0.55 },
});
