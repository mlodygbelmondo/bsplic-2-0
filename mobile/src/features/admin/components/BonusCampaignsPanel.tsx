import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AppBadge, AppButton, AppCard, AppInput, AppText } from '@/components/ui';
import { createBonusCampaign, deactivateBonusCampaign, fetchAdminBonusCampaigns } from '@/features/bonus-campaigns/bonus-campaign-api';
import { getBonusCampaignAdminStatus, formatBonusAmount, validateBonusCampaignForm } from '@/features/bonus-campaigns/campaign-availability';
import { createDefaultBonusCampaignForm } from '@/features/bonus-campaigns/constants';
import type { BonusCampaignWithClaimCount } from '@/features/bonus-campaigns/types';
import { getErrorMessage } from '../helpers';
import { AdminState } from './AdminPrimitives';

const LABELS = { scheduled: 'Zaplanowana', active: 'Aktywna', expired: 'Wygasła', disabled: 'Wyłączona' } as const;

export function BonusCampaignsPanel() {
  const [campaigns, setCampaigns] = useState<BonusCampaignWithClaimCount[]>([]);
  const [form, setForm] = useState(createDefaultBonusCampaignForm);
  const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => { setLoading(true); setError(null); try { setCampaigns(await fetchAdminBonusCampaigns()); } catch (cause) { setError(getErrorMessage(cause, 'Nie udało się pobrać kampanii')); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  const create = async () => { const validation = validateBonusCampaignForm(form); if (validation) return Alert.alert('Sprawdź formularz', validation); setBusy('create'); try { await createBonusCampaign(form); setForm(createDefaultBonusCampaignForm()); await load(); Alert.alert('Gotowe', 'Kampania została utworzona.'); } catch (cause) { Alert.alert('Błąd', getErrorMessage(cause, 'Nieznany błąd')); } finally { setBusy(null); } };
  const deactivate = (item: BonusCampaignWithClaimCount) => Alert.alert('Wyłączyć kampanię?', item.title, [{ text: 'Anuluj', style: 'cancel' }, { text: 'Wyłącz', style: 'destructive', onPress: async () => { setBusy(item.id); try { await deactivateBonusCampaign(item.id); await load(); } catch (cause) { Alert.alert('Błąd', getErrorMessage(cause, 'Nieznany błąd')); } finally { setBusy(null); } } }]);
  if (loading || error) return <AdminState loading={loading} error={error} onRetry={load} />;
  return <View style={styles.stack}><AppCard style={styles.stack}><AppText variant="subtitle">Nowa kampania bonusowa</AppText><AppInput label="Tytuł" value={form.title} onChangeText={(title) => setForm({ ...form, title })} /><AppInput label="Opis" value={form.description} multiline style={styles.textarea} onChangeText={(description) => setForm({ ...form, description })} /><AppInput label="Kwota (zł)" keyboardType="decimal-pad" value={form.amount} onChangeText={(amount) => setForm({ ...form, amount })} /><AppInput label="Start (RRRR-MM-DD GG:MM)" value={form.startsAt.replace('T', ' ')} onChangeText={(startsAt) => setForm({ ...form, startsAt: startsAt.replace(' ', 'T') })} /><AppInput label="Wygaśnięcie (RRRR-MM-DD GG:MM)" value={form.expiresAt.replace('T', ' ')} onChangeText={(expiresAt) => setForm({ ...form, expiresAt: expiresAt.replace(' ', 'T') })} /><AppButton loading={busy === 'create'} onPress={create}>Utwórz kampanię</AppButton></AppCard><AdminState empty={campaigns.length === 0} emptyTitle="Brak kampanii bonusowych." />{campaigns.map((item) => { const status = getBonusCampaignAdminStatus(item); return <AppCard key={item.id} style={styles.stack}><View style={styles.row}><View style={styles.flex}><AppText variant="label">{item.title}</AppText><AppText variant="caption" tone="muted">{item.description}</AppText></View><AppBadge label={LABELS[status]} tone={status === 'active' ? 'success' : status === 'scheduled' ? 'primary' : 'neutral'} /></View><AppText>{formatBonusAmount(item.amount)} · odebrano {item.claim_count}</AppText><AppText variant="caption" tone="muted">{new Date(item.starts_at).toLocaleString('pl-PL')} – {new Date(item.expires_at).toLocaleString('pl-PL')}</AppText>{item.is_active ? <AppButton variant="outline" loading={busy === item.id} onPress={() => deactivate(item)}>Wyłącz kampanię</AppButton> : null}</AppCard>; })}</View>;
}
const styles = StyleSheet.create({ stack: { gap: 14 }, textarea: { minHeight: 88, textAlignVertical: 'top' }, row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' }, flex: { flex: 1, gap: 3 } });
