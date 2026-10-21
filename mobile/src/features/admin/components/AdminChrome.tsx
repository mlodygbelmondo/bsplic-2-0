import { WifiOff } from 'lucide-react-native';
import { createContext, use, type ReactElement, type ReactNode } from 'react';
import {
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type RefreshControlProps,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import type { SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OFFLINE_WRITE_MESSAGE, useIsOffline } from '@/lib/connectivity';
import { createStyles, useTheme } from '@/theme';
import { Text } from '@/ui';

/** Height of the web `pb-[calc(5rem+env(safe-area-inset-bottom))]` reserve above the nav. */
export const ADMIN_NAV_RESERVE = 80;

export interface AdminChrome {
  /** Heading of the active tab (web mobile `h1`). */
  title: string;
  /** Feed every admin scroll container into the nav's hide-on-scroll logic. */
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** 0 = bottom nav shown, 1 = hidden (animated). */
  navHidden: SharedValue<number>;
}

export const AdminChromeContext = createContext<AdminChrome | null>(null);

export function useAdminChrome(): AdminChrome {
  const chrome = use(AdminChromeContext);
  if (!chrome) throw new Error('useAdminChrome must be used inside the admin shell');
  return chrome;
}

/** Bottom padding of every admin scroll container: web `p-4` + nav reserve + home indicator. */
export function useAdminContentBottomPadding(extra = 0) {
  const insets = useSafeAreaInsets();
  return 16 + ADMIN_NAV_RESERVE + insets.bottom + extra;
}

/**
 * Mobile page heading (`text-2xl font-bold tracking-tight mb-6`). Tabs with
 * writes pass `offlineNote` to explain why their actions are disabled.
 */
export function AdminPageHeader({ offlineNote = false }: { offlineNote?: boolean }) {
  const styles = useStyles();
  const { title } = useAdminChrome();
  const offline = useIsOffline();
  return (
    <View style={styles.header}>
      <Text size="2xl" weight="700" accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {offlineNote && offline ? <AdminOfflineNote /> : null}
    </View>
  );
}

/** Admin writes are disabled offline; this tells the user why. */
export function AdminOfflineNote() {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.offline} accessibilityLiveRegion="polite">
      <WifiOff size={16} color={colors.mutedForeground} />
      <Text size="xs" color="mutedForeground" style={styles.flex}>
        {OFFLINE_WRITE_MESSAGE}
      </Text>
    </View>
  );
}

/**
 * The shell's scroll container (web `admin-scroll-container`): keyboard-aware,
 * reports scroll to the bottom nav, reserves room for the nav.
 */
export function AdminTabScroll({
  children,
  refreshControl,
  extraBottomPadding = 0,
  offlineNote = false,
}: {
  children: ReactNode;
  refreshControl?: ReactElement<RefreshControlProps>;
  extraBottomPadding?: number;
  offlineNote?: boolean;
}) {
  const styles = useStyles();
  const { onScroll } = useAdminChrome();
  const paddingBottom = useAdminContentBottomPadding(extraBottomPadding);
  return (
    <KeyboardAwareScrollView
      onScroll={onScroll}
      bottomOffset={16}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      refreshControl={refreshControl}
      contentContainerStyle={[styles.content, { paddingBottom }]}
    >
      <AdminPageHeader offlineNote={offlineNote} />
      {children}
    </KeyboardAwareScrollView>
  );
}

const useStyles = createStyles(({ colors, radius }) => ({
  content: { padding: 16 },
  header: { marginBottom: 24, gap: 12 },
  title: { letterSpacing: -0.6 },
  offline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  flex: { flex: 1 },
}));
