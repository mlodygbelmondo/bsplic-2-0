// SCAFFOLD — owner: social compose worker.
// The compact phone trigger of the web `PostComposer` ("Co nowego?"). The full
// composer is the `/sheets/compose-post` route; the trigger only opens it.
// Keep the export name and these props (web props; `imageBlob?: Blob` becomes
// `image?: SocialImageAttachment`). The feed passes `onSubmit={publishPost}`
// from `api/actions.ts`; the sheet can call `publishPost` directly.
import { router } from 'expo-router';
import { ImagePlus } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { createStyles } from '@/theme';
import { Avatar, Text } from '@/ui';
import { social } from '../components/socialColors';
import type { SocialImageAttachment } from '../images';

export interface PostComposerProps {
  onSubmit: (content: string, image?: SocialImageAttachment) => Promise<void>;
  disabled?: boolean;
  currentUserId?: string;
  currentUsername?: string;
  currentUserAvatarUrl?: string | null;
}

export function PostComposer({ disabled, currentUsername, currentUserAvatarUrl }: PostComposerProps) {
  const styles = useStyles();
  return (
    <View style={styles.entry}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Utwórz post"
        disabled={disabled}
        onPress={() => router.push('/sheets/compose-post')}
        style={[styles.trigger, disabled && styles.disabled]}
      >
        <Avatar
          uri={currentUserAvatarUrl}
          name={currentUsername || 'T'}
          size={40}
          style={styles.avatar}
          fallbackStyle={styles.avatar}
          fallbackTextStyle={styles.avatarText}
        />
        <View style={styles.pill}>
          <Text numberOfLines={1} style={styles.pillText}>
            Co nowego?
          </Text>
        </View>
        <View style={styles.media}>
          <ImagePlus size={24} color={social.primary} />
        </View>
      </Pressable>
    </View>
  );
}

const useStyles = createStyles(() => ({
  entry: { backgroundColor: social.card },
  // `flex w-full items-center gap-3 px-3 py-2.5`.
  trigger: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10 },
  disabled: { opacity: 0.6 },
  avatar: { backgroundColor: social.primarySoft },
  avatarText: { fontSize: 14, color: social.primary },
  // `rounded-full bg-muted px-4 py-2.5 text-[15px] font-medium leading-none` (35 pt tall; 18 pt line box keeps descenders).
  pill: { flex: 1, minWidth: 0, borderRadius: 999, backgroundColor: social.muted, paddingHorizontal: 16, paddingVertical: 8.5 },
  pillText: { fontSize: 15, lineHeight: 18, fontWeight: '500', color: social.mutedForeground },
  media: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
}));
