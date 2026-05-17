import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  BarChart3,
  Wallet,
  Lightbulb,
  Activity,
  CheckCircle2,
  Tag,
  Trophy,
  Clock,
} from 'lucide-react';

interface DashboardStats {
  totalBets: number;
  totalPool: number;
  pendingProposals: number;
  activeBets: number;
  resolvedToday: number;
  topCategory: string | null;
}

interface RecentActivity {
  id: string;
  title: string;
  winningOption: string;
  resolvedAt: string;
}

export default function DashboardTab() {
  const [stats, setStats] = useState<DashboardStats>({
    totalBets: 0,
    totalPool: 0,
    pendingProposals: 0,
    activeBets: 0,
    resolvedToday: 0,
    topCategory: null,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const [
          { count: totalBets, error: e1 },
          { data: stakes, error: e2 },
          { count: pendingProposals, error: e3 },
          { count: activeBets, error: e4 },
          { count: resolvedToday, error: e5 },
          { data: categoryData, error: e6 },
          { data: recentResolved, error: e7 },
        ] = await Promise.all([
          supabase.from('placed_bets').select('*', { count: 'exact', head: true }),
          supabase.from('placed_bets').select('stake'),
          supabase
            .from('bet_proposals')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending'),
          supabase
            .from('bets')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', true),
          supabase
            .from('bets')
            .select('*', { count: 'exact', head: true })
            .not('winning_option', 'is', null)
            .gte('created_at', todayStart.toISOString()),
          supabase
            .from('bets')
            .select('category_id, categories(id, emoji, name)')
            .eq('is_active', true)
            .not('category_id', 'is', null),
          supabase
            .from('bets')
            .select('id, title, winning_option, created_at')
            .not('winning_option', 'is', null)
            .order('created_at', { ascending: false })
            .limit(5),
        ]);

        const firstError = e1 || e2 || e3 || e4 || e5 || e6 || e7;
        if (firstError) throw firstError;

        const totalPool = stakes?.reduce((acc, b) => acc + Number(b.stake), 0) || 0;

        let topCategory: string | null = null;
        if (categoryData && categoryData.length > 0) {
          const freq: Record<string, number> = {};
          const categoryLabels: Record<string, string> = {};
          for (const row of categoryData) {
            if (!row.category_id) continue;
            freq[row.category_id] = (freq[row.category_id] || 0) + 1;
            if (row.categories) {
              categoryLabels[row.category_id] = `${row.categories.emoji} ${row.categories.name}`;
            }
          }
          const topId = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0];
          topCategory = topId ? categoryLabels[topId] || null : null;
        }

        setStats({
          totalBets: totalBets || 0,
          totalPool,
          pendingProposals: pendingProposals || 0,
          activeBets: activeBets || 0,
          resolvedToday: resolvedToday || 0,
          topCategory,
        });

        setRecentActivity(
          (recentResolved || []).map((r) => ({
            id: r.id,
            title: r.title,
            winningOption: r.winning_option || '',
            resolvedAt: r.created_at,
          }))
        );
      } catch (err: unknown) {
        setError(true);
        const msg = err instanceof Error ? err.message : 'Nieznany błąd';
        toast.error(`Nie udało się załadować statystyk: ${msg}`);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-card rounded-xl p-4 card-shadow">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-7 w-16" />
            </div>
          ))}
        </div>
        <div className="bg-card rounded-xl p-4 card-shadow">
          <Skeleton className="h-4 w-40 mb-4" />
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full mb-2" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-muted-foreground">
          Nie udało się załadować danych. Odśwież stronę, aby spróbować ponownie.
        </p>
      </div>
    );
  }

  const statCards = [
    {
      label: 'Łączna liczba zakładów',
      value: String(stats.totalBets),
      icon: BarChart3,
      accent: false,
    },
    {
      label: 'Łączna pula',
      value: `${stats.totalPool.toFixed(0)} zł`,
      icon: Wallet,
      accent: false,
    },
    {
      label: 'Propozycje oczekujące',
      value: String(stats.pendingProposals),
      icon: Lightbulb,
      accent: stats.pendingProposals > 0,
    },
    {
      label: 'Aktywne zakłady',
      value: String(stats.activeBets),
      icon: Activity,
      accent: false,
    },
    {
      label: 'Rozstrzygnięte dziś',
      value: String(stats.resolvedToday),
      icon: CheckCircle2,
      accent: false,
    },
    {
      label: 'Top kategoria',
      value: stats.topCategory || '—',
      icon: Tag,
      accent: false,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-card rounded-xl p-4 card-shadow">
              <div className="flex items-center gap-2 mb-1.5">
                <Icon className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
                <p className="text-xs text-muted-foreground font-medium truncate">
                  {card.label}
                </p>
              </div>
              <p className={`text-2xl font-bold ${card.accent ? 'text-primary' : ''}`}>
                {card.value}
              </p>
            </div>
          );
        })}
      </div>

      {/* Recent Activity */}
      <div className="bg-card rounded-xl card-shadow">
        <div className="flex items-center gap-2 px-4 pt-4 pb-2">
          <Clock className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
          <h3 className="text-sm font-semibold">Ostatnia aktywność</h3>
        </div>

        {recentActivity.length === 0 ? (
          <p className="text-sm text-muted-foreground px-4 pb-4">
            Brak rozstrzygniętych zakładów.
          </p>
        ) : (
          <ul className="divide-y divide-border" role="list" aria-label="Ostatnia aktywność">
            {recentActivity.map((item) => {
              const ago = getRelativeTime(item.resolvedAt);
              return (
                <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="rounded-full bg-emerald-100 p-1.5 shrink-0">
                    <Trophy className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Wynik: <span className="font-medium text-foreground">{item.winningOption}</span>
                    </p>
                  </div>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                    {ago}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function getRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'teraz';
  if (minutes < 60) return `${minutes} min temu`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h temu`;

  const days = Math.floor(hours / 24);
  if (days === 1) return 'wczoraj';
  return `${days} dni temu`;
}
