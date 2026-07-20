import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { router, usePathname } from 'expo-router';
import { Alert, Image, Text, View } from 'react-native';

import { AppHeader } from '@/components/navigation/AppHeader';
import { AppUserMenu } from '@/components/navigation/AppUserMenu';
import { AdaptiveGlassBottomNav } from '@/components/navigation/AdaptiveGlassBottomNav';
import type { MobileNavKey, MobileNavItem } from '@/constants/mobile-navigation';
import { NotificationsSheet, TransferSheet } from '@/features/account/components/account-overlays';
import { canClaimTopup } from '@/features/account/lib/topup';
import { fetchUnreadNotificationsCount } from '@/features/notifications/api/notifications';
import { EngagementSurfaces } from '@/features/engagement/components/engagement-surfaces';
import { MaintenanceScreen } from '@/components/feedback/MaintenanceScreen';
import { useMaintenanceMode } from '@/hooks/use-maintenance-mode';
import { useNotificationSound } from '@/features/notifications/hooks/use-notification-sound';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/providers/auth-provider';
import { useNetwork } from '@/providers/network-provider';

function activeKeyForPath(pathname: string): MobileNavKey {
  if (pathname.startsWith('/social')) return 'social';
  if (pathname.startsWith('/casino/roulette')) return 'roulette';
  if (pathname.startsWith('/casino/blackjack')) return 'blackjack';
  if (pathname.startsWith('/rankings')) return 'rankings';
  return 'bets';
}

export function AuthenticatedShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, profile, isAdmin, isModerator, signOut, refreshProfile } = useAuth();
  const { isOnline, canPerformWrites } = useNetwork();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [topupLoading, setTopupLoading] = useState(false);
  const { maintenance, checking: checkingMaintenance, refresh: refreshMaintenance } = useMaintenanceMode();
  const notificationSound = useNotificationSound();
  const topupAvailable = canClaimTopup(profile?.last_topup_at);
  const isDetail = pathname.startsWith('/profile') || pathname.startsWith('/admin') || pathname.startsWith('/social/') || pathname.startsWith('/jackpot/') || pathname === '/coupon';
  const casinoTone = pathname.startsWith('/casino/');

  useEffect(() => {
    if (!user) return;
    const update = () => void fetchUnreadNotificationsCount(user.id).then(setUnread).catch(() => undefined);
    update();
    const channel = supabase.channel(`mobile-notifications:${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'user_notifications', filter: `user_id=eq.${user.id}` }, payload => { update(); if (payload.eventType === 'INSERT') notificationSound.play(); }).subscribe();
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
    await refreshProfile(); Alert.alert('Gotowe', 'Doładowano portfel o 100 zł. Wróć jutro po więcej!');
  };

  const navigate = (item: MobileNavItem) => router.navigate(item.href);
  if (maintenance) return <MaintenanceScreen checking={checkingMaintenance} onRetry={() => void refreshMaintenance()} />;
  return <View style={{ flex: 1, backgroundColor: casinoTone ? '#09090b' : '#090005' }}>
    <AppHeader username={profile?.username} avatarSource={avatarSource} balance={profile ? Number(profile.balance) : undefined} unreadNotifications={unread} topupAvailable={topupAvailable} onPressBalance={() => topupAvailable ? void topup() : Alert.alert('Portfel', 'Dzisiejsze doładowanie zostało już wykorzystane.')} onPressNotifications={() => setNotificationsOpen(true)} onPressProfile={() => router.push('/profile')} onPressMenu={() => setMenuOpen(true)} />
    {isOnline === false && <View style={{ backgroundColor: '#9d1d35', paddingVertical: 5, paddingHorizontal: 12 }}><Text style={{ color: '#fff', fontSize: 11, textAlign: 'center', fontWeight: '800' }}>Tryb offline — pokazujemy zapisane dane; operacje finansowe są wyłączone</Text></View>}
    <View style={{ flex: 1 }}>{children}</View>
    <AdaptiveGlassBottomNav activeKey={activeKeyForPath(pathname)} onSelect={navigate} hidden={isDetail} tone={casinoTone ? 'casino' : 'default'} />
    <AppUserMenu visible={menuOpen} onClose={() => setMenuOpen(false)} username={profile?.username} avatarSource={avatarSource} balance={profile ? Number(profile.balance) : undefined} canTopup={topupAvailable && !topupLoading} isAdmin={isAdmin || isModerator} onTopup={() => void topup()} onTransfer={() => setTransferOpen(true)} onProfile={() => router.push('/profile')} onNotifications={() => setNotificationsOpen(true)} onAdmin={() => router.push('/admin')} onLogout={() => signOut()} />
    <NotificationsSheet visible={notificationsOpen} onClose={() => setNotificationsOpen(false)} onCountChange={setUnread} soundMuted={notificationSound.muted} onToggleSound={notificationSound.toggle} />
    <TransferSheet visible={transferOpen} onClose={() => setTransferOpen(false)} />
    <EngagementSurfaces />
  </View>;
}
