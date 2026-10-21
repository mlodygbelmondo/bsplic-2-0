import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { type EntryExitAnimationFunction } from 'react-native-reanimated';

import { createStyles } from '@/theme';
import { Text } from '@/ui';

import { rgba, tw } from '../../shared/casinoTheme';

interface RailCardProps {
  Icon: LucideIcon;
  title: string;
  /** Extra header content next to the title (streak badge). */
  titleAccessory?: ReactNode;
  /** Right side of the header (count pill, carousel arrows). */
  right?: ReactNode;
  /** `mb-2` instead of `mb-3` under the header (empty wins feed). */
  tightHeader?: boolean;
  entering?: EntryExitAnimationFunction;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

/**
 * The table's side cards (`rounded-2xl border border-white/10 bg-white/[0.03]
 * p-4 backdrop-blur-sm`) with the amber icon + uppercase title header. The
 * backdrop blur is left out: the cards sit on an already dimmed table photo.
 */
export function RailCard({ Icon, title, titleAccessory, right, tightHeader, entering, style, children }: RailCardProps) {
  const styles = useStyles();
  return (
    <Animated.View entering={entering} style={[styles.card, style]}>
      <View style={[styles.header, tightHeader && styles.headerTight]}>
        <View style={styles.titleRow}>
          <Icon size={16} color={tw.amber400} />
          <Text size="xs" weight="600" accessibilityRole="header" style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {titleAccessory}
        </View>
        {right}
      </View>
      {children}
    </Animated.View>
  );
}

const useStyles = createStyles(() => ({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: rgba(tw.white, 0.1),
    backgroundColor: rgba(tw.white, 0.03),
    padding: 16,
  },
  header: { marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headerTight: { marginBottom: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, minWidth: 0 },
  // `text-xs font-semibold uppercase tracking-wider text-white/40`
  title: { textTransform: 'uppercase', letterSpacing: 0.6, color: rgba(tw.white, 0.4), flexShrink: 0 },
}));
