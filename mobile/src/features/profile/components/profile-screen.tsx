/* eslint-disable @typescript-eslint/no-require-imports -- Metro resolves bundled badge assets through static require calls. */
import 'expo-sqlite/localStorage/install';
import { useCallback, useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { fetch } from 'expo/fetch';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Share, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';

import { useReducedMotion } from '@/components/feedback/use-reduced-motion';
import { AppAvatar, AppButton, AppCard } from '@/components/ui';
import { useAppTheme } from '@/hooks/use-app-theme';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/providers/auth-provider';
import type {
  Badge,
  CasinoHistoryEntry,
  CouponHistoryEntry,
  PublicProfile,
} from '@/types/database';

import {
  ProfileHistoryPanel,
  type CouponFilter,
  type HistoryKind,
} from './profile-history-panel';
import { ProfilePlayerCard } from './profile-player-card';

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
  hasMoreCoupons: boolean;
  hasMoreCasino: boolean;
}

const profileCacheKey = (id: string) => `bsplic.profile.screen.v2.${id}`;
const AVATAR_TARGET_BYTES = 135_000;
const AVATAR_MAX_BYTES = 140_000;
const HISTORY_PREVIEW_SIZE = 10;
const HISTORY_PREVIEW_FETCH_LIMIT = HISTORY_PREVIEW_SIZE + 1;
const HISTORY_BATCH_SIZE = 30;
const HISTORY_BATCH_FETCH_LIMIT = HISTORY_BATCH_SIZE + 1;

function readProfileCache(id: string): CachedProfileScreen | null {
  try {
    return JSON.parse(localStorage.getItem(profileCacheKey(id)) ?? 'null') as CachedProfileScreen | null;
  } catch {
    return null;
  }
}

function writeProfileCache(id: string, value: CachedProfileScreen) {
  try {
    localStorage.setItem(profileCacheKey(id), JSON.stringify(value));
  } catch {
    // The current in-memory profile remains available.
  }
}

const BADGES: Record<string, { name: string; description: string; source: number }> = {
  debiutant: { name: 'Debiutant', description: 'Pierwszy postawiony zakład', source: require('../../../../assets/images/badges/debiutant.png') },
  trafiony: { name: 'Trafiony zakład', description: 'Pierwszy wygrany zakład', source: require('../../../../assets/images/badges/trafiony.png') },
  kuponista: { name: 'Kuponista', description: 'Pierwszy kupon AKO', source: require('../../../../assets/images/badges/kuponista.png') },
  goraca_passa: { name: 'Gorąca passa', description: '3 wygrane z rzędu', source: require('../../../../assets/images/badges/goraca_passa.png') },
  nie_do_zatrzymania: { name: 'Nie do zatrzymania', description: '5 wygranych z rzędu', source: require('../../../../assets/images/badges/nie_do_zatrzymania.png') },
  mistrz_serii: { name: 'Mistrz serii', description: '10 wygranych z rzędu', source: require('../../../../assets/images/badges/mistrz_serii.png') },
  pierwszy_tysiac: { name: 'Pierwszy tysiąc', description: 'Łączne wygrane powyżej 1000 zł', source: require('../../../../assets/images/badges/pierwszy_tysiac.png') },
  wieloryb: { name: 'Wieloryb', description: 'Pojedynczy zakład na 500 zł lub więcej', source: require('../../../../assets/images/badges/wieloryb.png') },
  ryzykant: { name: 'Ryzykant', description: 'Kupon AKO z 5+ wydarzeniami', source: require('../../../../assets/images/badges/ryzykant.png') },
  analityk: { name: 'Analityk', description: 'Win rate powyżej 60% (min. 20 zakładów)', source: require('../../../../assets/images/badges/analityk.png') },
  staly_bywalec: { name: 'Stały bywalec', description: 'Seria 7 dni', source: require('../../../../assets/images/badges/staly_bywalec.png') },
  legenda: { name: 'Legenda', description: 'Seria 30 dni', source: require('../../../../assets/images/badges/legenda.png') },
  pomyslodawca: { name: 'Pomysłodawca', description: 'Pierwsza zaakceptowana propozycja', source: require('../../../../assets/images/badges/pomyslodawca.png') },
  wszechstronny: { name: 'Wszechstronny', description: 'Zakłady w 4+ kategoriach', source: require('../../../../assets/images/badges/wszechstronny.png') },
  multi_fan: { name: 'Multi-fan', description: '10 kuponów AKO', source: require('../../../../assets/images/badges/multi_fan.png') },
};

