import { ImagePlus, Send } from 'lucide-react-native';
import { useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { getErrorMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { toast } from '@/lib/toast';
import { createStyles } from '@/theme';
import { Text } from '@/ui';
import { social } from '../components/socialColors';
import { attachSocialImage, SOCIAL_TEXT_MAX_LENGTH } from '../compose/attachImage';
import { ImagePreview } from '../compose/ImagePreview';
import type { SocialImageAttachment } from '../images';
import { applyMention } from '../mentions/mentions';
import { MentionSuggestions } from '../mentions/MentionSuggestions';
import { useMentionAutocomplete } from '../mentions/useMentionAutocomplete';

interface CommentInputProps {
  onSubmit: (content: string, image?: SocialImageAttachment) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
  onCancel?: () => void;
  currentUserId?: string;
  autoFocus?: boolean;
}

/**
 * Web `CommentInput`: one-line field (return sends), photo, send and, for
 * replies, cancel; mention suggestions and the photo preview below. A failed
 * send keeps the draft.
 */
export function CommentInput({ onSubmit, disabled, placeholder, onCancel, currentUserId, autoFocus }: CommentInputProps) {
  const styles = useStyles();
  const [content, setContent] = useState('');
  const [image, setImage] = useState<SocialImageAttachment | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [picking, setPicking] = useState(false);
  const [caretPosition, setCaretPosition] = useState(0);
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const label = placeholder ?? 'Napisz komentarz...';

  const { activeMention, suggestions, loading } = useMentionAutocomplete({ value: content, caretPosition, currentUserId });

  const trimmed = content.trim();
  const sendDisabled = (!trimmed && !image) || submitting || Boolean(disabled);

  const handleSubmit = async () => {
    if ((!trimmed && !image) || submitting || disabled) return;
    setSubmitting(true);
    try {
      await onSubmit(trimmed, image ?? undefined);
      setContent('');
      setCaretPosition(0);
      setImage(null);
    } catch (error) {
      // The web leaves this unhandled; native keeps the draft and says why.
      haptics.error();
      toast.error(getErrorMessage(error, 'Nie udało się dodać komentarza'));
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
        tooManyMessage: 'Możesz dodać maksymalnie jedno zdjęcie do komentarza',
        announceSuccess: true,
      });
      if (next) setImage(next);
    } finally {
      setPicking(false);
    }
  };

  const handleMentionSelect = (username: string) => {
    if (!activeMention) return;
    const next = applyMention(content, activeMention, username);
    setContent(next.value);
    setCaretPosition(next.caret);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelection(next.caret, next.caret);
    });
  };

  return (
    <View style={styles.root}>
      <View style={styles.row}>
        <TextInput
          ref={inputRef}
          value={content}
          onChangeText={setContent}
          onSelectionChange={(event) => setCaretPosition(event.nativeEvent.selection.start)}
          onSubmitEditing={() => void handleSubmit()}
          submitBehavior="submit"
          returnKeyType="send"
          placeholder={label}
          placeholderTextColor={social.mutedForeground}
          maxLength={SOCIAL_TEXT_MAX_LENGTH}
          editable={!submitting && !disabled}
          autoFocus={autoFocus}
          accessibilityLabel={label}
          maxFontSizeMultiplier={1.35}
          style={[styles.input, (submitting || disabled) && styles.inputDisabled]}
        />
        <IconButton
          label="Dodaj zdjęcie do komentarza"
          disabled={picking || submitting || Boolean(disabled)}
          onPress={() => void handlePickImage()}
        >
          <ImagePlus size={14} color={social.foreground} />
        </IconButton>
        <IconButton label="Wyślij komentarz" disabled={sendDisabled} onPress={() => void handleSubmit()}>
          <Send size={14} color={social.foreground} />
        </IconButton>
        {onCancel ? (
          <IconButton label="Anuluj odpowiedź" onPress={onCancel}>
            <Text style={styles.cancel}>✕</Text>
          </IconButton>
        ) : null}
      </View>
      {image ? <ImagePreview image={image} onRemove={() => setImage(null)} /> : null}
      {activeMention ? <MentionSuggestions loading={loading} users={suggestions} onSelect={handleMentionSelect} /> : null}
    </View>
  );
}

/** `Button size="icon" variant="ghost" className="h-7 w-7"`. */
function IconButton({
  label,
  disabled,
  onPress,
  children,
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed, disabled && styles.disabled]}
    >
      {children}
    </Pressable>
  );
}

const useStyles = createStyles(() => ({
  // `space-y-2`.
  root: { gap: 8 },
  // `flex items-center gap-2`.
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // `flex-1 bg-transparent border border-border rounded-full px-3 py-2 text-base`.
  input: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    borderColor: social.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 0,
    fontFamily: 'Inter',
    fontSize: 16,
    color: social.foreground,
  },
  inputDisabled: { opacity: 0.5 },
  iconButton: { width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  // Ghost hover: `bg-accent`.
  iconButtonPressed: { backgroundColor: social.accent },
  disabled: { opacity: 0.5 },
  cancel: { fontSize: 12, lineHeight: 16, color: social.foreground },
}));
