import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { router, usePathname } from 'expo-router';
import { Alert, Image, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/navigation/AppHeader';
import { AppUserMenu } from '@/components/navigation/AppUserMenu';
import { AdaptiveGlassBottomNav } from '@/components/navigation/AdaptiveGlassBottomNav';
import { MainTabsPager, type MainTabsPagerHandle } from '@/components/navigation/MainTabsPager';
import { NavigationChromeProvider, useNavigationChrome } from '@/components/navigation/navigation-chrome';
import { MOBILE_NAV_ITEMS, type MobileNavKey, type MobileNavItem } from '@/constants/mobile-navigation';
import { NotificationsSheet, TransferSheet } from '@/features/account/components/account-overlays';
import { canClaimTopup } from '@/features/account/lib/topup';
import { fetchUnreadNotificationsCount } from '@/features/notifications/api/notifications';
import { EngagementSurfaces } from '@/features/engagement/components/engagement-surfaces';
import { MaintenanceScreen } from '@/components/feedback/MaintenanceScreen';
import { useMaintenanceMode } from '@/hooks/use-maintenance-mode';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useNotificationSound } from '@/features/notifications/hooks/use-notification-sound';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/providers/auth-provider';
import { useNetwork } from '@/providers/network-provider';

function activeKeyForPath(pathname: string): MobileNavKey | null {
  if (pathname.startsWith('/social')) return 'social';
  if (pathname.startsWith('/casino/roulette')) return 'roulette';
  if (pathname.startsWith('/casino/blackjack')) return 'blackjack';
  if (pathname.startsWith('/rankings')) return 'rankings';
  if (pathname.startsWith('/profile') || pathname.startsWith('/admin') || pathname.startsWith('/jackpot')) return null;
  if (pathname.startsWith('/casino')) return null;
  return pathname === '/' ? 'bets' : null;
}

function mainKeyForPath(pathname: string): MobileNavKey | null {
  if (pathname === '/') return 'bets';
  if (pathname === '/social') return 'social';
  if (pathname === '/casino/roulette') return 'roulette';
  if (pathname === '/casino/blackjack') return 'blackjack';
  if (pathname === '/rankings') return 'rankings';
  return null;
}

let notificationsChannelSequence = 0;

export function AuthenticatedShell({ children }: { children: ReactNode }) {
  return (
    <NavigationChromeProvider>
      <AuthenticatedShellContent>{children}</AuthenticatedShellContent>
    </NavigationChromeProvider>
  );
}

function AuthenticatedShellContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { user, profile, isAdmin, isModerator, signOut, refreshProfile } = useAuth();
  const { isOnline, canPerformWrites } = useNetwork();
  const { tokens } = useAppTheme();
  const { hidden: chromeHidden, progress: chromeProgress, show: showChrome } = useNavigationChrome();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [topupLoading, setTopupLoading] = useState(false);
  const mainRouteKey = mainKeyForPath(pathname);
  const [displayTabKey, setDisplayTabKey] = useState<MobileNavKey>(mainRouteKey ?? 'bets');
  const [pendingTabKey, setPendingTabKey] = useState<MobileNavKey | null>(null);
  const [topChromeHeight, setTopChromeHeight] = useState(insets.top + 44);
  const tabPosition = useSharedValue(Math.max(0, MOBILE_NAV_ITEMS.findIndex((item) => item.key === (mainRouteKey ?? 'bets'))));
  const pagerRef = useRef<MainTabsPagerHandle>(null);
  const { maintenance, checking: checkingMaintenance, refresh: refreshMaintenance } = useMaintenanceMode();
  const notificationSound = useNotificationSound();
  const topupAvailable = canClaimTopup(profile?.last_topup_at);
  const isDetail = pathname.startsWith('/admin') || pathname.startsWith('/jackpot/') || pathname === '/coupon';
  const casinoTone = mainRouteKey
    ? displayTabKey === 'roulette' || displayTabKey === 'blackjack'
    : pathname.startsWith('/casino/');
  const headerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: mainRouteKey ? -topChromeHeight * chromeProgress.value : 0 }],
  }), [mainRouteKey, topChromeHeight]);

  useEffect(() => {
    if (mainRouteKey) {
      setPendingTabKey(null);
      return;
    }
    showChrome();
  }, [mainRouteKey, showChrome]);

  useEffect(() => {
    if (!user) return;
    const update = () => void fetchUnreadNotificationsCount(user.id).then(setUnread).catch(() => undefined);
    update();
    const channel = supabase.channel(`mobile-notifications:${user.id}:${++notificationsChannelSequence}`).on('postgres_changes', { event: '*', schema: 'public', table: 'user_notifications', filter: `user_id=eq.${user.id}` }, payload => { update(); if (payload.eventType === 'INSERT') notificationSound.play(); }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [notificationSound, user]);

  const avatarSource = useMemo(() => profile?.avatar_url ? { uri: profile.avatar_url } : undefined, [profile?.avatar_url]);
  const topup = async () => {
    if (!user || !topupAvailable || topupLoading) return;
    if (!canPerformWrites) { Alert.alert('Brak internetu', 'Doładowanie wymaga aktywnego połączenia.'); return; }
    setTopupLoading(true);
    const { error } = await supabase.rpc('secure_daily_topup', { p_user_id: user.id });
    setTopupLoading(false);
    if (error) { Alert.alert('Nie udało się doładować', error.message); return; }
    void refreshProfile().catch(() => undefined); Alert.alert('Gotowe', 'Doładowano portfel o 100 zł. Wróć jutro po więcej!');
  };

  const navigate = (item: MobileNavItem) => {
    if (mainRouteKey && pagerRef.current) {
      pagerRef.current.navigateTo(item.key);
      return;
    }
    setDisplayTabKey(item.key);
    setPendingTabKey(item.key);
    showChrome();
    router.replace(item.href);
  };
  const navigateHome = () => {
    if (mainRouteKey && pagerRef.current) {
      pagerRef.current.navigateTo('bets');
      return;
    }
    setDisplayTabKey('bets');
    setPendingTabKey('bets');
    showChrome();
    router.replace('/');
  };
  if (maintenance) return <MaintenanceScreen checking={checkingMaintenance} onRetry={() => void refreshMaintenance()} />;
  return <View style={{ flex: 1, backgroundColor: casinoTone ? '#09090b' : tokens.colors.background }}>
    <Animated.View
      onLayout={(event) => setTopChromeHeight(event.nativeEvent.layout.height)}
      style={[{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 80 }, headerStyle]}
    >
      <AppHeader username={profile?.username} avatarSource={avatarSource} balance={profile ? Number(profile.balance) : undefined} unreadNotifications={unread} topupAvailable={topupAvailable} onPressBrand={navigateHome} onPressBalance={() => topupAvailable ? void topup() : Alert.alert('Portfel', 'Dzisiejsze doładowanie zostało już wykorzystane.')} onPressNotifications={() => setNotificationsOpen(true)} onPressProfile={() => router.push('/profile')} onPressMenu={() => setMenuOpen(true)} />
      {isOnline === false && <View style={{ backgroundColor: '#9d1d35', paddingVertical: 5, paddingHorizontal: 12 }}><Text style={{ color: '#fff', fontSize: 11, textAlign: 'center', fontWeight: '800' }}>Tryb offline — pokazujemy zapisane dane; operacje finansowe są wyłączone</Text></View>}
    </Animated.View>
    <View style={{ flex: 1, paddingTop: mainRouteKey ? 0 : topChromeHeight }}>
      {children}
      <MainTabsPager
        ref={pagerRef}
        routeKey={mainRouteKey}
        topInset={topChromeHeight}
        visible={mainRouteKey !== null}
        tabPosition={tabPosition}
        onActiveKeyChange={setDisplayTabKey}
      />
    </View>
    <AdaptiveGlassBottomNav activeKey={mainRouteKey ? displayTabKey : (pendingTabKey ?? activeKeyForPath(pathname))} animatedTabPosition={mainRouteKey ? tabPosition : undefined} onSelect={navigate} hidden={isDetail} scrollHidden={mainRouteKey !== null && chromeHidden} tone={casinoTone ? 'casino' : 'default'} />
    <AppUserMenu visible={menuOpen} onClose={() => setMenuOpen(false)} username={profile?.username} avatarSource={avatarSource} balance={profile ? Number(profile.balance) : undefined} canTopup={topupAvailable && !topupLoading} isAdmin={isAdmin || isModerator} onTopup={() => void topup()} onTransfer={() => setTransferOpen(true)} onProfile={() => router.push('/profile')} onNotifications={() => setNotificationsOpen(true)} onCasino={() => router.push('/casino')} onAdmin={() => router.push('/admin')} onLogout={() => signOut()} />
    <NotificationsSheet visible={notificationsOpen} onClose={() => setNotificationsOpen(false)} onCountChange={setUnread} soundMuted={notificationSound.muted} onToggleSound={notificationSound.toggle} />
    <TransferSheet visible={transferOpen} onClose={() => setTransferOpen(false)} />
    <EngagementSurfaces />
  </View>;
}
