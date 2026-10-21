import { router, useNavigation, usePathname } from 'expo-router';
import { ChevronLeft, Menu } from 'lucide-react-native';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NotificationsBell } from '@/features/notifications/NotificationsBell';
import { haptics } from '@/lib/haptics';
import { alpha, createStyles, useTheme } from '@/theme';
import { Text } from '@/ui';
import { BalanceChip } from './BalanceChip';
import { navigateFromChrome } from './navigation';

interface AppHeaderProps {
  /** Pushed screens (public profile, social item, replay, admin) show a back button. */
  back?: boolean;
}

/** Below 360 pt the web navbar tightens its padding, wordmark and chip text. */
const COMPACT_WIDTH = 360;

/**
 * Mobile part of the web `Navbar`: gradient bar with the wordmark, balance
 * chip, notifications bell and menu button. Every signed-in screen renders it
 * at the top, outside its scroll view.
 */
export function AppHeader({ back = false }: AppHeaderProps) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const compact = useWindowDimensions().width < COMPACT_WIDTH;

  return (
    <View style={[styles.bar, { paddingTop: insets.top }]}>
      <View style={[styles.row, compact && styles.rowCompact]}>
        <View style={styles.left}>
          {back ? <BackButton /> : null}
          <Wordmark compact={compact} />
        </View>
        <View style={styles.right}>
          <BalanceChip compact={compact} />
          <NotificationsBell />
          <MenuButton />
        </View>
      </View>
    </View>
  );
}

function BackButton() {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Wstecz"
      hitSlop={6}
      onPress={() => router.back()}
      style={({ pressed }) => [styles.iconButton, styles.backButton, pressed && styles.pressed]}
    >
      <ChevronLeft size={26} color={colors.navbarForeground} />
    </Pressable>
  );
}

function Wordmark({ compact }: { compact: boolean }) {
  const styles = useStyles();
  const navigation = useNavigation();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel="BSPLIC 2.0"
      hitSlop={{ top: 9, bottom: 9, left: 4, right: 4 }}
      onPress={() => navigateFromChrome(navigation, '/')}
      style={({ pressed }) => [styles.wordmarkPill, pressed && styles.pressed]}
    >
      <Text
        weight="900"
        italic
        numberOfLines={1}
        maxFontSizeMultiplier={1.2}
        style={[styles.wordmark, compact && styles.wordmarkCompact]}
      >
        BSPLIC 2.0
      </Text>
    </Pressable>
  );
}

/** Passes the current path so the menu can mark the active link and show the home-only action. */
function MenuButton() {
  const styles = useStyles();
  const { colors } = useTheme();
  const pathname = usePathname();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Otwórz menu"
      hitSlop={6}
      onPress={() => {
        haptics.selection();
        router.push({ pathname: '/sheets/menu', params: { from: pathname } });
      }}
      style={styles.iconButton}
    >
      {({ pressed }) => (
        <Menu size={24} color={pressed ? colors.primaryForeground : alpha(colors.primaryForeground, 0.8)} />
      )}
    </Pressable>
  );
}

const useStyles = createStyles(({ colors, gradients, radius, scheme }) => ({
  bar: {
    zIndex: 10,
    backgroundColor: colors.navbar,
    backgroundImage: gradients.navbar,
    borderBottomWidth: scheme === 'dark' ? 1 : 0,
    borderBottomColor: gradients.navbarBorder,
    // Tailwind `shadow-md`.
    boxShadow: '0px 4px 6px -1px rgba(0, 0, 0, 0.1), 0px 2px 4px -2px rgba(0, 0, 0, 0.1)',
  },
  row: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  rowCompact: { paddingHorizontal: 8 },
  left: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  right: { height: '100%', flexDirection: 'row', alignItems: 'center', gap: 8 },
  wordmarkPill: {
    borderRadius: radius.md,
    paddingHorizontal: 8,
    // py-[5px] around a 16 px line; the native line box is 2 px taller.
    paddingVertical: 4,
  },
  wordmark: {
    fontSize: 16,
    lineHeight: 18,
    letterSpacing: -0.4,
    color: colors.navbarForeground,
  },
  wordmarkCompact: { fontSize: 13, lineHeight: 15, letterSpacing: -0.325 },
  iconButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backButton: { marginLeft: -8 },
  pressed: { opacity: 0.8 },
}));
