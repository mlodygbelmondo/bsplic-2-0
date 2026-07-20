import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Pencil, RotateCcw, Trash2, Trophy } from 'lucide-react-native';

import { AppBadge, AppButton, AppCard, AppInput, AppModal, AppText } from '@/components/ui';
import { useAppTheme } from '@/hooks/use-app-theme';
import { supabase } from '@/integrations/supabase/client';
import type { Bet, Category } from '@/types/database';
import { fetchBetAkoExclusions, updateBetWithAkoExclusions, type BetAkoExclusionDraft } from '../api/akoExclusions';
import { BET_WINNING_OPTION_FORCED_LOSS, BET_WINNING_OPTION_REFUND } from '../constants';
import { getErrorMessage, lockEditableOptionsByType, normalizeOptions, normalizeType, parseWinningOptions, toEditableOptions, toInputDateTime } from '../helpers';
import { settleBetWithBackend, type CorrectionScope, type SettlementMode } from '../settlementApi';
import { AdminChoice, AdminState, AdminToggle } from './AdminPrimitives';
import { AkoExclusionsField, BetFormFields, type BetFormValue } from './BetFormFields';

type StatusFilter = 'all' | 'active' | 'resolved' | 'closed';
type TypeFilter = 'all' | 'single' | '12' | '1x2' | 'multi';
interface BetEditor extends BetFormValue { id: string; isActive: boolean; exclusions: BetAkoExclusionDraft[] }

