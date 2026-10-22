import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { MenuView } from '@expo/ui/community/menu';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Plus, Trash2, X } from 'lucide-react-native';
import { useRef, useState, type ComponentRef } from 'react';
import { Platform, Pressable, Text as RNText, ScrollView, TextInput, useWindowDimensions, View } from 'react-native';
import { useKeyboardHandler } from 'react-native-keyboard-controller';
import { scheduleOnRN } from 'react-native-worklets';

import { useUser } from '@/features/auth/auth-store';
import { OFFLINE_WRITE_MESSAGE, useIsOffline } from '@/lib/connectivity';
import { haptics } from '@/lib/haptics';
import { toast } from '@/lib/toast';
import { createStyles, useScheme, useTheme } from '@/theme';
import { Button, Field, OverlayScreen, PressScale, Text, useOverlayClose } from '@/ui';
import { getErrorMessage } from '@/lib/errors';
import { createBetProposal } from '../api/bet-proposals';
import { categoriesQueryOptions } from '../api/categories';
import { getCategoryLabel, getCategoryOptions } from '../logic/category-tree';
import {
  getTomorrowAt2359,
  hasFixedOptionCount,
  INITIAL_OPTION_DRAFTS,
  PROPOSAL_TYPES,
  reshapeOptionsForType,
  validateProposalOptions,
  type OptionDraft,
  type ProposalBetType,
} from '../logic/propose-bet';

const MAX_FONT_SCALE = 1.35;
/** DialogContent padding (`p-4`). */
const DIALOG_PADDING = 16;
/** DialogContent border width. */
const DIALOG_BORDER = 1;
/** Space kept between the focused field and the dialog's visible bottom edge. */
const FOCUS_MARGIN = 16;

const defaultEndsAt = () => getTomorrowAt2359(new Date());

