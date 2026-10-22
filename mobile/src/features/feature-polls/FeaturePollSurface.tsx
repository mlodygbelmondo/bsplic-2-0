import { Circle, Vote } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import Animated, { Easing, FadeOut, Keyframe, LinearTransition } from 'react-native-reanimated';

import { useAuthStore, useUserId } from '@/features/auth/auth-store';
import { useBootVisible } from '@/features/boot/boot-store';
import { OFFLINE_WRITE_MESSAGE, useIsOffline } from '@/lib/connectivity';
import { useModalRouteOpen } from '@/lib/focus';
import { getErrorMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { queryClient } from '@/lib/query-client';
import { toast } from '@/lib/toast';
import { alpha, createStyles, useTheme } from '@/theme';
import { DialogModal, PressScale, Text } from '@/ui';
import { featurePollQueries, submitFeaturePollVote } from './feature-poll-api';
import { setFeaturePollOpen } from './feature-poll-store';
import { useQueryErrorToast } from './use-query-error-toast';
import type { AvailableFeaturePoll } from './types';

const OTHER_VALUE = '__other__';

/** Web: `initial { opacity: 0, y: 8 }` → `animate { opacity: 1, y: 0 }`. */
const CONTENT_ENTER = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: 8 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }], easing: Easing.out(Easing.cubic) },
}).duration(300);

/** Web other panel: height/opacity/y, 0.2 s easeOut. */
const OTHER_PANEL_ENTER = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: -4 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }], easing: Easing.out(Easing.ease) },
}).duration(200);

const LAYOUT = LinearTransition.duration(200).easing(Easing.out(Easing.ease));

/**
 * Mandatory feature poll (web `FeaturePollSurface`): a dialog that only a
 * successful vote closes. Mounted once in the root layout for signed-in users.
 */
export function FeaturePollSurface() {
  const userId = useUserId();
  const hasProfile = useAuthStore((s) => s.profile !== null);
  const bootVisible = useBootVisible();
  const modalRouteOpen = useModalRouteOpen();
  const query = useQuery({
    ...featurePollQueries.available(userId ?? ''),
    enabled: userId !== null && hasProfile,
  });
  useQueryErrorToast(query.error, query.errorUpdatedAt, 'Nie udało się sprawdzić głosowań');

  // Never trust a poll restored from the persisted cache: it may already be answered.
  const poll = query.isFetchedAfterMount && !query.isError ? (query.data ?? null) : null;
  const open = Boolean(userId && hasProfile && poll && !bootVisible && !modalRouteOpen);

  useEffect(() => {
    setFeaturePollOpen(open);
    return () => setFeaturePollOpen(false);
  }, [open]);

  if (!userId || !hasProfile || !poll) return null;

  return (
    <DialogModal
      visible={open}
      // Non-dismissable: Android back does nothing (web blocks Escape and outside clicks).
      onRequestClose={() => undefined}
      maxWidth={480}
      accessibilityLabel={poll.title_enabled !== false ? poll.title || 'Głosowanie' : 'Głosowanie'}
    >
      <FeaturePollForm
        key={poll.id}
        poll={poll}
        loadingPoll={query.isFetching}
        onVoted={() => {
          // Drop any in-flight refetch so it cannot bring the answered poll back.
          const { queryKey } = featurePollQueries.available(userId);
          void queryClient.cancelQueries({ queryKey });
          queryClient.setQueryData(queryKey, null);
        }}
        // "Already voted" or "poll closed" (e.g. answered on the web): a refetch closes the dialog.
        onVoteFailed={() => void queryClient.invalidateQueries({ queryKey: featurePollQueries.available(userId).queryKey })}
      />
    </DialogModal>
  );
}

