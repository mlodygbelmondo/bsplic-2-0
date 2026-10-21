import { ImagePlus, Send } from 'lucide-react-native';
import { Pressable } from 'react-native';

import { haptics } from '@/lib/haptics';
import { alpha, createStyles } from '@/theme';
import { Text } from '@/ui';
import { social } from '../components/socialColors';
import { Spinner } from '../components/Spinner';
import { SOCIAL_TEXT_MAX_LENGTH } from './attachImage';

/** `{trimmed.length}/500`, red past the limit (unreachable with `maxLength`, kept like the web). */
export function CharacterCounter({ length }: { length: number }) {
  const styles = useStyles();
  return (
    <Text tabular style={[styles.counter, length > SOCIAL_TEXT_MAX_LENGTH && styles.counterOver]}>
      {length}/{SOCIAL_TEXT_MAX_LENGTH}
    </Text>
  );
}

/** `Button size="sm" className="rounded-full px-4"` with `Send` / spinning `Loader2` and "Opublikuj". */
export function PublishButton({
  accessibilityLabel,
  disabled,
  submitting,
  onPress,
}: {
  accessibilityLabel: string;
  disabled: boolean;
  submitting: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, busy: submitting }}
      disabled={disabled}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      style={({ pressed }) => [styles.publish, pressed && styles.publishPressed, disabled && styles.disabled]}
    >
      {submitting ? (
        <Spinner size={16} color={social.primaryForeground} />
      ) : (
        <Send size={16} color={social.primaryForeground} />
      )}
      <Text style={styles.publishText}>Opublikuj</Text>
    </Pressable>
  );
}

/** Story `label` control: `inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold text-primary`. */
export function AddPhotoButton({
  accessibilityLabel,
  disabled,
  onPress,
}: {
  accessibilityLabel: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.photo, pressed && styles.photoPressed, disabled && styles.disabled]}
    >
      <ImagePlus size={20} color={social.primary} />
      <Text style={styles.photoText}>Dodaj zdjęcie</Text>
    </Pressable>
  );
}

const useStyles = createStyles(({ colors }) => ({
  counter: { fontSize: 12, lineHeight: 16, color: social.mutedForeground },
  // `text-destructive` (not overridden by the phone Social palette).
  counterOver: { color: colors.destructive },
  // `h-9 px-4 rounded-full gap-2` + icon `mr-1`.
  publish: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: social.primary,
  },
  publishPressed: { backgroundColor: alpha(social.primary, 0.9) },
  publishText: { fontSize: 14, lineHeight: 20, fontWeight: '500', color: social.primaryForeground },
  disabled: { opacity: 0.5 },
  photo: { height: 40, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: 999 },
  photoPressed: { backgroundColor: social.primarySoft },
  photoText: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: social.primary },
}));
