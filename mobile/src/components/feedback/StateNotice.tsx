import { AlertCircle, CloudOff, Inbox, RefreshCcw, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/hooks/use-app-theme';

export type StateNoticeKind = 'empty' | 'error' | 'offline';

export interface StateNoticeProps extends ViewProps {
  kind: StateNoticeKind;
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

const defaults: Record<StateNoticeKind, { title: string; message: string; icon: LucideIcon }> = {
  empty: { title: 'Tu jest jeszcze pusto', message: 'Nowe elementy pojawią się tutaj.', icon: Inbox },
  error: { title: 'Coś poszło nie tak', message: 'Spróbuj ponownie za chwilę.', icon: AlertCircle },
  offline: {
    title: 'Brak połączenia',
    message: 'Możesz przeglądać zapisane dane. Operacje wymagające internetu są wyłączone.',
    icon: CloudOff,
  },
};

export function StateNotice({
  kind,
  title,
  message,
  actionLabel = 'Spróbuj ponownie',
  onAction,
  style,
  ...props
}: StateNoticeProps) {
  const { tokens } = useAppTheme();
  const fallback = defaults[kind];
  const Icon = fallback.icon;

  return (
    <View
      {...props}
      accessibilityRole={kind === 'error' ? 'alert' : undefined}
      style={[styles.container, { borderColor: tokens.colors.border }, style]}
    >
      <View style={[styles.icon, { backgroundColor: `${tokens.colors.primary}18` }]}>
        <Icon color={kind === 'error' ? tokens.colors.destructive : tokens.colors.primary} size={24} />
      </View>
      <AppText variant="subtitle" style={styles.center}>{title ?? fallback.title}</AppText>
      <AppText tone="muted" style={styles.center}>{message ?? fallback.message}</AppText>
      {onAction ? (
        <AppButton variant="outline" onPress={onAction} leftAccessory={<RefreshCcw size={16} color={tokens.colors.primary} />}>
          {actionLabel}
        </AppButton>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 10, padding: 24, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16 },
  icon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
});
