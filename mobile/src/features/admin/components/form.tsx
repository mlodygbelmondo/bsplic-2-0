import type { ComponentRef, ReactNode, Ref } from 'react';
import {
  Switch as NativeSwitch,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { haptics } from '@/lib/haptics';
import { createStyles, useTheme } from '@/theme';
import { Text } from '@/ui';

/** shadcn `Input` (`h-10 rounded-md border border-input bg-background px-3 text-base`). */
export function Input({
  disabled,
  style,
  ref,
  ...props
}: TextInputProps & { disabled?: boolean; ref?: Ref<ComponentRef<typeof TextInput>> }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <TextInput
      ref={ref}
      editable={!disabled}
      placeholderTextColor={colors.mutedForeground}
      selectionColor={colors.primary}
      style={[styles.input, disabled && styles.disabled, style]}
      {...props}
    />
  );
}

/** shadcn `Label` (`text-sm font-medium leading-none`). */
export function FieldLabel({ children, color }: { children: ReactNode; color?: 'primary' | 'foreground' }) {
  return (
    <Text weight="500" color={color ?? 'foreground'} style={{ lineHeight: 14 }}>
      {children}
    </Text>
  );
}

/** `text-xs font-semibold text-muted-foreground uppercase tracking-wider`. */
export function CapsLabel({ children }: { children: ReactNode }) {
  return (
    <Text size="xs" weight="600" color="mutedForeground" style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
      {children}
    </Text>
  );
}

/** shadcn `Switch` (`bg-primary` checked, `bg-input` unchecked). */
export function Switch({
  value,
  onValueChange,
  accessibilityLabel,
  disabled,
}: {
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <NativeSwitch
      value={value}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      onValueChange={(next) => {
        haptics.selection();
        onValueChange(next);
      }}
      trackColor={{ false: colors.input, true: colors.primary }}
      ios_backgroundColor={colors.input}
      thumbColor="#ffffff"
    />
  );
}

/** Bordered row with a label (and optional description) and a switch. */
export function SwitchRow({
  label,
  description,
  value,
  onValueChange,
  accessibilityLabel,
  labelColor,
  variant = 'compact',
  disabled,
}: {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel?: string;
  labelColor?: 'primary' | 'foreground';
  /** `compact` = edit dialog (`rounded-lg p-3`), `card` = create tab (`rounded-xl p-4 bg-background`). */
  variant?: 'compact' | 'card';
  disabled?: boolean;
}) {
  const styles = useStyles();
  return (
    <View style={[styles.switchRow, variant === 'card' ? styles.switchCard : styles.switchCompact]}>
      <View style={styles.switchText}>
        <FieldLabel color={labelColor}>{label}</FieldLabel>
        {description ? (
          <Text size="xs" color="mutedForeground">
            {description}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        accessibilityLabel={accessibilityLabel ?? label}
        disabled={disabled}
      />
    </View>
  );
}

/** `bg-card rounded-xl border border-border p-4 shadow-sm space-y-4`. */
export function FormCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  return <View style={[styles.card, style]}>{children}</View>;
}

const useStyles = createStyles(({ colors, radius }) => ({
  input: {
    height: 40,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.input,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingVertical: 0,
    fontFamily: 'Inter',
    fontSize: 16,
    color: colors.foreground,
  },
  disabled: { opacity: 0.5 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderCurve: 'continuous',
  },
  switchCompact: { borderRadius: radius.lg, padding: 12 },
  switchCard: { borderRadius: 12, padding: 16, backgroundColor: colors.background },
  switchText: { flex: 1, gap: 2 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 16,
    boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)',
  },
}));
