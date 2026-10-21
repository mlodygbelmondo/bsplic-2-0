import { router } from 'expo-router';
import { memo } from 'react';
import { Pressable, View } from 'react-native';

import { alpha, createStyles } from '@/theme';
import { Text } from '@/ui';
import {
  getMedal,
  getPrimaryMetric,
  getRankingSubline,
  type RankEntry,
  type SortKey,
} from './ranking-logic';

interface RankingRowProps {
  entry: RankEntry;
  rank: number;
  sortBy: SortKey;
  isCurrentUser: boolean;
}

/** Mobile ranking row (web `rankings-mobile-row`): rank, name + summary, sorted metric. */
export const RankingRow = memo(function RankingRow({ entry, rank, sortBy, isCurrentUser }: RankingRowProps) {
  const styles = useStyles();
  const medal = getMedal(rank);
  const metric = getPrimaryMetric(entry, sortBy);
  const podium = rank <= 3;

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${rank}. ${entry.username}${isCurrentUser ? ' (ty)' : ''}, ${metric.label} ${metric.value}`}
      onPress={() => router.push(`/profile/${entry.id}`)}
      style={({ pressed }) => [
        styles.row,
        rank === 1 && styles.first,
        isCurrentUser && styles.current,
        pressed && styles.pressed,
      ]}
    >
      <Text size="base" weight="700" align="center" style={styles.rank}>
        {medal ?? rank}
      </Text>
      <View style={styles.main}>
        <Text weight="500" numberOfLines={1}>
          {entry.username}
          {isCurrentUser ? (
            <Text size="xs" color="mutedForeground" weight="500">
              {' (ty)'}
            </Text>
          ) : null}
        </Text>
        <Text color="mutedForeground" weight={podium ? '600' : '400'} numberOfLines={1} style={styles.subline}>
          {getRankingSubline(entry)}
        </Text>
      </View>
      <View style={styles.metric}>
        <Text color="mutedForeground" weight="600" style={styles.metricLabel}>
          {metric.label}
        </Text>
        <Text
          weight="700"
          tabular
          color={metric.tone ?? 'foreground'}
          style={styles.metricValue}
        >
          {metric.value}
        </Text>
      </View>
    </Pressable>
  );
});

const useStyles = createStyles(({ colors }) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: alpha(colors.card, 0.8),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  first: { borderTopWidth: 1, borderTopColor: colors.border },
  current: {
    backgroundImage: `linear-gradient(${alpha(colors.primary, 0.1)}, ${alpha(colors.primary, 0.1)})`,
  },
  pressed: {
    backgroundImage: `linear-gradient(${alpha(colors.muted, 0.5)}, ${alpha(colors.muted, 0.5)})`,
  },
  rank: { width: 32 },
  main: { flex: 1, minWidth: 0 },
  subline: { marginTop: 4, fontSize: 11, lineHeight: 20 },
  metric: { alignItems: 'flex-end' },
  metricLabel: { fontSize: 10, lineHeight: 20, textTransform: 'uppercase' },
  metricValue: { textAlign: 'right' },
}));
