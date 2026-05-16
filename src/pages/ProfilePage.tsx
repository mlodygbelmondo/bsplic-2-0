import { useEffect, useState, type ChangeEvent } from 'react';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Badge, BADGE_DEFINITIONS, CasinoHistoryEntry, CouponHistoryEntry, PublicProfile } from '@/types/database';
import { cn } from '@/lib/utils';
import { Navigate, useParams } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { deriveCouponStatus, getDisplayedCouponOdds, getDisplayedCouponWin } from '@/features/coupons/display';
import { PlayerCardHero } from '@/features/player-card/components/PlayerCardHero';
import { derivePlayerCardDisplayModel } from '@/features/player-card/displayModel';
import { compressImageFile } from '@/features/social/images';

const HISTORY_PREVIEW_SIZE = 10;
const HISTORY_PREVIEW_FETCH_LIMIT = HISTORY_PREVIEW_SIZE + 1;
const HISTORY_BATCH_SIZE = 30;
const HISTORY_BATCH_FETCH_LIMIT = HISTORY_BATCH_SIZE + 1;

function formatBadgeDate(value: string) {
  return new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const { userId: userRef } = useParams<{ userId: string }>();
  const normalizedUserRef = userRef ? decodeURIComponent(userRef) : undefined;

  const [resolvedTargetUserId, setResolvedTargetUserId] = useState<string | null>(null);
  const [resolvingTarget, setResolvingTarget] = useState(Boolean(normalizedUserRef));

  useEffect(() => {
    let cancelled = false;

    const resolveTarget = async () => {
      if (!normalizedUserRef) {
        if (!cancelled) {
          setResolvedTargetUserId(user?.id ?? null);
          setResolvingTarget(false);
        }
        return;
      }

      if (normalizedUserRef === user?.id) {
        if (!cancelled) {
          setResolvedTargetUserId(user.id);
          setResolvingTarget(false);
        }
        return;
      }

      const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalizedUserRef);
      if (looksLikeUuid) {
        if (!cancelled) {
          setResolvedTargetUserId(normalizedUserRef);
          setResolvingTarget(false);
        }
        return;
      }

      if (!cancelled) {
        setResolvingTarget(true);
      }

      const { data } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', normalizedUserRef)
        .limit(1)
        .maybeSingle();

      if (!cancelled) {
        setResolvedTargetUserId(data?.id ?? null);
        setResolvingTarget(false);
      }
    };

    void resolveTarget();

    return () => {
      cancelled = true;
    };
  }, [normalizedUserRef, user?.id]);

  const targetUserId = resolvedTargetUserId;
  const isOwnProfile = !normalizedUserRef || (targetUserId !== null && targetUserId === user?.id);

  const [coupons, setCoupons] = useState<CouponHistoryEntry[]>([]);
  const [casinoHistory, setCasinoHistory] = useState<CasinoHistoryEntry[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [publicProfile, setPublicProfile] = useState<PublicProfile | null>(null);
  const [rankingStats, setRankingStats] = useState<{
    totalBets: number;
    wins: number;
    losses: number;
    winRate: number;
    totalProfit: number;
  } | null>(null);
  const [filter, setFilter] = useState<'all' | 'won' | 'lost' | 'pending' | 'refund'>('all');
  const [historyType, setHistoryType] = useState<'sportsbook' | 'casino'>('sportsbook');
  const [loadingCoupons, setLoadingCoupons] = useState(true);
  const [loadingCasinoHistory, setLoadingCasinoHistory] = useState(true);
  const [sportsbookHistoryExpanded, setSportsbookHistoryExpanded] = useState(false);
  const [casinoHistoryExpanded, setCasinoHistoryExpanded] = useState(false);
  const [hasMoreCoupons, setHasMoreCoupons] = useState(false);
  const [hasMoreCasinoHistory, setHasMoreCasinoHistory] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [expandedCoupons, setExpandedCoupons] = useState<Set<string>>(new Set());
  const [avatarUploadLoading, setAvatarUploadLoading] = useState(false);
  const [avatarOverrideUrl, setAvatarOverrideUrl] = useState<string | null>(null);

  const toggleCoupon = (couponId: string) => {
    setExpandedCoupons((prev) => {
      const next = new Set(prev);
      if (next.has(couponId)) next.delete(couponId);
      else next.add(couponId);
      return next;
    });
  };

  const loadMoreSportsbookHistory = async () => {
    if (!targetUserId) return;
    setLoadingCoupons(true);

    try {
      const { data, error } = await supabase.rpc('get_user_coupon_history', {
        p_user_id: targetUserId,
        p_limit: HISTORY_BATCH_FETCH_LIMIT,
        p_offset: coupons.length,
      });
      if (error) throw error;
      const entries = (data as unknown as CouponHistoryEntry[] | null) ?? [];
      setCoupons((prev) => [...prev, ...entries.slice(0, HISTORY_BATCH_SIZE)]);
      setHasMoreCoupons(entries.length > HISTORY_BATCH_SIZE);
      setSportsbookHistoryExpanded(true);
    } catch (error) {
      console.error('Failed to load more sportsbook history', error);
      toast.error('Nie udało się załadować kolejnych zakładów');
    } finally {
      setLoadingCoupons(false);
    }
  };

  const collapseSportsbookHistory = () => {
    setSportsbookHistoryExpanded(false);
  };

  const loadMoreCasinoHistory = async () => {
    if (!targetUserId) return;
    setLoadingCasinoHistory(true);

    try {
      const { data, error } = await supabase.rpc('get_user_casino_history', {
        p_user_id: targetUserId,
        p_limit: HISTORY_BATCH_FETCH_LIMIT,
        p_offset: casinoHistory.length,
      });
      if (error) throw error;
      const entries = ((data as unknown as CasinoHistoryEntry[] | null) ?? []).map((entry) => ({
        ...entry,
        stake: Number(entry.stake),
        payout: Number(entry.payout),
      }));
      setCasinoHistory((prev) => [...prev, ...entries.slice(0, HISTORY_BATCH_SIZE)]);
      setHasMoreCasinoHistory(entries.length > HISTORY_BATCH_SIZE);
      setCasinoHistoryExpanded(true);
    } catch (error) {
      console.error('Failed to load more casino history', error);
      toast.error('Nie udało się załadować kolejnych wpisów kasyna');
    } finally {
      setLoadingCasinoHistory(false);
    }
  };

  const collapseCasinoHistory = () => {
    setCasinoHistoryExpanded(false);
  };

  useEffect(() => {
    if (!targetUserId) return;
    setLoadingCoupons(true);
    setLoadingCasinoHistory(true);

    setSportsbookHistoryExpanded(false);
    setCasinoHistoryExpanded(false);

    // Fetch history previews via RPC
    supabase
      .rpc('get_user_coupon_history', { p_user_id: targetUserId, p_limit: HISTORY_PREVIEW_FETCH_LIMIT, p_offset: 0 })
      .then(({ data }) => {
        const entries = (data as unknown as CouponHistoryEntry[] | null) ?? [];
        setCoupons(entries.slice(0, HISTORY_PREVIEW_SIZE));
        setHasMoreCoupons(entries.length > HISTORY_PREVIEW_SIZE);
        setLoadingCoupons(false);
      });

    supabase
      .rpc('get_user_casino_history', { p_user_id: targetUserId, p_limit: HISTORY_PREVIEW_FETCH_LIMIT, p_offset: 0 })
      .then(({ data }) => {
        const entries = ((data as unknown as CasinoHistoryEntry[] | null) ?? []).map((entry) => ({
          ...entry,
          stake: Number(entry.stake),
          payout: Number(entry.payout),
        }));
        setCasinoHistory(entries.slice(0, HISTORY_PREVIEW_SIZE));
        setHasMoreCasinoHistory(entries.length > HISTORY_PREVIEW_SIZE);
        setLoadingCasinoHistory(false);
      });

    // Fetch badges
    if (isOwnProfile) {
      supabase
        .from('badges')
        .select('*')
        .eq('user_id', targetUserId)
        .then(({ data }) => {
          if (data) setBadges(data as Badge[]);
        });
    }

    if (isOwnProfile) {
      // Use existing rankings RPC for own stats
      supabase
        .rpc('get_user_rankings')
        .then(({ data }) => {
          if (!data) return;
          const userRanking = (data as Array<{
            id: string;
            total_bets: number;
            won_bets: number;
            lost_bets: number;
            win_rate: number;
            total_profit: number;
          }>).find((entry) => entry.id === targetUserId);
          if (!userRanking) return;
          setRankingStats({
            totalBets: Number(userRanking.total_bets),
            wins: Number(userRanking.won_bets),
            losses: Number(userRanking.lost_bets),
            winRate: Number(userRanking.win_rate),
            totalProfit: Number(userRanking.total_profit),
          });
        });
    } else {
      // Use get_public_profile RPC for other users
      setLoadingProfile(true);
      supabase
        .rpc('get_public_profile', { p_user_id: targetUserId })
        .then(({ data }) => {
          if (data) {
            const pp = data as unknown as PublicProfile;
            setPublicProfile(pp);
            setRankingStats({
              totalBets: Number(pp.total_bets),
              wins: Number(pp.won_bets),
              losses: Number(pp.lost_bets),
              winRate: Number(pp.win_rate),
              totalProfit: Number(pp.total_profit),
            });
          }
          setLoadingProfile(false);
        });
    }
  }, [targetUserId, isOwnProfile]);

  // Own profile requires auth
  if (resolvingTarget) return null;
  if (isOwnProfile && (!user || !profile)) return <Navigate to="/" />;

  const displayName = isOwnProfile ? profile!.username : publicProfile?.username ?? '...';
  const displayDate = isOwnProfile
    ? new Date(profile!.created_at).toLocaleDateString('pl-PL')
    : publicProfile
      ? new Date(publicProfile.created_at).toLocaleDateString('pl-PL')
      : '';
  const displayStreak = isOwnProfile ? profile!.current_streak : publicProfile?.current_streak ?? 0;
  const playerCardModel = derivePlayerCardDisplayModel({
    totalBets: rankingStats?.totalBets ?? 0,
    wins: rankingStats?.wins ?? 0,
    winRate: rankingStats?.winRate ?? 0,
    totalProfit: rankingStats?.totalProfit ?? 0,
    currentStreak: displayStreak,
  });

  const visibleCoupons = sportsbookHistoryExpanded ? coupons : coupons.slice(0, HISTORY_PREVIEW_SIZE);
  const visibleCasinoHistory = casinoHistoryExpanded ? casinoHistory : casinoHistory.slice(0, HISTORY_PREVIEW_SIZE);

  const couponsWithDerivedStatus = visibleCoupons.map((coupon) => ({
    ...coupon,
    status: deriveCouponStatus({
      status: coupon.status,
      legs: (coupon.legs ?? []).map((leg) => ({ result: leg.result })),
    }),
  }));

  const filtered = couponsWithDerivedStatus.filter((c) => filter === 'all' || c.status === filter);
  const isAko = (c: CouponHistoryEntry) => c.legs !== null && c.legs.length > 1;
  const displayAvatarUrl = avatarOverrideUrl ?? (isOwnProfile ? profile?.avatar_url ?? null : publicProfile?.avatar_url ?? null);

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!isOwnProfile || !user || !profile) return;

    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Wybierz plik obrazu');
      event.target.value = '';
      return;
    }

    setAvatarUploadLoading(true);
    try {
      const compressed = await compressImageFile(file, {
        maxDimension: 640,
        targetBytes: 135 * 1024,
        absoluteMaxBytes: 140 * 1024,
        minDimension: 256,
      });

      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('profile-avatars')
        .upload(path, compressed.blob, {
          contentType: 'image/jpeg',
          cacheControl: '31536000',
          upsert: false,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { data: publicUrlData } = supabase.storage
        .from('profile-avatars')
        .getPublicUrl(path);

      const avatarUrl = publicUrlData.publicUrl;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', user.id);

      if (profileError) {
        throw new Error(profileError.message);
      }

      setAvatarOverrideUrl(avatarUrl);
      await refreshProfile();
      toast.success('Zdjęcie profilowe zaktualizowane');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nie udało się zaktualizować zdjęcia profilowego';
      toast.error(message);
    } finally {
      setAvatarUploadLoading(false);
      event.target.value = '';
    }
  };

  if (!isOwnProfile && loadingProfile) {
    return (
      <div className="h-safe-screen bg-background overflow-hidden flex flex-col">
        <Navbar />
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="max-w-4xl mx-auto p-4 space-y-4">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-56 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-safe-screen bg-background overflow-hidden flex flex-col">
      <Navbar />
      <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {/* Header card */}
        <div className="bg-card rounded-xl p-6 card-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-14 w-14 border border-border">
                <AvatarImage src={displayAvatarUrl ?? undefined} alt={`Avatar ${displayName}`} />
                <AvatarFallback className="text-base font-bold">
                  {displayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-2xl font-bold">{displayName}</h1>
                <p className="text-sm text-muted-foreground">
                  Dołączył: {displayDate}
                  {!isOwnProfile && <span className="ml-2 text-xs bg-muted px-2 py-0.5 rounded-full">Profil publiczny</span>}
                </p>
              </div>
            </div>
            {isOwnProfile && (
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Saldo</p>
                <p className="text-2xl font-bold text-primary">{Number(profile!.balance).toFixed(2)} zł</p>
              </div>
            )}
          </div>

          {isOwnProfile && (
            <div className="mt-3">
              <label
                htmlFor="profile-avatar-input"
                className="inline-flex cursor-pointer items-center rounded-md bg-muted px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted/80"
              >
                {avatarUploadLoading ? 'Przesyłanie...' : 'Wybierz zdjęcie profilowe'}
              </label>
              <input
                id="profile-avatar-input"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleAvatarChange}
                disabled={avatarUploadLoading}
              />
            </div>
          )}
        </div>

        <PlayerCardHero
          model={playerCardModel}
          profileName={displayName}
          profileUrl={window.location.href}
        />

        {/* History */}
        <div className="bg-card rounded-xl p-4 card-shadow">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-bold">Historia</h2>
            <div className="inline-flex w-max items-center rounded-lg border border-border bg-muted/40 p-1">
              {([
                ['sportsbook', 'Zakłady'],
                ['casino', 'Kasyno'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setHistoryType(value)}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                    historyType === value
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-background hover:text-foreground'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {historyType === 'sportsbook' && (
          <>
            <div className="-mx-1 mb-3 px-1 overflow-x-auto scrollbar-hide touch-pan-x">
            <div className="flex w-max min-w-full gap-2 pb-1 pr-1">
              {(['all', 'won', 'lost', 'pending', 'refund'] as const).map((value) => (
                <button
                  key={value}
                  onClick={() => setFilter(value)}
                  className={cn(
                    'shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-all',
                    filter === value ? 'gradient-primary text-primary-foreground shadow-sm' : 'bg-muted'
                  )}
                >
                  {{ all: 'Wszystkie', won: 'Wygrane', lost: 'Przegrane', pending: 'W toku', refund: 'Zwroty' }[value]}
                </button>
              ))}
            </div>
          </div>

          {loadingCoupons ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, index) => (
                <Skeleton key={index} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Brak zakładów</p>
              ) : (
                filtered.map((coupon) => {
                  const ako = isAko(coupon);
                  const expanded = expandedCoupons.has(coupon.id);
                  const displayedOdds = getDisplayedCouponOdds({
                    totalOdds: Number(coupon.total_odds),
                    legs: (coupon.legs ?? []).map((leg) => ({
                      oddsAtTime: Number(leg.odds_at_time),
                      result: leg.result,
                    })),
                  });
                  const displayedWin = getDisplayedCouponWin({
                    status: coupon.status,
                    isAko: ako,
                    stake: Number(coupon.stake),
                    displayedOdds,
                    couponPayout: Number(coupon.payout),
                    legs: (coupon.legs ?? []).map((leg) => ({ legPayout: Number(leg.leg_payout ?? 0) })),
                  });

                  return (
                    <div key={coupon.id} className="bg-muted rounded-lg card-shadow overflow-hidden">
                      {/* Coupon header */}
                      <button
                        type="button"
                        className="flex items-center justify-between p-3 w-full text-sm text-left"
                        onClick={() => ako && toggleCoupon(coupon.id)}
                      >
                        <div className="min-w-0 flex-1">
                          {ako ? (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary">
                                AKO {coupon.legs!.length}
                              </span>
                              <span className="font-medium text-xs text-muted-foreground">
                                kurs {displayedOdds.toFixed(2)}
                              </span>
                              {ako && (
                                expanded
                                  ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                                  : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                            </div>
                          ) : (
                            <>
                              <p className="font-medium truncate">{coupon.legs?.[0]?.bet_title || 'Zakład'}</p>
                              <p className="text-xs text-muted-foreground">
                                {coupon.legs?.[0]?.selected_option} • kurs {displayedOdds.toFixed(2)}
                              </p>
                            </>
                          )}
                        </div>
                        <div className="text-right ml-3 shrink-0">
                          <p className="font-bold">{Number(coupon.stake).toFixed(2)} zł</p>
                          <p
                            className={cn(
                              'text-xs font-medium',
                              coupon.status === 'won'
                                ? 'text-success'
                                : coupon.status === 'lost'
                                  ? 'text-destructive'
                                  : coupon.status === 'refund'
                                    ? 'text-primary'
                                  : 'text-muted-foreground'
                            )}
                          >
                            {coupon.status === 'won'
                              ? `+${displayedWin.toFixed(2)} zł`
                              : coupon.status === 'lost'
                                ? 'Przegrana'
                                : coupon.status === 'refund'
                                  ? `Zwrot ${displayedWin.toFixed(2)} zł`
                                : 'W toku'}
                          </p>
                        </div>
                      </button>

                      {/* AKO legs (expandable) */}
                      {ako && expanded && (
                        <div className="border-t border-border px-3 pb-3 pt-2 space-y-1.5">
                          {coupon.legs!.map((leg) => (
                            <div key={leg.id} className="flex items-center justify-between text-xs">
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium">{leg.bet_title || 'Zakład'}</p>
                                <p className="text-muted-foreground">
                                  {leg.selected_option} • kurs {Number(leg.odds_at_time).toFixed(2)}
                                </p>
                              </div>
                              <span
                                className={cn(
                                  'ml-2 shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded',
                                  leg.result === 'won'
                                    ? 'bg-success/10 text-success'
                                    : leg.result === 'lost'
                                      ? 'bg-destructive/10 text-destructive'
                                      : leg.result === 'refund'
                                        ? 'bg-primary/10 text-primary'
                                      : 'bg-muted-foreground/10 text-muted-foreground'
                                )}
                              >
                                {leg.result === 'won' ? 'Wygrana' : leg.result === 'lost' ? 'Przegrana' : leg.result === 'refund' ? 'Zwrot' : 'W toku'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {!loadingCoupons && coupons.length > 0 && (sportsbookHistoryExpanded || coupons.length > HISTORY_PREVIEW_SIZE || hasMoreCoupons) && (
            <div className="mt-3 flex gap-2">
              {sportsbookHistoryExpanded && (
                <button
                  type="button"
                  onClick={collapseSportsbookHistory}
                  className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
                >
                  Pokaż mniej
                </button>
              )}
              {(!sportsbookHistoryExpanded || hasMoreCoupons) && (
                <button
                  type="button"
                  onClick={loadMoreSportsbookHistory}
                  className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
                >
                  Pokaż więcej
                </button>
              )}
            </div>
          )}
          </>
          )}

          {historyType === 'casino' && (
          <>
          {loadingCasinoHistory ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, index) => (
                <Skeleton key={index} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {casinoHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Brak betów z kasyna</p>
              ) : (
                visibleCasinoHistory.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between rounded-lg bg-muted p-3 text-sm card-shadow">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{entry.game_type}</p>
                        {entry.round_label && (
                          <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                            {entry.round_label}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{entry.bet_label}</p>
                    </div>
                    <div className="ml-3 shrink-0 text-right">
                      <p className="font-bold">{entry.stake.toFixed(2)} zł</p>
                      <p
                        className={cn(
                          'text-xs font-medium',
                          entry.status === 'won'
                            ? 'text-success'
                            : entry.status === 'lost'
                              ? 'text-destructive'
                              : entry.status === 'push'
                                ? 'text-primary'
                              : 'text-muted-foreground'
                        )}
                      >
                        {entry.status === 'won'
                          ? `+${entry.payout.toFixed(2)} zł`
                          : entry.status === 'lost'
                            ? 'Przegrana'
                            : entry.status === 'push'
                              ? `Zwrot ${entry.payout.toFixed(2)} zł`
                            : 'W toku'}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {!loadingCasinoHistory && casinoHistory.length > 0 && (casinoHistoryExpanded || casinoHistory.length > HISTORY_PREVIEW_SIZE || hasMoreCasinoHistory) && (
            <div className="mt-3 flex gap-2">
              {casinoHistoryExpanded && (
                <button
                  type="button"
                  onClick={collapseCasinoHistory}
                  className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
                >
                  Pokaż mniej
                </button>
              )}
              {(!casinoHistoryExpanded || hasMoreCasinoHistory) && (
                <button
                  type="button"
                  onClick={loadMoreCasinoHistory}
                  className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
                >
                  Pokaż więcej
                </button>
              )}
            </div>
          )}
          </>
          )}
        </div>

        {/* Badges — only on own profile */}
        {isOwnProfile && (
          <section aria-label="Odznaki" className="bg-card rounded-xl p-4 card-shadow">
            <h2 className="font-bold mb-3">Odznaki</h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(BADGE_DEFINITIONS).map(([key, definition]) => {
                const unlockedBadge = badges.find((badge) => badge.badge_key === key);
                return (
                  <li
                    key={key}
                    aria-label={definition.name}
                    className={cn(
                      'rounded-xl border p-3 card-shadow transition-all',
                      unlockedBadge ? 'border-primary/20 bg-muted' : 'border-border bg-background/60'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          'flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border',
                          unlockedBadge ? 'border-primary/20 bg-background' : 'border-border bg-muted/40'
                        )}
                      >
                        <img
                          src={definition.imageSrc}
                          alt={`Odznaka ${definition.name}`}
                          className={cn('h-14 w-14 object-contain', !unlockedBadge && 'grayscale opacity-60')}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-tight">{definition.name}</p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{definition.description}</p>
                        <p
                          className={cn(
                            'mt-2 text-xs font-medium',
                            unlockedBadge ? 'text-primary' : 'text-muted-foreground'
                          )}
                        >
                          {unlockedBadge
                            ? `Odblokowano: ${formatBadgeDate(unlockedBadge.unlocked_at)}`
                            : 'Nieodblokowana'}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
      </div>
    </div>
  );
}
