import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppCard, AppText } from '@/components/ui';
import { fetchAdminDashboardSummary, type DashboardStats, type RecentActivity } from '../dashboardApi';
import { getErrorMessage } from '../helpers';
import { AdminState } from './AdminPrimitives';

const EMPTY: DashboardStats = { totalBets: 0, totalPool: 0, pendingProposals: 0, activeBets: 0, resolvedToday: 0, topCategory: null };

export function DashboardPanel() {
  const [stats, setStats] = useState(EMPTY);
  const [activity, setActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const data = await fetchAdminDashboardSummary(); setStats(data.stats); setActivity(data.recentActivity); }
    catch (cause) { setError(getErrorMessage(cause, 'Nie udało się pobrać statystyk')); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  if (loading || error) return <AdminState loading={loading} error={error} onRetry={load} />;
  const cards = [
    ['Łączna liczba zakładów', String(stats.totalBets)], ['Łączna pula', `${stats.totalPool.toFixed(0)} zł`],
    ['Propozycje oczekujące', String(stats.pendingProposals)], ['Aktywne zakłady', String(stats.activeBets)],
    ['Rozstrzygnięte dziś', String(stats.resolvedToday)], ['Top kategoria', stats.topCategory ?? '—'],
  ];
  return <View style={styles.stack}>
    <View style={styles.grid}>{cards.map(([label, value]) => <AppCard key={label} style={styles.stat}><AppText variant="caption" tone="muted">{label}</AppText><AppText variant="title" tone={label === 'Propozycje oczekujące' && stats.pendingProposals ? 'primary' : 'default'}>{value}</AppText></AppCard>)}</View>
    <AppCard style={styles.stack}><AppText variant="subtitle">Ostatnia aktywność</AppText><AdminState empty={activity.length === 0} emptyTitle="Brak rozstrzygniętych zakładów." />{activity.map((item) => <View key={item.id} style={styles.activity}><View style={styles.flex}><AppText variant="label" numberOfLines={2}>{item.title}</AppText><AppText variant="caption" tone="muted">Wynik: {item.winningOption}</AppText></View><AppText variant="caption" tone="muted">{new Date(item.resolvedAt).toLocaleDateString('pl-PL')}</AppText></View>)}</AppCard>
  </View>;
}

const styles = StyleSheet.create({ stack: { gap: 14 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, stat: { width: '48%', flexGrow: 1, minWidth: 140, gap: 5 }, activity: { flexDirection: 'row', gap: 10, alignItems: 'center' }, flex: { flex: 1 } });
