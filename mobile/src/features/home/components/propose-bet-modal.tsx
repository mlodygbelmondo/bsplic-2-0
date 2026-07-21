import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';

import { AppButton, AppInput, AppModal, AppText } from '@/components/ui';
import { createBetProposal } from '@/features/home/api/betProposals';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useAuth } from '@/providers/auth-provider';
import { useNetwork } from '@/providers/network-provider';
import type { Category } from '@/types/database';

type BetType = 'single' | '12' | '1x2' | 'multi';

interface OptionDraft {
  name: string;
  odds: string;
}

interface ProposeBetModalProps {
  visible: boolean;
  categories: Category[];
  onClose(): void;
}

const FIXED_OPTION_COUNTS: Partial<Record<BetType, number>> = {
  single: 1,
  '12': 2,
  '1x2': 3,
};

const OPTION_DEFAULTS: Record<BetType, string[]> = {
  single: ['1'],
  '12': ['1', '2'],
  '1x2': ['1', 'X', '2'],
  multi: ['', ''],
};

const DEFAULT_OPTIONS: OptionDraft[] = [
  { name: '1', odds: '2' },
  { name: '2', odds: '2' },
];

function tomorrowAt2359(): Date {
  const value = new Date();
  value.setDate(value.getDate() + 1);
  value.setHours(23, 59, 0, 0);
  return value;
}

function formatDateTime(value: Date): string {
  const part = (number: number) => String(number).padStart(2, '0');
  return `${part(value.getDate())}.${part(value.getMonth() + 1)}.${value.getFullYear()} ${part(value.getHours())}:${part(value.getMinutes())}`;
}

function parseDateTime(value: string): Date | null {
  const match = value.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})$/);
  if (!match) return null;

  const [, day, month, year, hour, minute] = match.map(Number);
  const parsed = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day ||
    parsed.getHours() !== hour ||
    parsed.getMinutes() !== minute
  ) return null;

  return parsed;
}

