import { randomUUID } from 'expo-crypto';
import { ArrowLeft, Clock3, Search, Send, ShieldCheck, WifiOff } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  TextInput,
  View,
  type HostInstance,
  type LayoutRectangle,
  type ScrollViewInstance,
  type TextInputFocusEvent,
} from 'react-native';

import { authActions } from '@/features/auth/auth-store';
import { OFFLINE_WRITE_MESSAGE, useIsOffline } from '@/lib/connectivity';
import { getErrorMessage, isOutcomeUnknown } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { queryClient } from '@/lib/query-client';
import { toast } from '@/lib/toast';
import { alpha, createStyles, useTheme } from '@/theme';
import { Avatar, Text } from '@/ui';
import {
  createMoneyTransfer,
  fetchMoneyTransferRules,
  resolveTransferRecipient,
  searchMoneyTransferRecipients,
} from './api/transfers';
import { formatMoney, formatTransferDate, parseMoney, toAmountInput } from './format';
import { GradientButton } from './GradientButton';
import { getEffectiveRules, getSenderEligibility, getTransferValidationError, messageLengthOf } from './send-rules';
import type { MoneyTransferRecipient, MoneyTransferRules } from './types';

const AMBER_700 = '#b45309';
const AMBER_500 = '#f59e0b';
/** Space kept between a focused field and the edge of the dialog's scroll area. */
const REVEAL_MARGIN = 16;

interface MoneyTransferSendProps {
  balance: number;
  profileCreatedAt: string;
  /** Recipient user id to preselect (route param `recipient`). */
  initialRecipientId?: string;
  onCompleted: () => void;
  onSubmittingChange: (submitting: boolean) => void;
}