function FeaturePollForm({
  poll,
  loadingPoll,
  onVoted,
  onVoteFailed,
}: {
  poll: AvailableFeaturePoll;
  loadingPoll: boolean;
  onVoted: () => void;
  onVoteFailed: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const offline = useIsOffline();
  const [selectedValue, setSelectedValue] = useState('');
  const [otherText, setOtherText] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const showTitle = poll.title_enabled !== false;
  const showDescription = poll.description_enabled !== false;
  const showQuestion = poll.question_enabled !== false;
  const title = poll.title || 'Głosowanie';
  const description = poll.description || 'Odpowiedz na jedno pytanie, żeby kontynuować.';

  const select = (value: string) => {
    haptics.selection();
    setSelectedValue(value);
    setFormError(null);
  };

  const validateSelection = () => {
    if (!selectedValue) return 'Wybierz odpowiedź';
    if (selectedValue === OTHER_VALUE && !otherText.trim()) return 'Wpisz swoją propozycję';
    return null;
  };

  const handleSubmit = async () => {
    if (submitting) return;
    if (offline) {
      toast.error(OFFLINE_WRITE_MESSAGE);
      return;
    }

    const validationError = validateSelection();
    if (validationError) {
      haptics.warning();
      setFormError(validationError);
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      await submitFeaturePollVote({
        pollId: poll.id,
        optionId: selectedValue === OTHER_VALUE ? null : selectedValue,
        otherText: selectedValue === OTHER_VALUE ? otherText.trim() : null,
      });
      haptics.success();
      toast.success('Dziękujemy za głos');
      onVoted();
    } catch (error: unknown) {
      haptics.error();
      toast.error(getErrorMessage(error, 'Nie udało się zapisać głosu'));
      onVoteFailed();
    } finally {
      setSubmitting(false);
    }
  };

  const submitDisabled = submitting || loadingPoll || offline;

  return (
    <ScrollView bounces={false} keyboardShouldPersistTaps="handled" style={styles.scroll}>
      <Animated.View entering={CONTENT_ENTER} style={styles.content}>
        <View style={styles.header}>
          <View style={styles.iconBox}>
            <Vote size={20} color={colors.primary} />
          </View>
          {showTitle ? (
            <Text size="lg" weight="600" accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
          ) : null}
          {showDescription ? (
            <Text size="sm" color="mutedForeground">
              {description}
            </Text>
          ) : null}
        </View>

        <View style={styles.body}>
          {showQuestion ? (
            <Text size="base" weight="600" style={styles.question}>
              {poll.question}
            </Text>
          ) : null}

          <View style={styles.options} accessibilityRole="radiogroup">
            {poll.options.map((option) => (
              <PollOption
                key={option.id}
                label={option.label}
                selected={selectedValue === option.id}
                onPress={() => select(option.id)}
              />
            ))}
            {poll.allow_other ? (
              <PollOption label="Inne" selected={selectedValue === OTHER_VALUE} onPress={() => select(OTHER_VALUE)} />
            ) : null}
          </View>

          {selectedValue === OTHER_VALUE ? (
            <Animated.View
              entering={OTHER_PANEL_ENTER}
              exiting={FadeOut.duration(200)}
              style={styles.otherPanel}
              testID="feature-poll-other-panel"
            >
              <Text size="sm" weight="500" style={styles.label} nativeID="feature-poll-other-label">
                Twoja propozycja
              </Text>
              <TextInput
                value={otherText}
                onChangeText={(value) => {
                  setOtherText(value);
                  setFormError(null);
                }}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                accessibilityLabel="Twoja propozycja"
                accessibilityLabelledBy="feature-poll-other-label"
                placeholderTextColor={colors.mutedForeground}
                style={styles.textarea}
                maxFontSizeMultiplier={1.35}
              />
            </Animated.View>
          ) : null}

          {formError ? (
            <Animated.View layout={LAYOUT}>
              <Text size="sm" weight="500" color="destructive" accessibilityLiveRegion="polite">
                {formError}
              </Text>
            </Animated.View>
          ) : null}

          {offline ? (
            <Animated.View layout={LAYOUT}>
              <Text size="sm" color="mutedForeground" align="center">
                {OFFLINE_WRITE_MESSAGE}
              </Text>
            </Animated.View>
          ) : null}

          <Animated.View layout={LAYOUT}>
            <PressScale
              accessibilityRole="button"
              accessibilityState={{ disabled: submitDisabled, busy: submitting }}
              disabled={submitDisabled}
              onPress={() => void handleSubmit()}
              scaleTo={0.98}
              style={[styles.submit, submitDisabled && styles.submitDisabled]}
            >
              <Text size="sm" weight="500" color="primaryForeground">
                {submitting ? 'Zapisywanie...' : 'Oddaj głos'}
              </Text>
            </PressScale>
          </Animated.View>
        </View>
      </Animated.View>
    </ScrollView>
  );
}

function PollOption({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        selected ? styles.optionSelected : pressed && styles.optionPressed,
      ]}
    >
      <View style={styles.radio}>
        {selected ? <Circle size={10} color={colors.primary} fill={colors.primary} /> : null}
      </View>
      <Text size="sm" weight="500" style={styles.optionLabel}>
        {label}
      </Text>
    </Pressable>
  );
}

const useStyles = createStyles(({ colors, radius }) => ({
  scroll: { flexGrow: 0 },
  content: { padding: 20, gap: 20 },
  header: { gap: 8 },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: alpha(colors.primary, 0.1),
  },
  title: { lineHeight: 22, letterSpacing: -0.45 },
  body: { gap: 16 },
  question: { lineHeight: 22 },
  options: { gap: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: alpha(colors.primary, 0.05) },
  optionPressed: { backgroundColor: alpha(colors.muted, 0.6) },
  radio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: { flex: 1, lineHeight: 17 },
  otherPanel: { gap: 8, paddingTop: 4 },
  label: { lineHeight: 17 },
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
  submit: {
    height: 44,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  submitDisabled: { opacity: 0.5 },
}));
