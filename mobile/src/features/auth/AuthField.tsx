import { Eye, EyeOff } from 'lucide-react-native';
import type { ComponentRef, Ref } from 'react';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';

import { createStyles, useTheme } from '@/theme';
import { Text } from '@/ui';

/** Tailwind preflight placeholder colour (`gray-400`), not themed on the web. */
const PLACEHOLDER_COLOR = '#9ca3af';

export interface AuthFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  /** Adds the eye toggle on the right (web password field). */
  passwordToggle?: { visible: boolean; onToggle: () => void };
  ref?: Ref<ComponentRef<typeof TextInput>>;
}

/**
 * Login/reset field (`bg-muted rounded-xl px-4 pt-2.5 pb-2`): label above
 * a 16 px input, with the optional show-password toggle centred on the row.
 */
export function AuthField({ label, passwordToggle, ref, ...inputProps }: AuthFieldProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <View style={styles.column}>
        <Text size="xs" color="mutedForeground" style={styles.label}>
          {label}
        </Text>
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={PLACEHOLDER_COLOR}
          maxFontSizeMultiplier={1.35}
          style={styles.input}
          {...inputProps}
        />
      </View>
      {passwordToggle ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={passwordToggle.visible ? 'Ukryj hasło' : 'Pokaż hasło'}
          hitSlop={12}
          onPress={passwordToggle.onToggle}
          style={styles.toggle}
        >
          {passwordToggle.visible ? (
            <EyeOff size={20} color={colors.mutedForeground} />
          ) : (
            <Eye size={20} color={colors.mutedForeground} />
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = createStyles(({ colors }) => ({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.muted,
    borderRadius: 12,
    borderCurve: 'continuous',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
  },
  column: { flex: 1 },
  label: { marginBottom: 2 },
  input: {
    height: 24,
    padding: 0,
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '500',
    color: colors.foreground,
  },
  toggle: { marginLeft: 8 },
}));