/** Port of the web `MoneyTransferSend`: rules, recipient search, amount, message, review, submit. */
export function MoneyTransferSend({
  balance,
  profileCreatedAt,
  initialRecipientId,
  onCompleted,
  onSubmittingChange,
}: MoneyTransferSendProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const offline = useIsOffline();

  const [query, setQuery] = useState('');
  const [recipients, setRecipients] = useState<MoneyTransferRecipient[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<MoneyTransferRecipient | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [amountInput, setAmountInput] = useState('');
  const [message, setMessage] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [rules, setRules] = useState<MoneyTransferRules | null>(null);
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [rulesRequest, setRulesRequest] = useState(0);
  const [recipientFieldLayout, setRecipientFieldLayout] = useState<LayoutRectangle | null>(null);
  // The dialog shrinks above the keyboard (OverlayScreen's KeyboardAvoidingView), so the
  // focused field is scrolled back into the remaining viewport on focus and on every resize.
  const scrollRef = useRef<ScrollViewInstance>(null);
  const contentRef = useRef<HostInstance>(null);
  const focusedInput = useRef<HostInstance | null>(null);
  const scrollY = useRef(0);
  const viewportHeight = useRef(0);
  // Only the pre-rules estimate reads the clock; Continue stays disabled until rules load.
  const [openedAt] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    fetchMoneyTransferRules()
      .then((next) => {
        if (cancelled) return;
        setRulesError(null);
        setRules(next);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setRules(null);
        const text = getErrorMessage(error, 'Nie udało się pobrać zasad transferów');
        setRulesError(text);
        toast.error(text);
      });
    return () => {
      cancelled = true;
    };
  }, [rulesRequest]);

  useEffect(() => {
    if (!initialRecipientId) return;
    let cancelled = false;
    resolveTransferRecipient(initialRecipientId)
      .then(({ recipient, username }) => {
        if (cancelled) return;
        if (recipient) setSelectedRecipient(recipient);
        else if (username) setQuery(username);
      })
      .catch((error: unknown) => console.warn('Transfer recipient preselect failed:', error));
    return () => {
      cancelled = true;
    };
  }, [initialRecipientId]);

  const { minAmount, messageLimit, maxTransfersPerHour, minAccountAgeDays } = getEffectiveRules(rules);
  const amount = parseMoney(amountInput);
  const messageLength = messageLengthOf(message);
  const balanceAfter = amount === null ? balance : balance - amount;
  const eligibility = getSenderEligibility(rules, profileCreatedAt, openedAt);
  const accountIsTooNew = eligibility.tooNew;
  const trimmedQuery = query.trim();
  const showDropdown = !selectedRecipient && trimmedQuery.length >= 2;

  // Re-armed for every rules snapshot, so a still-ineligible answer schedules another check.
  const refetchRulesInMs = eligibility.refetchRulesInMs;
  useEffect(() => {
    if (refetchRulesInMs === null) return;
    const timeoutId = setTimeout(() => setRulesRequest((current) => current + 1), refetchRulesInMs);
    return () => clearTimeout(timeoutId);
  }, [refetchRulesInMs, rules]);

  useEffect(() => {
    if (selectedRecipient || trimmedQuery.length < 2) return;

    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const results = await searchMoneyTransferRecipients(trimmedQuery);
        if (!cancelled) setRecipients(results);
      } catch (error) {
        if (!cancelled) {
          setRecipients([]);
          setSearchError(getErrorMessage(error, 'Nie udało się wyszukać użytkowników'));
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [trimmedQuery, selectedRecipient]);

  const handleQueryChange = (next: string) => {
    setQuery(next);
    if (next.trim().length < 2) {
      setRecipients([]);
      setSearchError(null);
      setSearching(false);
    }
  };

  const getValidationError = () =>
    getTransferValidationError({
      rules,
      rulesFailed: rulesError !== null,
      hasRecipient: selectedRecipient !== null,
      amount,
      balance,
      messageLength,
      tooNew: accountIsTooNew,
    });

  const handleContinue = () => {
    if (offline) {
      toast.error(OFFLINE_WRITE_MESSAGE);
      return;
    }
    const validationError = getValidationError();
    if (validationError) {
      haptics.error();
      toast.error(validationError);
      return;
    }
    setIdempotencyKey(randomUUID());
    setConfirming(true);
  };

  const handleSubmit = async () => {
    if (!selectedRecipient || amount === null || !idempotencyKey) return;
    if (offline) {
      toast.error(OFFLINE_WRITE_MESSAGE);
      return;
    }
    const validationError = getValidationError();
    if (validationError) {
      setConfirming(false);
      setIdempotencyKey(null);
      haptics.error();
      toast.error(validationError);
      return;
    }

    setSubmitting(true);
    onSubmittingChange(true);
    try {
      const transfer = await createMoneyTransfer({
        recipientId: selectedRecipient.id,
        amount,
        message,
        idempotencyKey,
      });

      authActions.updateProfileBalance(transfer.balance_after);
      haptics.success();
      toast.success(`Wysłano ${formatMoney(amount)} zł do @${selectedRecipient.username}`);
      onCompleted();
      void authActions.refreshProfile().catch((error: unknown) => {
        console.warn('Post-transfer profile refresh failed:', error);
      });
    } catch (error) {
      haptics.error();
      // A timeout or dropped connection may still have sent it. The key stays, so
      // sending again from this screen cannot transfer twice.
      toast.error(
        isOutcomeUnknown(error)
          ? 'Nie udało się potwierdzić transferu. Sprawdź historię, zanim wyślesz go ponownie.'
          : getErrorMessage(error, 'Nie udało się wykonać transferu'),
      );
      // The balance may have changed elsewhere (another device): show the server's.
      void authActions.refreshProfile();
      void queryClient.invalidateQueries({ queryKey: ['money-transfer-history'] });
    } finally {
      setSubmitting(false);
      onSubmittingChange(false);
    }
  };

  const revealFocused = () => {
    const input = focusedInput.current;
    const content = contentRef.current;
    if (!input || !content || viewportHeight.current === 0) return;
    input.measureLayout(content, (_x, y, _width, fieldHeight) => {
      const top = y - REVEAL_MARGIN;
      const bottom = y + fieldHeight + REVEAL_MARGIN;
      if (bottom > scrollY.current + viewportHeight.current) {
        scrollRef.current?.scrollTo({ y: Math.min(top, bottom - viewportHeight.current), animated: true });
      } else if (top < scrollY.current) {
        scrollRef.current?.scrollTo({ y: Math.max(0, top), animated: true });
      }
    });
  };

  const handleFieldFocus = (event: TextInputFocusEvent) => {
    focusedInput.current = typeof event.currentTarget === 'number' ? null : event.currentTarget;
    revealFocused();
  };
  const handleFieldBlur = () => {
    focusedInput.current = null;
  };

  if (confirming && selectedRecipient && amount !== null) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: submitting }}
          disabled={submitting}
          hitSlop={12}
          onPress={() => {
            setConfirming(false);
            setIdempotencyKey(null);
          }}
          style={({ pressed }) => [styles.back, (pressed || submitting) && styles.backDim]}
        >
          <ArrowLeft size={16} color={colors.mutedForeground} />
          <Text weight="500" color="mutedForeground">
            Wróć
          </Text>
        </Pressable>

        <View style={styles.summary}>
          <Text size="xs" weight="600" color="mutedForeground" style={styles.summaryCaption}>
            Sprawdź transfer
          </Text>
          <View style={styles.summaryRow}>
            <Avatar uri={selectedRecipient.avatar_url} name={selectedRecipient.username} size={44} />
            <View style={styles.flexText}>
              <Text size="base" weight="600" numberOfLines={1}>
                @{selectedRecipient.username}
              </Text>
              <Text size="xs" color="mutedForeground">
                Odbiorca
              </Text>
            </View>
            <Text size="lg" weight="900" color="primary" tabular>
              {formatMoney(amount)} zł
            </Text>
          </View>
          {message.trim() ? (
            <Text color="mutedForeground" style={styles.summaryMessage}>
              {message.trim()}
            </Text>
          ) : null}
        </View>

        <View style={styles.balanceRow}>
          <Text color="mutedForeground">Saldo po transferze</Text>
          <Text weight="700" tabular>
            {formatMoney(balanceAfter)} zł
          </Text>
        </View>

        <View style={styles.warning}>
          <ShieldCheck size={16} color={AMBER_700} style={styles.noteIcon} />
          <Text size="xs" style={styles.warningText}>
            Transfer zostanie wykonany natychmiast i nie można go cofnąć.
          </Text>
        </View>

        {offline ? <OfflineNote /> : null}

        <GradientButton
          label={submitting ? 'Wysyłanie...' : `Wyślij ${formatMoney(amount)} zł`}
          disabled={submitting || offline}
          onPress={() => void handleSubmit()}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      keyboardShouldPersistTaps="handled"
      scrollEventThrottle={16}
      onScroll={(event) => {
        scrollY.current = event.nativeEvent.contentOffset.y;
      }}
      onLayout={(event) => {
        viewportHeight.current = event.nativeEvent.layout.height;
        revealFocused();
      }}
    >
      <View ref={contentRef} style={styles.content}>
        <View style={styles.form}>
          {rulesError ? (
            <View style={styles.rulesError}>
              <Text color="destructive">{rulesError}</Text>
              <Pressable
                accessibilityRole="button"
                hitSlop={12}
                onPress={() => {
                  setRulesError(null);
                  setRulesRequest((current) => current + 1);
                }}
              >
                <Text weight="600" color="destructive" style={styles.retryLink}>
                  Spróbuj ponownie
                </Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.field} onLayout={(event) => setRecipientFieldLayout(event.nativeEvent.layout)}>
            <Text weight="600">
              Odbiorca
            </Text>
            {selectedRecipient ? (
              <View style={styles.selected}>
                <Avatar uri={selectedRecipient.avatar_url} name={selectedRecipient.username} size={36} />
                <View style={styles.flexText}>
                  <Text weight="600" numberOfLines={1}>
                    @{selectedRecipient.username}
                  </Text>
                  <Text size="xs" color="mutedForeground">
                    Wybrany odbiorca
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  hitSlop={14}
                  onPress={() => {
                    haptics.selection();
                    setSelectedRecipient(null);
                    handleQueryChange('');
                  }}
                >
                  <Text size="xs" weight="600" color="primary">
                    Zmień
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.input}>
                <Search size={16} color={colors.mutedForeground} style={styles.searchIcon} />
                <TextInput
                  onFocus={handleFieldFocus}
                  onBlur={handleFieldBlur}
                  accessibilityLabel="Odbiorca"
                  maxFontSizeMultiplier={1.35}
                  value={query}
                  onChangeText={handleQueryChange}
                  placeholder="Wpisz nazwę użytkownika"
                  placeholderTextColor={colors.mutedForeground}
                  autoComplete="off"
                  autoCorrect={false}
                  autoCapitalize="none"
                  spellCheck={false}
                  returnKeyType="search"
                  style={[styles.inputText, styles.searchInputText]}
                />
              </View>
            )}
          </View>

          <View style={styles.field}>
            <View style={styles.labelRow}>
              <Text weight="600">Kwota</Text>
              <Pressable
                accessibilityRole="button"
                hitSlop={12}
                onPress={() => {
                  haptics.selection();
                  setAmountInput(toAmountInput(balance));
                }}
              >
                <Text size="xs" weight="600" color="primary">
                  Wyślij całe saldo
                </Text>
              </Pressable>
            </View>
            <View style={styles.input}>
              <Text weight="600" color="mutedForeground" style={styles.amountSuffix}>
                zł
              </Text>
              <TextInput
                onFocus={handleFieldFocus}
                onBlur={handleFieldBlur}
                accessibilityLabel="Kwota"
                maxFontSizeMultiplier={1.35}
                value={amountInput}
                onChangeText={setAmountInput}
                placeholder="0,00"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="decimal-pad"
                style={[styles.inputText, styles.amountInputText]}
              />
            </View>
            <Text size="xs" color="mutedForeground">
              Minimum {formatMoney(minAmount)} zł · maksymalnie {maxTransfersPerHour} transferów w ciągu godziny
            </Text>
          </View>

          <View style={styles.field}>
            <View style={styles.labelRow}>
              <Text weight="600">
                Wiadomość{' '}
                <Text weight="400" color="mutedForeground">
                  (opcjonalnie)
                </Text>
              </Text>
              {messageLength >= messageLimit - 200 ? (
                <Text size="xs" color="mutedForeground" tabular>
                  {messageLength}/{messageLimit}
                </Text>
              ) : null}
            </View>
            <TextInput
              onFocus={handleFieldFocus}
              onBlur={handleFieldBlur}
              accessibilityLabel="Wiadomość (opcjonalnie)"
              maxFontSizeMultiplier={1.35}
              onContentSizeChange={revealFocused}
              value={message}
              onChangeText={(next) => {
                if (messageLengthOf(next) <= messageLimit) setMessage(next);
              }}
              multiline
              placeholder="Dodaj krótką wiadomość..."
              placeholderTextColor={colors.mutedForeground}
              textAlignVertical="top"
              style={styles.textarea}
            />
          </View>

          {accountIsTooNew && eligibility.eligibleAt !== null ? (
            <View style={styles.note}>
              <Clock3 size={16} color={colors.mutedForeground} style={styles.noteIcon} />
              <Text size="xs" color="mutedForeground" style={styles.flexText}>
                Transfery będą dostępne {formatTransferDate(new Date(eligibility.eligibleAt).toISOString())}, po{' '}
                {minAccountAgeDays} dniach od utworzenia konta.
              </Text>
            </View>
          ) : null}

          {offline ? <OfflineNote /> : null}

          <GradientButton
            label={rules ? 'Dalej' : rulesError ? 'Zasady niedostępne' : 'Ładowanie zasad...'}
            icon={<Send size={16} color={colors.primaryForeground} />}
            disabled={!rules || accountIsTooNew || offline}
            onPress={handleContinue}
          />

          {showDropdown && recipientFieldLayout ? (
            <View style={[styles.dropdown, { top: recipientFieldLayout.y + recipientFieldLayout.height + 4 }]}>
              <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                {searching ? (
                  <Text color="mutedForeground" align="center" style={styles.dropdownMessage}>
                    Szukam...
                  </Text>
                ) : searchError ? (
                  <Text color="destructive" align="center" style={styles.dropdownMessage}>
                    {searchError}
                  </Text>
                ) : recipients.length === 0 ? (
                  <Text color="mutedForeground" align="center" style={styles.dropdownMessage}>
                    Brak dostępnych użytkowników
                  </Text>
                ) : (
                  recipients.map((recipient) => (
                    <Pressable
                      key={recipient.id}
                      accessibilityRole="button"
                      onPress={() => {
                        haptics.selection();
                        setSelectedRecipient(recipient);
                      }}
                      style={({ pressed }) => [styles.result, pressed && styles.resultPressed]}
                    >
                      <Avatar uri={recipient.avatar_url} name={recipient.username} size={32} recyclingKey={recipient.id} />
                      <Text weight="500">@{recipient.username}</Text>
                    </Pressable>
                  ))
                )}
              </ScrollView>
            </View>
          ) : null}
        </View>
      </View>
    </ScrollView>
  );
}

