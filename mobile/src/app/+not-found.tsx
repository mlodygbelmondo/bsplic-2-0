import { Linking, StyleSheet, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { ExternalLink, House } from 'lucide-react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/hooks/use-app-theme';
import { env } from '@/lib/env';

export default function NotFoundRoute() {
  const pathname = usePathname();
  const { tokens } = useAppTheme();
  const webUrl = `${env.webUrl}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;

  return (
    <View style={[styles.screen, { backgroundColor: tokens.colors.background }]}>
      <View style={[styles.mark, { backgroundColor: `${tokens.colors.primary}18`, borderColor: `${tokens.colors.primary}38` }]}>
        <AppText tone="primary" style={styles.question}>?</AppText>
      </View>
      <AppText variant="title" style={styles.center}>Nie znaleziono ekranu</AppText>
      <AppText tone="muted" style={styles.center}>Ten link nie jest jeszcze obsługiwany w aplikacji. Możesz wrócić do zakładów albo otworzyć go w BSPLIC w przeglądarce.</AppText>
      <View style={styles.actions}>
        <AppButton fullWidth onPress={() => router.replace('/')} leftAccessory={<House color={tokens.colors.primaryForeground} size={18} />}>Wróć do zakładów</AppButton>
        <AppButton fullWidth variant="outline" onPress={() => void Linking.openURL(webUrl)} leftAccessory={<ExternalLink color={tokens.colors.primary} size={18} />}>Otwórz w przeglądarce</AppButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 28 },
  mark: { width: 88, height: 88, borderRadius: 28, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  question: { fontSize: 52, lineHeight: 60, fontWeight: '900' },
  center: { textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: 10, marginTop: 12 },
});
