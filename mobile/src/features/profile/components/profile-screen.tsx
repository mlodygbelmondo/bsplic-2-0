/* eslint-disable @typescript-eslint/no-require-imports -- Metro resolves bundled badge assets through static require calls. */
import 'expo-sqlite/localStorage/install';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { fetch } from 'expo/fetch';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Share, Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { AppAvatar, AppBadge, AppButton, AppCard } from '@/components/ui';
import { useAppTheme } from '@/hooks/use-app-theme';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/providers/auth-provider';
import type {
  Badge,
  CasinoHistoryEntry,
  CouponHistoryEntry,
  PublicProfile,
} from '@/types/database';

type HistoryKind = 'sportsbook' | 'casino';
type CouponFilter = 'all' | 'won' | 'lost' | 'pending' | 'refund';

interface Stats {
  totalBets: number;
  wins: number;
  losses: number;
  winRate: number;
  totalProfit: number;
}

interface CachedProfileScreen {
  publicProfile: PublicProfile | null;
  stats: Stats | null;
  badges: Badge[];
  coupons: CouponHistoryEntry[];
  casino: CasinoHistoryEntry[];
}

const profileCacheKey = (id: string) => `bsplic.profile.screen.v1.${id}`;

const BADGES: Record<string, { name: string; description: string; source: number }> = {
  debiutant: { name: 'Debiutant', description: 'Pierwszy postawiony zakład', source: require('../../../../assets/images/badges/debiutant.png') },
  trafiony: { name: 'Trafiony zakład', description: 'Pierwszy wygrany zakład', source: require('../../../../assets/images/badges/trafiony.png') },
  kuponista: { name: 'Kuponista', description: 'Pierwszy kupon AKO', source: require('../../../../assets/images/badges/kuponista.png') },
  goraca_passa: { name: 'Gorąca passa', description: '3 wygrane z rzędu', source: require('../../../../assets/images/badges/goraca_passa.png') },
  nie_do_zatrzymania: { name: 'Nie do zatrzymania', description: '5 wygranych z rzędu', source: require('../../../../assets/images/badges/nie_do_zatrzymania.png') },
  mistrz_serii: { name: 'Mistrz serii', description: '10 wygranych z rzędu', source: require('../../../../assets/images/badges/mistrz_serii.png') },
  pierwszy_tysiac: { name: 'Pierwszy tysiąc', description: 'Łączne wygrane ponad 1000 zł', source: require('../../../../assets/images/badges/pierwszy_tysiac.png') },
  wieloryb: { name: 'Wieloryb', description: 'Zakład na co najmniej 500 zł', source: require('../../../../assets/images/badges/wieloryb.png') },
  ryzykant: { name: 'Ryzykant', description: 'Kupon AKO z 5+ wydarzeniami', source: require('../../../../assets/images/badges/ryzykant.png') },
  analityk: { name: 'Analityk', description: 'Win rate ponad 60%', source: require('../../../../assets/images/badges/analityk.png') },
  staly_bywalec: { name: 'Stały bywalec', description: 'Seria 7 dni', source: require('../../../../assets/images/badges/staly_bywalec.png') },
  legenda: { name: 'Legenda', description: 'Seria 30 dni', source: require('../../../../assets/images/badges/legenda.png') },
  pomyslodawca: { name: 'Pomysłodawca', description: 'Zaakceptowana propozycja', source: require('../../../../assets/images/badges/pomyslodawca.png') },
  wszechstronny: { name: 'Wszechstronny', description: 'Zakłady w 4+ kategoriach', source: require('../../../../assets/images/badges/wszechstronny.png') },
  multi_fan: { name: 'Multi-fan', description: '10 kuponów AKO', source: require('../../../../assets/images/badges/multi_fan.png') },
};

const statusLabels: Record<string, string> = {
  won: 'Wygrany', lost: 'Przegrany', pending: 'W toku', refund: 'Zwrot', push: 'Remis',
};

