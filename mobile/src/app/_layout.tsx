import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { setAudioModeAsync } from 'expo-audio';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Toaster } from 'sonner-native';

import { startAuth, useAuthStore } from '@/features/auth/auth-store';
import { BonusCampaignSurface } from '@/features/bonus-campaigns/BonusCampaignSurface';
import { BootController } from '@/features/boot/BootController';
import { BootOverlay } from '@/features/boot/BootOverlay';
import { initBoot } from '@/features/boot/boot-store';
import { FeaturePollSurface } from '@/features/feature-polls/FeaturePollSurface';
import { ConnectivityWatcher } from '@/features/shell/ConnectivityWatcher';
import { MaintenanceGate } from '@/features/shell/MaintenanceGate';
import {
  NON_PERSISTED_QUERY_ROOTS,
  PERSIST_BUSTER,
  PERSIST_MAX_AGE,
  queryClient,
  queryPersister,
} from '@/lib/query-client';
import { ThemeProvider, useTheme } from '@/theme';
import { formSheet, sheetDefaults } from '@/lib/sheet-options';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);
SplashScreen.setOptions({ fade: true, duration: 200 });
initBoot();
startAuth();
// Casino and notification sounds follow the silent switch and mix with the
// player's music, like web audio in iOS Safari.
void setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => undefined);

const TOAST_SHADOW = '0px 10px 15px -3px rgba(0, 0, 0, 0.1), 0px 4px 6px -4px rgba(0, 0, 0, 0.1)';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister: queryPersister,
            maxAge: PERSIST_MAX_AGE,
            buster: PERSIST_BUSTER,
            dehydrateOptions: {
              shouldDehydrateQuery: (query) =>
                query.state.status === 'success' && !NON_PERSISTED_QUERY_ROOTS.has(String(query.queryKey[0])),
            },
          }}
        >
          <ThemeProvider>
            <RootNavigator />
            <ThemedChrome />
            <ConnectivityWatcher />
            <BootController />
            <SignedInSurfaces />
            <MaintenanceGate />
            <BootOverlay />
          </ThemeProvider>
        </PersistQueryClientProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

function ThemedChrome() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <>
      <StatusBar style="light" />
      {/* Web sonner: system theme, 16px below the safe area (`offset` replaces
          the inset here), 13px text, 8px radius, compact action button. */}
      <Toaster
        position="top-center"
        richColors
        duration={2200}
        theme="system"
        offset={insets.top + 16}
        toastOptions={{
          style: { padding: 16, borderRadius: 8, borderWidth: 1, boxShadow: TOAST_SHADOW },
          toastContentStyle: { gap: 6 },
          titleStyle: { fontSize: 13, lineHeight: 19.5, fontWeight: '500' },
          descriptionStyle: { fontSize: 13, lineHeight: 19.5 },
          actionButtonStyle: {
            height: 24,
            paddingHorizontal: 8,
            paddingVertical: 0,
            borderRadius: 4,
            borderWidth: 0,
            justifyContent: 'center',
            backgroundColor: colors.foreground,
          },
          actionButtonTextStyle: { fontSize: 12, lineHeight: 16, fontWeight: '500', color: colors.background },
        }}
      />
    </>
  );
}

/** Global signed-in overlays (web mounts them in App.tsx). */
function SignedInSurfaces() {
  const signedIn = useAuthStore((s) => s.user !== null);
  if (!signedIn) return null;
  return (
    <>
      <BonusCampaignSurface />
      <FeaturePollSurface />
    </>
  );
}

function RootNavigator() {
  const signedIn = useAuthStore((s) => s.user !== null);
  // Web coupon panel: min(viewport - 6rem, 680px) tall.
  const { height } = useWindowDimensions();
  const couponDetent = Math.min(height - 96, 680) / height;

  return (
    <Stack
      screenOptions={({ route }) => ({
        headerShown: false,
        ...(route.name.startsWith('sheets/') ? sheetDefaults : null),
      })}
    >
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="profile/[userId]" />
        <Stack.Screen name="social/[itemType]/[itemId]" />
        <Stack.Screen name="replay" />
        <Stack.Screen name="admin" />
        <Stack.Screen
          name="jackpot/draw/[roundId]"
          options={{ presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }}
        />
        <Stack.Screen name="sheets/menu" options={formSheet([0.75, 1])} />
        <Stack.Screen name="sheets/topup" options={formSheet('fitToContents')} />
        <Stack.Screen name="sheets/wallet" options={formSheet([0.92])} />
        <Stack.Screen name="sheets/notifications" options={formSheet([0.6, 1])} />
        <Stack.Screen name="sheets/coupon" options={formSheet([couponDetent, 1])} />
        <Stack.Screen name="sheets/sort-bets" options={formSheet('fitToContents')} />
        <Stack.Screen name="sheets/propose-bet" options={formSheet([1])} />
        <Stack.Screen name="sheets/reactors" options={formSheet([0.5, 1])} />
        <Stack.Screen name="sheets/compose-post" options={formSheet([1])} />
        <Stack.Screen name="sheets/compose-story" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="sheets/story-viewer" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="sheets/image-viewer" options={{ presentation: 'transparentModal', animation: 'fade' }} />
        <Stack.Screen name="sheets/roulette-stake" options={formSheet('fitToContents')} />
        <Stack.Screen name="sheets/slot-rules" options={formSheet([0.7, 1])} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" options={{ animation: 'fade' }} />
      </Stack.Protected>
      <Stack.Screen name="reset-password" options={{ animation: 'fade' }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}