export function ManageBetsPanel() {
  const { tokens } = useAppTheme();
  const [bets, setBets] = useState<Bet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [type, setType] = useState<TypeFilter>('all');
  const [editor, setEditor] = useState<BetEditor | null>(null);
  const [resolveBet, setResolveBet] = useState<Bet | null>(null);
  const [winners, setWinners] = useState<string[]>([]);
  const [scope, setScope] = useState<CorrectionScope>('pending_only');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [betResult, categoryResult] = await Promise.all([
        supabase.from('bets').select('*').order('created_at', { ascending: false }),
        supabase.from('categories').select('*').order('sort_order'),
      ]);
      if (betResult.error) throw betResult.error;
      if (categoryResult.error) throw categoryResult.error;
      setBets((betResult.data ?? []) as unknown as Bet[]);
      setCategories((categoryResult.data ?? []) as Category[]);
    } catch (cause) { setError(getErrorMessage(cause, 'Nie udało się pobrać zakładów')); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => bets.filter((bet) => {
    const q = search.trim().toLowerCase();
    if (q && !bet.title.toLowerCase().includes(q)) return false;
    if (type !== 'all' && bet.bet_type !== type) return false;
    if (status === 'active' && (!bet.is_active || bet.winning_option)) return false;
    if (status === 'resolved' && !bet.winning_option) return false;
    if (status === 'closed' && (bet.is_active || bet.winning_option)) return false;
    return true;
  }), [bets, search, status, type]);

  const openEditor = async (bet: Bet) => {
    setBusy(bet.id);
    try {
      const betType = normalizeType(bet.bet_type);
      const exclusions = await fetchBetAkoExclusions(bet.id);
      setEditor({
        id: bet.id, title: bet.title, categoryId: bet.category_id ?? '', betType,
        options: lockEditableOptionsByType(betType, toEditableOptions(normalizeOptions(bet.options))),
        endsAt: toInputDateTime(bet.ends_at), isLive: bet.is_live,
        isBsplicboost: Boolean(bet.is_bsplicboost), isActive: bet.is_active, exclusions,
      });
    } catch (cause) { Alert.alert('Błąd', getErrorMessage(cause, 'Nie udało się otworzyć zakładu')); }
    finally { setBusy(null); }
  };

  const saveEditor = async () => {
    if (!editor) return;
    const ends = new Date(editor.endsAt);
    const options = editor.options.map((item) => ({ name: item.name.trim(), odds: Number(item.odds.replace(',', '.')) }));
    if (!editor.title.trim() || options.some((item) => !item.name || !Number.isFinite(item.odds) || item.odds <= 0) || Number.isNaN(ends.getTime())) {
      return Alert.alert('Nieprawidłowe dane', 'Sprawdź tytuł, opcje, kursy i datę zakończenia.');
    }
    setBusy(editor.id);
    try {
      await updateBetWithAkoExclusions({
        betId: editor.id, title: editor.title.trim(), categoryId: editor.categoryId || null,
        betType: editor.betType, options, endsAt: ends.toISOString(), isLive: editor.isLive,
        isBsplicboost: editor.isBsplicboost, isActive: editor.isActive, exclusions: editor.exclusions,
      });
      setEditor(null); await load(); Alert.alert('Gotowe', 'Zakład został zaktualizowany.');
    } catch (cause) { Alert.alert('Błąd zapisu', getErrorMessage(cause, 'Nieznany błąd')); }
    finally { setBusy(null); }
  };

  const openSettlement = (bet: Bet) => {
    setResolveBet(bet);
    setWinners(parseWinningOptions(bet.winning_option).filter((item) => item !== BET_WINNING_OPTION_REFUND && item !== BET_WINNING_OPTION_FORCED_LOSS));
    setScope('pending_only');
  };
  const settle = async (mode: SettlementMode) => {
    if (!resolveBet || (mode === 'normal' && winners.length === 0)) return;
    if (mode === 'normal' && resolveBet.bet_type !== 'multi' && winners.length > 1) {
      const confirmed = await new Promise<boolean>((done) => Alert.alert('Niestandardowy wynik', 'Wybrano wiele opcji dla zakładu innego niż Multi.', [{ text: 'Wróć', style: 'cancel', onPress: () => done(false) }, { text: 'Rozlicz', style: 'destructive', onPress: () => done(true) }]));
      if (!confirmed) return;
    }
    setBusy(resolveBet.id);
    try {
      await settleBetWithBackend({ betId: resolveBet.id, winningOptionNames: mode === 'normal' ? winners : [], mode, scope });
      setResolveBet(null); await load(); Alert.alert('Gotowe', mode === 'refund' ? 'Zakład rozliczony jako zwrot.' : mode === 'force_lost' ? 'Wszyscy przegrali.' : 'Wynik został zapisany.');
    } catch (cause) { Alert.alert('Błąd rozliczenia', getErrorMessage(cause, 'Nieznany błąd')); }
    finally { setBusy(null); }
  };
  const remove = (bet: Bet) => Alert.alert('Usunąć zakład?', bet.title, [
    { text: 'Anuluj', style: 'cancel' },
    { text: 'Usuń', style: 'destructive', onPress: async () => {
      setBusy(bet.id);
      try { const { error: removeError } = await supabase.from('bets').delete().eq('id', bet.id); if (removeError) throw removeError; await load(); }
      catch (cause) { Alert.alert('Nie udało się usunąć', getErrorMessage(cause, 'Nieznany błąd')); }
      finally { setBusy(null); }
    } },
  ]);

  if (loading || error) return <AdminState loading={loading} error={error} onRetry={load} />;
  return (
    <View style={styles.stack}>
      <AppInput value={search} onChangeText={setSearch} placeholder="Szukaj zakładów…" />
      <AdminChoice<StatusFilter> label="Status" value={status} onChange={setStatus} options={[{ value: 'all', label: 'Wszystkie' }, { value: 'active', label: 'Aktywne' }, { value: 'resolved', label: 'Rozstrzygnięte' }, { value: 'closed', label: 'Zamknięte' }]} />
      <AdminChoice<TypeFilter> label="Typ" value={type} onChange={setType} options={[{ value: 'all', label: 'Wszystkie' }, { value: 'single', label: 'Single' }, { value: '12', label: '1/2' }, { value: '1x2', label: '1X2' }, { value: 'multi', label: 'Multi' }]} />
      <AppText variant="caption" tone="muted">{filtered.length} wyników</AppText>
      <AdminState empty={filtered.length === 0} emptyTitle="Brak pasujących zakładów." />
      {filtered.map((bet) => {
        const resolved = Boolean(bet.winning_option);
        return (
          <AppCard key={bet.id} style={styles.betCard}>
            <View style={styles.heading}><View style={styles.flex}><AppText variant="label">{bet.title}</AppText><AppText variant="caption" tone="muted">{bet.bet_type.toUpperCase()} · {bet.bet_count} zakładów</AppText></View><AppBadge tone={resolved ? 'success' : bet.is_active ? 'primary' : 'neutral'} label={resolved ? 'ROZSTRZYGNIĘTY' : bet.is_active ? 'AKTYWNY' : 'ZAMKNIĘTY'} /></View>
            <View style={styles.actions}>
              <AppButton variant="secondary" disabled={busy === bet.id} onPress={() => void openEditor(bet)} leftAccessory={<Pencil size={15} color={tokens.colors.foreground} />}>Edytuj</AppButton>
              <AppButton disabled={busy === bet.id} onPress={() => openSettlement(bet)} leftAccessory={<Trophy size={15} color="#fff" />}>{resolved ? 'Korekta' : 'Wynik'}</AppButton>
              {!resolved ? <AppButton variant="outline" disabled={busy === bet.id} onPress={() => openSettlement(bet)} leftAccessory={<RotateCcw size={15} color={tokens.colors.foreground} />}>Zwrot</AppButton> : null}
              <AppButton variant="danger" disabled={busy === bet.id} onPress={() => remove(bet)} leftAccessory={<Trash2 size={15} color="#fff" />}>Usuń</AppButton>
            </View>
          </AppCard>
        );
      })}

      <AppModal visible={Boolean(editor)} title="Edytuj zakład" onClose={() => !busy && setEditor(null)}>
        {editor ? <View style={styles.modalStack}>
          <BetFormFields value={editor} onChange={(next) => setEditor({ ...editor, ...next })} categories={categories} disabled={Boolean(busy)} />
          <AdminToggle label="Aktywny" value={editor.isActive} onChange={(isActive) => setEditor({ ...editor, isActive })} />
          <AkoExclusionsField bets={bets} currentBetId={editor.id} value={editor.exclusions} onChange={(exclusions) => setEditor({ ...editor, exclusions })} />
          <AppButton loading={busy === editor.id} onPress={saveEditor}>Zapisz zmiany</AppButton>
        </View> : null}
      </AppModal>

      <AppModal visible={Boolean(resolveBet)} title={resolveBet?.winning_option ? 'Korekta wyniku' : 'Ogłoś wynik'} onClose={() => !busy && setResolveBet(null)}>
        {resolveBet ? <View style={styles.modalStack}>
          <AppText variant="label">{resolveBet.title}</AppText>
          {resolveBet.winning_option ? <AdminChoice<CorrectionScope> label="Zakres korekty" value={scope} onChange={setScope} options={[{ value: 'pending_only', label: 'Tylko pending' }, { value: 'all', label: 'Wszystkie + saldo' }]} /> : null}
          {resolveBet.options.map((option) => {
            const selected = winners.includes(option.name);
            return <Pressable key={option.name} onPress={() => setWinners((items) => selected ? items.filter((name) => name !== option.name) : [...items, option.name])} style={[styles.winner, { borderColor: selected ? tokens.colors.primary : tokens.colors.border, backgroundColor: selected ? `${tokens.colors.primary}18` : tokens.colors.backgroundElevated }]}><AppText tone={selected ? 'primary' : 'default'}>{selected ? '✓ ' : ''}{option.name}</AppText><AppText variant="label">{Number(option.odds).toFixed(2)}</AppText></Pressable>;
          })}
          <AppButton loading={busy === resolveBet.id} disabled={winners.length === 0} onPress={() => void settle('normal')}>{`Zapisz wynik (${winners.length})`}</AppButton>
          {resolveBet.is_bsplicboost ? <AppButton variant="outline" disabled={Boolean(busy)} onPress={() => void settle('force_lost')}>Przegrana wszystkich</AppButton> : null}
          <AppButton variant="outline" disabled={Boolean(busy)} onPress={() => void settle('refund')}>Zwrot 1.00</AppButton>
        </View> : null}
      </AppModal>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 14 }, betCard: { gap: 14 }, heading: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' }, flex: { flex: 1, gap: 3 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, modalStack: { gap: 15 },
  winner: { minHeight: 50, paddingHorizontal: 14, borderWidth: 1, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
