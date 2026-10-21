import NetInfo from '@react-native-community/netinfo';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';
import { Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { FullWindowOverlay } from 'react-native-screens';
import { create } from 'zustand';

import { holdBoot } from '@/features/boot/boot-store';
import { env } from '@/lib/env';
import { useAppActive } from '@/lib/focus';
import { createMaintenanceModeChecker, MAINTENANCE_CHECK_INTERVAL_MS, MAINTENANCE_STATUS_PATH } from './maintenance';

/** The first check may keep the boot overlay up this long, never longer. */
const BOOT_HOLD_MAX_MS = 3000;

const checkMaintenanceMode = createMaintenanceModeChecker({
  endpoint: `${env.webUrl}${MAINTENANCE_STATUS_PATH}`,
});

const useMaintenanceStore = create<{ active: boolean }>(() => ({ active: false }));

async function refreshMaintenanceMode() {
  const maintenanceMode = await checkMaintenanceMode();
  // `null` = failed or overlapping check: keep the current state (fail open).
  if (maintenanceMode !== null && maintenanceMode !== useMaintenanceStore.getState().active) {
    useMaintenanceStore.setState({ active: maintenanceMode });
  }
}

/**
 * Web maintenance mode (Edge rewrite to `/maintenance.html` plus a client
 * poll). Checks the flag on launch, every 30 s while the app is in the
 * foreground, on returning to the foreground and on reconnecting. While the
 * flag is on, a full-screen maintenance page covers the whole app; it goes
 * away by itself once the flag is turned off.
 */
export function MaintenanceGate() {
  const active = useMaintenanceStore((s) => s.active);
  const appActive = useAppActive();

  useEffect(() => {
    // Hold the boot overlay for the first answer so a cold start during
    // maintenance shows the maintenance page instead of flashing the app.
    const release = holdBoot();
    const timeoutId = setTimeout(release, BOOT_HOLD_MAX_MS);
    void refreshMaintenanceMode().finally(() => {
      clearTimeout(timeoutId);
      release();
    });
    return () => {
      clearTimeout(timeoutId);
      release();
    };
  }, []);

  useEffect(() => {
    if (!appActive) return;
    // Foreground recheck (the launch check above dedupes this first call).
    void refreshMaintenanceMode();
    const intervalId = setInterval(() => void refreshMaintenanceMode(), MAINTENANCE_CHECK_INTERVAL_MS);
    let wasOffline = false;
    const unsubscribe = NetInfo.addEventListener((state) => {
      const offline = state.isConnected === false || state.isInternetReachable === false;
      if (wasOffline && !offline) void refreshMaintenanceMode();
      wasOffline = offline;
    });
    return () => {
      clearInterval(intervalId);
      unsubscribe();
    };
  }, [appActive]);

  if (!active) return null;
  return (
    <Overlay>
      <MaintenanceScreen />
    </Overlay>
  );
}

/** iOS: a window-level overlay so the page also covers open form sheets. */
function Overlay({ children }: { children: ReactNode }) {
  if (Platform.OS === 'ios') {
    return <FullWindowOverlay>{children}</FullWindowOverlay>;
  }
  return <View style={styles.androidOverlay}>{children}</View>;
}

/** Port of `public/maintenance.html` (white page, two images, uppercase line). */
function MaintenanceScreen() {
  const { width, height } = useWindowDimensions();
  // clamp() values from the web page.
  const imageWidth = Math.min(width * 0.42, 360);
  const imageSize = Math.min(imageWidth, height * 0.46);
  const fontSize = Math.min(Math.max(28, width * 0.07), 72);

  return (
    <View
      accessibilityLabel="Przerwa techniczna"
      accessibilityViewIsModal
      style={[
        styles.page,
        {
          paddingVertical: Math.min(Math.max(24, width * 0.06), 72),
          paddingHorizontal: Math.min(Math.max(16, width * 0.05), 48),
        },
      ]}
    >
      <StatusBar style="dark" />
      <View style={[styles.images, { gap: Math.min(Math.max(12, width * 0.03), 36) }]}>
        <Image
          source={require('../../../assets/images/maintenance/thumbs-up.jpeg')}
          style={{ width: imageWidth, height: imageSize }}
          contentFit="contain"
          accessible={false}
        />
        <Image
          source={require('../../../assets/images/maintenance/grin.jpeg')}
          style={{ width: imageWidth, height: imageSize }}
          contentFit="contain"
          accessible={false}
        />
      </View>
      <Text
        maxFontSizeMultiplier={1}
        style={[
          styles.copy,
          { fontSize, lineHeight: fontSize * 0.98, marginTop: Math.min(Math.max(20, width * 0.05), 48) },
        ]}
      >
        jebać kurwa kurwczala
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  androidOverlay: { ...StyleSheet.absoluteFill, zIndex: 9000, elevation: 9000 },
  page: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  images: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  // Impact is not on phones; the PWA falls back to the system sans-serif there.
  copy: {
    color: '#111111',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0,
    width: '100%',
  },
});