function toStats(row: { total_bets: number; won_bets: number; lost_bets: number; win_rate: number; total_profit: number }): Stats {
  return {
    totalBets: Number(row.total_bets), wins: Number(row.won_bets), losses: Number(row.lost_bets),
    winRate: Number(row.win_rate), totalProfit: Number(row.total_profit),
  };
}

function Segment<T extends string>({ values, value, onChange }: {
  values: Array<[T, string]>; value: T; onChange: (next: T) => void;
}) {
  const { tokens } = useAppTheme();
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
    {values.map(([key, label]) => <Pressable key={key} onPress={() => onChange(key)} style={{ minHeight: 38, justifyContent: 'center', borderRadius: 999, paddingHorizontal: 14, backgroundColor: value === key ? tokens.colors.primary : tokens.colors.secondary }}>
      <Text style={{ color: value === key ? tokens.colors.primaryForeground : tokens.colors.mutedForeground, fontSize: 12, fontWeight: '800' }}>{label}</Text>
    </Pressable>)}
  </ScrollView>;
}

function ProfileStat({ label, value, color = '#FFFFFF', flex = false }: { label: string; value: string; color?: string; flex?: boolean }) {
  return <View style={{ flex: flex ? 1 : undefined, minHeight: 74, justifyContent: 'center', gap: 7, borderRadius: 13, borderWidth: 1, borderColor: '#ffffff18', backgroundColor: '#09090988', paddingHorizontal: 13 }}><Text allowFontScaling={false} style={{ color: '#BFAF9D', fontSize: 9, fontWeight: '700', letterSpacing: 1.7, textTransform: 'uppercase' }}>{label}</Text><Text allowFontScaling={false} style={{ color, fontSize: 20, fontWeight: '900' }}>{value}</Text></View>;
}

