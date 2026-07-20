import { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { Camera, ImagePlus, Send, Trash2 } from 'lucide-react-native';
import { ActivityIndicator, Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppModal } from '@/components/ui/AppModal';
import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/hooks/use-app-theme';

import { readSocialDraft, saveSocialDraft } from '../cache';
import { pickSocialImage, type PreparedSocialImage } from '../images';
import { applyMention } from '../mentions';
import { useMentionAutocomplete } from '../hooks/use-mention-autocomplete';

interface ComposerModalProps {
  visible: boolean;
  title: string;
  placeholder: string;
  draftScope: string;
  currentUserId?: string;
  allowImage?: boolean;
  initialText?: string;
  onClose(): void;
  onSubmit(text: string, image: PreparedSocialImage | null): Promise<void>;
}

export function ComposerModal({ visible, title, placeholder, draftScope, currentUserId, allowImage = true, initialText = '', onClose, onSubmit }: ComposerModalProps) {
  const { tokens } = useAppTheme();
  const [text, setText] = useState(() => readSocialDraft(draftScope) || initialText);
  const [selection, setSelection] = useState({ start: text.length, end: text.length });
  const [image, setImage] = useState<PreparedSocialImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const { activeMention, suggestions, loading } = useMentionAutocomplete(text, selection.start, currentUserId);

  useEffect(() => { saveSocialDraft(draftScope, text); }, [draftScope, text]);

  const attach = (source: 'camera' | 'library') => {
    setImageBusy(true);
    void pickSocialImage(source)
      .then((next) => next && setImage(next))
      .catch((error: unknown) => Alert.alert('Nie udało się dodać zdjęcia', error instanceof Error ? error.message : 'Spróbuj ponownie.'))
      .finally(() => setImageBusy(false));
  };

  const chooseImage = () => Alert.alert('Dodaj zdjęcie', undefined, [
    { text: 'Aparat', onPress: () => attach('camera') },
    { text: 'Galeria', onPress: () => attach('library') },
    { text: 'Anuluj', style: 'cancel' },
  ]);

  const submit = async () => {
    const normalized = text.trim();
    if ((!normalized && !image) || normalized.length > 500 || busy) return;
    setBusy(true);
    try {
      await onSubmit(normalized, image);
      setText('');
      setImage(null);
      saveSocialDraft(draftScope, '');
      onClose();
    } catch (error) {
      Alert.alert('Nie udało się opublikować', error instanceof Error ? error.message : 'Spróbuj ponownie.');
    } finally {
      setBusy(false);
    }
  };

  const selectMention = (username: string) => {
    if (!activeMention) return;
    const next = applyMention(text, activeMention, username);
    setText(next.value);
    setSelection({ start: next.caret, end: next.caret });
  };

  return (
    <AppModal visible={visible} title={title} onClose={onClose}>
      <View style={styles.form}>
        <TextInput
          accessibilityLabel={placeholder}
          autoFocus
          multiline
          maxLength={500}
          placeholder={placeholder}
          placeholderTextColor={tokens.colors.mutedForeground}
          selection={selection}
          onSelectionChange={(event) => setSelection(event.nativeEvent.selection)}
          value={text}
          onChangeText={setText}
          style={[styles.input, { color: tokens.colors.foreground, backgroundColor: tokens.colors.muted, borderColor: tokens.colors.border }]}
        />
        {activeMention && (loading || suggestions.length > 0) ? (
          <View style={[styles.suggestions, { borderColor: tokens.colors.border }]}>
            {loading ? <ActivityIndicator color={tokens.colors.primary} /> : suggestions.map((user) => (
              <Pressable key={user.id} accessibilityRole="button" onPress={() => selectMention(user.username)} style={styles.suggestion}>
                <AppText variant="label">@{user.username}</AppText>
              </Pressable>
            ))}
          </View>
        ) : null}
        {image ? (
          <View style={styles.previewWrap}>
            <Image source={{ uri: image.uri }} contentFit="cover" style={styles.preview} />
            <Pressable accessibilityRole="button" accessibilityLabel="Usuń zdjęcie" onPress={() => setImage(null)} style={[styles.remove, { backgroundColor: tokens.colors.overlay }]}>
              <Trash2 size={18} color="#fff" />
            </Pressable>
            <AppText variant="caption" tone="muted">{Math.ceil(image.bytes / 1024)} KB</AppText>
          </View>
        ) : null}
        <View style={styles.meta}>
          <AppText variant="caption" tone={text.length >= 480 ? 'danger' : 'muted'} style={{ fontVariant: ['tabular-nums'] }}>{text.length}/500</AppText>
          {allowImage ? (
            <AppButton variant="outline" disabled={imageBusy || !!image} loading={imageBusy} onPress={chooseImage} leftAccessory={imageBusy ? undefined : <ImagePlus size={17} color={tokens.colors.primary} />}>Zdjęcie</AppButton>
          ) : null}
        </View>
        <AppButton fullWidth loading={busy} disabled={(!text.trim() && !image) || text.trim().length > 500} onPress={() => void submit()} leftAccessory={<Send size={17} color={tokens.colors.primaryForeground} />}>Opublikuj</AppButton>
        {allowImage ? <View style={styles.cameraHint}><Camera size={14} color={tokens.colors.mutedForeground} /><AppText variant="caption" tone="muted">Jedno zdjęcie, maks. 90 KB po kompresji</AppText></View> : null}
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  form: { gap: 12 },
  input: { minHeight: 120, maxHeight: 240, textAlignVertical: 'top', borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14, fontSize: 16 },
  suggestions: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, overflow: 'hidden' },
  suggestion: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14 },
  previewWrap: { gap: 4 },
  preview: { width: '100%', aspectRatio: 4 / 3, borderRadius: 14 },
  remove: { position: 'absolute', right: 8, top: 8, width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cameraHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
});
