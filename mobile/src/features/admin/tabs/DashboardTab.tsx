import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Clock,
  Lightbulb,
  Tag,
  Trophy,
  Wallet,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { RefreshControl, View } from 'react-native';

import { whenOnline } from '@/lib/connectivity';
import { toast } from '@/lib/toast';
import { alpha, createStyles, useTheme } from '@/theme';
import { SectionLoader, Text } from '@/ui';
import { getErrorMessage } from '@/lib/errors';
import { getRelativeTime, type AdminDashboardSummary } from '../api/dashboard';
import { adminQueries } from '../api/queries';
import { AdminTabScroll } from '../components/AdminChrome';

interface StatCard {
  label: string;
  value: string;
  icon: LucideIcon;
  accent: boolean;
}

function toStatCards({ stats }: AdminDashboardSummary): StatCard[] {
  return [
    { label: 'Łączna liczba zakładów', value: String(stats.totalBets), icon: BarChart3, accent: false },
    { label: 'Łączna pula', value: `${stats.totalPool.toFixed(0)} zł`, icon: Wallet, accent: false },
    {
      label: 'Propozycje oczekujące',
      value: String(stats.pendingProposals),
      icon: Lightbulb,
      accent: stats.pendingProposals > 0,
    },
    { label: 'Aktywne zakłady', value: String(stats.activeBets), icon: Activity, accent: false },
    { label: 'Rozstrzygnięte dziś', value: String(stats.resolvedToday), icon: CheckCircle2, accent: false },
    { label: 'Top kategoria', value: stats.topCategory || '—', icon: Tag, accent: false },
  ];
}

/** Web `DashboardTab`: six stat cards and the recent settlements. */
export function DashboardTab() {
  const styles = useStyles();
  const { colors } = useTheme();
  const query = useQuery(adminQueries.dashboard());
  const [refreshing, setRefreshing] = useState(false);
  const { error } = query;

  useEffect(() => {
    if (!error) return;
    const msg = getErrorMessage(error, 'Nieznany błąd');
    toast.error(`Nie udało się załadować statystyk: ${msg}`);
  }, [error]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const summary = query.data;

  return (
    <AdminTabScroll
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={whenOnline(refresh)} tintColor={colors.mutedForeground} />}
    >
      {summary ? (
        <DashboardContent summary={summary} />
      ) : query.isPending ? (
        <SectionLoader label="Wczytywanie statystyk..." />
      ) : (
        <View style={styles.error}>
          <Text color="mutedForeground" align="center">
            Nie udało się załadować danych. Odśwież stronę, aby spróbować ponownie.
          </Text>
        </View>
      )}
    </AdminTabScroll>
  );
}

function DashboardContent({ summary }: { summary: AdminDashboardSummary }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const cards = toStatCards(summary);
  const rows = [cards.slice(0, 2), cards.slice(2, 4), cards.slice(4, 6)];
  const { recentActivity } = summary;

  return (
    <View style={styles.stack}>
      <View style={styles.grid}>
        {rows.map((row) => (
          <View key={row[0].label} style={styles.gridRow}>
            {row.map((card) => {
              const Icon = card.icon;
              return (
                <View key={card.label} style={[styles.surface, styles.statCard]}>
                  <View style={styles.statHeader}>
                    <Icon size={16} color={colors.foreground} />
                    <Text size="xs" weight="500" color="mutedForeground" numberOfLines={1} style={styles.flex}>
                      {card.label}
                    </Text>
                  </View>
                  <Text size="2xl" weight="700" color={card.accent ? 'primary' : 'foreground'} numberOfLines={1}>
                    {card.value}
                  </Text>
                </View>
              );
            })}
          </View>
        ))}
      </View>

      <View style={styles.surface}>
        <View style={styles.activityHeader}>
          <Clock size={16} color={colors.foreground} />
          <Text weight="600" accessibilityRole="header">
            Ostatnia aktywność
          </Text>
        </View>

        {recentActivity.length === 0 ? (
          <Text color="mutedForeground" style={styles.empty}>
            Brak rozstrzygniętych zakładów.
          </Text>
        ) : (
          <View accessibilityRole="list" accessibilityLabel="Ostatnia aktywność">
            {recentActivity.map((item, index) => (
              <View key={item.id} style={[styles.activityRow, index > 0 && styles.divider]}>
                <View style={styles.trophy}>
                  <Trophy size={14} color="#047857" />
                </View>
                <View style={styles.flex}>
                  <Text weight="500" numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text size="xs" color="mutedForeground">
                    Wynik:{' '}
                    <Text size="xs" weight="500">
                      {item.winningOption}
                    </Text>
                  </Text>
                </View>
                <Text color="mutedForeground" style={styles.ago}>
                  {getRelativeTime(item.resolvedAt)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const useStyles = createStyles(({ colors, gradients, shadows, scheme }) => ({
  stack: { gap: 24 },
  grid: { gap: 12 },
  gridRow: { flexDirection: 'row', gap: 12 },
  // `bg-card rounded-xl card-shadow` (+ the `.card-shadow.bg-card` surface).
  surface: {
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: scheme === 'dark' ? alpha(colors.border, 0.82) : colors.border,
    backgroundColor: colors.card,
    backgroundImage: gradients.bookmakerSurface,
    boxShadow: shadows.card,
  },
  statCard: { flex: 1, padding: 16, gap: 6 },
  statHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1, minWidth: 0 },
  activityHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  empty: { paddingHorizontal: 16, paddingBottom: 16 },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  trophy: { borderRadius: 999, backgroundColor: '#d1fae5', padding: 6 },
  ago: { fontSize: 11, lineHeight: 16 },
  error: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64 },
}));
