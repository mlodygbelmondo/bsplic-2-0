import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { Lightbulb, LogOut, Moon, Plus, Send, Sun, X } from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { authActions, useIsAdmin, useIsModerator, useProfile } from '@/features/auth/auth-store';
import { haptics } from '@/lib/haptics';
import { usePreferences } from '@/lib/preferences';
import { toast } from '@/lib/toast';
import { alpha, createStyles, useTheme } from '@/theme';
import { Avatar, OverlayScreen, Text, useOverlayClose } from '@/ui';
import { isActivePath, navigateFromChrome } from './navigation';
import { canClaimTopup } from './polish-day';
import { TOPUP_DENIED_MESSAGE } from './topup';

type MenuPath = '/' | '/casino' | '/social' | '/rankings' | '/admin';

const NAV_LINKS: readonly { path: MenuPath; label: string }[] = [
  { path: '/', label: 'Zakłady' },
  { path: '/casino', label: 'Kasyno' },
  { path: '/social', label: 'Social' },
  { path: '/rankings', label: 'Rankingi' },
];

/**
 * Web `NavbarMobileMenu`: the right-side Sheet with links, account card
 * (balance, top-up, transfers, profile), then the propose action (home only),
 * theme toggle and logout. Every navigation closes the drawer first.
 */
export function MenuSheet() {
  const insets = useSafeAreaInsets();

  return (
    <OverlayScreen variant="drawer-right" accessibilityLabel="Menu" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <MenuContent />
    </OverlayScreen>
  );
}

function MenuContent() {
  const styles = useStyles();
  const { colors } = useTheme();
  const close = useOverlayClose();
  const navigation = useNavigation();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const currentPath = typeof from === 'string' ? from : '';
  const isAdmin = useIsAdmin();
  const isModerator = useIsModerator();
  const theme = usePreferences((s) => s.theme);
  const toggleTheme = usePreferences((s) => s.toggleTheme);

  const links: { path: MenuPath; label: string }[] = [...NAV_LINKS];
  if (isAdmin) {
    links.push({ path: '/admin', label: 'Admin' });
  } else if (isModerator) {
    // Web desktop label for the moderator entry (the web phone menu has none).
    links.push({ path: '/admin', label: 'Propozycje' });
  }

  const handleSignOut = () => {
    haptics.selection();
    close(() => {
      authActions.signOut().catch((error: unknown) => console.warn('Sign-out failed:', error));
    });
  };

  return (
    <>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text size="base" weight="600" accessibilityRole="header">
            Menu
          </Text>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} contentInsetAdjustmentBehavior="never">
          <View style={styles.links}>
            {links.map((link) => {
              const active = isActivePath(currentPath, link.path);
              return (
                <Pressable
                  key={link.path}
                  accessibilityRole="link"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    haptics.selection();
                    // dismissTo pops the drawer and switches the tab in one step.
                    close(() => navigateFromChrome(navigation, link.path), { pop: false });
                  }}
                  style={({ pressed }) => [styles.link, active ? styles.linkActive : pressed && styles.linkPressed]}
                >
                  <Text weight="600" color={active ? 'primary' : 'foreground'}>
                    {link.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <AccountCard />
        </ScrollView>

        <View style={styles.footer}>
          {currentPath === '/' ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                haptics.selection();
                close(() => router.push('/sheets/propose-bet'));
              }}
              style={({ pressed }) => [styles.footerButton, styles.proposeButton, pressed && styles.proposePressed]}
            >
              <Lightbulb size={16} color={colors.primaryForeground} />
              <Text weight="700" color="primaryForeground">
                Zaproponuj zakład
              </Text>
            </Pressable>
          ) : null}
          {/* Web keeps the drawer open after toggling the theme. */}
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              haptics.selection();
              toggleTheme();
            }}
            style={({ pressed }) => [styles.footerButton, styles.outlineButton, pressed && styles.outlinePressed]}
          >
            {theme === 'dark' ? <Sun size={16} color={colors.foreground} /> : <Moon size={16} color={colors.foreground} />}
            <Text weight="600">{theme === 'dark' ? 'Tryb jasny' : 'Tryb ciemny'}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={handleSignOut}
            style={({ pressed }) => [styles.footerButton, styles.outlineButton, pressed && styles.outlinePressed]}
          >
            <LogOut size={16} color={colors.foreground} />
            <Text weight="600">Wyloguj się</Text>
          </Pressable>
        </View>
      </View>

      {/* shadcn SheetContent close: `absolute right-4 top-4` on the panel's border box, so it sits in the status bar area. */}
      <Pressable accessibilityRole="button" accessibilityLabel="Zamknij" hitSlop={14} onPress={() => close()} style={styles.close}>
        <X size={16} color={colors.foreground} />
      </Pressable>
    </>
  );
}