export function ProposeBetModal({ visible, categories, onClose }: ProposeBetModalProps) {
  const { tokens } = useAppTheme();
  const { user } = useAuth();
  const { canPerformWrites, isOnline } = useNetwork();
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [betType, setBetType] = useState<BetType>('12');
  const [endsAt, setEndsAt] = useState(() => formatDateTime(tomorrowAt2359()));
  const [options, setOptions] = useState<OptionDraft[]>(DEFAULT_OPTIONS);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const optionCount = FIXED_OPTION_COUNTS[betType];
    if (optionCount) {
      setOptions((previous) =>
        Array.from({ length: optionCount }, (_, index) => ({
          name: previous[index]?.name || OPTION_DEFAULTS[betType][index] || '',
          odds: previous[index]?.odds || (betType === '1x2' && index === 1 ? '3' : '2'),
        })),
      );
      return;
    }

    setOptions((previous) =>
      previous.length >= 2
        ? previous
        : OPTION_DEFAULTS.multi.map((name) => ({ name, odds: '2' })),
    );
  }, [betType]);

  const updateOption = (index: number, patch: Partial<OptionDraft>) => {
    setOptions((current) =>
      current.map((option, optionIndex) =>
        optionIndex === index ? { ...option, ...patch } : option,
      ),
    );
  };

  const reset = () => {
    setTitle('');
    setCategoryId(null);
    setBetType('12');
    setEndsAt(formatDateTime(tomorrowAt2359()));
    setOptions(DEFAULT_OPTIONS);
    setFormError(null);
  };

  const submit = async () => {
    setFormError(null);
    if (!canPerformWrites) {
      setFormError(
        isOnline === null
          ? 'Sprawdzamy połączenie. Spróbuj ponownie za chwilę.'
          : 'Propozycje nie są kolejkowane offline. Połącz się z internetem.',
      );
      return;
    }
    if (!user) {
      setFormError('Sesja wygasła. Zaloguj się ponownie.');
      return;
    }
    if (!title.trim()) {
      setFormError('Podaj tytuł zakładu.');
      return;
    }

    const parsedEndsAt = parseDateTime(endsAt);
    if (!parsedEndsAt || parsedEndsAt.getTime() <= Date.now()) {
      setFormError('Podaj przyszłą datę w formacie DD.MM.RRRR GG:MM.');
      return;
    }

    const preparedOptions = options.map((option) => ({
      name: option.name.trim(),
      oddsRaw: option.odds.trim().replace(',', '.'),
    }));
    if (preparedOptions.some((option) => !option.name)) {
      setFormError('Uzupełnij etykiety wszystkich opcji.');
      return;
    }
    if (preparedOptions.length < (betType === 'single' ? 1 : 2)) {
      setFormError(betType === 'single' ? 'Dodaj co najmniej 1 opcję.' : 'Dodaj co najmniej 2 opcje.');
      return;
    }
    const invalidOddsIndex = preparedOptions.findIndex(({ oddsRaw }) => {
      const odds = Number(oddsRaw);
      return !oddsRaw || !Number.isFinite(odds) || odds <= 0;
    });
    if (invalidOddsIndex !== -1) {
      setFormError(`Podaj poprawny kurs dla opcji ${invalidOddsIndex + 1}.`);
      return;
    }

    setLoading(true);
    try {
      await createBetProposal({
        userId: user.id,
        title: title.trim(),
        categoryId,
        betType,
        options: preparedOptions.map((option) => ({
          name: option.name,
          odds: Number(option.oddsRaw),
        })),
        endsAt: parsedEndsAt.toISOString(),
      });
      reset();
      onClose();
      Alert.alert('Propozycja wysłana', 'Zakład czeka na akceptację administratora.');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Nie udało się wysłać propozycji.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppModal visible={visible} title="Zaproponuj zakład" onClose={() => !loading && onClose()}>
      <View style={{ gap: 14 }}>
        <AppInput
          label="Tytuł"
          value={title}
          onChangeText={setTitle}
          placeholder="np. Kto wygra El Clasico?"
          editable={!loading}
          returnKeyType="next"
        />

        <View style={{ gap: 7 }}>
          <AppText variant="label">Kategoria (opcjonalnie)</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <ChoicePill label="Bez kategorii" selected={!categoryId} onPress={() => setCategoryId(null)} disabled={loading} />
            {categories.map((category) => (
              <ChoicePill
                key={category.id}
                label={`${category.emoji} ${category.name}`}
                selected={categoryId === category.id}
                onPress={() => setCategoryId(category.id)}
                disabled={loading}
              />
            ))}
          </ScrollView>
        </View>

        <View style={{ gap: 7 }}>
          <AppText variant="label">Typ</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {([['single', 'Single'], ['12', '1/2'], ['1x2', '1X2'], ['multi', 'Multi']] as Array<[BetType, string]>).map(([value, label]) => (
              <ChoicePill key={value} label={label} selected={betType === value} onPress={() => setBetType(value)} disabled={loading} />
            ))}
          </View>
        </View>

        <AppInput
          label="Data zakończenia"
          helperText="Format: DD.MM.RRRR GG:MM"
          value={endsAt}
          onChangeText={setEndsAt}
          placeholder="31.12.2026 23:59"
          keyboardType="numbers-and-punctuation"
          editable={!loading}
        />

        <View style={{ gap: 8 }}>
          <AppText variant="label">Opcje</AppText>
          {options.map((option, index) => (
            <View key={index} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <AppInput
                  accessibilityLabel={`Nazwa opcji ${index + 1}`}
                  value={option.name}
                  onChangeText={(name) => updateOption(index, { name })}
                  placeholder={`Opcja ${index + 1}`}
                  editable={!loading}
                />
              </View>
              <View style={{ width: 88 }}>
                <AppInput
                  accessibilityLabel={`Kurs opcji ${index + 1}`}
                  value={option.odds}
                  onChangeText={(odds) => updateOption(index, { odds })}
                  placeholder="Kurs"
                  keyboardType="decimal-pad"
                  editable={!loading}
                />
              </View>
              {!FIXED_OPTION_COUNTS[betType] && options.length > 2 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Usuń opcję ${index + 1}`}
                  disabled={loading}
                  onPress={() => setOptions((current) => current.filter((_, optionIndex) => optionIndex !== index))}
                  style={{ minHeight: 48, minWidth: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <AppText variant="title" tone="danger">×</AppText>
                </Pressable>
              ) : null}
            </View>
          ))}
          {!FIXED_OPTION_COUNTS[betType] ? (
            <AppButton
              variant="outline"
              disabled={loading}
              onPress={() => setOptions((current) => [...current, { name: '', odds: '2' }])}>
              + Dodaj opcję
            </AppButton>
          ) : null}
        </View>

        {formError ? (
          <View style={{ borderRadius: 12, backgroundColor: tokens.colors.secondary, padding: 12 }}>
            <AppText variant="caption" tone="danger">{formError}</AppText>
          </View>
        ) : null}

        <AppButton
          fullWidth
          loading={loading}
          disabled={!canPerformWrites}
          onPress={() => void submit()}>
          {canPerformWrites ? 'Wyślij propozycję' : isOnline === null ? 'Sprawdzanie połączenia…' : 'Brak internetu'}
        </AppButton>
      </View>
    </AppModal>
  );
}

function ChoicePill({
  label,
  selected,
  onPress,
  disabled,
}: {
  label: string;
  selected: boolean;
  onPress(): void;
  disabled: boolean;
}) {
  const { tokens } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: 42,
        justifyContent: 'center',
        borderRadius: 999,
        borderWidth: 1,
        borderColor: selected ? tokens.colors.primary : tokens.colors.border,
        backgroundColor: selected ? tokens.colors.secondary : tokens.colors.card,
        paddingHorizontal: 14,
        opacity: disabled ? 0.5 : 1,
      }}>
      <AppText variant="caption" style={{ color: selected ? tokens.colors.primary : tokens.colors.foreground }}>
        {label}
      </AppText>
    </Pressable>
  );
}
