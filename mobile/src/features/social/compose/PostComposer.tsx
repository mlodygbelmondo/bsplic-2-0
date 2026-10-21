import { router } from 'expo-router';
import { ImagePlus } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { createStyles } from '@/theme';
import { Text } from '@/ui';
import { social } from '../components/socialColors';
import type { SocialImageAttachment } from '../images';
import { ComposerAvatar } from './ComposerAvatar';
import { postDraftActions } from './postDraftStore';

export interface PostComposerProps {
  onSubmit: (content: string, image?: SocialImageAttachment) => Promise<void>;
  disabled?: boolean;
  currentUserId?: string;
  currentUsername?: string;
  currentUserAvatarUrl?: string | null;
}

/**
 * Phone `PostComposer` trigger ("Co nowego?"). The editor is the
 * `/sheets/compose-post` form sheet; the draft lives in `postDraftStore`, so
 * it survives closing the sheet like the web.
 */
export function PostComposer({ onSubmit, disabled, currentUsername, currentUserAvatarUrl }: PostComposerProps) {
  const styles = useStyles();
  return (
    <View style={styles.entry}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Utwórz post"
        accessibilityState={{ disabled: Boolean(disabled) }}
        disabled={disabled}
        onPress={() => {
          postDraftActions.setSubmitHandler(onSubmit);
          router.push('/sheets/compose-post');
        }}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed, disabled && styles.disabled]}
      >
        <ComposerAvatar username={currentUsername} avatarUrl={currentUserAvatarUrl} />
        <View style={styles.pill}>
          <Text numberOfLines={1} style={styles.pillText}>
            Co nowego?
          </Text>
        </View>
        <View style={styles.media} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <ImagePlus size={24} color={social.primary} />
        </View>
      </Pressable>
    </View>
  );
}

const useStyles = createStyles(() => ({
  entry: { backgroundColor: social.card },
  // `flex w-full items-center gap-3 px-3 py-2.5`.
  trigger: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: social.card },
  pressed: { backgroundColor: social.background },
  disabled: { opacity: 0.6 },
  // `rounded-full bg-muted px-4 py-2.5 text-[15px] font-medium leading-none` (35 pt tall; 18 pt line box keeps descenders).
  pill: { flex: 1, minWidth: 0, borderRadius: 999, backgroundColor: social.muted, paddingHorizontal: 16, paddingVertical: 8.5 },
  pillText: { fontSize: 15, lineHeight: 18, fontWeight: '500', color: social.mutedForeground },
  // `flex h-10 w-10 items-center justify-center rounded-full text-primary`.
  media: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
}));