function toStats(row: { total_bets: number; won_bets: number; lost_bets: number; win_rate: number; total_profit: number }): Stats {
  return {
    totalBets: Number(row.total_bets), wins: Number(row.won_bets), losses: Number(row.lost_bets),
    winRate: Number(row.win_rate), totalProfit: Number(row.total_profit),
  };
}

async function prepareAvatarBody(uri: string): Promise<ArrayBuffer> {
  const attempts = [
    { dimension: 640, quality: 0.78 },
    { dimension: 560, quality: 0.68 },
    { dimension: 480, quality: 0.58 },
    { dimension: 400, quality: 0.48 },
    { dimension: 320, quality: 0.38 },
    { dimension: 256, quality: 0.3 },
  ];

  for (const [index, attempt] of attempts.entries()) {
    const edited = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: attempt.dimension, height: attempt.dimension } }],
      { compress: attempt.quality, format: ImageManipulator.SaveFormat.JPEG },
    );
    const body = await (await fetch(edited.uri)).arrayBuffer();
    if (body.byteLength <= AVATAR_TARGET_BYTES || (index === attempts.length - 1 && body.byteLength <= AVATAR_MAX_BYTES)) return body;
  }

  throw new Error('Nie udało się zmniejszyć zdjęcia poniżej limitu 140 KB. Wybierz prostsze zdjęcie.');
}

