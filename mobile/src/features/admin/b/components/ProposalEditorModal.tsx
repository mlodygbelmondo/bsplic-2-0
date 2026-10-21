import { Plus, X } from 'lucide-react-native';
import { ActivityIndicator, Pressable, Switch, View } from 'react-native';

import { createStyles, useTheme } from '@/theme';
import type { Category } from '@/types/database';
import { Button, Text } from '@/ui';
import type { EditableBetType } from '../../constants';
import { lockEditableOptionsByType } from '../../helpers';
import { hasFixedOptionCount, type ProposalEditor } from '../logic/proposal-review';
import { DateTimeField } from './DateTimeField';
import { FormModal } from './FormModal';
import { FormField, FormLabel, Input } from './primitives';
import { SelectField, type SelectOption } from './SelectField';

const BET_TYPE_OPTIONS: SelectOption<EditableBetType>[] = [
  { value: 'single', label: 'Single' },
  { value: '12', label: '1/2' },
  { value: '1x2', label: '1X2' },
  { value: 'multi', label: 'Multi' },
];

/** Web "Dostosuj propozycję" dialog. */
export function ProposalEditorModal({
  editing,
  categories,
  saving,
  disabled,
  onChange,
  onClose,
  onSubmit,
}: {
  editing: ProposalEditor | null;
  categories: Category[];
  saving: boolean;
  disabled: boolean;
  onChange: (next: ProposalEditor) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const fixed = editing ? hasFixedOptionCount(editing.betType) : false;

  const updateOption = (index: number, patch: Partial<{ name: string; odds: string }>) => {
    if (!editing) return;
    onChange({
      ...editing,
      options: editing.options.map((option, i) => (i === index ? { ...option, ...patch } : option)),
    });
  };

  return (
    <FormModal visible={editing !== null} title="Dostosuj propozycję" onClose={onClose}>
      {editing ? (
        <>
          <FormField label="Tytuł">
            <Input
              accessibilityLabel="Tytuł propozycji"
              value={editing.title}
              onChangeText={(title) => onChange({ ...editing, title })}
            />
          </FormField>

          <FormField label="Kategoria">
            <SelectField
              accessibilityLabel="Kategoria propozycji"
              placeholder="Wybierz"
              value={editing.categoryId}
              options={categories.map((category) => ({
                value: category.id,
                label: `${category.emoji} ${category.name}`,
              }))}
              onChange={(categoryId) => onChange({ ...editing, categoryId })}
            />
          </FormField>

          <FormField label="Typ">
            <SelectField
              accessibilityLabel="Typ zakładu propozycji"
              value={editing.betType}
              options={BET_TYPE_OPTIONS}
              onChange={(betType) =>
                onChange({
                  ...editing,
                  betType,
                  options: lockEditableOptionsByType(betType, editing.options),
                })
              }
            />
          </FormField>

          <FormField label="Data zakończenia">
            <DateTimeField
              accessibilityLabel="Data zakończenia propozycji"
              value={editing.endsAt}
              onChange={(endsAt) => onChange({ ...editing, endsAt })}
            />
          </FormField>

          <View style={styles.boostRow}>
            <View style={{ flex: 1, gap: 2 }}>
              <FormLabel color="primary">BSPLICBOOST</FormLabel>
              <Text size="xs" color="mutedForeground">
                Wyróżnij zaakceptowany zakład jako boost
              </Text>
            </View>
            <Switch
              accessibilityLabel="Włącz BSPLICBOOST dla propozycji"
              value={editing.isBsplicboost}
              onValueChange={(isBsplicboost) => onChange({ ...editing, isBsplicboost })}
              trackColor={{ true: colors.primary, false: colors.input }}
            />
          </View>

          <View style={{ gap: 8 }}>
            <FormLabel>Opcje</FormLabel>
            {editing.options.map((option, index) => (
              <View key={`${editing.id}-${index}`} style={styles.optionRow}>
                <Input
                  style={{ flex: 1 }}
                  accessibilityLabel={`Nazwa opcji ${index + 1}`}
                  value={option.name}
                  onChangeText={(name) => updateOption(index, { name })}
                />
                <Input
                  style={styles.oddsInput}
                  keyboardType="decimal-pad"
                  accessibilityLabel={`Kurs opcji ${index + 1}`}
                  value={option.odds}
                  onChangeText={(odds) => updateOption(index, { odds: odds.replace(',', '.') })}
                />
                {!fixed && editing.options.length > 2 ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Usuń opcję ${index + 1}`}
                    hitSlop={4}
                    onPress={() =>
                      onChange({ ...editing, options: editing.options.filter((_, i) => i !== index) })
                    }
                    style={styles.removeOption}
                  >
                    <X size={16} color={colors.foreground} />
                  </Pressable>
                ) : null}
              </View>
            ))}
            {!fixed ? (
              <Button
                variant="outline"
                size="sm"
                label="Dodaj opcję"
                icon={<Plus size={12} color={colors.foreground} />}
                style={styles.tallButton}
                onPress={() =>
                  onChange({ ...editing, options: [...editing.options, { name: '', odds: '2' }] })
                }
              />
            ) : null}
          </View>

          <Button
            variant="gradient"
            label={saving ? 'Zapisywanie...' : 'Akceptuj propozycję'}
            accessibilityLabel={saving ? 'Zapisywanie propozycji' : 'Akceptuj propozycję'}
            icon={saving ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : undefined}
            disabled={saving || disabled}
            onPress={onSubmit}
            style={styles.tallButton}
          />
        </>
      ) : null}
    </FormModal>
  );
}

const useStyles = createStyles(({ colors, radius }) => ({
  boostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: 16,
  },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  oddsInput: { width: 80 },
  removeOption: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tallButton: { height: 44 },
}));