function OfflineNote() {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.note} accessibilityLiveRegion="polite">
      <WifiOff size={16} color={colors.mutedForeground} style={styles.noteIcon} />
      <Text size="xs" color="mutedForeground" style={styles.flexText}>
        {OFFLINE_WRITE_MESSAGE}
      </Text>
    </View>
  );
}

const useStyles = createStyles(({ colors, radius, scheme }) => ({
  // TabsContent px-5 pb-5 pt-4.
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, gap: 16 },
  form: { gap: 16 },
  field: { gap: 8 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  flexText: { flex: 1, minWidth: 0 },
  rulesError: {
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: alpha(colors.destructive, 0.4),
    backgroundColor: alpha(colors.destructive, 0.1),
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  retryLink: { marginTop: 4, textDecorationLine: 'underline' },
  input: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.input,
    backgroundColor: colors.background,
  },
  inputText: {
    flex: 1,
    alignSelf: 'stretch',
    paddingHorizontal: 12,
    paddingVertical: 0,
    fontFamily: 'Inter',
    fontSize: 16,
    color: colors.foreground,
  },
  searchIcon: { position: 'absolute', left: 12 },
  searchInputText: { paddingLeft: 36 },
  amountInputText: { paddingRight: 48, fontSize: 18, fontWeight: '700' },
  amountSuffix: { position: 'absolute', right: 12 },
  textarea: {
    minHeight: 80,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.input,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    fontFamily: 'Inter',
    fontSize: 14,
    lineHeight: 20,
    color: colors.foreground,
  },
  selected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: alpha(colors.primary, 0.25),
    backgroundColor: alpha(colors.primary, 0.05),
    padding: 12,
  },
  dropdown: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 20,
    maxHeight: 224,
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.popover,
    padding: 4,
    boxShadow: '0px 10px 15px -3px rgba(0, 0, 0, 0.1), 0px 4px 6px -4px rgba(0, 0, 0, 0.1)',
  },
  dropdownMessage: { paddingHorizontal: 12, paddingVertical: 16 },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 44,
  },
  resultPressed: { backgroundColor: colors.muted },
  note: {
    flexDirection: 'row',
    gap: 8,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.muted,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  noteIcon: { marginTop: 2 },
  back: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4 },
  backDim: { opacity: 0.6 },
  summary: {
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: alpha(colors.border, 0.72),
    backgroundColor: alpha(colors.muted, scheme === 'light' ? 0.6 : 0.52),
    padding: 16,
  },
  summaryCaption: { marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.3 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  summaryMessage: {
    marginTop: 16,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    backgroundColor: alpha(colors.background, 0.8),
    padding: 12,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: alpha(colors.border, 0.6),
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  warning: {
    flexDirection: 'row',
    gap: 8,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    backgroundColor: alpha(AMBER_500, 0.1),
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  warningText: { flex: 1, color: AMBER_700 },
}));