export function ProfileScreen({ userRef }: { userRef?: string }) {
  const reducedMotion = useReducedMotion();
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
  const [expandedCouponIds, setExpandedCouponIds] = useState<Set<string>>(new Set());
  const [sportsbookExpanded, setSportsbookExpanded] = useState(false);
  const [casinoExpanded, setCasinoExpanded] = useState(false);
  const [hasMoreCoupons, setHasMoreCoupons] = useState(false);
  const [hasMoreCasino, setHasMoreCasino] = useState(false);
  const [casinoLoaded, setCasinoLoaded] = useState(false);
  const [loadingCasino, setLoadingCasino] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    setHistoryError(null);
    setExpandedCouponIds(new Set());
    setSportsbookExpanded(false);
    setCasinoExpanded(false);
    setCasinoLoaded(false);
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
      const [badgeResult, statsResult, couponsResult] = await Promise.all([
        supabase.rpc('get_public_badges', { p_user_id: resolved }),
        own ? supabase.rpc('get_user_stats', { p_user_id: resolved }) : supabase.rpc('get_public_profile', { p_user_id: resolved }),
        supabase.rpc('get_user_coupon_history', { p_user_id: resolved, p_limit: HISTORY_PREVIEW_FETCH_LIMIT, p_offset: 0 }),
      ]);
      if (badgeResult.error) throw badgeResult.error;
      if (statsResult.error) throw statsResult.error;
      if (couponsResult.error) throw couponsResult.error;
      const nextBadges = (badgeResult.data as unknown as Badge[] | null) ?? [];
      const couponPage = (couponsResult.data as unknown as CouponHistoryEntry[] | null) ?? [];
      const nextCoupons = couponPage.slice(0, HISTORY_PREVIEW_SIZE);
      const nextHasMoreCoupons = couponPage.length > HISTORY_PREVIEW_SIZE;
      let nextPublicProfile: PublicProfile | null = null;
      let nextStats: Stats | null = null;
      if (own) {
        const row = (statsResult.data as unknown as Array<Parameters<typeof toStats>[0]> | null)?.[0];
        nextStats = row ? toStats(row) : null;
      } else {
        const row = statsResult.data as unknown as PublicProfile | null;
        nextPublicProfile = row; nextStats = row ? toStats(row) : null;
      }
      setBadges(nextBadges);
      setCoupons(nextCoupons);
      setCasino([]);
      setHasMoreCoupons(nextHasMoreCoupons);
      setHasMoreCasino(false);
      setPublicProfile(nextPublicProfile);
      setStats(nextStats);
      const previousCache = readProfileCache(resolved);
      writeProfileCache(resolved, {
        publicProfile: nextPublicProfile,
        stats: nextStats,
        badges: nextBadges,
        coupons: nextCoupons,
        casino: previousCache?.casino ?? [],
        hasMoreCoupons: nextHasMoreCoupons,
        hasMoreCasino: previousCache?.hasMoreCasino ?? false,
      });
    } catch (cause) {
      const cached = resolved ? readProfileCache(resolved) : null;
      if (cached) {
        setBadges(cached.badges);
        setCoupons(cached.coupons);
        setCasino(cached.casino);
        setHasMoreCoupons(cached.hasMoreCoupons);
        setHasMoreCasino(cached.hasMoreCasino);
        setCasinoLoaded(cached.casino.length > 0);
        setPublicProfile(cached.publicProfile);
        setStats(cached.stats);
      }
      setError(cached ? null : cause instanceof Error ? cause.message : 'Nie udało się wczytać profilu');
    } finally { setLoading(false); }
  }, [user?.id, userRef]);

  const loadCasinoPreview = useCallback(async () => {
    if (!targetId || casinoLoaded || loadingCasino) return;
    setCasinoLoaded(true);
    setLoadingCasino(true);
    setHistoryError(null);
    try {
      const result = await supabase.rpc('get_user_casino_history', {
        p_user_id: targetId,
        p_limit: HISTORY_PREVIEW_FETCH_LIMIT,
        p_offset: 0,
      });
      if (result.error) throw result.error;
      const page = ((result.data as unknown as CasinoHistoryEntry[] | null) ?? []).map(
        (entry) => ({ ...entry, stake: Number(entry.stake), payout: Number(entry.payout) }),
      );
      setCasino(page.slice(0, HISTORY_PREVIEW_SIZE));
      setHasMoreCasino(page.length > HISTORY_PREVIEW_SIZE);
      const cached = readProfileCache(targetId);
      if (cached) {
        writeProfileCache(targetId, {
          ...cached,
          casino: page.slice(0, HISTORY_PREVIEW_SIZE),
          hasMoreCasino: page.length > HISTORY_PREVIEW_SIZE,
        });
      }
    } catch (cause) {
      const cached = readProfileCache(targetId);
      if (cached?.casino.length) {
        setCasino(cached.casino);
        setHasMoreCasino(cached.hasMoreCasino);
      } else {
        setHistoryError(cause instanceof Error ? cause.message : 'Nie udało się wczytać historii kasyna');
      }
    } finally {
      setLoadingCasino(false);
    }
  }, [casinoLoaded, loadingCasino, targetId]);

  const showMoreHistory = useCallback(async () => {
    if (!targetId || loadingMore) return;
    if (kind === 'sportsbook' && !sportsbookExpanded && coupons.length > HISTORY_PREVIEW_SIZE) {
      setSportsbookExpanded(true);
      return;
    }
    if (kind === 'casino' && !casinoExpanded && casino.length > HISTORY_PREVIEW_SIZE) {
      setCasinoExpanded(true);
      return;
    }

    const hasMore = kind === 'sportsbook' ? hasMoreCoupons : hasMoreCasino;
    if (!hasMore) {
      if (kind === 'sportsbook') setSportsbookExpanded(true);
      else setCasinoExpanded(true);
      return;
    }

    setLoadingMore(true);
    setHistoryError(null);
    try {
      if (kind === 'sportsbook') {
        const result = await supabase.rpc('get_user_coupon_history', {
          p_user_id: targetId,
          p_limit: HISTORY_BATCH_FETCH_LIMIT,
          p_offset: coupons.length,
        });
        if (result.error) throw result.error;
        const page = (result.data as unknown as CouponHistoryEntry[] | null) ?? [];
        const nextCoupons = [...coupons, ...page.slice(0, HISTORY_BATCH_SIZE)];
        const nextHasMore = page.length > HISTORY_BATCH_SIZE;
        setCoupons(nextCoupons);
        setHasMoreCoupons(nextHasMore);
        setSportsbookExpanded(true);
        const cached = readProfileCache(targetId);
        if (cached) writeProfileCache(targetId, { ...cached, coupons: nextCoupons, hasMoreCoupons: nextHasMore });
      } else {
        const result = await supabase.rpc('get_user_casino_history', {
          p_user_id: targetId,
          p_limit: HISTORY_BATCH_FETCH_LIMIT,
          p_offset: casino.length,
        });
        if (result.error) throw result.error;
        const page = ((result.data as unknown as CasinoHistoryEntry[] | null) ?? []).map(
          (entry) => ({ ...entry, stake: Number(entry.stake), payout: Number(entry.payout) }),
        );
        const nextCasino = [...casino, ...page.slice(0, HISTORY_BATCH_SIZE)];
        const nextHasMore = page.length > HISTORY_BATCH_SIZE;
        setCasino(nextCasino);
        setHasMoreCasino(nextHasMore);
        setCasinoExpanded(true);
        const cached = readProfileCache(targetId);
        if (cached) writeProfileCache(targetId, { ...cached, casino: nextCasino, hasMoreCasino: nextHasMore });
      }
    } catch (cause) {
      setHistoryError(cause instanceof Error ? cause.message : 'Nie udało się wczytać dalszej historii');
    } finally {
      setLoadingMore(false);
    }
  }, [casino, casinoExpanded, coupons, hasMoreCasino, hasMoreCoupons, kind, loadingMore, sportsbookExpanded, targetId]);

  const collapseHistory = useCallback(() => {
    if (kind === 'sportsbook') setSportsbookExpanded(false);
    else setCasinoExpanded(false);
  }, [kind]);

  const toggleCoupon = useCallback((id: string) => {
    setExpandedCouponIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (kind === 'casino') void loadCasinoPreview(); }, [kind, loadCasinoPreview]);
  const own = targetId === user?.id;
  const shownProfile = own ? profile : publicProfile;
  const displayName = shownProfile?.username ?? 'Gracz';
  const playerLevel = stats && stats.totalProfit > 0 ? 'Na plusie' : (shownProfile?.current_streak ?? 0) >= 3 ? 'Na fali' : (stats?.totalBets ?? 0) >= 25 ? 'Weteran kuponów' : 'Nowy gracz';
  const visibleCoupons = sportsbookExpanded ? coupons : coupons.slice(0, HISTORY_PREVIEW_SIZE);
  const visibleCasino = casinoExpanded ? casino : casino.slice(0, HISTORY_PREVIEW_SIZE);
  const sectionEntering = (delay: number) => reducedMotion
    ? undefined
    : FadeInDown.duration(300).delay(delay).reduceMotion(ReduceMotion.System);

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
      const body = await prepareAvatarBody(result.assets[0].uri);
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
    <Animated.View entering={sectionEntering(0)}>
      <AppCard style={{ backgroundColor: palette.card, borderColor: palette.border, gap: 12, padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <AppAvatar name={displayName} size={58} source={shownProfile.avatar_url ? { uri: shownProfile.avatar_url } : undefined} />
          <View style={{ flex: 1, gap: 2 }}><Text allowFontScaling={false} style={{ color: palette.foreground, fontSize: 21, fontWeight: '800' }}>{displayName}</Text><Text allowFontScaling={false} style={{ color: palette.muted, fontSize: 11 }}>Dołączył: {new Date(shownProfile.created_at).toLocaleDateString('pl-PL')}{own ? '' : ' · profil publiczny'}</Text></View>
          {own && <View style={{ alignItems: 'flex-end', maxWidth: 92 }}><Text allowFontScaling={false} style={{ color: palette.muted, fontSize: 10 }}>Saldo</Text><Text allowFontScaling={false} style={{ color: palette.primary, fontSize: 18, fontWeight: '900', textAlign: 'right' }}>{Number(profile?.balance ?? 0).toFixed(2)} zł</Text></View>}
        </View>
        {own ? <Pressable accessibilityRole="button" disabled={uploading} onPress={changeAvatar} style={{ minHeight: 34, justifyContent: 'center', alignSelf: 'flex-start', borderRadius: 10, backgroundColor: palette.inset, paddingHorizontal: 12 }}><Text allowFontScaling={false} style={{ color: palette.foreground, fontSize: 11, fontWeight: '700' }}>{uploading ? 'Wysyłanie…' : 'Wybierz zdjęcie profilowe'}</Text></Pressable> : null}
      </AppCard>
    </Animated.View>

    <Animated.View entering={sectionEntering(45)}>
      <ProfilePlayerCard
        playerLevel={playerLevel}
        profit={stats?.totalProfit ?? 0}
        winRate={stats?.winRate ?? 0}
        currentStreak={shownProfile.current_streak ?? 0}
        totalBets={stats?.totalBets ?? 0}
        wins={stats?.wins ?? 0}
        onShare={() => void shareProfile()}
      />
    </Animated.View>

    <Animated.View entering={sectionEntering(90)}>
      <ProfileHistoryPanel
        coupons={visibleCoupons}
        casino={visibleCasino}
        kind={kind}
        filter={filter}
        expandedCouponIds={expandedCouponIds}
        sportsbookExpanded={sportsbookExpanded}
        casinoExpanded={casinoExpanded}
        hasMoreCoupons={hasMoreCoupons}
        hasMoreCasino={hasMoreCasino}
        hasHiddenCoupons={coupons.length > visibleCoupons.length}
        hasHiddenCasino={casino.length > visibleCasino.length}
        loadingCasino={loadingCasino}
        loadingMore={loadingMore}
        error={historyError}
        onKindChange={setKind}
        onFilterChange={setFilter}
        onToggleCoupon={toggleCoupon}
        onShowMore={() => void showMoreHistory()}
        onCollapse={collapseHistory}
      />
    </Animated.View>

    <Animated.View entering={sectionEntering(135)}>
      <AppCard style={{ backgroundColor: palette.card, borderColor: palette.border, gap: 12 }}>
        <Text style={{ color: palette.foreground, fontSize: 18, fontWeight: '900' }}>Odznaki</Text>
        <View style={{ gap: 10 }}>
          {Object.entries(BADGES).map(([badgeKey, definition]) => {
            const unlockedBadge = badges.find((badge) => badge.badge_key === badgeKey);
            const unlockedLabel = unlockedBadge ? `Odblokowano: ${new Date(unlockedBadge.unlocked_at).toLocaleDateString('pl-PL')}` : 'Nieodblokowana';
            return <View key={badgeKey} accessibilityLabel={`${definition.name}. ${unlockedLabel}`} style={{ minHeight: 86, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, borderWidth: 1, borderColor: unlockedBadge ? `${tokens.colors.primary}40` : palette.border, backgroundColor: palette.inset, padding: 12 }}><View style={{ width: 64, height: 64, borderRadius: 10, borderWidth: 1, borderColor: unlockedBadge ? `${tokens.colors.primary}38` : palette.border, backgroundColor: palette.card, alignItems: 'center', justifyContent: 'center' }}><Image source={definition.source} style={{ width: 56, height: 56, opacity: unlockedBadge ? 1 : 0.42 }} contentFit="contain" /></View><View style={{ flex: 1, gap: 4 }}><Text style={{ color: palette.foreground, fontSize: 13, fontWeight: '800' }}>{definition.name}</Text><Text style={{ color: palette.muted, fontSize: 11 }}>{definition.description}</Text><Text style={{ color: unlockedBadge ? tokens.colors.primary : palette.muted, fontSize: 10, fontWeight: '700' }}>{unlockedLabel}</Text></View></View>;
          })}
        </View>
      </AppCard>
    </Animated.View>
  </ScrollView>;
}
