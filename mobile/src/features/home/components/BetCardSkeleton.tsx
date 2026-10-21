import { View } from 'react-native';

import { createStyles, hsl } from '@/theme';
import { Skeleton } from '@/ui';
import { GAP_STYLES, type RowGap } from './BetRow';

/**
 * Placeholder with the exact box of a two-option `BetCard`: meta row, title,
 * date line, odds chips and probability bar.
 */
export function BetCardSkeleton({ gap }: { gap: RowGap }) {
  const styles = useStyles();
  return (
    <View style={[styles.row, GAP_STYLES[gap]]}>
      <View style={styles.card}>
        <View style={styles.topBar}>
          <Skeleton width={84} height={11} radius={4} />
          <Skeleton width={26} height={10} radius={4} />
        </View>
        <View style={styles.body}>
          <View style={styles.titleBlock}>
            <View style={styles.titleLine}>
              <Skeleton width="62%" height={16} radius={4} />
            </View>
            <View style={styles.dateLine}>
              <Skeleton width={72} height={12} radius={4} />
            </View>
          </View>
          <View style={styles.chips}>
            <Skeleton height={56} radius={12} style={styles.chip} />
            <Skeleton height={56} radius={12} style={styles.chip} />
          </View>
          <Skeleton height={3} radius={9999} style={styles.bar} />
        </View>
      </View>
    </View>
  );
}

const useStyles = createStyles(({ colors, gradients, shadows, scheme }) => ({
  row: { paddingHorizontal: 12 },
  card: {
    borderRadius: 20,
    borderCurve: 'continuous',
    borderWidth: 1,
    overflow: 'hidden',
    borderColor: scheme === 'dark' ? hsl(355, 75, 50, 0.24) : colors.border,
    backgroundColor: colors.card,
    ...(scheme === 'dark' ? { backgroundImage: gradients.bookmakerSurfaceStrong, boxShadow: shadows.betCard } : null),
  },
  // Same paddings and line boxes as BetCard: 10 + 16 + 2 on top.
  topBar: {
    height: 28,
    paddingTop: 10,
    paddingBottom: 2,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  body: { paddingHorizontal: 14, paddingTop: 6, paddingBottom: 12 },
  titleBlock: { marginBottom: 12, alignItems: 'center' },
  titleLine: { height: 20, width: '100%', alignItems: 'center', justifyContent: 'center' },
  dateLine: { marginTop: 4, height: 18, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { flex: 1 },
  bar: { marginTop: 8 },
}));
