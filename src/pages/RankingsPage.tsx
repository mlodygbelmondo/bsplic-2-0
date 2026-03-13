import { useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface RankEntry {
  id: string;
  username: string;
  total_profit: number;
  win_rate: number;
  total_bets: number;
}

export default function RankingsPage() {
  const [rankings, setRankings] = useState<RankEntry[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    const fetch = async () => {
      // Get all profiles
      const { data: profiles } = await supabase.from('profiles').select('id, username');
      if (!profiles) return;

      // Get placed bets (we can only see our own due to RLS, so rankings may be limited)
      // For a full ranking, we'd need a server function. For now, show profiles.
      const entries: RankEntry[] = profiles.map((p: any) => ({
        id: p.id,
        username: p.username,
        total_profit: 0,
        win_rate: 0,
        total_bets: 0,
      }));
      setRankings(entries);
    };
    fetch();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-3xl mx-auto p-4">
        <h1 className="text-2xl font-bold mb-6">🏆 Rankingi</h1>
        <div className="bg-card rounded-xl border overflow-hidden">
          <div className="grid grid-cols-5 gap-2 p-3 text-xs font-bold text-muted-foreground border-b">
            <span>#</span>
            <span>Gracz</span>
            <span className="text-right">Profit</span>
            <span className="text-right">Win rate</span>
            <span className="text-right">Zakłady</span>
          </div>
          {rankings.map((r, i) => (
            <div key={r.id} className={cn('grid grid-cols-5 gap-2 p-3 text-sm items-center', r.id === user?.id && 'bg-primary/10')}>
              <span className="font-bold">{i + 1}</span>
              <span className="font-medium truncate">{r.username}</span>
              <span className="text-right font-bold">{r.total_profit.toFixed(0)} zł</span>
              <span className="text-right">{r.win_rate.toFixed(1)}%</span>
              <span className="text-right">{r.total_bets}</span>
            </div>
          ))}
          {rankings.length === 0 && (
            <p className="text-center py-8 text-muted-foreground">Brak danych</p>
          )}
        </div>
      </div>
    </div>
  );
}
