import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AppBadge, AppButton, AppCard, AppInput, AppText } from '@/components/ui';
import { commandEniu, fetchEniuBotRuns, retryEniuResponse, type EniuBotRun, type EniuSourceType } from '@/features/social/api/eniuBot';
import { getErrorMessage } from '../helpers';
import { AdminState, AdminToggle } from './AdminPrimitives';

const STATUS = { pending: 'W toku', success: 'Sukces', skipped: 'Pominięto', error: 'Błąd' } as const;
const SOURCE_LABELS: Record<string, string> = { post: 'Post', comment: 'Komentarz', admin_command: 'Komenda admina' };
const retryable = (value: string): value is EniuSourceType => value === 'post' || value === 'comment';

function formatRunError(value: string) {
  const normalized = value.toLocaleLowerCase('en-US');
  if (normalized.includes('credits') || normalized.includes('insufficient balance')) return 'Usługa Eniu nie ma dostępnych środków. Sprawdź rozliczenia dostawcy.';
  if (normalized.includes('401') || normalized.includes('unauthorized')) return 'Usługa Eniu odrzuciła autoryzację. Sprawdź konfigurację dostawcy.';
  if (normalized === 'unknown error') return 'Nieznany błąd usługi Eniu.';
  return value.replace(/https?:\/\/\S+/g, '[link usunięty]').slice(0, 300);
}

export function EniuPanel() {
  const [command, setCommand] = useState(''); const [preview, setPreview] = useState(false); const [previewText, setPreviewText] = useState<string | null>(null); const [runs, setRuns] = useState<EniuBotRun[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => { setLoading(true); setError(null); try { setRuns(await fetchEniuBotRuns(20)); } catch (cause) { setError(getErrorMessage(cause, 'Nie udało się pobrać logów Eniu')); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  const send = async () => { if (!command.trim()) return; setBusy('command'); setPreviewText(null); try { const result = await commandEniu(command.trim(), preview); if (!result.ok) throw new Error(result.error ?? 'Eniu nie wykonał komendy'); if (result.preview) setPreviewText(result.text); else { setCommand(''); await load(); } } catch (cause) { Alert.alert('Błąd Eniu', getErrorMessage(cause, 'Nieznany błąd')); } finally { setBusy(null); } };
  const retry = async (run: EniuBotRun) => { if (!retryable(run.sourceType)) return; setBusy(run.id); try { const result = await retryEniuResponse(run.sourceType, run.sourceId); if (!result.ok) throw new Error(result.error ?? 'Eniu nie odpowiedział'); await load(); } catch (cause) { Alert.alert('Ponowienie nieudane', getErrorMessage(cause, 'Nieznany błąd')); } finally { setBusy(null); } };
  return <View style={styles.stack}><AppCard style={styles.stack}><AppText variant="subtitle">Komenda dla Eniu</AppText><AppText variant="caption" tone="muted">Domyślnie publikuje od razu jako Eniu Bukmacher.</AppText><AppInput multiline value={command} onChangeText={setCommand} placeholder="Napisz post o dzisiejszych kuponach…" style={styles.textarea} /><AdminToggle label="Tylko podgląd" value={preview} onChange={setPreview} /><AppButton loading={busy === 'command'} disabled={!command.trim()} onPress={send}>{preview ? 'Wygeneruj podgląd' : 'Wyślij Eniu'}</AppButton>{previewText ? <AppCard inset><AppText variant="caption" tone="muted">PODGLĄD</AppText><AppText>{previewText}</AppText></AppCard> : null}</AppCard><AppText variant="subtitle">Logi Eniu</AppText>{loading || error ? <AdminState loading={loading} error={error} onRetry={load} /> : null}<AdminState empty={!loading && !error && runs.length === 0} emptyTitle="Brak logów Eniu." />{runs.map((run) => <AppCard key={run.id} style={styles.stack}><View style={styles.row}><AppBadge label={STATUS[run.status]} tone={run.status === 'success' ? 'success' : run.status === 'error' ? 'danger' : run.status === 'pending' ? 'primary' : 'neutral'} /><AppText variant="caption" tone="muted">{new Date(run.createdAt).toLocaleString('pl-PL')}</AppText></View><AppText variant="label">{SOURCE_LABELS[run.sourceType] ?? run.sourceType}</AppText>{run.error ? <AppText variant="caption" tone="danger">{formatRunError(run.error)}</AppText> : null}{run.status === 'error' && retryable(run.sourceType) ? <AppButton variant="outline" loading={busy === run.id} onPress={() => void retry(run)}>Ponów odpowiedź</AppButton> : null}</AppCard>)}</View>;
}

const styles = StyleSheet.create({ stack: { gap: 14 }, textarea: { minHeight: 130, textAlignVertical: 'top' }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 } });
