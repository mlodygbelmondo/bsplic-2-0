import { router } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useProfile } from '@/features/auth/auth-store';
import { OFFLINE_WRITE_MESSAGE, useIsOffline } from '@/lib/connectivity';
import { haptics } from '@/lib/haptics';
import { toast } from '@/lib/toast';
import { createStyles } from '@/theme';
import { Text } from '@/ui';
import { publishStory } from '../api/actions';
import { social } from '../components/socialColors';
import { attachSocialImage, SOCIAL_TEXT_MAX_LENGTH } from '../compose/attachImage';
import { AddPhotoButton, CharacterCounter, PublishButton } from '../compose/ComposerControls';
import { ComposerHeader } from '../compose/ComposerHeader';
import { ImagePreview } from '../compose/ImagePreview';
import type { SocialImageAttachment } from '../images';
import { storyComposerHandler } from './storyComposerHandler';
import { StoryImage } from './StoryImage';

/** Web focuses the story textarea 150 ms after the sheet opens. */
const FOCUS_DELAY_MS = 150;

const close = () => {
  if (router.canGoBack()) router.back();
};

/**
 * `/sheets/compose-story`: web `StoryComposerSheet`. The draft is local, so
 * closing discards it (web `resetDraft` on close); a failed publish keeps it.
 */
export function StoryComposerScreen() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const profile = useProfile();
  const offline = useIsOffline();
  const [content, setContent] = useState('');
  const [image, setImage] = useState<SocialImageAttachment | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [picking, setPicking] = useState(false);
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const username = profile?.username ?? 'Ty';

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
      const submit = storyComposerHandler.get() ?? publishStory;
      await submit(trimmed, image ?? undefined);
      haptics.success();
      close();
    } catch (error) {
      haptics.error();
      toast.error(error instanceof Error ? error.message : 'Nie udało się opublikować relacji');
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
        tooManyMessage: 'Możesz dodać maksymalnie jedno zdjęcie do relacji',
        announceSuccess: false,
      });
      if (next) setImage(next);
    } finally {
      setPicking(false);
    }
  };

  return (
    <View collapsable={false} style={[styles.root, { paddingTop: insets.top }]}>
      <ComposerHeader title="Utwórz relację" onClose={close} />
      <KeyboardAwareScrollView
        bottomOffset={64}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.body, { paddingBottom: 16 + insets.bottom }]}
      >
        <View style={styles.author}>
          <View style={styles.avatar}>
            <StoryImage username={username} avatarUrl={profile?.avatar_url ?? null} />
          </View>
          <View style={styles.authorText}>
            <Text numberOfLines={1} style={styles.name}>
              {username || 'Ty'}
            </Text>
            <Text style={styles.subtitle}>Relacja zniknie po 24 godz.</Text>
          </View>
        </View>

        <TextInput
          ref={inputRef}
          multiline
          value={content}
          onChangeText={setContent}
          placeholder="Napisz coś..."
          placeholderTextColor={social.mutedForeground}
          maxLength={SOCIAL_TEXT_MAX_LENGTH}
          editable={!submitting && !disabled}
          accessibilityLabel="Treść relacji"
          maxFontSizeMultiplier={1.35}
          textAlignVertical="top"
          style={styles.textarea}
        />

        {image ? <ImagePreview image={image} onRemove={() => setImage(null)} /> : null}

        <View style={styles.footer}>
          <AddPhotoButton
            accessibilityLabel="Dodaj zdjęcie do relacji"
            disabled={image !== null || picking || submitting || disabled}
            onPress={() => void handlePickImage()}
          />
          <View style={styles.footerEnd}>
            <CharacterCounter length={trimmed.length} />
            <PublishButton
              accessibilityLabel="Opublikuj relację"
              disabled={!canSubmit}
              submitting={submitting}
              onPress={() => void handleSubmit()}
            />
          </View>
        </View>

        {offline ? <Text style={styles.offline}>{OFFLINE_WRITE_MESSAGE}</Text> : null}
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = createStyles(() => ({
  // `.social-story-composer-sheet bg-background` with the phone Social palette.
  root: { flex: 1, backgroundColor: social.background },
  // `space-y-3 px-4 pt-4 pb-[calc(1rem+safe-area)]`.
  body: { gap: 12, paddingHorizontal: 16, paddingTop: 16 },
  author: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  // `h-10 w-10 rounded-full`.
  avatar: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden' },
  authorText: { minWidth: 0, flexShrink: 1 },
  name: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: social.foreground },
  subtitle: { fontSize: 12, lineHeight: 16, color: social.mutedForeground },
  // `min-h-[9rem] rounded-2xl border-0 bg-muted px-4 py-3 text-base leading-6`.
  textarea: {
    minHeight: 144,
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
  // `flex items-center justify-between gap-3`.
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  footerEnd: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  offline: { textAlign: 'center', fontSize: 12, lineHeight: 16, color: social.mutedForeground },
}));
