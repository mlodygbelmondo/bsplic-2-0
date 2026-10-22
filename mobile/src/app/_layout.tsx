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
import { PERSIST_BUSTER, queryClient, queryPersister } from '@/lib/query-client';
import { PERSIST_MAX_AGE, shouldPersistQuery } from '@/lib/query-persistence';
import { ThemeProvider, useTheme } from '@/theme';
import { formSheet, overlayScreen, sheetDefaults } from '@/lib/sheet-options';
import { useTrackVisibleRoutes } from '@/lib/focus';

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
            dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
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
        // Same cap as the app's text: the fixed-height action button would overflow at accessibility sizes.
        maxFontSizeMultiplier={1.35}
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
  useTrackVisibleRoutes();
  const signedIn = useAuthStore((s) => s.user !== null);
  // Until the stored session is read, keep the signed-in routes open so a
  // cold-start deep link is not redirected away; the boot overlay covers it.
  const authLoading = useAuthStore((s) => s.loading);
  // Web coupon panel: min(viewport - 6rem, 680px) tall, 8px above the bottom.
  // iOS resolves detent fractions against the full-height sheet (window minus
  // the top inset) and floats lower detents ~9pt in from the top and bottom.
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const couponDetent = Math.min((Math.min(height - 96, 680) + 18) / (height - insets.top), 1);

  return (
    <Stack
      screenOptions={({ route }) => ({
        headerShown: false,
        ...(route.name.startsWith('sheets/') ? sheetDefaults : null),
      })}
    >
      <Stack.Protected guard={signedIn || authLoading}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="profile/[userId]" />
        <Stack.Screen name="social/[itemType]/[itemId]" />
        <Stack.Screen name="replay" />
        <Stack.Screen name="admin" />
        <Stack.Screen
          name="jackpot/draw/[roundId]"
          options={{ presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }}
        />
        <Stack.Screen dangerouslySingular name="sheets/menu" options={overlayScreen} />
        <Stack.Screen dangerouslySingular name="sheets/topup" options={overlayScreen} />
        <Stack.Screen dangerouslySingular name="sheets/wallet" options={overlayScreen} />
        <Stack.Screen dangerouslySingular name="sheets/notifications" options={overlayScreen} />
        <Stack.Screen dangerouslySingular name="sheets/coupon" options={formSheet([couponDetent, 1])} />
        <Stack.Screen dangerouslySingular name="sheets/sort-bets" options={formSheet('fitToContents')} />
        <Stack.Screen dangerouslySingular name="sheets/propose-bet" options={overlayScreen} />
        <Stack.Screen dangerouslySingular name="sheets/reactors" options={overlayScreen} />
        <Stack.Screen dangerouslySingular name="sheets/compose-post" options={formSheet('fitToContents')} />
        <Stack.Screen dangerouslySingular name="sheets/compose-story" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen dangerouslySingular name="sheets/story-viewer" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen dangerouslySingular name="sheets/image-viewer" options={{ presentation: 'transparentModal', animation: 'fade' }} />
        <Stack.Screen dangerouslySingular name="sheets/roulette-stake" options={formSheet('fitToContents')} />
        <Stack.Screen dangerouslySingular name="sheets/slot-rules" options={overlayScreen} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn && !authLoading}>
        <Stack.Screen name="sign-in" options={{ animation: 'fade' }} />
      </Stack.Protected>
      <Stack.Screen name="reset-password" options={{ animation: 'fade' }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}