const pad2 = (value: number) => String(value).padStart(2, '0');
/** How the web `datetime-local` input shows the value in Polish: `21.10.2026, 23:59`. */
const formatEndsAt = (date: Date) =>
  `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${date.getFullYear()}, ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

/**
 * Web `ProposeBetModal`: `w-[calc(100vw-2rem)] max-w-lg rounded-lg p-4` dialog
 * whose whole content scrolls inside the dialog's max height.
 */
export function ProposeBetSheet() {
  const styles = useStyles();
  const { colors } = useTheme();
  const scheme = useScheme();
  const user = useUser();
  const offline = useIsOffline();
  const close = useOverlayClose();
  const { width: windowWidth } = useWindowDimensions();
  const dialogWidth = Math.min(windowWidth - 32, 512);
  const selectWidth = dialogWidth - DIALOG_BORDER * 2 - DIALOG_PADDING * 2;
  const { data: categories = [] } = useQuery(categoriesQueryOptions());

  const titleRef = useRef<ComponentRef<typeof TextInput>>(null);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const scrollY = useRef(0);
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [betType, setBetType] = useState<ProposalBetType>('12');
  const [endsAt, setEndsAt] = useState(defaultEndsAt);
  const [androidPicker, setAndroidPicker] = useState<'date' | 'time' | null>(null);
  const [options, setOptions] = useState<OptionDraft[]>(INITIAL_OPTION_DRAFTS);
  const [loading, setLoading] = useState(false);

  // The overlay shrinks the dialog above the keyboard; once the keyboard settles,
  // scroll the focused field back into the dialog's visible area.
  const revealFocusedField = () => {
    requestAnimationFrame(() => {
      const input = TextInput.State.currentlyFocusedInput();
      const scroll = scrollRef.current;
      if (!input || !scroll) return;
      scroll.measureInWindow((_scrollX, top, _scrollWidth, height) => {
        input.measureInWindow((_x, y, _width, inputHeight) => {
          const visibleBottom = top + height - FOCUS_MARGIN;
          const delta =
            y + inputHeight > visibleBottom
              ? y + inputHeight - visibleBottom
              : y < top + FOCUS_MARGIN
                ? y - top - FOCUS_MARGIN
                : 0;
          if (delta !== 0) scroll.scrollTo({ y: Math.max(scrollY.current + delta, 0), animated: true });
        });
      });
    });
  };

  useKeyboardHandler(
    {
      onEnd: (event) => {
        'worklet';
        if (event.height > 0) scheduleOnRN(revealFocusedField);
      },
    },
    [],
  );

  const fixedCount = hasFixedOptionCount(betType);
  // Each sport followed by its leagues, labelled "Piłka nożna › Premier League".
  const categoryOptions = getCategoryOptions(categories).map(({ category, parent }) => ({
    id: category.id,
    label: `${category.emoji} ${getCategoryLabel(category, parent)}`,
  }));
  const selectedCategory = categoryOptions.find((option) => option.id === categoryId);
  const typeLabel = PROPOSAL_TYPES.find((type) => type.value === betType)?.label ?? '';

  const changeBetType = (next: ProposalBetType) => {
    setBetType(next);
    setOptions((previous) => reshapeOptionsForType(previous, next));
  };

  const updateOption = (index: number, patch: Partial<OptionDraft>) => {
    setOptions((previous) => previous.map((option, i) => (i === index ? { ...option, ...patch } : option)));
  };

  const pickDatePart = (date: Date) => {
    const next = new Date(endsAt);
    next.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
    setEndsAt(next);
  };

  const pickTimePart = (date: Date) => {
    const next = new Date(endsAt);
    next.setHours(date.getHours(), date.getMinutes(), 0, 0);
    setEndsAt(next);
  };

  const handleSubmit = async () => {
    if (!user || loading) return;
    if (offline) {
      toast.error(OFFLINE_WRITE_MESSAGE);
      return;
    }
    // The web `required` title field blocks an empty submit.
    if (title.length === 0) {
      haptics.warning();
      titleRef.current?.focus();
      return;
    }

    const validation = validateProposalOptions(options, betType);
    if (!validation.ok) {
      haptics.error();
      toast.error(validation.message);
      return;
    }

    setLoading(true);
    try {
      await createBetProposal({
        userId: user.id,
        title,
        categoryId,
        betType,
        options: validation.options,
        endsAt: endsAt.toISOString(),
      });
      haptics.success();
      toast.success('📋 Zakład zaproponowany — czeka na akceptację admina');
      close();
    } catch (error) {
      haptics.error();
      toast.error(getErrorMessage(error, 'Nie udało się wysłać propozycji'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <OverlayScreen
      variant="dialog"
      accessibilityLabel="Zaproponuj zakład"
      style={[styles.card, { width: dialogWidth }]}
      // While the proposal is sent the dialog stays open, so its success closes this dialog and nothing else.
      dismissible={!loading}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        alwaysBounceVertical={false}
        scrollEventThrottle={16}
        onScroll={(event) => {
          scrollY.current = event.nativeEvent.contentOffset.y;
        }}
      >
        {/* DialogHeader is `text-center` below `sm`; title `text-lg font-bold leading-none tracking-tight`. */}
        <Text style={styles.title} accessibilityRole="header">
          Zaproponuj zakład
        </Text>

        <View style={styles.form}>
          <View style={styles.group}>
            <Label>Tytuł</Label>
            <Field ref={titleRef} value={title} onChangeText={setTitle} placeholder="np. Kto wygra El Clasico?" />
          </View>

          <View style={styles.selects}>
            <View style={styles.group}>
              <Label>Kategoria</Label>
              <MenuView
                actions={categoryOptions.map((option) => ({
                  id: option.id,
                  title: option.label,
                  state: option.id === categoryId ? 'on' : 'off',
                }))}
                onPressAction={({ nativeEvent }) => {
                  haptics.selection();
                  setCategoryId(nativeEvent.event);
                }}
                style={{ width: selectWidth }}
              >
                <SelectTrigger
                  width={selectWidth}
                  label={selectedCategory?.label ?? 'Wybierz'}
                  placeholder={!selectedCategory}
                />
              </MenuView>
            </View>

            <View style={styles.group}>
              <Label>Typ</Label>
              <MenuView
                actions={PROPOSAL_TYPES.map((type) => ({
                  id: type.value,
                  title: type.label,
                  state: type.value === betType ? 'on' : 'off',
                }))}
                onPressAction={({ nativeEvent }) => {
                  const next = PROPOSAL_TYPES.find((type) => type.value === nativeEvent.event);
                  if (!next) return;
                  haptics.selection();
                  changeBetType(next.value);
                }}
                style={{ width: selectWidth }}
              >
                <SelectTrigger width={selectWidth} label={typeLabel} placeholder={false} />
              </MenuView>
            </View>
          </View>

          <View style={styles.group}>
            <Label>Data zakończenia</Label>
            {Platform.OS === 'ios' ? (
              <View style={styles.datePickerRow}>
                <DateTimePicker
                  value={endsAt}
                  mode="datetime"
                  display="compact"
                  locale="pl_PL"
                  themeVariant={scheme}
                  accentColor={colors.primary}
                  onValueChange={(_event, date) => {
                    const next = new Date(date);
                    next.setSeconds(0, 0);
                    setEndsAt(next);
                  }}
                />
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Data zakończenia: ${formatEndsAt(endsAt)}`}
                onPress={() => setAndroidPicker('date')}
                style={styles.inputBox}
              >
                <RNText maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.inputText}>
                  {formatEndsAt(endsAt)}
                </RNText>
              </Pressable>
            )}
            {androidPicker === 'date' ? (
              <DateTimePicker
                value={endsAt}
                mode="date"
                presentation="dialog"
                onValueChange={(_event, date) => {
                  pickDatePart(date);
                  setAndroidPicker('time');
                }}
                onDismiss={() => setAndroidPicker(null)}
              />
            ) : null}
            {androidPicker === 'time' ? (
              <DateTimePicker
                value={endsAt}
                mode="time"
                is24Hour
                presentation="dialog"
                onValueChange={(_event, date) => {
                  pickTimePart(date);
                  setAndroidPicker(null);
                }}
                onDismiss={() => setAndroidPicker(null)}
              />
            ) : null}
          </View>

          <View style={styles.group}>
            <Label>Opcje</Label>
            {options.map((option, index) => (
              <View key={index} style={styles.optionRow}>
                <Field
                  value={option.name}
                  onChangeText={(name) => updateOption(index, { name })}
                  placeholder={`Opcja ${index + 1}`}
                  containerStyle={styles.optionName}
                />
                <Field
                  value={option.odds}
                  onChangeText={(odds) => updateOption(index, { odds })}
                  placeholder="Kurs"
                  keyboardType="decimal-pad"
                  containerStyle={styles.optionOdds}
                />
                {!fixedCount && options.length > 2 ? (
                  <PressScale
                    accessibilityRole="button"
                    accessibilityLabel={`Usuń opcję ${index + 1}`}
                    onPress={() => setOptions((previous) => previous.filter((_, i) => i !== index))}
                    style={styles.removeButton}
                  >
                    <Trash2 size={16} color={colors.destructive} />
                  </PressScale>
                ) : null}
              </View>
            ))}
            {!fixedCount ? (
              <Button
                variant="outline"
                size="sm"
                fullWidth
                label="Dodaj opcję"
                icon={<Plus size={16} color={colors.foreground} />}
                onPress={() => setOptions((previous) => [...previous, { name: '', odds: '2' }])}
              />
            ) : null}
          </View>

          {offline ? (
            <Text color="mutedForeground" align="center">
              {OFFLINE_WRITE_MESSAGE}
            </Text>
          ) : null}
          <Button
            variant="gradient"
            fullWidth
            label={loading ? 'Wysyłanie...' : 'Wyślij propozycję'}
            disabled={loading || offline}
            onPress={() => void handleSubmit()}
          />
        </View>

        {/* DialogPrimitive.Close: `absolute right-4 top-4 opacity-70`, 16 px X, no background. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Zamknij"
          hitSlop={14}
          disabled={loading}
          onPress={() => close()}
          style={styles.close}
        >
          <X size={16} color={colors.foreground} />
        </Pressable>
      </ScrollView>
    </OverlayScreen>
  );
}

/** shadcn `Label`: `text-sm font-medium leading-none`. */
function Label({ children }: { children: string }) {
  const styles = useStyles();
  return <Text style={styles.label}>{children}</Text>;
}

/** shadcn `SelectTrigger`: input-like box with the value and a chevron. */
function SelectTrigger({ width, label, placeholder }: { width: number; label: string; placeholder: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={[styles.inputBox, styles.selectBox, { width }]}>
      <RNText
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        numberOfLines={1}
        style={[styles.selectText, placeholder && styles.placeholderText]}
      >
        {label}
      </RNText>
      <ChevronDown size={16} color={colors.foreground} style={styles.chevron} />
    </View>
  );
}

const useStyles = createStyles(({ colors, radius }) => ({
  card: { maxWidth: 512, borderRadius: radius.lg },
  scroll: { flexGrow: 0, flexShrink: 1 },
  // `p-4 grid gap-4`.
  content: { padding: DIALOG_PADDING, gap: 16 },
  title: { fontSize: 18, lineHeight: 18, fontWeight: '700', letterSpacing: -0.45, textAlign: 'center' },
  close: { position: 'absolute', top: 16, right: 16, opacity: 0.7 },
  // `space-y-4`.
  form: { gap: 16 },
  label: { fontSize: 14, lineHeight: 14, fontWeight: '500' },
  selects: { gap: 12 },
  group: { gap: 8 },
  inputBox: {
    height: 40,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.input,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  inputText: { fontFamily: 'Inter', fontSize: 16, color: colors.foreground },
  selectBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  selectText: { flex: 1, fontFamily: 'Inter', fontSize: 14, lineHeight: 20, color: colors.foreground },
  placeholderText: { color: colors.mutedForeground },
  chevron: { opacity: 0.5 },
  datePickerRow: { flexDirection: 'row', alignItems: 'center', minHeight: 40 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  optionName: { flex: 1 },
  optionOdds: { width: 96 },
  removeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
}));
