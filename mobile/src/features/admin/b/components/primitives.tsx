import { Check, WifiOff } from 'lucide-react-native';
import type { ReactNode } from 'react';
import Animated from 'react-native-reanimated';
import { Pressable, TextInput, View, type StyleProp, type TextInputProps, type ViewProps, type ViewStyle } from 'react-native';

import { OFFLINE_WRITE_MESSAGE } from '@/lib/connectivity';
import { haptics } from '@/lib/haptics';
import { createStyles, useTheme } from '@/theme';
import { Surface, Text } from '@/ui';

/** Web `bg-card rounded-xl card-shadow` block. */
export function AdminCard({ style, ...props }: ViewProps) {
  const styles = useStyles();
  return <Surface variant="bookmaker" style={[styles.card, style]} {...props} />;
}

/** shadcn `Label` (`text-sm font-medium leading-none`). */
export function FormLabel({ children, color }: { children: ReactNode; color?: 'primary' }) {
  return (
    <Text weight="500" color={color ?? 'foreground'} style={{ lineHeight: 16 }}>
      {children}
    </Text>
  );
}

/** Labelled form control (`space-y-2`). */
export function FormField({ label, children, style }: { label: string; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ gap: 8 }, style]}>
      <FormLabel>{label}</FormLabel>
      {children}
    </View>
  );
}

/** shadcn `Input` without a label. */
export function Input({ style, ...props }: TextInputProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <TextInput
      placeholderTextColor={colors.mutedForeground}
      maxFontSizeMultiplier={1.35}
      style={[styles.input, style]}
      {...props}
    />
  );
}

/** shadcn `Textarea` (`min-h-[80px] rounded-md border px-3 py-2`). */
export function TextArea({ minHeight = 80, style, ...props }: TextInputProps & { minHeight?: number }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <TextInput
      multiline
      textAlignVertical="top"
      placeholderTextColor={colors.mutedForeground}
      maxFontSizeMultiplier={1.35}
      style={[styles.input, styles.textArea, { minHeight }, style]}
      {...props}
    />
  );
}

/** Rounded status chip with explicit colors (web `rounded-full px-2.5 py-0.5 text-xs font-semibold`). */
export function Pill({
  label,
  background,
  color,
  size = 'xs',
  weight = '600',
  paddingX = 10,
  paddingY = 2,
}: {
  label: string;
  background: string;
  color: string;
  size?: 'xs' | '2xs';
  weight?: '500' | '600' | '700' | '400';
  paddingX?: number;
  paddingY?: number;
}) {
  return (
    <View style={{ borderRadius: 999, backgroundColor: background, paddingHorizontal: paddingX, paddingVertical: paddingY }}>
      <Text size={size} weight={weight} style={{ color }}>
        {label}
      </Text>
    </View>
  );
}

/** shadcn `Progress` (`h-4 rounded-full bg-secondary`, indicator `bg-primary`). */
export function ProgressBar({ value }: { value: number }) {
  const styles = useStyles();
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <View
      style={styles.progressTrack}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: clamped }}
    >
      <View style={[styles.progressFill, { width: `${clamped}%` }]} />
    </View>
  );
}

/** shadcn `Checkbox` with its label; the whole row toggles. */
export function CheckboxRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      hitSlop={8}
      onPress={() => {
        haptics.selection();
        onChange(!checked);
      }}
      style={styles.checkboxRow}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked ? <Check size={12} strokeWidth={3} color={colors.primaryForeground} /> : null}
      </View>
      <Text weight="500" style={{ lineHeight: 16 }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Admin writes are disabled offline (contract); shown at the top of each tab. */
export function OfflineNotice() {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.offline} accessibilityRole="alert">
      <WifiOff size={16} color={colors.warning} />
      <Text weight="500" style={{ flex: 1 }}>
        {OFFLINE_WRITE_MESSAGE}
      </Text>
    </View>
  );
}

const useStyles = createStyles(({ colors, radius }) => ({
  card: { borderRadius: radius.xl },
  input: {
    minHeight: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.input,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: 'Inter',
    fontSize: 16,
    color: colors.foreground,
  },
  textArea: { paddingTop: 8 },
  progressTrack: {
    height: 16,
    borderRadius: 999,
    backgroundColor: colors.secondary,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 999 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28 },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.primary },
  offline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
}));

/** Web `animate-spin` for an icon (functional loading feedback). */
export function Spin({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <Animated.View
      style={
        active
          ? {
              animationName: { to: { transform: [{ rotate: '360deg' }] } },
              animationDuration: '1s',
              animationIterationCount: 'infinite',
              animationTimingFunction: 'linear',
            }
          : undefined
      }
    >
      {children}
    </Animated.View>
  );
}
