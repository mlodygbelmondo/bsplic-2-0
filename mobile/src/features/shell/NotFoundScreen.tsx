import { router, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { useAuthStore } from '@/features/auth/auth-store';
import { createStyles } from '@/theme';
import { Button, ScreenBackground, Text } from '@/ui';

/** Web `NotFound` (route `*`). */
export function NotFoundScreen() {
  const styles = useStyles();
  const pathname = usePathname();
  const signedIn = useAuthStore((s) => s.user !== null);

  useEffect(() => {
    console.warn('404 Error: User attempted to access non-existent route:', pathname);
  }, [pathname]);

  return (
    <ScreenBackground style={styles.root}>
      <View style={styles.column}>
        <Text weight="900" align="center" accessibilityRole="header" style={styles.code}>
          404
        </Text>
        <Text size="xl" weight="600" align="center" style={styles.title}>
          Ta strona nie istnieje
        </Text>
        <Text color="mutedForeground" align="center" style={styles.description}>
          Sprawdź adres lub wróć na stronę główną.
        </Text>
        <Button
          variant="gradient"
          accessibilityLabel="Wróć na stronę główną"
          label="Wróć na stronę główną"
          onPress={() => router.replace(signedIn ? '/' : '/sign-in')}
          style={styles.button}
        />
      </View>
    </ScreenBackground>
  );
}

const useStyles = createStyles(() => ({
  root: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  column: { alignItems: 'center' },
  // text-5xl font-black tracking-tight
  code: { fontSize: 48, lineHeight: 52, letterSpacing: -1.2, marginBottom: 8 },
  title: { marginBottom: 4 },
  description: { marginBottom: 24 },
  // h-11 rounded-xl px-6 text-sm font-bold
  button: { height: 44, borderRadius: 12, paddingHorizontal: 24 },
}));