export function ProfileScreen({ userRef }: { userRef?: string }) {
  const { tokens } = useAppTheme();
  const palette = {
    background: tokens.colors.background,
    card: tokens.colors.card,
    inset: tokens.colors.secondary,
    border: tokens.colors.border,
    foreground: tokens.colors.foreground,
    muted: tokens.colors.mutedForeground,
    primary: tokens.colors.primary,
  };
  const { user, profile, refreshProfile } = useAuth();
  const [targetId, setTargetId] = useState<string | null>(null);
  const [publicProfile, setPublicProfile] = useState<PublicProfile | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [coupons, setCoupons] = useState<CouponHistoryEntry[]>([]);
  const [casino, setCasino] = useState<CasinoHistoryEntry[]>([]);
  const [kind, setKind] = useState<HistoryKind>('sportsbook');
  const [filter, setFilter] = useState<CouponFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    let resolved = userRef ?? user?.id ?? null;
    try {
      if (resolved && !/^[0-9a-f-]{36}$/i.test(resolved)) {
        const { data, error: resolveError } = await supabase.from('profiles').select('id').ilike('username', resolved).limit(1).maybeSingle();
        if (resolveError) throw resolveError;
        resolved = data?.id ?? null;
      }
      if (!resolved) throw new Error('Nie znaleziono profilu');
      setTargetId(resolved);
      const own = resolved === user?.id;
      const [badgeResult, statsResult, couponsResult, casinoResult] = await Promise.all([
        supabase.rpc('get_public_badges', { p_user_id: resolved }),
        own ? supabase.rpc('get_user_stats', { p_user_id: resolved }) : supabase.rpc('get_public_profile', { p_user_id: resolved }),
        supabase.rpc('get_user_coupon_history', { p_user_id: resolved, p_limit: 60, p_offset: 0 }),
        supabase.rpc('get_user_casino_history', { p_user_id: resolved, p_limit: 60, p_offset: 0 }),
      ]);
      if (badgeResult.error) throw badgeResult.error;
      if (statsResult.error) throw statsResult.error;
      if (couponsResult.error) throw couponsResult.error;
      if (casinoResult.error) throw casinoResult.error;
      const nextBadges = (badgeResult.data as unknown as Badge[] | null) ?? [];
      const nextCoupons = (couponsResult.data as unknown as CouponHistoryEntry[] | null) ?? [];
      const nextCasino = ((casinoResult.data as unknown as CasinoHistoryEntry[] | null) ?? []).map(entry => ({ ...entry, stake: Number(entry.stake), payout: Number(entry.payout) }));
      let nextPublicProfile: PublicProfile | null = null;
      let nextStats: Stats | null = null;
      if (own) {
        const row = (statsResult.data as unknown as Array<Parameters<typeof toStats>[0]> | null)?.[0];
        nextStats = row ? toStats(row) : null;
      } else {
        const row = statsResult.data as unknown as PublicProfile | null;
        nextPublicProfile = row; nextStats = row ? toStats(row) : null;
      }
      setBadges(nextBadges); setCoupons(nextCoupons); setCasino(nextCasino); setPublicProfile(nextPublicProfile); setStats(nextStats);
      try { localStorage.setItem(profileCacheKey(resolved), JSON.stringify({ publicProfile: nextPublicProfile, stats: nextStats, badges: nextBadges, coupons: nextCoupons, casino: nextCasino } satisfies CachedProfileScreen)); } catch { /* current in-memory profile remains available */ }
    } catch (cause) {
      let cached: CachedProfileScreen | null = null;
      if (resolved) {
        try { cached = JSON.parse(localStorage.getItem(profileCacheKey(resolved)) ?? 'null') as CachedProfileScreen | null; } catch { cached = null; }
      }
      if (cached) { setBadges(cached.badges); setCoupons(cached.coupons); setCasino(cached.casino); setPublicProfile(cached.publicProfile); setStats(cached.stats); }
      setError(cached ? null : cause instanceof Error ? cause.message : 'Nie udało się wczytać profilu');
    } finally { setLoading(false); }
  }, [user?.id, userRef]);

  useEffect(() => { void load(); }, [load]);
  const own = targetId === user?.id;
  const shownProfile = own ? profile : publicProfile;
  const displayName = shownProfile?.username ?? 'Gracz';
  const playerLevel = stats && stats.totalProfit > 0 ? 'Na plusie' : (shownProfile?.current_streak ?? 0) >= 3 ? 'Na fali' : (stats?.totalBets ?? 0) >= 25 ? 'Weteran kuponów' : 'Nowy gracz';
  const filteredCoupons = useMemo(() => filter === 'all' ? coupons : coupons.filter(item => item.status === filter), [coupons, filter]);

  const shareProfile = async () => {
    const ref = encodeURIComponent(shownProfile?.username || targetId || '');
    await Share.share({ message: `Profil ${displayName} w BSPLIC: https://bsplic.vercel.app/profile/${ref}`, url: `https://bsplic.vercel.app/profile/${ref}` });
  };

  const pickAvatar = async (source: 'camera' | 'library') => {
    if (!own || !user) return;
    const permission = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert('Brak dostępu', source === 'camera' ? 'Zezwól aplikacji na dostęp do aparatu.' : 'Zezwól aplikacji na dostęp do zdjęć.'); return; }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.9 };
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled) return;
    setUploading(true);
    try {
      const edited = await ImageManipulator.manipulateAsync(result.assets[0].uri, [{ resize: { width: 640, height: 640 } }], { compress: 0.78, format: ImageManipulator.SaveFormat.JPEG });
      const body = await (await fetch(edited.uri)).arrayBuffer();
      const path = `${user.id}/${Date.now()}-avatar.jpg`;
      const { error: uploadError } = await supabase.storage.from('profile-avatars').upload(path, body, { contentType: 'image/jpeg', cacheControl: '31536000' });
      if (uploadError) throw uploadError;
      const avatarUrl = supabase.storage.from('profile-avatars').getPublicUrl(path).data.publicUrl;
      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', user.id);
      if (updateError) throw updateError;
      await refreshProfile();
    } catch (cause) { Alert.alert('Nie udało się zmienić zdjęcia', cause instanceof Error ? cause.message : 'Spróbuj ponownie.'); }
    finally { setUploading(false); }
  };

  const changeAvatar = () => Alert.alert('Zmień zdjęcie', 'Wybierz źródło zdjęcia profilowego.', [
    { text: 'Anuluj', style: 'cancel' },
    { text: 'Aparat', onPress: () => void pickAvatar('camera') },
    { text: 'Galeria', onPress: () => void pickAvatar('library') },
  ]);

  if (loading) return <View style={{ flex: 1, backgroundColor: palette.background, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: palette.muted }}>Wczytywanie profilu…</Text></View>;
  if (error || !shownProfile) return <View style={{ flex: 1, backgroundColor: palette.background, padding: 24, justifyContent: 'center', gap: 16 }}><Text style={{ color: palette.foreground, textAlign: 'center', fontWeight: '800' }}>{error ?? 'Nie znaleziono profilu'}</Text><AppButton onPress={() => void load()}>Spróbuj ponownie</AppButton></View>;

  return <ScrollView style={{ flex: 1, backgroundColor: palette.background }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ gap: 12, padding: 12, paddingBottom: 116 }} refreshControl={undefined}>
    <AppCard style={{ backgroundColor: palette.card, borderColor: palette.border, gap: 12, padding: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <AppAvatar name={displayName} size={58} source={shownProfile.avatar_url ? { uri: shownProfile.avatar_url } : undefined} />
        <View style={{ flex: 1, gap: 2 }}><Text allowFontScaling={false} style={{ color: palette.foreground, fontSize: 21, fontWeight: '800' }}>{displayName}</Text><Text allowFontScaling={false} style={{ color: palette.muted, fontSize: 11 }}>Dołączył: {new Date(shownProfile.created_at).toLocaleDateString('pl-PL')}{own ? '' : ' · profil publiczny'}</Text></View>
        {own && <View style={{ alignItems: 'flex-end', maxWidth: 92 }}><Text allowFontScaling={false} style={{ color: palette.muted, fontSize: 10 }}>Saldo</Text><Text allowFontScaling={false} style={{ color: palette.primary, fontSize: 18, fontWeight: '900', textAlign: 'right' }}>{Number(profile?.balance ?? 0).toFixed(2)} zł</Text></View>}
      </View>
      {own ? <Pressable accessibilityRole="button" disabled={uploading} onPress={changeAvatar} style={{ minHeight: 34, justifyContent: 'center', alignSelf: 'flex-start', borderRadius: 10, backgroundColor: palette.inset, paddingHorizontal: 12 }}><Text allowFontScaling={false} style={{ color: palette.foreground, fontSize: 11, fontWeight: '700' }}>{uploading ? 'Wysyłanie…' : 'Wybierz zdjęcie profilowe'}</Text></Pressable> : null}
    </AppCard>

    <AppCard style={{ backgroundColor: '#2A1C10', borderColor: '#72552C', gap: 12, padding: 16 }}>
      <View style={{ gap: 4 }}><Text allowFontScaling={false} style={{ color: '#D9C6A0', fontWeight: '700', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase' }}>Karta gracza</Text><Text allowFontScaling={false} style={{ color: palette.foreground, fontSize: 20, fontWeight: '900' }}>{playerLevel}</Text></View>
      <View style={{ flexDirection: 'row', gap: 7 }}><View style={{ minHeight: 30, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: '#ffffff28', backgroundColor: '#ffffff10', paddingHorizontal: 12 }}><Text allowFontScaling={false} style={{ color: palette.foreground, fontSize: 11, fontWeight: '700' }}>Sportsbook</Text></View><Pressable accessibilityRole="button" onPress={() => void shareProfile()} style={{ minHeight: 30, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: '#ffffff28', backgroundColor: '#ffffff10', paddingHorizontal: 12 }}><Text allowFontScaling={false} style={{ color: palette.foreground, fontSize: 11, fontWeight: '700' }}>⌯ Udostępnij profil</Text></Pressable></View>
      <ProfileStat label="Zysk" value={`${(stats?.totalProfit ?? 0) >= 0 ? '+' : ''}${(stats?.totalProfit ?? 0).toFixed(2)} zł`} color={(stats?.totalProfit ?? 0) >= 0 ? tokens.colors.success : tokens.colors.destructive} />
      <ProfileStat label="Win rate" value={`${(stats?.winRate ?? 0).toFixed(1)}%`} />
      <ProfileStat label="Seria" value={String(shownProfile.current_streak ?? 0)} />
      <View style={{ flexDirection: 'row', gap: 8 }}><ProfileStat label="Kupony" value={String(stats?.totalBets ?? 0)} flex /><ProfileStat label="Wygrane" value={String(stats?.wins ?? 0)} flex /></View>
    </AppCard>

    <AppCard style={{ backgroundColor: palette.card, borderColor: palette.border, gap: 12 }}>
      <Text style={{ color: palette.foreground, fontSize: 18, fontWeight: '900' }}>Historia</Text>
      <Segment values={[["sportsbook", 'Zakłady'], ["casino", 'Kasyno']]} value={kind} onChange={setKind} />
      {kind === 'sportsbook' && <><Segment values={[["all", 'Wszystkie'], ["won", 'Wygrane'], ["lost", 'Przegrane'], ["pending", 'W toku'], ["refund", 'Zwroty']]} value={filter} onChange={setFilter} />{filteredCoupons.length === 0 ? <Text style={{ color: palette.muted, paddingVertical: 18, textAlign: 'center' }}>Brak zakładów</Text> : filteredCoupons.map(coupon => <View key={coupon.id} style={{ gap: 7, borderRadius: 12, backgroundColor: palette.inset, padding: 12 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: palette.foreground, fontWeight: '800' }}>{(coupon.legs?.length ?? 0) > 1 ? `AKO ${coupon.legs?.length}` : coupon.legs?.[0]?.bet_title ?? 'Zakład'}</Text><AppBadge label={statusLabels[coupon.status]} tone={coupon.status === 'won' ? 'success' : coupon.status === 'lost' ? 'danger' : 'warning'} /></View><Text style={{ color: palette.muted, fontSize: 12 }}>Stawka {Number(coupon.stake).toFixed(2)} zł · kurs {Number(coupon.total_odds).toFixed(2)} · wypłata {Number(coupon.payout).toFixed(2)} zł</Text>{coupon.legs?.map((leg, index) => <Text key={leg.id || index} style={{ color: palette.muted, fontSize: 11 }}>• {leg.bet_title}: {leg.selected_option} ({Number(leg.odds_at_time).toFixed(2)})</Text>)}</View>)}</>}
      {kind === 'casino' && (casino.length === 0 ? <Text style={{ color: palette.muted, paddingVertical: 18, textAlign: 'center' }}>Brak gier w kasynie</Text> : casino.map(entry => <View key={entry.id} style={{ gap: 5, borderRadius: 12, backgroundColor: palette.inset, padding: 12 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: palette.foreground, fontWeight: '800' }}>{entry.game_type === 'roulette' ? 'Ruletka' : 'Blackjack'} · {entry.bet_label}</Text><AppBadge label={statusLabels[entry.status]} tone={entry.status === 'won' ? 'success' : entry.status === 'lost' ? 'danger' : 'warning'} /></View><Text style={{ color: palette.muted, fontSize: 12 }}>Stawka {entry.stake.toFixed(2)} zł · wypłata {entry.payout.toFixed(2)} zł</Text></View>))}
    </AppCard>

    <AppCard style={{ backgroundColor: palette.card, borderColor: palette.border, gap: 12 }}><Text style={{ color: palette.foreground, fontSize: 18, fontWeight: '900' }}>Odznaki ({badges.length})</Text>{badges.length === 0 ? <Text style={{ color: palette.muted }}>Brak zdobytych odznak.</Text> : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{badges.map(badge => { const definition = BADGES[badge.badge_key]; if (!definition) return null; return <View key={badge.id} style={{ width: 92, alignItems: 'center', gap: 5 }}><Image source={definition.source} style={{ width: 58, height: 58 }} contentFit="contain" /><Text style={{ color: palette.foreground, fontSize: 11, fontWeight: '800', textAlign: 'center' }}>{definition.name}</Text><Text style={{ color: palette.muted, fontSize: 9, textAlign: 'center' }}>{definition.description}</Text></View>; })}</View>}</AppCard>
  </ScrollView>;
}
