import '@/global.css';

import { useEffect } from 'react';
import { ThemeProvider } from 'expo-router';
import { Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage from 'expo-sqlite/kv-store';
import { useFonts } from 'expo-font';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Inter_900Black } from '@expo-google-fonts/inter/900Black';
import { Text, View } from 'react-native';

import { AuthenticatedShell } from '@/components/navigation/AuthenticatedShell';
import { AppLoader } from '@/components/feedback/AppLoader';
import { AppButton } from '@/components/ui';
import { LoginScreen } from '@/features/auth/components/login-screen';
import { AppThemeProvider, useAppTheme } from '@/hooks/use-app-theme';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { CouponProvider } from '@/providers/coupon-provider';
import { NetworkProvider } from '@/providers/network-provider';
import { QueryProvider } from '@/providers/query-provider';

void SplashScreen.preventAutoHideAsync();

function RoutedApplication() {
  const pathname = usePathname();
  const { navigationTheme, tokens } = useAppTheme();
  const { user, profile, loading, error, refreshProfile, signOut } = useAuth();
  const publicResetRoute = pathname === '/reset-password';

  if (loading || (user && !profile && !error)) return <AppLoader label="Uruchamianie BSPLIC…" />;
  if (user && !profile) {
    return <View style={{ flex: 1, justifyContent: 'center', gap: 16, padding: 24, backgroundColor: tokens.colors.background }}>
      <Text style={{ color: tokens.colors.foreground, textAlign: 'center', fontSize: 20, fontWeight: '900' }}>Nie udało się wczytać profilu</Text>
      <Text style={{ color: tokens.colors.mutedForeground, textAlign: 'center' }}>Sprawdź połączenie i spróbuj ponownie. Możesz też bezpiecznie wylogować się z tego urządzenia.</Text>
      <AppButton onPress={() => void refreshProfile().catch(() => undefined)}>Spróbuj ponownie</AppButton>
      <AppButton variant="secondary" onPress={() => void signOut().catch(() => undefined)}>Wyloguj</AppButton>
    </View>;
  }
  if (!user && !publicResetRoute) return <LoginScreen />;

  const routes = <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />;
  return <ThemeProvider value={navigationTheme}>{publicResetRoute ? routes : <AuthenticatedShell>{routes}</AuthenticatedShell>}</ThemeProvider>;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_900Black });
  useEffect(() => { if (fontsLoaded || fontError) void SplashScreen.hideAsync(); }, [fontError, fontsLoaded]);
  if (!fontsLoaded && !fontError) return null;
  return <AppThemeProvider storage={AsyncStorage} initialTheme="dark"><NetworkProvider><QueryProvider><AuthProvider><CouponProvider><RoutedApplication /></CouponProvider></AuthProvider></QueryProvider></NetworkProvider></AppThemeProvider>;
}
