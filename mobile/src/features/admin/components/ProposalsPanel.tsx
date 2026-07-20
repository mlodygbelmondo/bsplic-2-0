import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Check, XCircle } from 'lucide-react-native';

import { AppBadge, AppButton, AppCard, AppModal, AppText } from '@/components/ui';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import type { BetOption, BetProposalSource, Category } from '@/types/database';
import type { EditableBetType } from '../constants';
import { getErrorMessage, getTomorrowAt2359, lockEditableOptionsByType, normalizeOptions, normalizeType, toEditableOptions, toInputDateTime } from '../helpers';
import { normalizeAgentMetadata, normalizeProposalSource, type AgentProposalMetadata } from '../proposalSource';
import { AdminState } from './AdminPrimitives';
import { BetFormFields, type BetFormValue } from './BetFormFields';

interface ProposalRow {
  id: string; userId: string; title: string; categoryId: string | null; endsAt: string | null;
  betType: EditableBetType; options: BetOption[]; username: string;
  source: BetProposalSource; metadata: AgentProposalMetadata | null; duplicateKey: string | null;
}
interface ProposalEditor extends BetFormValue { id: string }

export function ProposalsPanel() {
  const [proposals, setProposals] = useState<ProposalRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editor, setEditor] = useState<ProposalEditor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [proposalResult, categoryResult] = await Promise.all([
        supabase.from('bet_proposals').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
        supabase.from('categories').select('*').order('sort_order'),
      ]);
      if (proposalResult.error) throw proposalResult.error;
      if (categoryResult.error) throw categoryResult.error;
      setCategories((categoryResult.data ?? []) as Category[]);
      const raw = proposalResult.data ?? [];
      const ids = [...new Set(raw.map((item) => item.user_id))];
      const profileResult = ids.length ? await supabase.from('profiles').select('id, username').in('id', ids) : { data: [], error: null };
      if (profileResult.error) throw profileResult.error;
      const names = new Map((profileResult.data ?? []).map((item) => [item.id, item.username]));
      setProposals(raw.map((item) => ({
        id: item.id, userId: item.user_id, title: item.title, categoryId: item.category_id,
        endsAt: item.ends_at, betType: normalizeType(item.bet_type), options: normalizeOptions(item.options),
        username: names.get(item.user_id) ?? 'Użytkownik', source: normalizeProposalSource(item.proposal_source),
        metadata: normalizeAgentMetadata(item.agent_metadata), duplicateKey: typeof item.agent_duplicate_key === 'string' ? item.agent_duplicate_key : null,
      })));
    } catch (cause) { setError(getErrorMessage(cause, 'Nie udało się pobrać propozycji')); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const open = (proposal: ProposalRow) => setEditor({
    id: proposal.id, title: proposal.title, categoryId: proposal.categoryId ?? '', betType: proposal.betType,
    options: lockEditableOptionsByType(proposal.betType, toEditableOptions(proposal.options)),
    endsAt: proposal.endsAt ? toInputDateTime(proposal.endsAt) : toInputDateTime(getTomorrowAt2359()),
    isLive: false, isBsplicboost: false,
  });
  const accept = async () => {
    if (!editor) return;
    const options = editor.options.filter((item) => item.name.trim()).map((item) => ({ name: item.name.trim(), odds: Number(item.odds.replace(',', '.')) }));
    const ends = new Date(editor.endsAt);
    if (!editor.title.trim() || options.some((item) => !Number.isFinite(item.odds) || item.odds <= 0) || Number.isNaN(ends.getTime())) return Alert.alert('Nieprawidłowe dane', 'Sprawdź tytuł, kursy i datę.');
    setBusy(editor.id);
    try {
      const result = await supabase.rpc('review_bet_proposal', { p_proposal_id: editor.id, p_status: 'accepted', p_title: editor.title.trim(), p_category_id: editor.categoryId || null, p_bet_type: editor.betType, p_options: options as Json, p_ends_at: ends.toISOString(), p_is_bsplicboost: editor.isBsplicboost });
      if (result.error) throw result.error; setEditor(null); await load(); Alert.alert('Gotowe', 'Propozycja zaakceptowana.');
    } catch (cause) { Alert.alert('Nie udało się zaakceptować', getErrorMessage(cause, 'Nieznany błąd')); }
    finally { setBusy(null); }
  };
  const reject = (proposal: ProposalRow) => Alert.alert('Odrzucić propozycję?', proposal.title, [{ text: 'Anuluj', style: 'cancel' }, { text: 'Odrzuć', style: 'destructive', onPress: async () => { setBusy(proposal.id); try { const result = await supabase.rpc('review_bet_proposal', { p_proposal_id: proposal.id, p_status: 'rejected' }); if (result.error) throw result.error; await load(); } catch (cause) { Alert.alert('Błąd', getErrorMessage(cause, 'Nieznany błąd')); } finally { setBusy(null); } } }]);
  if (loading || error) return <AdminState loading={loading} error={error} onRetry={load} />;
  return <View style={styles.stack}>
    <AdminState empty={proposals.length === 0} emptyTitle="Brak oczekujących propozycji." />
    {proposals.map((proposal) => <AppCard key={proposal.id} style={styles.stack}><View style={styles.heading}><View style={styles.flex}><AppText variant="label">{proposal.title}</AppText><AppText variant="caption" tone="muted">Od: {proposal.username} · {proposal.betType.toUpperCase()}</AppText></View><AppBadge tone={proposal.source === 'agent' ? 'warning' : 'neutral'} label={proposal.source === 'agent' ? 'AGENT' : 'UŻYTKOWNIK'} /></View>{proposal.metadata?.reason ? <AppText variant="caption" tone="muted">Powód: {proposal.metadata.reason}</AppText> : null}<View style={styles.options}>{proposal.options.map((option, index) => <AppBadge key={`${option.name}-${index}`} label={`${option.name} ${Number(option.odds).toFixed(2)}`} />)}</View><View style={styles.actions}><AppButton disabled={busy === proposal.id} onPress={() => open(proposal)} leftAccessory={<Check size={16} color="#fff" />}>Akceptuj</AppButton><AppButton variant="outline" disabled={busy === proposal.id} onPress={() => reject(proposal)} leftAccessory={<XCircle size={16} />}>Odrzuć</AppButton></View></AppCard>)}
    <AppModal visible={Boolean(editor)} title="Dostosuj propozycję" onClose={() => !busy && setEditor(null)}>{editor ? <View style={styles.stack}><BetFormFields value={editor} onChange={(next) => setEditor({ ...editor, ...next })} categories={categories} disabled={Boolean(busy)} /><AppButton loading={busy === editor.id} onPress={accept}>Akceptuj propozycję</AppButton></View> : null}</AppModal>
  </View>;
}

const styles = StyleSheet.create({ stack: { gap: 14 }, heading: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, flex: { flex: 1 }, options: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 } });
