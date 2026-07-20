import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Plus, X } from 'lucide-react-native';

import { AppButton, AppCard, AppInput, AppText } from '@/components/ui';
import { useAppTheme } from '@/hooks/use-app-theme';
import type { Bet, Category } from '@/types/database';
import type { BetAkoExclusionDraft } from '../api/akoExclusions';
import type { EditableBetOption } from '../helpers';
import type { EditableBetType } from '../constants';
import { AdminChoice, AdminToggle } from './AdminPrimitives';

const TYPE_OPTIONS = [
  { value: 'single', label: 'Single' },
  { value: '12', label: '1/2' },
  { value: '1x2', label: '1X2' },
  { value: 'multi', label: 'Multi' },
] as const;

export interface BetFormValue {
  title: string;
  categoryId: string;
  betType: EditableBetType;
  options: EditableBetOption[];
  endsAt: string;
  isLive: boolean;
  isBsplicboost: boolean;
}

export function BetFormFields({
  value,
  onChange,
  categories,
  disabled,
}: {
  value: BetFormValue;
  onChange(value: BetFormValue): void;
  categories: Category[];
  disabled?: boolean;
}) {
  const { tokens } = useAppTheme();
  const fixed = value.betType !== 'multi';
  const changeType = (betType: EditableBetType) => {
    const presets: Record<Exclude<EditableBetType, 'multi'>, EditableBetOption[]> = {
      single: [{ name: '1', odds: '2' }],
      '12': [{ name: '1', odds: '2' }, { name: '2', odds: '2' }],
      '1x2': [{ name: '1', odds: '2' }, { name: 'X', odds: '3' }, { name: '2', odds: '2' }],
    };
    onChange({
      ...value,
      betType,
      options: betType === 'multi'
        ? (value.options.length >= 2 ? value.options : [{ name: '', odds: '2' }, { name: '', odds: '2' }])
        : presets[betType],
    });
  };

  return (
    <View style={styles.stack}>
      <AppInput label="Tytuł zakładu" value={value.title} editable={!disabled} onChangeText={(title) => onChange({ ...value, title })} />
      <AdminChoice label="Typ zakładu" options={TYPE_OPTIONS} value={value.betType} onChange={changeType} />
      <View style={styles.field}>
        <AppText variant="label">Kategoria</AppText>
        <View style={styles.wrap}>
          <Pressable
            onPress={() => onChange({ ...value, categoryId: '' })}
            style={[styles.pill, { borderColor: value.categoryId ? tokens.colors.border : tokens.colors.primary }]}
          >
            <AppText variant="caption" tone={value.categoryId ? 'muted' : 'primary'}>Bez kategorii</AppText>
          </Pressable>
          {categories.map((category) => {
            const active = category.id === value.categoryId;
            return (
              <Pressable key={category.id} onPress={() => onChange({ ...value, categoryId: category.id })} style={[styles.pill, { borderColor: active ? tokens.colors.primary : tokens.colors.border }]}>
                <AppText variant="caption" tone={active ? 'primary' : 'default'}>{category.emoji} {category.name}</AppText>
              </Pressable>
            );
          })}
        </View>
      </View>
      <AppInput
        label="Data zakończenia (RRRR-MM-DD GG:MM)"
        value={value.endsAt.replace('T', ' ')}
        editable={!disabled}
        autoCapitalize="none"
        onChangeText={(endsAt) => onChange({ ...value, endsAt: endsAt.replace(' ', 'T') })}
      />
      <AdminToggle label="Na żywo" description="Oznacz jako wydarzenie live" value={value.isLive} onChange={(isLive) => onChange({ ...value, isLive })} disabled={disabled} />
      <AdminToggle label="BSPLICBOOST" description="Wyróżnij zakład wyższym kursem" value={value.isBsplicboost} onChange={(isBsplicboost) => onChange({ ...value, isBsplicboost })} disabled={disabled} />
      <View style={styles.headingRow}>
        <AppText variant="label">Możliwe typy</AppText>
        {!fixed ? <AppButton variant="outline" onPress={() => onChange({ ...value, options: [...value.options, { name: '', odds: '2' }] })} leftAccessory={<Plus size={15} color={tokens.colors.foreground} />}>Dodaj</AppButton> : null}
      </View>
      {value.options.map((option, index) => (
        <View key={index} style={styles.optionRow}>
          <AppInput
            accessibilityLabel={`Nazwa opcji ${index + 1}`}
            value={option.name}
            editable={!disabled}
            style={styles.optionName}
            onChangeText={(name) => {
              const options = value.options.map((item, itemIndex) => itemIndex === index ? { ...item, name } : item);
              onChange({ ...value, options });
            }}
          />
          <AppInput
            accessibilityLabel={`Kurs opcji ${index + 1}`}
            value={option.odds}
            keyboardType="decimal-pad"
            editable={!disabled}
            style={styles.odds}
            onChangeText={(odds) => {
              const options = value.options.map((item, itemIndex) => itemIndex === index ? { ...item, odds } : item);
              onChange({ ...value, options });
            }}
          />
          {!fixed && value.options.length > 2 ? (
            <Pressable accessibilityLabel={`Usuń opcję ${index + 1}`} hitSlop={8} onPress={() => onChange({ ...value, options: value.options.filter((_, itemIndex) => itemIndex !== index) })} style={styles.remove}>
              <X size={19} color={tokens.colors.destructive} />
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  );
}

export function AkoExclusionsField({
  bets,
  value,
  onChange,
  currentBetId,
  disabled,
}: {
  bets: Bet[];
  value: BetAkoExclusionDraft[];
  onChange(value: BetAkoExclusionDraft[]): void;
  currentBetId?: string;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState('');
  const matches = useMemo(() => {
    const query = search.trim().toLowerCase();
    const selected = new Set(value.map((item) => item.betId));
    if (query.length < 2) return [];
    return bets.filter((bet) => bet.id !== currentBetId && !selected.has(bet.id) && bet.title.toLowerCase().includes(query)).slice(0, 5);
  }, [bets, currentBetId, search, value]);
  return (
    <AppCard inset style={styles.stack}>
      <View><AppText variant="label">Wykluczenia AKO</AppText><AppText variant="caption" tone="muted">Zablokuj łączenie powiązanych zdarzeń.</AppText></View>
      <AppInput value={search} editable={!disabled} placeholder="Szukaj zakładu" onChangeText={setSearch} />
      {matches.map((bet) => (
        <AppButton key={bet.id} variant="outline" onPress={() => { onChange([...value, { betId: bet.id, title: bet.title, reason: null }]); setSearch(''); }}>{`Dodaj: ${bet.title}`}</AppButton>
      ))}
      {value.length === 0 ? <AppText variant="caption" tone="muted">Brak wykluczeń.</AppText> : value.map((item) => (
        <View key={item.betId} style={styles.exclusion}>
          <View style={styles.headingRow}>
            <AppText variant="label" style={styles.flex}>{item.title}</AppText>
            <Pressable onPress={() => onChange(value.filter((candidate) => candidate.betId !== item.betId))}><X size={18} /></Pressable>
          </View>
          <AppInput placeholder="Powód (opcjonalnie)" value={item.reason ?? ''} onChangeText={(reason) => onChange(value.map((candidate) => candidate.betId === item.betId ? { ...candidate, reason } : candidate))} />
        </View>
      ))}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 14 },
  field: { gap: 7 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  pill: { minHeight: 38, justifyContent: 'center', borderWidth: 1, borderRadius: 999, paddingHorizontal: 12 },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  optionName: { flex: 1 },
  odds: { width: 76, textAlign: 'center' },
  remove: { width: 36, height: 48, alignItems: 'center', justifyContent: 'center' },
  exclusion: { gap: 8 },
  flex: { flex: 1 },
});
