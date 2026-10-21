import { View } from 'react-native';

import { useTheme } from '@/theme';
import { Text } from './Text';

/** TEMPORARY scaffold for routes whose feature worker has not landed yet. Must not ship. */
export function RoutePlaceholder({ name }: { name: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, gap: 8 }}>
      <Text weight="700">{name}</Text>
      <Text color="mutedForeground">W budowie</Text>
    </View>
  );
}
