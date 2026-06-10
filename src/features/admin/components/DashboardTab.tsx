import { useState, useEffect } from 'react';
import { SectionLoader } from '@/components/SectionLoader';
import { toast } from 'sonner';
import {
  fetchAdminDashboardSummary,
  type DashboardStats,
  type RecentActivity,
} from '@/features/admin/dashboardApi';
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
        const summary = await fetchAdminDashboardSummary();
        setStats(summary.stats);
        setRecentActivity(summary.recentActivity);
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
    return <SectionLoader label="Wczytywanie statystyk..." />;
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
                <Icon className="h-4 w-4 text-foreground shrink-0" aria-hidden="true" />
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
          <Clock className="h-4 w-4 text-foreground shrink-0" aria-hidden="true" />
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
