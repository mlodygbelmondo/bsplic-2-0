import { useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface RankEntry {
  id: string;
  username: string;
  total_profit: number;
  win_rate: number;
  total_bets: number;
}

export default function RankingsPage() {
  const [rankings, setRankings] = useState<RankEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetch = async () => {
      const { data: profiles } = await supabase.from('profiles').select('id, username');
      if (!profiles) { setLoading(false); return; }
      const entries: RankEntry[] = profiles.map((p: any) => ({
        id: p.id,
        username: p.username,
        total_profit: 0,
        win_rate: 0,
        total_bets: 0,
      }));
      setRankings(entries);
      setLoading(false);
    };
    fetch();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-3xl mx-auto p-4">
        <h1 className="text-2xl font-bold mb-6">🏆 Rankingi</h1>
        <div className="bg-card rounded-xl overflow-hidden card-shadow">
          <div className="grid grid-cols-5 gap-2 p-3 text-xs font-bold text-muted-foreground border-b">
            <span>#</span>
            <span>Gracz</span>
            <span className="text-right">Profit</span>
            <span className="text-right">Win rate</span>
            <span className="text-right">Zakłady</span>
          </div>
          {loading ? (
            <div className="space-y-0">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="grid grid-cols-5 gap-2 p-3 items-center">
                  <Skeleton className="h-4 w-6" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-12 ml-auto" />
                  <Skeleton className="h-4 w-10 ml-auto" />
                  <Skeleton className="h-4 w-8 ml-auto" />
                </div>
              ))}
            </div>
          ) : (
            <>
              {rankings.map((r, i) => (
                <div key={r.id} className={cn('grid grid-cols-5 gap-2 p-3 text-sm items-center border-b border-border last:border-0', r.id === user?.id && 'bg-primary/10')}>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
