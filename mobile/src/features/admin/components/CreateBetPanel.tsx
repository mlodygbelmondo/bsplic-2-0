import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui';
import { supabase } from '@/integrations/supabase/client';
import type { Bet, Category } from '@/types/database';
import { createBetWithAkoExclusions, type BetAkoExclusionDraft } from '../api/akoExclusions';
import { getErrorMessage, getTomorrowAt2359, toInputDateTime } from '../helpers';
import { AdminSection, AdminState } from './AdminPrimitives';
import { AkoExclusionsField, BetFormFields, type BetFormValue } from './BetFormFields';

function initialValue(): BetFormValue {
  return {
    title: '', categoryId: '', betType: '12',
    options: [{ name: '1', odds: '2' }, { name: '2', odds: '2' }],
    endsAt: toInputDateTime(getTomorrowAt2359()), isLive: false, isBsplicboost: false,
  };
}

export function CreateBetPanel() {
  const [value, setValue] = useState(initialValue);
  const [categories, setCategories] = useState<Category[]>([]);
  const [bets, setBets] = useState<Bet[]>([]);
  const [exclusions, setExclusions] = useState<BetAkoExclusionDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [categoryResult, betResult] = await Promise.all([
        supabase.from('categories').select('*').order('sort_order'),
        supabase.from('bets').select('*').eq('is_active', true).order('created_at', { ascending: false }),
      ]);
      if (categoryResult.error) throw categoryResult.error;
      if (betResult.error) throw betResult.error;
      setCategories((categoryResult.data ?? []) as Category[]);
      setBets((betResult.data ?? []) as unknown as Bet[]);
    } catch (cause) { setError(getErrorMessage(cause, 'Nie udało się wczytać formularza')); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const submit = async () => {
    const title = value.title.trim();
    const options = value.options.map((item) => ({ name: item.name.trim(), odds: Number(item.odds.replace(',', '.')) }));
    const ends = new Date(value.endsAt);
    if (!title) return Alert.alert('Brak tytułu', 'Tytuł zakładu jest wymagany.');
    if (options.some((item) => !item.name || !Number.isFinite(item.odds) || item.odds <= 0)) return Alert.alert('Nieprawidłowe opcje', 'Uzupełnij nazwy i dodatnie kursy wszystkich opcji.');
    if ((value.betType === 'single' ? options.length < 1 : options.length < 2)) return Alert.alert('Za mało opcji', 'Dodaj wymaganą liczbę opcji.');
    if (Number.isNaN(ends.getTime())) return Alert.alert('Nieprawidłowa data', 'Wpisz datę w formacie RRRR-MM-DD GG:MM.');
    setSaving(true);
    try {
      await createBetWithAkoExclusions({
        title, categoryId: value.categoryId || null, betType: value.betType,
        options, endsAt: ends.toISOString(), isLive: value.isLive,
        isBsplicboost: value.isBsplicboost, exclusions,
      });
      setValue(initialValue()); setExclusions([]);
      Alert.alert('Gotowe', 'Zakład został utworzony.');
      await load();
    } catch (cause) { Alert.alert('Nie udało się utworzyć zakładu', getErrorMessage(cause, 'Nieznany błąd')); }
    finally { setSaving(false); }
  };

  const state = <AdminState loading={loading} error={error} onRetry={load} />;
  if (loading || error) return state;
  return (
    <View style={styles.stack}>
      <AdminSection title="Nowy zakład" description="Utwórz zdarzenie, kursy i zasady kuponu.">
        <BetFormFields value={value} onChange={setValue} categories={categories} disabled={saving} />
      </AdminSection>
      <AkoExclusionsField bets={bets} value={exclusions} onChange={setExclusions} disabled={saving} />
      <AppButton fullWidth loading={saving} onPress={submit}>Utwórz zakład</AppButton>
    </View>
  );
}

const styles = StyleSheet.create({ stack: { gap: 16 } });
