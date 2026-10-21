import { useQuery } from '@tanstack/react-query';
import { Bot, CheckCircle2, Clock3, RefreshCw, TriangleAlert, type LucideIcon } from 'lucide-react-native';
import { memo } from 'react';
import { View } from 'react-native';

import { getErrorMessage } from '@/lib/errors';
import { alpha, createStyles, useTheme, type Colors } from '@/theme';
import { Button, SectionLoader, StateMessage, Text } from '@/ui';
import { agentRunsQueryOptions } from '../b/api/agent-runs';
import { AdminCard, Pill, Spin } from '../b/components/primitives';
import { useQueryErrorToast } from '../b/hooks';
import {
  formatAgentRunDate,
  presentationFor,
  runErrors,
  runHistorySummary,
  runSkipped,
  type AgentRun,
  type AgentRunTone,
} from '../b/logic/agent-runs';

interface ToneStyle {
  background: string;
  color: string;
  icon: LucideIcon;
  iconColor: string;
}

// Tailwind blue/emerald/amber/red (the web's `dark:` variants never apply).
function toneStyle(tone: AgentRunTone, colors: Colors): ToneStyle {
  switch (tone) {
    case 'running':
      return { background: 'rgba(59, 130, 246, 0.1)', color: '#1d4ed8', icon: Clock3, iconColor: '#2563eb' };
    case 'ok':
      return { background: 'rgba(16, 185, 129, 0.1)', color: '#047857', icon: CheckCircle2, iconColor: '#059669' };
    case 'partial':
      return { background: 'rgba(245, 158, 11, 0.1)', color: '#b45309', icon: TriangleAlert, iconColor: '#d97706' };
    case 'failed':
      return { background: 'rgba(239, 68, 68, 0.1)', color: '#b91c1c', icon: TriangleAlert, iconColor: '#dc2626' };
    default:
      return { background: colors.muted, color: colors.mutedForeground, icon: TriangleAlert, iconColor: '#d97706' };
  }
}

/** Admin "Agent" tab (web `AgentRunsTab`): latest run and history. */
export function AgentRunsTab() {
  const styles = useStyles();
  const { colors } = useTheme();
  const query = useQuery(agentRunsQueryOptions());

  useQueryErrorToast(
    query.error,
    query.errorUpdatedAt,
    (error) => `Nie udało się pobrać runów agenta: ${getErrorMessage(error, 'Nieznany błąd')}`,
  );

  if (query.isPending) return <SectionLoader label="Wczytywanie runów agenta..." />;

  const runs = query.data ?? [];
  const latest = runs[0];
  const refreshing = query.isFetching;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text size="lg" weight="600">
            Automatyczny agent betów
          </Text>
          <Text color="mutedForeground" style={{ marginTop: 4 }}>
            Codzienny run: rozliczenie zakończonych betów i dodanie nowych.
          </Text>
        </View>
        <Button
          variant="outline"
          size="sm"
          label="Odśwież"
          disabled={refreshing}
          onPress={() => void query.refetch()}
          icon={
            <Spin active={refreshing}>
              <RefreshCw size={16} color={colors.foreground} />
            </Spin>
          }
        />
      </View>

      {query.isError && !query.data ? (
        <StateMessage
          title="Nie udało się pobrać runów agenta"
          description={getErrorMessage(query.error, 'Nieznany błąd')}
          actionLabel="Spróbuj ponownie"
          onAction={() => void query.refetch()}
        />
      ) : latest ? (
        <LatestRun run={latest} />
      ) : (
        <AdminCard style={styles.emptyCard}>
          <Clock3 size={32} color={colors.mutedForeground} />
          <Text color="mutedForeground" align="center" style={{ marginTop: 12 }}>
            Agent nie wykonał jeszcze żadnego runu.
          </Text>
        </AdminCard>
      )}

      {runs.length > 0 ? (
        <AdminCard style={styles.historyCard}>
          <View style={styles.historyHeader}>
            <Text weight="600">Historia</Text>
          </View>
          {runs.map((run, index) => (
            <HistoryRow key={run.id} run={run} first={index === 0} />
          ))}
        </AdminCard>
      ) : null}
    </View>
  );
}

function LatestRun({ run }: { run: AgentRun }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const presentation = presentationFor(run.status);
  const tone = toneStyle(presentation.tone, colors);
  const stats: [string, number][] = [
    ['Dodane', run.created_count],
    ['Rozliczone', run.settled_count],
    ['Wstrzymane', run.held_count],
    ['Pominięte', runSkipped(run)],
    ['Błędy', runErrors(run)],
  ];

  return (
    <AdminCard style={styles.latestCard}>
      <View style={styles.latestTop}>
        <View style={styles.latestTitle}>
          <View style={styles.iconBox}>
            <Bot size={20} color={colors.primary} />
          </View>
          <View>
            <Text weight="600">Ostatni run</Text>
            <Text size="xs" color="mutedForeground">
              {formatAgentRunDate(run.started_at)}
            </Text>
          </View>
        </View>
        <Pill label={presentation.label} background={tone.background} color={tone.color} paddingY={4} />
      </View>

      <View style={styles.stats}>
        {[stats.slice(0, 2), stats.slice(2, 4), stats.slice(4)].map((pair) => (
          <View key={pair[0][0]} style={styles.statsRow}>
            {pair.map(([label, value]) => (
              <View key={label} style={styles.stat}>
                <Text size="xs" color="mutedForeground">
                  {label}
                </Text>
                <Text size="xl" weight="700" style={{ marginTop: 4 }} tabular>
                  {value}
                </Text>
              </View>
            ))}
            {pair.length === 1 ? <View style={{ flex: 1 }} /> : null}
          </View>
        ))}
      </View>

      {run.report ? (
        <View style={styles.report}>
          <Text selectable>{run.report}</Text>
        </View>
      ) : null}
    </AdminCard>
  );
}

const HistoryRow = memo(function HistoryRow({ run, first }: { run: AgentRun; first: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const presentation = presentationFor(run.status);
  const tone = toneStyle(presentation.tone, colors);
  const Icon = tone.icon;
  return (
    <View style={[styles.historyRow, !first && styles.historyDivider]}>
      <Icon size={16} color={tone.iconColor} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text weight="500" numberOfLines={1}>
          {formatAgentRunDate(run.started_at)}
        </Text>
        <Text size="xs" color="mutedForeground">
          {runHistorySummary(run)}
        </Text>
      </View>
      <Text size="xs" color="mutedForeground">
        {presentation.label}
      </Text>
    </View>
  );
});

const useStyles = createStyles(({ colors, radius }) => ({
  root: { gap: 24 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  latestCard: { padding: 16 },
  latestTop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  latestTitle: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: alpha(colors.primary, 0.1),
    alignItems: 'center',
    justifyContent: 'center',
  },
  stats: { marginTop: 16, gap: 12 },
  statsRow: { flexDirection: 'row', gap: 12 },
  stat: {
    flex: 1,
    borderRadius: radius.lg,
    backgroundColor: alpha(colors.muted, 0.5),
    padding: 12,
  },
  report: {
    marginTop: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  emptyCard: { padding: 32, alignItems: 'center' },
  historyCard: { overflow: 'hidden' },
  historyHeader: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  historyDivider: { borderTopWidth: 1, borderTopColor: colors.border },
}));
