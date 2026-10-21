import { supabase } from '@/lib/supabase';

export interface DashboardStats {
  totalBets: number;
  totalPool: number;
  pendingProposals: number;
  activeBets: number;
  resolvedToday: number;
  topCategory: string | null;
}

export interface RecentActivity {
  id: string;
  title: string;
  winningOption: string;
  resolvedAt: string;
}

export interface AdminDashboardSummary {
  stats: DashboardStats;
  recentActivity: RecentActivity[];
}

interface DashboardSummaryRpcResponse {
  stats?: {
    total_bets?: unknown;
    total_pool?: unknown;
    pending_proposals?: unknown;
    active_bets?: unknown;
    resolved_today?: unknown;
    top_category?: unknown;
  };
  recent_activity?: {
    id?: unknown;
    title?: unknown;
    winning_option?: unknown;
    resolved_at?: unknown;
  }[];
}

export async function fetchAdminDashboardSummary(): Promise<AdminDashboardSummary> {
  const { data, error } = await supabase.rpc('admin_get_dashboard_summary');

  if (error) throw error;

  return normalizeDashboardSummary(data as DashboardSummaryRpcResponse | null);
}

function normalizeDashboardSummary(
  data: DashboardSummaryRpcResponse | null,
): AdminDashboardSummary {
  const stats = data?.stats ?? {};

  return {
    stats: {
      totalBets: toNumber(stats.total_bets),
      totalPool: toNumber(stats.total_pool),
      pendingProposals: toNumber(stats.pending_proposals),
      activeBets: toNumber(stats.active_bets),
      resolvedToday: toNumber(stats.resolved_today),
      topCategory:
        typeof stats.top_category === 'string' && stats.top_category.length > 0
          ? stats.top_category
          : null,
    },
    recentActivity: Array.isArray(data?.recent_activity)
      ? data.recent_activity.map((item) => ({
          id: String(item.id ?? ''),
          title: String(item.title ?? ''),
          winningOption: String(item.winning_option ?? ''),
          resolvedAt: String(item.resolved_at ?? ''),
        }))
      : [],
  };
}

function toNumber(value: unknown) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

/** Web `getRelativeTime` from `DashboardTab`. */
export function getRelativeTime(dateStr: string, now: number = Date.now()): string {
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
