import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { Lightbulb, LogOut, Moon, Plus, Send, Sun, X } from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { authActions, useIsAdmin, useIsModerator, useProfile } from '@/features/auth/auth-store';
import { haptics } from '@/lib/haptics';
import { usePreferences } from '@/lib/preferences';
import { alpha, createStyles, useTheme } from '@/theme';
import { Avatar, Text } from '@/ui';
import { isActivePath, navigateFromChrome } from './navigation';
import { openTopupSheet } from './topup';

type MenuPath = '/' | '/casino' | '/social' | '/rankings' | '/admin';

const NAV_LINKS: readonly { path: MenuPath; label: string }[] = [
  { path: '/', label: 'Zakłady' },
  { path: '/casino', label: 'Kasyno' },
  { path: '/social', label: 'Social' },
  { path: '/rankings', label: 'Rankingi' },
];

/**
 * Header menu (web `NavbarMobileMenu`, a right-side Sheet) as a native form
 * sheet: links, account card with balance, top-up, transfers and profile,
 * then the propose action (home only), theme toggle and logout.
 */
export function MenuSheet() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
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
    router.back();
    authActions.signOut().catch((error: unknown) => console.warn('Sign-out failed:', error));
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text size="base" weight="600" accessibilityRole="header">
          Menu
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Zamknij"
          hitSlop={14}
          onPress={() => router.back()}
          style={styles.close}
        >
          <X size={16} color={colors.foreground} />
        </Pressable>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
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
                  navigateFromChrome(navigation, link.path);
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

      <View style={[styles.footer, { paddingBottom: 16 + insets.bottom }]}>
        {currentPath === '/' ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              haptics.selection();
              router.replace('/sheets/propose-bet');
            }}
            style={({ pressed }) => [styles.footerButton, styles.proposeButton, pressed && styles.proposePressed]}
          >
            <Lightbulb size={16} color={colors.primaryForeground} />
            <Text weight="700" color="primaryForeground">
              Zaproponuj zakład
            </Text>
          </Pressable>
        ) : null}
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
  );
}

/** Balance, top-up, transfers and the profile row (shown once the profile is loaded). */
function AccountCard() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const profile = useProfile();

  if (!profile) return null;

  return (
    <View style={styles.card}>
      <View style={styles.balanceRow}>
        <Text color="mutedForeground">Saldo</Text>
        <Text weight="700" tabular>
          {Number(profile.balance).toFixed(2)} zł
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => {
          haptics.selection();
          openTopupSheet(profile.last_topup_at, 'replace');
        }}
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
          router.replace({ pathname: '/sheets/wallet', params: { tab: 'send' } });
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
          navigateFromChrome(navigation, '/profile');
        }}
        style={({ pressed }) => [styles.profileRow, pressed && styles.profilePressed]}
      >
        <Avatar
          uri={profile.avatar_url}
          name={profile.username}
          size={28}
          fallbackStyle={styles.avatarFallback}
          fallbackTextStyle={styles.avatarFallbackText}
        />
        <Text weight="500">{profile.username}</Text>
      </Pressable>
    </View>
  );
}

const useStyles = createStyles(({ colors, radius, scheme }) => ({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  close: { position: 'absolute', right: 16, top: 16, padding: 2, opacity: 0.7 },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 16, paddingVertical: 16, gap: 24 },
  links: { gap: 6 },
  link: { borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10 },
  linkActive: { backgroundColor: alpha(colors.primary, 0.1) },
  linkPressed: { backgroundColor: colors.muted },
  // `.app-subsurface`
  card: {
    borderRadius: radius.lg,
    borderCurve: 'continuous',
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
  cardButtonLabel: { fontSize: 12, lineHeight: 16 },
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
    paddingHorizontal: 16,
    paddingTop: 16,
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