/** Balance, top-up, transfers and the profile row (shown once the profile is loaded). */
function AccountCard() {
  const styles = useStyles();
  const { colors } = useTheme();
  const close = useOverlayClose();
  const navigation = useNavigation();
  const profile = useProfile();

  if (!profile) return null;

  const handleOpenTopup = () => {
    haptics.selection();
    if (!canClaimTopup(profile.last_topup_at)) {
      toast.error(TOPUP_DENIED_MESSAGE);
      return;
    }
    close(() => router.push('/sheets/topup'));
  };

  return (
    <View style={styles.card}>
      <View style={styles.balanceRow}>
        <Text color="mutedForeground">Saldo</Text>
        <Text weight="700">{Number(profile.balance).toFixed(2)} zł</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={handleOpenTopup}
        style={({ pressed }) => [styles.cardButton, styles.topupButton, pressed && styles.topupPressed]}
      >
        <Plus size={14} color={colors.primary} />
        <Text weight="700" color="primary" style={styles.cardButtonLabel}>
          Doładuj 100 zł
        </Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={() => {
          haptics.selection();
          close(() => router.push({ pathname: '/sheets/wallet', params: { tab: 'send' } }));
        }}
        style={({ pressed }) => [styles.cardButton, styles.transferButton, pressed && styles.transferPressed]}
      >
        <Send size={14} color={colors.primary} />
        <Text weight="700" style={styles.cardButtonLabel}>
          Wyślij pieniądze
        </Text>
      </Pressable>

      <Pressable
        accessibilityRole="link"
        onPress={() => {
          haptics.selection();
          close(() => navigateFromChrome(navigation, '/profile'), { pop: false });
        }}
        style={({ pressed }) => [styles.profileRow, pressed && styles.profilePressed]}
      >
        <Avatar
          uri={profile.avatar_url}
          name={profile.username}
          size={28}
          style={styles.avatarFallback}
          fallbackStyle={styles.avatarFallback}
          fallbackTextStyle={styles.avatarFallbackText}
        />
        <Text weight="500">{profile.username}</Text>
      </Pressable>
    </View>
  );
}

const useStyles = createStyles(({ colors, radius, scheme }) => ({
  content: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  close: { position: 'absolute', right: 16, top: 16, borderRadius: radius.sm, opacity: 0.7 },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 16, paddingVertical: 16, gap: 24 },
  links: { gap: 6 },
  link: { borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10 },
  linkActive: { backgroundColor: alpha(colors.primary, 0.1) },
  linkPressed: { backgroundColor: colors.muted },
  // `.app-subsurface rounded-lg p-3 space-y-3`
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: alpha(colors.border, 0.72),
    backgroundColor: alpha(colors.muted, scheme === 'dark' ? 0.52 : 0.6),
    padding: 12,
    gap: 12,
  },
  balanceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  // `text-[12px]` keeps the inherited `line-height: 1.5`.
  cardButtonLabel: { fontSize: 12, lineHeight: 18 },
  topupButton: { backgroundColor: alpha(colors.primary, 0.1) },
  topupPressed: { backgroundColor: alpha(colors.primary, 0.15) },
  transferButton: {
    borderWidth: 1,
    borderColor: alpha(colors.primary, 0.2),
    backgroundColor: colors.background,
  },
  transferPressed: { backgroundColor: alpha(colors.primary, 0.05) },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radius.md,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  profilePressed: { backgroundColor: colors.background },
  avatarFallback: { backgroundColor: alpha(colors.primary, 0.1) },
  avatarFallbackText: { fontSize: 11, color: colors.primary },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 16,
    gap: 8,
  },
  footerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  proposeButton: { backgroundColor: colors.primary },
  proposePressed: { backgroundColor: alpha(colors.primary, 0.9) },
  outlineButton: { borderWidth: 1, borderColor: colors.border },
  outlinePressed: { backgroundColor: colors.muted },
}));
