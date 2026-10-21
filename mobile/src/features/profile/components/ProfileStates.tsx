import { UserX } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import { useBootHold } from '@/features/boot/boot-store';
import { PlayerCardHeroSkeleton } from '@/features/player-card/PlayerCardHero';
import { createStyles, useTheme } from '@/theme';
import { Skeleton, StateMessage } from '@/ui';
import { ProfileHeaderCardSkeleton } from './ProfileHeaderCard';
import { HistorySkeleton } from './ProfileHistoryPanel';
import { useSurfaceStyles } from './surfaces';

const CHIP_WIDTHS = [86, 74, 82, 64, 66];

/** Page placeholder with the final layout (header card, player card, history). Holds the boot overlay. */
export function ProfilePageSkeleton({ isOwnProfile }: { isOwnProfile: boolean }) {
  useBootHold();
  const surfaces = useSurfaceStyles();
  const styles = useStyles();
  const { radius } = useTheme();
  return (
    <ScrollView
      scrollEnabled={false}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      accessibilityLabel="Wczytywanie profilu..."
    >
      <ProfileHeaderCardSkeleton isOwnProfile={isOwnProfile} />
      <PlayerCardHeroSkeleton />
      <View style={[surfaces.card, styles.historyCard]}>
        <View style={styles.historyHeader}>
          <Skeleton width={72} height={16} style={styles.titleBar} />
          <Skeleton width={150} height={38} radius={radius.lg} />
        </View>
        <View style={styles.chipRow}>
          {CHIP_WIDTHS.map((width) => (
            <Skeleton key={width} width={width} height={30} radius={9999} />
          ))}
        </View>
        <HistorySkeleton />
      </View>
    </ScrollView>
  );
}

function StateCard({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <View style={styles.stateCard}>{children}</View>
    </ScrollView>
  );
}

/** A `/profile/<id or username>` link that points at no player (`get_public_profile` returned `{}`). */
export function ProfileNotFound() {
  const { colors } = useTheme();
  return (
    <StateCard>
      <StateMessage
        icon={<UserX size={32} color={colors.mutedForeground} />}
        title="Nie znaleziono profilu"
        description="Ten profil mógł zostać usunięty albo link jest nieprawidłowy."
      />
    </StateCard>
  );
}

export function ProfileLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <StateCard>
      <StateMessage title="Nie udało się załadować profilu" actionLabel="Spróbuj ponownie" onAction={onRetry} />
    </StateCard>
  );
}

const useStyles = createStyles(({ colors }) => ({
  content: { padding: 16, gap: 16 },
  historyCard: { padding: 16 },
  historyHeader: { marginBottom: 12, gap: 12 },
  titleBar: { marginVertical: 4 },
  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 16, overflow: 'hidden' },
  // rounded-xl border border-border bg-card (web "Nie znaleziono wpisu" card)
  stateCard: {
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
}));
