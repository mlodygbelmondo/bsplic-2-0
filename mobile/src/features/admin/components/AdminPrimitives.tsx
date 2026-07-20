import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  View,
  type ViewStyle,
} from 'react-native';
import { RefreshCw } from 'lucide-react-native';

import { useAppTheme } from '@/hooks/use-app-theme';
import { AppButton, AppCard, AppText } from '@/components/ui';

export function AdminSection({
  title,
  description,
  children,
  style,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  style?: ViewStyle;
}) {
  return (
    <AppCard style={[styles.section, style]}>
      <View style={styles.sectionHeader}>
        <AppText variant="subtitle">{title}</AppText>
        {description ? <AppText variant="caption" tone="muted">{description}</AppText> : null}
      </View>
      {children}
    </AppCard>
  );
}

export function AdminChoice<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange(value: T): void;
}) {
  const { tokens } = useAppTheme();
  return (
    <View style={styles.field}>
      <AppText variant="label">{label}</AppText>
      <View style={styles.choices}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.choice,
                {
                  borderColor: active ? tokens.colors.primary : tokens.colors.border,
                  backgroundColor: active ? `${tokens.colors.primary}18` : tokens.colors.backgroundElevated,
                },
                pressed && styles.pressed,
              ]}
            >
              <AppText variant="label" tone={active ? 'primary' : 'default'}>{option.label}</AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function AdminToggle({
  label,
  description,
  value,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange(value: boolean): void;
  disabled?: boolean;
}) {
  const { tokens } = useAppTheme();
  return (
    <View style={[styles.toggle, { borderColor: tokens.colors.border }]}>
      <View style={styles.toggleCopy}>
        <AppText variant="label">{label}</AppText>
        {description ? <AppText variant="caption" tone="muted">{description}</AppText> : null}
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ false: tokens.colors.muted, true: tokens.colors.primary }}
      />
    </View>
  );
}

export function AdminState({
  loading,
  error,
  empty,
  emptyTitle = 'Brak danych',
  onRetry,
}: {
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyTitle?: string;
  onRetry?(): void;
}) {
  const { tokens } = useAppTheme();
  if (loading) {
    return (
      <View style={styles.state}>
        <ActivityIndicator color={tokens.colors.primary} />
        <AppText tone="muted">Wczytywanie…</AppText>
      </View>
    );
  }
  if (error) {
    return (
      <AppCard inset style={styles.state}>
        <AppText tone="danger" style={styles.center}>{error}</AppText>
        {onRetry ? (
          <AppButton variant="outline" onPress={onRetry} leftAccessory={<RefreshCw size={16} color={tokens.colors.foreground} />}>
            Spróbuj ponownie
          </AppButton>
        ) : null}
      </AppCard>
    );
  }
  if (empty) {
    return <AppCard inset style={styles.state}><AppText tone="muted">{emptyTitle}</AppText></AppCard>;
  }
  return null;
}

export function FieldRow({ children }: { children: ReactNode }) {
  return <View style={styles.fieldRow}>{children}</View>;
}

const styles = StyleSheet.create({
  section: { gap: 16 },
  sectionHeader: { gap: 3 },
  field: { gap: 7 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderWidth: 1, borderRadius: 12 },
  pressed: { opacity: 0.75 },
  toggle: { minHeight: 60, borderWidth: 1, borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  toggleCopy: { flex: 1, gap: 2 },
  state: { minHeight: 130, alignItems: 'center', justifyContent: 'center', gap: 12 },
  center: { textAlign: 'center' },
  fieldRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
});
