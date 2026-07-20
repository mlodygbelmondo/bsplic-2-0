import { StyleSheet, View, type ViewProps } from 'react-native';

import { useAppTheme } from '@/hooks/use-app-theme';

export interface AppCardProps extends ViewProps {
  elevated?: boolean;
  inset?: boolean;
}

export function AppCard({ elevated = true, inset = false, style, ...props }: AppCardProps) {
  const { tokens } = useAppTheme();
  return (
    <View
      {...props}
      style={[
        styles.card,
        {
          backgroundColor: inset ? tokens.colors.muted : tokens.colors.card,
          borderColor: tokens.colors.border,
          borderRadius: tokens.radii.large,
        },
        elevated && !inset && styles.elevated,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  elevated: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 5,
  },
});
