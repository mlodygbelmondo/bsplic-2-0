import { router } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useProfile, useUserId } from '@/features/auth/auth-store';
import { OFFLINE_WRITE_MESSAGE, useIsOffline } from '@/lib/connectivity';
import { getErrorMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { toast } from '@/lib/toast';
import { createStyles } from '@/theme';
import { Text } from '@/ui';
import { publishPost } from '../api/actions';
import { social } from '../components/socialColors';
import { applyMention } from '../mentions/mentions';
import { MentionSuggestions } from '../mentions/MentionSuggestions';
import { useMentionAutocomplete } from '../mentions/useMentionAutocomplete';
import { attachSocialImage, SOCIAL_TEXT_MAX_LENGTH } from './attachImage';
import { ComposerAvatar } from './ComposerAvatar';
import { AddPhotoButton, CharacterCounter, PublishButton } from './ComposerControls';
import { ComposerHeader } from './ComposerHeader';
import { ImagePreview } from './ImagePreview';
import { postDraftActions, usePostDraftStore } from './postDraftStore';

/** Web sheet editor focuses the textarea 120 ms after opening. */
const FOCUS_DELAY_MS = 120;

const close = () => {
  if (router.canGoBack()) router.back();
};

/**
 * `/sheets/compose-post`: the web phone post sheet (`ComposerEditor
 * variant="sheet"`). The draft is shared with the trigger through
 * `postDraftStore` and survives closing the sheet.
 */
export function PostComposerSheet() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const userId = useUserId();
  const profile = useProfile();
  const offline = useIsOffline();
  const content = usePostDraftStore((state) => state.content);
  const image = usePostDraftStore((state) => state.image);
  const [submitting, setSubmitting] = useState(false);
  const [picking, setPicking] = useState(false);
  const [caretPosition, setCaretPosition] = useState(content.length);
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const username = profile?.username ?? undefined;

  const { activeMention, suggestions, loading } = useMentionAutocomplete({
    value: content,
    caretPosition,
    currentUserId: userId ?? undefined,
  });

  const disabled = offline;
  const trimmed = content.trim();
  const canSubmit = (trimmed.length > 0 || image !== null) && trimmed.length <= SOCIAL_TEXT_MAX_LENGTH && !submitting && !disabled;

  useEffect(() => {
    const timeout = setTimeout(() => inputRef.current?.focus(), FOCUS_DELAY_MS);
    return () => clearTimeout(timeout);
  }, []);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const submit = postDraftActions.getSubmitHandler() ?? publishPost;
      await submit(trimmed, image ?? undefined);
      haptics.success();
      postDraftActions.reset();
      close();
    } catch (error) {
      // The web leaves this unhandled; native keeps the draft and says why.
      haptics.error();
      toast.error(getErrorMessage(error, 'Nie udało się opublikować posta'));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePickImage = async () => {
    if (picking) return;
    setPicking(true);
    try {
      const next = await attachSocialImage({
        current: image,
        tooManyMessage: 'Możesz dodać maksymalnie jedno zdjęcie do posta',
        announceSuccess: true,
      });
      if (next) postDraftActions.setImage(next);
    } finally {
      setPicking(false);
    }
  };

  const handleMentionSelect = (selected: string) => {
    if (!activeMention) return;
    const next = applyMention(content, activeMention, selected);
    postDraftActions.setContent(next.value);
    setCaretPosition(next.caret);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelection(next.caret, next.caret);
    });
  };

  return (
    <View collapsable={false} style={styles.root}>
      <ComposerHeader title="Utwórz post" onClose={close} />
      <View style={[styles.body, { paddingBottom: 16 + insets.bottom }]}>
        <View style={styles.author}>
          <ComposerAvatar username={username} avatarUrl={profile?.avatar_url} />
          <View style={styles.authorText}>
            <Text numberOfLines={1} style={styles.name}>
              {username || 'Ty'}
            </Text>
            <Text style={styles.subtitle}>Post w feedzie</Text>
          </View>
        </View>

        <TextInput
          ref={inputRef}
          multiline
          value={content}
          onChangeText={postDraftActions.setContent}
          onSelectionChange={(event) => setCaretPosition(event.nativeEvent.selection.start)}
          placeholder="Co nowego?"
          placeholderTextColor={social.mutedForeground}
          maxLength={SOCIAL_TEXT_MAX_LENGTH}
          editable={!submitting && !disabled}
          accessibilityLabel="Treść posta"
          maxFontSizeMultiplier={1.35}
          textAlignVertical="top"
          style={styles.textarea}
        />

        {image ? <ImagePreview image={image} onRemove={() => postDraftActions.setImage(null)} /> : null}

        {activeMention ? <MentionSuggestions loading={loading} users={suggestions} onSelect={handleMentionSelect} /> : null}

        <View style={styles.footer}>
          <AddPhotoButton
            accessibilityLabel="Dodaj zdjęcie do posta"
            disabled={picking || submitting || disabled}
            onPress={() => void handlePickImage()}
          />
          <View style={styles.footerEnd}>
            <CharacterCounter length={trimmed.length} />
            <PublishButton
              accessibilityLabel="Opublikuj post"
              disabled={!canSubmit}
              submitting={submitting}
              onPress={() => void handleSubmit()}
            />
          </View>
        </View>

        {offline ? <Text style={styles.offline}>{OFFLINE_WRITE_MESSAGE}</Text> : null}
      </View>
    </View>
  );
}

const useStyles = createStyles(() => ({
  // `.social-composer-sheet bg-background` with the phone Social palette; the
  // sheet fits its content like the web bottom sheet.
  root: { backgroundColor: social.background },
  // `space-y-3 px-4 pt-4 pb-[calc(1rem+safe-area)]`.
  body: { gap: 12, paddingHorizontal: 16, paddingTop: 16 },
  // `flex items-center gap-3`.
  author: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  authorText: { minWidth: 0, flexShrink: 1 },
  name: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: social.foreground },
  subtitle: { fontSize: 12, lineHeight: 16, color: social.mutedForeground },
  // `min-h-[10rem] rounded-2xl border-0 bg-muted px-4 py-3 text-base leading-6`.
  textarea: {
    minHeight: 160,
    borderRadius: 16,
    borderCurve: 'continuous',
    backgroundColor: social.muted,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    fontFamily: 'Inter',
    fontSize: 16,
    lineHeight: 24,
    color: social.foreground,
  },
  // `flex items-center justify-between pt-1`.
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 4 },
  footerEnd: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  offline: { textAlign: 'center', fontSize: 12, lineHeight: 16, color: social.mutedForeground },
}));
