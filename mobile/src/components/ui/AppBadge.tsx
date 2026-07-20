import { StyleSheet, View, type ViewProps } from 'react-native';

import { useAppTheme } from '@/hooks/use-app-theme';

import { AppText } from './AppText';

export interface AppBadgeProps extends ViewProps {
  label: string;
  tone?: 'primary' | 'neutral' | 'success' | 'warning' | 'danger';
}

export function AppBadge({ label, tone = 'neutral', style, ...props }: AppBadgeProps) {
  const { tokens } = useAppTheme();
  const colors = {
    primary: tokens.colors.primary,
    neutral: tokens.colors.mutedForeground,
    success: tokens.colors.success,
    warning: tokens.colors.warning,
    danger: tokens.colors.destructive,
  };

  return (
    <View
      {...props}
      style={[
        styles.badge,
        { backgroundColor: `${colors[tone]}1F`, borderColor: `${colors[tone]}66` },
        style,
      ]}
    >
      <AppText variant="caption" style={[styles.label, { color: colors[tone] }]}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  label: { fontWeight: '700' },
});
