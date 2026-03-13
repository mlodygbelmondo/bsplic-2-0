import { useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { PlacedBet, Badge, BADGE_DEFINITIONS } from '@/types/database';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Navigate } from 'react-router-dom';

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const [placedBets, setPlacedBets] = useState<any[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [filter, setFilter] = useState<'all' | 'won' | 'lost' | 'pending'>('all');

  useEffect(() => {
    if (!user) return;
    supabase.from('placed_bets').select('*, bet:bets(*)').eq('user_id', user.id).order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setPlacedBets(data); });
    supabase.from('badges').select('*').eq('user_id', user.id)
      .then(({ data }) => { if (data) setBadges(data as Badge[]); });
  }, [user]);

  if (!user || !profile) return <Navigate to="/" />;

  const topUp = async (amount: number) => {
    await supabase.from('profiles').update({ balance: Number(profile.balance) + amount }).eq('id', user.id);
    await refreshProfile();
    toast.success(`💰 Portfel doładowany o ${amount} zł`);
  };

  const totalBets = placedBets.length;
  const wins = placedBets.filter(b => b.result === 'won').length;
  const losses = placedBets.filter(b => b.result === 'lost').length;
  const winRate = totalBets > 0 ? ((wins / totalBets) * 100).toFixed(1) : '0';
  const totalProfit = placedBets.reduce((acc, b) => acc + (Number(b.payout) - Number(b.stake)), 0);

  const filtered = placedBets.filter(b => filter === 'all' || b.result === filter);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="bg-card rounded-xl p-6 border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">{profile.username}</h1>
              <p className="text-sm text-muted-foreground">Dołączył: {new Date(profile.created_at).toLocaleDateString('pl-PL')}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Saldo</p>
              <p className="text-2xl font-bold text-primary">{Number(profile.balance).toFixed(0)} zł</p>
            </div>
          </div>
          <div className="flex gap-2">
            {[50, 100, 500].map(amt => (
              <Button key={amt} variant="outline" size="sm" onClick={() => topUp(amt)}>+{amt} zł</Button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Zakłady', value: totalBets },
            { label: 'Wygrane', value: wins },
            { label: 'Przegrane', value: losses },
            { label: 'Win rate', value: `${winRate}%` },
            { label: 'Profit', value: `${totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(0)} zł` },
          ].map(s => (
            <div key={s.label} className="bg-card rounded-lg p-3 border text-center">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-lg font-bold">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Streak */}
        <div className="bg-card rounded-xl p-4 border flex items-center gap-3">
          <span className="text-3xl">🔥</span>
          <div>
            <p className="font-bold">{profile.current_streak} dni z rzędu</p>
            <p className="text-xs text-muted-foreground">Najdłuższa seria: {profile.longest_streak} dni</p>
          </div>
        </div>

        {/* Badges */}
        <div className="bg-card rounded-xl p-4 border">
          <h2 className="font-bold mb-3">Odznaki</h2>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {Object.entries(BADGE_DEFINITIONS).map(([key, def]) => {
              const unlocked = badges.find(b => b.badge_key === key);
              return (
                <div key={key} className={cn('text-center p-2 rounded-lg', unlocked ? 'bg-muted' : 'opacity-40')} title={unlocked ? `Odblokowano: ${new Date(unlocked.unlocked_at).toLocaleDateString('pl-PL')}` : def.description}>
                  <span className="text-2xl">{def.emoji}</span>
                  <p className="text-xs font-medium mt-1">{def.name}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bet history */}
        <div className="bg-card rounded-xl p-4 border">
          <h2 className="font-bold mb-3">Historia zakładów</h2>
          <div className="flex gap-2 mb-3">
            {(['all', 'won', 'lost', 'pending'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} className={cn('px-3 py-1 rounded-full text-xs font-medium', filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                {{ all: 'Wszystkie', won: 'Wygrane', lost: 'Przegrane', pending: 'W toku' }[f]}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Brak zakładów</p>
            ) : filtered.map((pb: any) => (
              <div key={pb.id} className="flex items-center justify-between p-3 bg-muted rounded-lg text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{pb.bet?.title || 'Zakład'}</p>
                  <p className="text-xs text-muted-foreground">{pb.selected_option} • kurs {Number(pb.odds_at_time).toFixed(2)}</p>
                </div>
                <div className="text-right ml-3">
                  <p className="font-bold">{Number(pb.stake).toFixed(0)} zł</p>
                  <p className={cn('text-xs font-medium', pb.result === 'won' ? 'text-success' : pb.result === 'lost' ? 'text-destructive' : 'text-muted-foreground')}>
                    {pb.result === 'won' ? `+${Number(pb.payout).toFixed(0)} zł` : pb.result === 'lost' ? 'Przegrana' : 'W toku'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
