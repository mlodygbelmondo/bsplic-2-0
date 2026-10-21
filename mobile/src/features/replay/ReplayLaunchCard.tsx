import { router } from 'expo-router';
import { ArrowRight, ChartNoAxesCombined } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { useUserId } from '@/features/auth/auth-store';
import { queryClient } from '@/lib/query-client';
import { alpha, createStyles, useTheme } from '@/theme';
import { Surface, Text } from '@/ui';
import { replayHistoryQuery } from './api/replay-history';

/** Own-profile entry to `/replay`. Prefetches the history snapshot on press-in. */
export function ReplayLaunchCard() {
  const styles = useStyles();
  const { colors } = useTheme();
  const userId = useUserId();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel="Replay. Bilans i historia kuponów"
      onPressIn={() => {
        if (userId) void queryClient.prefetchQuery(replayHistoryQuery(userId));
      }}
      onPress={() => router.push('/replay')}
    >
      {({ pressed }) => (
        <Surface variant="app" style={[styles.card, pressed && styles.cardPressed]}>
          <ChartNoAxesCombined size={22} color={colors.primary} />
          <View style={styles.text}>
            <Text size="base" weight="600">Replay</Text>
            <Text color="mutedForeground" style={styles.subtitle}>Bilans i historia kuponów</Text>
          </View>
          <ArrowRight size={18} color={pressed ? colors.foreground : colors.mutedForeground} />
        </Surface>
      )}
    </Pressable>
  );
}

const useStyles = createStyles(({ colors }) => ({
  card: { minHeight: 80, flexDirection: 'row', alignItems: 'center', gap: 16, borderRadius: 12, padding: 16 },
  // Web hover: `hover:border-primary/40`, arrow turns foreground.
  cardPressed: { borderColor: alpha(colors.primary, 0.4) },
  text: { flex: 1, minWidth: 0 },
  subtitle: { marginTop: 2 },
}));
