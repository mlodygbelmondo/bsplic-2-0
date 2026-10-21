import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, RefreshCw, RotateCcw, Send } from 'lucide-react-native';
import { memo, useState } from 'react';
import { ActivityIndicator, Pressable, Switch, View } from 'react-native';

import { haptics } from '@/lib/haptics';
import { toast } from '@/lib/toast';
import { alpha, createStyles, useTheme, type Colors } from '@/theme';
import type { EniuBotRun } from '@/types/social';
import { Button, Text } from '@/ui';
import { ADMIN_ENIU_RUNS_QUERY_KEY, commandEniu, eniuRunsQueryOptions, retryEniuResponse } from '../b/api/eniu';
import { OfflineNotice, Pill, Spin, TextArea } from '../b/components/primitives';
import { useAdminWriteGuard, useQueryErrorToast } from '../b/hooks';
import {
  canRetryRun,
  diagnosticChips,
  formatRunDate,
  isRetryableSourceType,
  runStatusLabel,
} from '../b/logic/eniu-runs';

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

/** Admin "Eniu" tab (web `EniuBotTab`): command composer and bot run log. */
export function EniuBotTab() {
  const styles = useStyles();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const { offline, ensureOnline } = useAdminWriteGuard();
  const runs = useQuery(eniuRunsQueryOptions());
  const [command, setCommand] = useState('');
  const [preview, setPreview] = useState(false);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [retryingRunId, setRetryingRunId] = useState<string | null>(null);

  useQueryErrorToast(runs.error, runs.errorUpdatedAt, (error) =>
    errorMessage(error, 'Nie udało się pobrać logów Eniu'),
  );

  const reloadRuns = () => queryClient.invalidateQueries({ queryKey: ADMIN_ENIU_RUNS_QUERY_KEY });

  const submitCommand = async () => {
    const trimmed = command.trim();
    if (!trimmed || submitting) return;
    if (!ensureOnline()) return;

    setSubmitting(true);
    setPreviewText(null);
    try {
      const result = await commandEniu(trimmed, preview);
      if (!result.ok) throw new Error(result.error || 'Eniu nie wykonał komendy');

      if (result.preview) {
        setPreviewText(result.text);
        toast.success('Eniu przygotował podgląd posta');
      } else {
        setCommand('');
        toast.success('Eniu opublikował post');
        await reloadRuns();
      }
    } catch (error) {
      toast.error(errorMessage(error, 'Nie udało się wykonać komendy'));
    } finally {
      setSubmitting(false);
    }
  };

  const retryRun = async (run: EniuBotRun) => {
    if (!isRetryableSourceType(run.sourceType) || retryingRunId) return;
    if (!ensureOnline()) return;

    setRetryingRunId(run.id);
    try {
      const result = await retryEniuResponse(run.sourceType, run.sourceId);
      if (!result.ok) throw new Error(result.error || 'Eniu nie odpowiedział');
      toast.success(result.text ? 'Eniu odpowiedział' : 'Ponowienie sprawdzone');
      await reloadRuns();
    } catch (error) {
      toast.error(errorMessage(error, 'Nie udało się ponowić odpowiedzi Eniu'));
    } finally {
      setRetryingRunId(null);
    }
  };

  const canSubmit = command.trim().length > 0 && !submitting && !offline;

  return (
    <View style={styles.root}>
      {offline ? <OfflineNotice /> : null}

      <View style={styles.section}>
        <View style={styles.header}>
          <View style={styles.iconBox}>
            <Bot size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text size="lg" weight="700">
              Komenda dla Eniu
            </Text>
            <Text color="mutedForeground">Domyślnie publikuje od razu jako Eniu Bukmacher.</Text>
          </View>
        </View>

        <TextArea
          minHeight={150}
          value={command}
          onChangeText={setCommand}
          placeholder="Napisz post o dzisiejszych kuponach i trochę podkręć ekipę..."
        />

        <View style={styles.controls}>
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: preview }}
            accessibilityLabel="Tylko podgląd"
            onPress={() => {
              haptics.selection();
              setPreview((value) => !value);
            }}
            style={styles.previewToggle}
          >
            <Switch
              value={preview}
              onValueChange={setPreview}
              trackColor={{ true: colors.primary, false: colors.input }}
            />
            <Text weight="500">Tylko podgląd</Text>
          </Pressable>

          <Button
            label={preview ? 'Wygeneruj podgląd' : 'Wyślij Eniu'}
            icon={
              submitting ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <Send size={16} color={colors.primaryForeground} />
              )
            }
            disabled={!canSubmit}
            onPress={() => void submitCommand()}
            style={styles.tallButton}
          />
        </View>

        {previewText ? (
          <View style={styles.previewBox}>
            <Text size="xs" weight="700" color="mutedForeground" style={styles.previewLabel}>
              Podgląd
            </Text>
            <Text selectable style={{ lineHeight: 22.75 }}>
              {previewText}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <View style={styles.logsHeader}>
          <View style={{ flex: 1 }}>
            <Text size="lg" weight="700">
              Logi Eniu
            </Text>
            <Text color="mutedForeground">Ostatnie odpowiedzi, komendy i błędy.</Text>
          </View>
          <Button
            variant="outline"
            size="icon"
            accessibilityLabel="Odśwież logi Eniu"
            disabled={runs.isFetching}
            onPress={() => void runs.refetch()}
            style={styles.refreshButton}
          >
            <Spin active={runs.isFetching}>
              <RefreshCw size={16} color={colors.foreground} />
            </Spin>
          </Button>
        </View>

        {runs.isPending ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.mutedForeground} />
            <Text color="mutedForeground">Ładowanie logów...</Text>
          </View>
        ) : (runs.data ?? []).length === 0 ? (
          <Text color="mutedForeground">Brak logów Eniu.</Text>
        ) : (
          <View style={{ gap: 12 }}>
            {(runs.data ?? []).map((run) => (
              <RunCard
                key={run.id}
                run={run}
                retrying={retryingRunId === run.id}
                retryDisabled={retryingRunId !== null || offline}
                onRetry={retryRun}
              />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function statusTone(status: EniuBotRun['status'], colors: Colors) {
  if (status === 'success') return { background: 'rgba(16, 185, 129, 0.1)', color: '#059669' };
  if (status === 'error') return { background: alpha(colors.destructive, 0.1), color: colors.destructive };
  if (status === 'pending') return { background: alpha(colors.primary, 0.1), color: colors.primary };
  return { background: colors.muted, color: colors.mutedForeground };
}

const RunCard = memo(function RunCard({
  run,
  retrying,
  retryDisabled,
  onRetry,
}: {
  run: EniuBotRun;
  retrying: boolean;
  retryDisabled: boolean;
  onRetry: (run: EniuBotRun) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const tone = statusTone(run.status, colors);
  return (
    <View style={styles.runCard}>
      <View style={styles.runTop}>
        <Pill label={runStatusLabel(run.status)} background={tone.background} color={tone.color} weight="700" paddingX={8} />
        <Text size="xs" color="mutedForeground">
          {formatRunDate(run.createdAt)}
        </Text>
      </View>
      <Text weight="500">{run.sourceType}</Text>
      {run.providerDiagnostic ? (
        <View style={styles.diagnostics}>
          {diagnosticChips(run.providerDiagnostic).map((chip) => (
            <Text key={chip} weight="500" color="mutedForeground" style={styles.diagnostic}>
              {chip}
            </Text>
          ))}
        </View>
      ) : null}
      {run.error ? (
        <Text size="xs" color="destructive" style={{ marginTop: 4 }}>
          {run.error}
        </Text>
      ) : null}
      {canRetryRun(run) ? (
        <Button
          variant="outline"
          size="sm"
          label="Ponów"
          accessibilityLabel="Ponów odpowiedź Eniu"
          icon={
            retrying ? (
              <ActivityIndicator size="small" color={colors.foreground} />
            ) : (
              <RotateCcw size={16} color={colors.foreground} />
            )
          }
          disabled={retryDisabled}
          onPress={() => onRetry(run)}
          style={styles.retryButton}
        />
      ) : null}
    </View>
  );
});

const useStyles = createStyles(({ colors, radius }) => ({
  root: { gap: 24 },
  section: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 16,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: alpha(colors.primary, 0.1),
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: { marginTop: 16, gap: 12 },
  previewToggle: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'flex-start' },
  tallButton: { height: 44 },
  previewBox: {
    marginTop: 20,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: alpha(colors.muted, 0.4),
    padding: 16,
  },
  previewLabel: { textTransform: 'uppercase', marginBottom: 8 },
  logsHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  refreshButton: { width: 44, height: 44 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  runCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: 12,
  },
  runTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 },
  diagnostics: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  diagnostic: { fontSize: 11, lineHeight: 16 },
  retryButton: { marginTop: 12, height: 44, alignSelf: 'flex-start' },
}));
