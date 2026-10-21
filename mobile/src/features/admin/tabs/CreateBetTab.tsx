import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { categoriesQueryOptions } from '@/features/home/api/categories';
import { OFFLINE_WRITE_MESSAGE, useIsOffline } from '@/lib/connectivity';
import { getErrorMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { toast } from '@/lib/toast';
import { alpha, createStyles, useTheme } from '@/theme';
import type { Bet } from '@/types/database';
import { Glass, PressScale, Text } from '@/ui';
import { createBetWithAkoExclusions, type BetAkoExclusionDraft } from '../api/ako-exclusions';
import { ADMIN_BETS_KEY, adminQueries } from '../api/queries';
import {
  createFormOptions,
  defaultEndsAt,
  hasFixedOptionCount,
  newOptionDraft,
  validateNewBet,
  type OptionDraft,
} from '../bet-form';
import type { EditableBetType } from '../constants';
import { ADMIN_NAV_RESERVE, AdminTabScroll, useAdminChrome } from '../components/AdminChrome';
import { AdminButton } from '../components/AdminButton';
import { AkoExclusionsEditor } from '../components/AkoExclusionsEditor';
import { DateTimeField } from '../components/DateTimeField';
import { CapsLabel, FormCard, Input, SwitchRow } from '../components/form';
import { SelectField, type SelectOption } from '../components/SelectField';

const EMPTY_BETS: Bet[] = [];

const TYPE_OPTIONS: SelectOption<EditableBetType>[] = [
  { value: 'single', label: 'Single (1 opcja)' },
  { value: '12', label: '1/2 (Dwie opcje)' },
  { value: '1x2', label: '1X2 (Trzy opcje)' },
  { value: 'multi', label: 'Multi (Wiele opcji)' },
];

/** Sticky bar height: `p-4` around the `h-12` button plus its top border. */
const SUBMIT_BAR_HEIGHT = 81;

const selectActiveBets = (bets: Bet[]) => bets.filter((bet) => bet.is_active);

/** Web `CreateBetTab` at phone size: one column and a sticky submit bar above the nav. */
export function CreateBetTab() {
  const styles = useStyles();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const offline = useIsOffline();

  // Loaded silently like the web: the pickers just stay empty on failure.
  const categories = useQuery(categoriesQueryOptions()).data ?? [];
  const availableAkoBets = useQuery({ ...adminQueries.activeBets(), select: selectActiveBets }).data ?? EMPTY_BETS;

  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [betType, setBetType] = useState<EditableBetType>('12');
  const [isLive, setIsLive] = useState(false);
  const [isBsplicboost, setIsBsplicboost] = useState(false);
  const [endsAt, setEndsAt] = useState(defaultEndsAt);
  const [options, setOptions] = useState<OptionDraft[]>(() => createFormOptions('12'));
  const [akoExclusions, setAkoExclusions] = useState<BetAkoExclusionDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fixedCount = hasFixedOptionCount(betType);

  const changeBetType = (next: EditableBetType) => {
    setBetType(next);
    setOptions((previous) => createFormOptions(next, previous));
  };

  const updateOption = (key: string, changes: Partial<OptionDraft>) =>
    setOptions((current) => current.map((option) => (option.key === key ? { ...option, ...changes } : option)));

  const submit = async () => {
    const result = validateNewBet({
      title,
      categoryId,
      betType,
      options,
      endsAt,
      isLive,
      isBsplicboost,
      akoExclusions,
    });
    if (!result.ok) {
      haptics.error();
      toast.error(result.message);
      return;
    }
    if (offline) {
      toast.error(OFFLINE_WRITE_MESSAGE);
      return;
    }

    setSubmitting(true);
    try {
      await createBetWithAkoExclusions(result.value);
      haptics.success();
      toast.success('Zakład utworzony!');
      // Category, type and the live flag carry over to the next bet (web behavior).
      setTitle('');
      setAkoExclusions([]);
      setIsBsplicboost(false);
      setEndsAt(defaultEndsAt());
      setOptions(createFormOptions(betType));
      void queryClient.invalidateQueries({ queryKey: ADMIN_BETS_KEY });
    } catch (err: unknown) {
      haptics.error();
      toast.error(getErrorMessage(err, 'Nie udało się utworzyć zakładu'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <AdminTabScroll offlineNote extraBottomPadding={96 + SUBMIT_BAR_HEIGHT}>
        <View style={styles.stack}>
          <FormCard>
            <Text size="base" weight="600" accessibilityRole="header" style={styles.sectionTitle}>
              Podstawowe informacje
            </Text>

            <View style={styles.field}>
              <CapsLabel>Tytuł zakładu</CapsLabel>
              <Input
                value={title}
                onChangeText={setTitle}
                placeholder="np. Kto wygra mecz Polska - Niemcy?"
                accessibilityLabel="Tytuł zakładu"
              />
            </View>

            <View style={styles.field}>
              <CapsLabel>Kategoria</CapsLabel>
              <SelectField
                value={categoryId}
                options={categories.map((category) => ({
                  value: category.id,
                  label: `${category.emoji} ${category.name}`,
                }))}
                placeholder="Wybierz kategorię"
                accessibilityLabel="Wybierz kategorię"
                onChange={setCategoryId}
              />
            </View>

            <View style={styles.field}>
              <CapsLabel>Typ zakładu</CapsLabel>
              <SelectField
                value={betType}
                options={TYPE_OPTIONS}
                accessibilityLabel="Typ zakładu"
                onChange={changeBetType}
              />
            </View>

            <View style={styles.field}>
              <CapsLabel>Data zakończenia</CapsLabel>
              <DateTimeField value={endsAt} onChange={setEndsAt} accessibilityLabel="Data zakończenia zakładu" />
            </View>
          </FormCard>

          <FormCard>
            <Text size="base" weight="600" accessibilityRole="header" style={styles.sectionTitle}>
              Opcje dodatkowe
            </Text>
            <SwitchRow
              variant="card"
              label="Na żywo"
              description="Oznacz jako wydarzenie live"
              accessibilityLabel="Zakład na żywo"
              value={isLive}
              onValueChange={setIsLive}
            />
            <SwitchRow
              variant="card"
              label="BSPLICBOOST"
              labelColor="primary"
              description="Wyróżnij wyższym kursem"
              accessibilityLabel="Włącz BSPLICBOOST"
              value={isBsplicboost}
              onValueChange={setIsBsplicboost}
            />
          </FormCard>

          <AkoExclusionsEditor
            availableBets={availableAkoBets}
            value={akoExclusions}
            onChange={setAkoExclusions}
            disabled={submitting}
          />

          <FormCard>
            <View style={styles.optionsHeader}>
              <Text size="base" weight="600" accessibilityRole="header">
                Możliwe typy
              </Text>
              {!fixedCount ? (
                <AdminButton
                  tone="outline"
                  label="Dodaj opcję"
                  icon={<Plus size={12} color={colors.foreground} />}
                  onPress={() => setOptions((current) => [...current, newOptionDraft()])}
                  style={styles.addOption}
                />
              ) : null}
            </View>

            <View style={styles.optionList}>
              {options.map((option, index) => (
                <View key={option.key} style={styles.optionRow}>
                  <Input
                    value={option.name}
                    onChangeText={(name) => updateOption(option.key, { name })}
                    placeholder="Nazwa opcji (np. Polska)"
                    accessibilityLabel={`Nazwa opcji ${index + 1}`}
                    style={styles.flex}
                  />
                  <Input
                    value={option.odds}
                    onChangeText={(odds) => updateOption(option.key, { odds })}
                    keyboardType="decimal-pad"
                    placeholder="Kurs"
                    accessibilityLabel={`Kurs opcji ${index + 1}`}
                    style={styles.oddsInput}
                  />
                  {!fixedCount && options.length > 2 ? (
                    <PressScale
                      accessibilityRole="button"
                      accessibilityLabel={`Usuń opcję ${index + 1}`}
                      hitSlop={2}
                      onPress={() => {
                        haptics.selection();
                        setOptions((current) => current.filter((item) => item.key !== option.key));
                      }}
                      style={styles.removeOption}
                    >
                      <X size={16} color={colors.mutedForeground} />
                    </PressScale>
                  ) : null}
                </View>
              ))}
            </View>
          </FormCard>
        </View>
      </AdminTabScroll>

      <SubmitBar submitting={submitting} disabled={submitting || offline} onSubmit={submit} />
    </View>
  );
}

/** `fixed bottom-[calc(5rem+safe)] p-4 bg-background/80 backdrop-blur-md border-t`; follows the nav when it hides. */
function SubmitBar({
  submitting,
  disabled,
  onSubmit,
}: {
  submitting: boolean;
  disabled: boolean;
  onSubmit: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { navHidden } = useAdminChrome();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: navHidden.get() * ADMIN_NAV_RESERVE }],
  }));

  return (
    <Animated.View style={[styles.submitBar, { bottom: ADMIN_NAV_RESERVE + insets.bottom }, animatedStyle]}>
      <Glass tint={alpha(colors.background, 0.8)} fallbackColor={colors.background} blurIntensity={30}>
        <View style={styles.submitInner}>
          <AdminButton
            tone="gradient"
            weight="700"
            size="base"
            label={submitting ? 'Tworzenie...' : 'Utwórz zakład'}
            accessibilityLabel={submitting ? 'Tworzenie zakładu w toku' : 'Utwórz zakład'}
            disabled={disabled}
            onPress={onSubmit}
            style={styles.submitButton}
          />
        </View>
      </Glass>
    </Animated.View>
  );
}

const useStyles = createStyles(({ colors, radius }) => ({
  root: { flex: 1 },
  stack: { gap: 24 },
  sectionTitle: { marginBottom: 8 },
  field: { gap: 8 },
  flex: { flex: 1 },
  optionsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  addOption: { backgroundColor: colors.background },
  optionList: { gap: 12, padding: 4 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  oddsInput: { width: 96, textAlign: 'center', fontWeight: '600', color: colors.primary },
  removeOption: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  submitInner: { padding: 16 },
  submitButton: {
    height: 48,
    borderRadius: 12,
    boxShadow: `0px 10px 15px -3px ${alpha(colors.primary, 0.25)}, 0px 4px 6px -4px ${alpha(colors.primary, 0.25)}`,
  },
}));
