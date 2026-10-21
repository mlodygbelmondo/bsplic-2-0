import { UserX } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import { createStyles, useTheme } from '@/theme';
import { SectionLoader, StateMessage } from '@/ui';

/** Web `SectionLoader label="Wczytywanie profilu..."` in the page padding. Holds the boot overlay. */
export function ProfilePageLoader() {
  const styles = useStyles();
  return (
    <ScrollView scrollEnabled={false} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <SectionLoader label="Wczytywanie profilu..." />
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
  // rounded-xl border border-border bg-card (web "Nie znaleziono wpisu" card)
  stateCard: {
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
}));
