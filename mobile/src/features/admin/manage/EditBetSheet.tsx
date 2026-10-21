import { Plus, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { getCategoryLabel, getCategoryOptions } from '@/features/home/logic/category-tree';
import { OFFLINE_WRITE_MESSAGE, useIsOffline } from '@/lib/connectivity';
import { getErrorMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { toast } from '@/lib/toast';
import { alpha, createStyles, useTheme } from '@/theme';
import type { Bet, Category } from '@/types/database';
import { PressScale, Text } from '@/ui';
import { fetchBetAkoExclusions, updateBetWithAkoExclusions } from '../api/ako-exclusions';
import {
  createBetEditor,
  hasFixedOptionCount,
  newOptionDraft,
  relockEditorOptions,
  validateBetEditor,
  type BetEditorDraft,
  type OptionDraft,
} from '../bet-form';
import { NO_CATEGORY_VALUE, type EditableBetType } from '../constants';
import { AdminButton } from '../components/AdminButton';
import { AdminSheet } from '../components/AdminSheet';
import { AkoExclusionsEditor } from '../components/AkoExclusionsEditor';
import { DateTimeField } from '../components/DateTimeField';
import { FieldLabel, Input, SwitchRow } from '../components/form';
import { SelectField, type SelectOption } from '../components/SelectField';

export interface SheetSession {
  bet: Bet;
  open: boolean;
  /** New per open, so every opening starts from a fresh form. */
  session: number;
}

const TYPE_OPTIONS: SelectOption<EditableBetType>[] = [
  { value: 'single', label: 'Single' },
  { value: '12', label: '1/2' },
  { value: '1x2', label: '1X2' },
  { value: 'multi', label: 'Multi' },
];

/** Web `ManageBetsTab` edit dialog (`Edytuj zakład`). */
export function EditBetSheet({
  editor,
  bets,
  categories,
  onClose,
  onDismissed,
  onSaved,
}: {
  editor: SheetSession | null;
  bets: Bet[];
  categories: Category[];
  onClose: () => void;
  onDismissed: () => void;
  onSaved: () => void;
}) {
  return (
    <AdminSheet
      open={editor?.open ?? false}
      title="Edytuj zakład"
      description="Zmień dane zakładu, opcje i wykluczenia AKO."
      onClose={onClose}
      onDismissed={onDismissed}
    >
      {editor ? (
        <EditBetForm key={editor.session} bet={editor.bet} bets={bets} categories={categories} onSaved={onSaved} />
      ) : null}
    </AdminSheet>
  );
}

type AkoLoadState = 'loading' | 'ready' | 'failed';

function EditBetForm({
  bet,
  bets,
  categories,
  onSaved,
}: {
  bet: Bet;
  bets: Bet[];
  categories: Category[];
  onSaved: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const offline = useIsOffline();
  const [draft, setDraft] = useState<BetEditorDraft>(() => createBetEditor(bet));
  const [akoState, setAkoState] = useState<AkoLoadState>('loading');
  const [saving, setSaving] = useState(false);
  const akoLoading = akoState === 'loading';
  const akoFailed = akoState === 'failed';
  const fixedCount = hasFixedOptionCount(draft.betType);

  useEffect(() => {
    // A response for a bet whose form was closed meanwhile is ignored.
    let active = true;
    fetchBetAkoExclusions(bet.id)
      .then((akoExclusions) => {
        if (!active) return;
        setDraft((current) => ({ ...current, akoExclusions }));
        setAkoState('ready');
      })
      .catch((err: unknown) => {
        if (!active) return;
        setAkoState('failed');
        toast.error(getErrorMessage(err, 'Nie udało się pobrać wykluczeń AKO'));
      });
    return () => {
      active = false;
    };
  }, [bet.id]);

  const patch = (changes: Partial<BetEditorDraft>) => setDraft((current) => ({ ...current, ...changes }));

  const updateOption = (key: string, changes: Partial<OptionDraft>) =>
    setDraft((current) => ({
      ...current,
      options: current.options.map((option) => (option.key === key ? { ...option, ...changes } : option)),
    }));

  const categoryOptions: SelectOption<string>[] = [
    { value: NO_CATEGORY_VALUE, label: 'Brak kategorii' },
    ...getCategoryOptions(categories).map(({ category, parent }) => ({
      value: category.id,
      label: `${category.emoji} ${getCategoryLabel(category, parent)}`,
    })),
  ];

  const save = async () => {
    const result = validateBetEditor(draft, { loading: akoLoading, failed: akoFailed });
    if (!result.ok) {
      haptics.error();
      toast.error(result.message);
      return;
    }
    if (offline) {
      toast.error(OFFLINE_WRITE_MESSAGE);
      return;
    }

    setSaving(true);
    try {
      await updateBetWithAkoExclusions(result.value);
      haptics.success();
      toast.success('Zakład zaktualizowany');
      onSaved();
    } catch (err: unknown) {
      haptics.error();
      toast.error(getErrorMessage(err, 'Nie udało się zaktualizować zakładu'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <View style={styles.field}>
        <FieldLabel>Tytuł</FieldLabel>
        <Input value={draft.title} onChangeText={(title) => patch({ title })} accessibilityLabel="Tytuł" />
      </View>

      <View style={styles.grid}>
        <View style={styles.field}>
          <FieldLabel>Kategoria</FieldLabel>
          <SelectField
            value={draft.categoryId || NO_CATEGORY_VALUE}
            options={categoryOptions}
            placeholder="Wybierz"
            accessibilityLabel="Kategoria"
            onChange={(value) => patch({ categoryId: value === NO_CATEGORY_VALUE ? '' : value })}
          />
        </View>
        <View style={styles.field}>
          <FieldLabel>Typ</FieldLabel>
          <SelectField
            value={draft.betType}
            options={TYPE_OPTIONS}
            accessibilityLabel="Typ"
            onChange={(betType) =>
              setDraft((current) => ({
                ...current,
                betType,
                options: relockEditorOptions(betType, current.options),
              }))
            }
          />
        </View>
      </View>

      <View style={styles.field}>
        <FieldLabel>Data zakończenia</FieldLabel>
        <DateTimeField
          value={draft.endsAt}
          onChange={(endsAt) => patch({ endsAt })}
          accessibilityLabel="Data zakończenia"
        />
      </View>

      <View style={styles.grid}>
        <SwitchRow label="Na żywo" value={draft.isLive} onValueChange={(isLive) => patch({ isLive })} />
        <SwitchRow
          label="BSPLICBOOST"
          value={draft.isBsplicboost}
          onValueChange={(isBsplicboost) => patch({ isBsplicboost })}
        />
        <SwitchRow label="Aktywny" value={draft.isActive} onValueChange={(isActive) => patch({ isActive })} />
      </View>

      <View style={styles.field}>
        <FieldLabel>Opcje</FieldLabel>
        {draft.options.map((option, index) => (
          <View key={option.key} style={styles.optionRow}>
            <Input
              value={option.name}
              onChangeText={(name) => updateOption(option.key, { name })}
              accessibilityLabel={`Nazwa opcji ${index + 1}`}
              style={styles.flex}
            />
            <Input
              value={option.odds}
              onChangeText={(odds) => updateOption(option.key, { odds })}
              keyboardType="decimal-pad"
              accessibilityLabel={`Kurs opcji ${index + 1}`}
              style={styles.oddsInput}
            />
            {!fixedCount && draft.options.length > 2 ? (
              <PressScale
                accessibilityRole="button"
                accessibilityLabel={`Usuń opcję ${index + 1}`}
                hitSlop={2}
                onPress={() => {
                  haptics.selection();
                  setDraft((current) => ({
                    ...current,
                    options: current.options.filter((item) => item.key !== option.key),
                  }));
                }}
                style={styles.removeOption}
              >
                <X size={16} color={colors.mutedForeground} />
              </PressScale>
            ) : null}
          </View>
        ))}
        {!fixedCount ? (
          <AdminButton
            tone="outline"
            label="Dodaj opcję"
            icon={<Plus size={12} color={colors.foreground} />}
            onPress={() => setDraft((current) => ({ ...current, options: [...current.options, newOptionDraft()] }))}
          />
        ) : null}
      </View>

      <AkoExclusionsEditor
        availableBets={bets}
        currentBetId={draft.id}
        value={draft.akoExclusions}
        onChange={(akoExclusions) => patch({ akoExclusions })}
        disabled={saving || akoFailed}
        loading={akoLoading}
      />

      {akoFailed ? (
        <View style={styles.akoError}>
          <Text size="xs" weight="500" color="destructive">
            Wykluczenia AKO nie wczytały się poprawnie. Zamknij edycję i spróbuj ponownie.
          </Text>
        </View>
      ) : null}

      <AdminButton
        tone="gradient"
        weight="700"
        label={saving ? 'Zapisywanie...' : 'Zapisz zmiany'}
        disabled={saving || akoLoading || akoFailed || offline}
        onPress={save}
      />
    </>
  );
}

const useStyles = createStyles(({ colors, radius }) => ({
  field: { gap: 8 },
  grid: { gap: 12 },
  flex: { flex: 1 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  oddsInput: { width: 80 },
  removeOption: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  akoError: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: alpha(colors.destructive, 0.3),
    backgroundColor: alpha(colors.destructive, 0.1),
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
}));
