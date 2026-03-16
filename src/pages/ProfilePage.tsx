import { useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Badge, BADGE_DEFINITIONS, CouponHistoryEntry, PublicProfile } from '@/types/database';
import { cn } from '@/lib/utils';
import { Navigate, useParams } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { getDisplayedCouponOdds } from '@/features/coupons/display';

export default function ProfilePage() {
  const { user, profile } = useAuth();
  const { userId } = useParams<{ userId: string }>();

  const isOwnProfile = !userId || userId === user?.id;
  const targetUserId = isOwnProfile ? user?.id : userId;

  const [coupons, setCoupons] = useState<CouponHistoryEntry[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [publicProfile, setPublicProfile] = useState<PublicProfile | null>(null);
  const [rankingStats, setRankingStats] = useState<{
    totalBets: number;
    wins: number;
    losses: number;
    winRate: number;
    totalProfit: number;
  } | null>(null);
  const [filter, setFilter] = useState<'all' | 'won' | 'lost' | 'pending'>('all');
  const [loadingCoupons, setLoadingCoupons] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(!isOwnProfile);
  const [expandedCoupons, setExpandedCoupons] = useState<Set<string>>(new Set());

  const toggleCoupon = (couponId: string) => {
    setExpandedCoupons((prev) => {
      const next = new Set(prev);
      if (next.has(couponId)) next.delete(couponId);
      else next.add(couponId);
      return next;
    });
  };

  useEffect(() => {
    if (!targetUserId) return;

    // Fetch coupon history via RPC
    supabase
      .rpc('get_user_coupon_history', { p_user_id: targetUserId, p_limit: 100, p_offset: 0 })
      .then(({ data }) => {
        if (data) setCoupons(data as unknown as CouponHistoryEntry[]);
        setLoadingCoupons(false);
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
  if (isOwnProfile && (!user || !profile)) return <Navigate to="/" />;

  const displayName = isOwnProfile ? profile!.username : publicProfile?.username ?? '...';
  const displayDate = isOwnProfile
    ? new Date(profile!.created_at).toLocaleDateString('pl-PL')
    : publicProfile
      ? new Date(publicProfile.created_at).toLocaleDateString('pl-PL')
      : '';
  const displayStreak = isOwnProfile ? profile!.current_streak : publicProfile?.current_streak ?? 0;
  const displayLongestStreak = isOwnProfile ? profile!.longest_streak : publicProfile?.longest_streak ?? 0;

  const totalBets = rankingStats?.totalBets ?? 0;
  const wins = rankingStats?.wins ?? 0;
  const losses = rankingStats?.losses ?? 0;
  const winRate = rankingStats ? rankingStats.winRate.toFixed(1) : '0';
  const totalProfit = rankingStats?.totalProfit ?? 0;

  const filtered = coupons.filter((c) => filter === 'all' || c.status === filter);
  const isAko = (c: CouponHistoryEntry) => c.legs !== null && c.legs.length > 1;

  if (!isOwnProfile && loadingProfile) {
    return (
      <div className="h-safe-screen bg-background overflow-hidden flex flex-col">
        <Navbar />
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="max-w-4xl mx-auto p-4 space-y-4">
            <Skeleton className="h-28 w-full rounded-xl" />
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
            </div>
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
            <div>
              <h1 className="text-2xl font-bold">{displayName}</h1>
              <p className="text-sm text-muted-foreground">
                Dołączył: {displayDate}
                {!isOwnProfile && <span className="ml-2 text-xs bg-muted px-2 py-0.5 rounded-full">Profil publiczny</span>}
              </p>
            </div>
            {isOwnProfile && (
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Saldo</p>
                <p className="text-2xl font-bold text-primary">{Number(profile!.balance).toFixed(2)} zł</p>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Zakłady', value: totalBets },
            { label: 'Wygrane', value: wins },
            { label: 'Przegrane', value: losses },
            { label: 'Win rate', value: `${winRate}%` },
            { label: 'Profit', value: `${totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(2)} zł` },
          ].map((stat) => (
            <div key={stat.label} className="bg-card rounded-lg p-3 card-shadow text-center">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="text-lg font-bold">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Streak */}
        <div className="bg-card rounded-xl p-4 card-shadow flex items-center gap-3">
          <span className="text-3xl">🔥</span>
          <div>
            <p className="font-bold">{displayStreak} dni z rzędu</p>
            <p className="text-xs text-muted-foreground">Najdłuższa seria: {displayLongestStreak} dni</p>
          </div>
        </div>

        {/* Coupon history */}
        <div className="bg-card rounded-xl p-4 card-shadow">
          <h2 className="font-bold mb-3">Historia zakładów</h2>
          <div className="-mx-1 mb-3 px-1 overflow-x-auto scrollbar-hide touch-pan-x">
            <div className="flex w-max min-w-full gap-2 pb-1 pr-1">
              {(['all', 'won', 'lost', 'pending'] as const).map((value) => (
                <button
                  key={value}
                  onClick={() => setFilter(value)}
                  className={cn(
                    'shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-all',
                    filter === value ? 'gradient-primary text-primary-foreground shadow-sm' : 'bg-muted'
                  )}
                >
                  {{ all: 'Wszystkie', won: 'Wygrane', lost: 'Przegrane', pending: 'W toku' }[value]}
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
                    legs: (coupon.legs ?? []).map((leg) => ({ oddsAtTime: Number(leg.odds_at_time) })),
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
                                  : 'text-muted-foreground'
                            )}
                          >
                            {coupon.status === 'won'
                              ? `+${Number(coupon.payout).toFixed(2)} zł`
                              : coupon.status === 'lost'
                                ? 'Przegrana'
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
                                      : 'bg-muted-foreground/10 text-muted-foreground'
                                )}
                              >
                                {leg.result === 'won' ? 'Wygrana' : leg.result === 'lost' ? 'Przegrana' : 'W toku'}
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
        </div>

        {/* Badges — only on own profile */}
        {isOwnProfile && (
          <div className="bg-card rounded-xl p-4 card-shadow">
            <h2 className="font-bold mb-3">Odznaki</h2>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              {Object.entries(BADGE_DEFINITIONS).map(([key, definition]) => {
                const unlockedBadge = badges.find((badge) => badge.badge_key === key);
                return (
                  <div
                    key={key}
                    className={cn('text-center p-2 rounded-lg card-shadow transition-all', unlockedBadge ? 'bg-muted' : 'opacity-40')}
                    title={
                      unlockedBadge
                        ? `Odblokowano: ${new Date(unlockedBadge.unlocked_at).toLocaleDateString('pl-PL')}`
                        : definition.description
                    }
                  >
                    <span className="text-2xl">{definition.emoji}</span>
                    <p className="text-xs font-medium mt-1">{definition.name}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
