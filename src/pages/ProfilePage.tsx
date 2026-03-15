import { useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Badge, BADGE_DEFINITIONS } from '@/types/database';
import { cn } from '@/lib/utils';
import { Navigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';

interface ProfilePlacedBet {
  id: string;
  selected_option: string;
  odds_at_time: number;
  stake: number;
  payout: number;
  result: 'pending' | 'won' | 'lost';
  bet?: { title: string } | null;
}

export default function ProfilePage() {
  const { user, profile } = useAuth();
  const [placedBets, setPlacedBets] = useState<ProfilePlacedBet[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [rankingStats, setRankingStats] = useState<{
    totalBets: number;
    wins: number;
    losses: number;
    winRate: number;
    totalProfit: number;
  } | null>(null);
  const [filter, setFilter] = useState<'all' | 'won' | 'lost' | 'pending'>('all');
  const [loadingBets, setLoadingBets] = useState(true);

  useEffect(() => {
    if (!user) return;

    supabase
      .from('placed_bets')
      .select('*, bet:bets(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setPlacedBets(data as unknown as ProfilePlacedBet[]);
        setLoadingBets(false);
      });

    supabase
      .from('badges')
      .select('*')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (data) setBadges(data as Badge[]);
      });

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
        }>).find((entry) => entry.id === user.id);

        if (!userRanking) return;

        setRankingStats({
          totalBets: Number(userRanking.total_bets),
          wins: Number(userRanking.won_bets),
          losses: Number(userRanking.lost_bets),
          winRate: Number(userRanking.win_rate),
          totalProfit: Number(userRanking.total_profit),
        });
      });
  }, [user]);

  if (!user || !profile) return <Navigate to="/" />;

  const totalBets = rankingStats?.totalBets ?? placedBets.length;
  const wins = rankingStats?.wins ?? placedBets.filter((bet) => bet.result === 'won').length;
  const losses = rankingStats?.losses ?? placedBets.filter((bet) => bet.result === 'lost').length;
  const winRate = rankingStats
    ? rankingStats.winRate.toFixed(1)
    : totalBets > 0
      ? ((wins / totalBets) * 100).toFixed(1)
      : '0';
  const totalProfit = rankingStats?.totalProfit ?? placedBets.reduce((acc, bet) => acc + (Number(bet.payout) - Number(bet.stake)), 0);
  const filtered = placedBets.filter((bet) => filter === 'all' || bet.result === filter);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        <div className="bg-card rounded-xl p-6 card-shadow">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">{profile.username}</h1>
              <p className="text-sm text-muted-foreground">Dołączył: {new Date(profile.created_at).toLocaleDateString('pl-PL')}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Saldo</p>
              <p className="text-2xl font-bold text-primary">{Number(profile.balance).toFixed(2)} zł</p>
            </div>
          </div>
        </div>

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

        <div className="bg-card rounded-xl p-4 card-shadow flex items-center gap-3">
          <span className="text-3xl">🔥</span>
          <div>
            <p className="font-bold">{profile.current_streak} dni z rzędu</p>
            <p className="text-xs text-muted-foreground">Najdłuższa seria: {profile.longest_streak} dni</p>
          </div>
        </div>

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

          {loadingBets ? (
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
                filtered.map((placedBet) => (
                  <div key={placedBet.id} className="flex items-center justify-between p-3 bg-muted rounded-lg text-sm card-shadow">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{placedBet.bet?.title || 'Zakład'}</p>
                      <p className="text-xs text-muted-foreground">
                        {placedBet.selected_option} • kurs {Number(placedBet.odds_at_time).toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right ml-3">
                      <p className="font-bold">{Number(placedBet.stake).toFixed(2)} zł</p>
                      <p
                        className={cn(
                          'text-xs font-medium',
                          placedBet.result === 'won'
                            ? 'text-success'
                            : placedBet.result === 'lost'
                              ? 'text-destructive'
                              : 'text-muted-foreground'
                        )}
                      >
                        {placedBet.result === 'won'
                          ? `+${Number(placedBet.payout).toFixed(2)} zł`
                          : placedBet.result === 'lost'
                            ? 'Przegrana'
                            : 'W toku'}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

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
      </div>
    </div>
  );
}
