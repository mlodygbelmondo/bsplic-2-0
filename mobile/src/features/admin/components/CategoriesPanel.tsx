import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Pencil, Plus, Trash2 } from 'lucide-react-native';

import { AppButton, AppCard, AppInput, AppModal, AppText } from '@/components/ui';
import { useAppTheme } from '@/hooks/use-app-theme';
import { supabase } from '@/integrations/supabase/client';
import type { Category } from '@/types/database';
import { getErrorMessage } from '../helpers';
import { AdminState } from './AdminPrimitives';

type CategoryForm = Pick<Category, 'name' | 'emoji' | 'color' | 'sort_order'>;
const EMPTY: CategoryForm = { name: '', emoji: '⚽', color: '#dc2626', sort_order: 0 };

export function CategoriesPanel() {
  const { tokens } = useAppTheme();
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { setLoading(true); setError(null); const result = await supabase.from('categories').select('*').order('sort_order'); if (result.error) setError(getErrorMessage(result.error, 'Nie udało się pobrać kategorii')); else setCategories((result.data ?? []) as Category[]); setLoading(false); }, []);
  useEffect(() => { void load(); }, [load]);
  const add = async () => {
    if (!form.name.trim()) return Alert.alert('Nazwa jest wymagana');
    setBusy(true); try { const { error: insertError } = await supabase.from('categories').insert({ ...form, name: form.name.trim() }); if (insertError) throw insertError; setForm({ ...EMPTY, sort_order: categories.length + 1 }); await load(); }
    catch (cause) { Alert.alert('Nie udało się dodać', getErrorMessage(cause, 'Nieznany błąd')); } finally { setBusy(false); }
  };
  const save = async () => { if (!editing?.name.trim()) return; setBusy(true); try { const { error: updateError } = await supabase.from('categories').update({ name: editing.name.trim(), emoji: editing.emoji, color: editing.color, sort_order: editing.sort_order }).eq('id', editing.id); if (updateError) throw updateError; setEditing(null); await load(); } catch (cause) { Alert.alert('Nie udało się zapisać', getErrorMessage(cause, 'Nieznany błąd')); } finally { setBusy(false); } };
  const remove = (category: Category) => Alert.alert('Usunąć kategorię?', category.name, [{ text: 'Anuluj', style: 'cancel' }, { text: 'Usuń', style: 'destructive', onPress: async () => { setBusy(true); try { const countResult = await supabase.from('bets').select('*', { count: 'exact', head: true }).eq('category_id', category.id).eq('is_active', true); if (countResult.error) throw countResult.error; if (countResult.count) throw new Error('Najpierw usuń aktywne zakłady z tej kategorii.'); const result = await supabase.from('categories').delete().eq('id', category.id); if (result.error) throw result.error; await load(); } catch (cause) { Alert.alert('Nie udało się usunąć', getErrorMessage(cause, 'Nieznany błąd')); } finally { setBusy(false); } } }]);
  if (loading || error) return <AdminState loading={loading} error={error} onRetry={load} />;
  return <View style={styles.stack}>
    <AppCard style={styles.stack}><AppText variant="subtitle">Dodaj kategorię</AppText><CategoryFields value={form} onChange={setForm} /><AppButton loading={busy} onPress={add} leftAccessory={<Plus size={16} color="#fff" />}>Dodaj kategorię</AppButton></AppCard>
    <AdminState empty={categories.length === 0} emptyTitle="Brak kategorii." />
    {categories.map((category) => <AppCard key={category.id} style={styles.row}><View style={[styles.color, { backgroundColor: category.color }]} /><AppText variant="title">{category.emoji}</AppText><View style={styles.flex}><AppText variant="label">{category.name}</AppText><AppText variant="caption" tone="muted">Pozycja: {category.sort_order}</AppText></View><AppButton variant="ghost" onPress={() => setEditing(category)} leftAccessory={<Pencil size={17} color={tokens.colors.foreground} />}>Edytuj</AppButton><AppButton variant="ghost" disabled={busy} onPress={() => remove(category)} leftAccessory={<Trash2 size={17} color={tokens.colors.destructive} />}>Usuń</AppButton></AppCard>)}
    <AppModal visible={Boolean(editing)} title="Edytuj kategorię" onClose={() => setEditing(null)}>{editing ? <View style={styles.stack}><CategoryFields value={editing} onChange={(value) => setEditing({ ...editing, ...value })} /><AppButton loading={busy} onPress={save}>Zapisz</AppButton></View> : null}</AppModal>
  </View>;
}

function CategoryFields({ value, onChange }: { value: CategoryForm; onChange(value: CategoryForm): void }) { return <View style={styles.stack}><AppInput label="Nazwa" value={value.name} onChangeText={(name) => onChange({ ...value, name })} /><AppInput label="Emoji" value={value.emoji} onChangeText={(emoji) => onChange({ ...value, emoji })} /><AppInput label="Kolor (HEX)" autoCapitalize="none" value={value.color} onChangeText={(color) => onChange({ ...value, color })} /><AppInput label="Kolejność" keyboardType="number-pad" value={String(value.sort_order)} onChangeText={(sort) => onChange({ ...value, sort_order: Number(sort) || 0 })} /></View>; }
const styles = StyleSheet.create({ stack: { gap: 14 }, row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 }, color: { width: 6, height: 42, borderRadius: 3 }, flex: { flex: 1, minWidth: 100 } });
