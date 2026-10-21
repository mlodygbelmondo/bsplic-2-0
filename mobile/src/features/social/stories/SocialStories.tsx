// SCAFFOLD — owner: social compose worker.
// The stories strip of the web `SocialStories` (create tile, active stories,
// profile fallbacks). Story creation is the `/sheets/compose-story` route and
// the viewer is `/sheets/story-viewer`; this scaffold only opens them.
// Keep the export name and these props (web props; `imageBlob?: Blob` becomes
// `image?: SocialImageAttachment`). The feed passes `onCreateStory={publishStory}`
// from `api/actions.ts`; the sheet can call `publishStory` directly.
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { prefetchPublicProfile } from '@/features/profile/api/profileQueries';
import { createStyles } from '@/theme';
import type { SocialStory } from '@/types/database';
import { Text } from '@/ui';
import { social } from '../components/socialColors';
import type { SocialImageAttachment } from '../images';
import { getSocialImageUrl } from '../images';
import { parseSocialContent } from '../lib/content';
import type { SocialStoryProfile } from '../lib/feedList';

export type { SocialStoryProfile } from '../lib/feedList';

export interface SocialStoriesProps {
  stories: SocialStory[];
  profileFallbacks: SocialStoryProfile[];
  currentUsername: string;
  currentAvatarUrl: string | null;
  onCreateStory: (content: string, image?: SocialImageAttachment) => Promise<void>;
  disabled?: boolean;
}

export function SocialStories({ stories, profileFallbacks, currentUsername, currentAvatarUrl, disabled }: SocialStoriesProps) {
  const styles = useStyles();
  const [now] = useState(() => Date.now());
  const activeStories = stories.filter((story) => new Date(story.expires_at).getTime() > now);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.strip}
      contentContainerStyle={styles.stripContent}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Utwórz relację"
        disabled={disabled}
        onPress={() => router.push('/sheets/compose-story')}
        style={[styles.tile, styles.createTile]}
      >
        <View style={styles.createImage}>
          <StoryImage username={currentUsername} avatarUrl={currentAvatarUrl} />
        </View>
        <View style={styles.createPlus}>
          <Plus size={16} color={social.primaryForeground} />
        </View>
        <Text numberOfLines={2} style={[styles.label, styles.createLabel]}>
          Utwórz relację
        </Text>
      </Pressable>

      {activeStories.map((story, index) => (
        <Pressable
          key={story.id}
          accessibilityRole="button"
          accessibilityLabel={`Otwórz relację ${story.username}`}
          onPress={() => router.push({ pathname: '/sheets/story-viewer', params: { index: String(index) } })}
          style={styles.tile}
        >
          <StoryCover story={story} />
          <View style={styles.shade} />
          <View style={styles.ring}>
            <StoryImage username={story.username} avatarUrl={story.avatar_url ?? null} />
          </View>
          <Text numberOfLines={2} style={styles.label}>
            {story.username}
          </Text>
        </Pressable>
      ))}

      {activeStories.length === 0
        ? profileFallbacks.map((profile) => (
            <Pressable
              key={profile.userId}
              accessibilityRole="link"
              accessibilityLabel={`Profil ${profile.username}`}
              onPressIn={() => prefetchPublicProfile(profile.userId)}
              onPress={() => router.push(`/profile/${profile.userId}`)}
              style={styles.tile}
            >
              <StoryImage username={profile.username} avatarUrl={profile.avatarUrl} />
              <View style={styles.shade} />
              <View style={styles.ring}>
                <StoryImage username={profile.username} avatarUrl={profile.avatarUrl} />
              </View>
              <Text numberOfLines={2} style={styles.label}>
                {profile.username}
              </Text>
            </Pressable>
          ))
        : null}
    </ScrollView>
  );
}

function StoryCover({ story }: { story: SocialStory }) {
  const styles = useStyles();
  const { imagePath } = parseSocialContent(story.content);
  if (imagePath) {
    return <Image source={{ uri: getSocialImageUrl(imagePath) }} style={styles.fill} contentFit="cover" />;
  }
  return <StoryImage username={story.username} avatarUrl={story.avatar_url ?? null} />;
}

function StoryImage({ username, avatarUrl }: { username: string; avatarUrl: string | null }) {
  const styles = useStyles();
  const [failed, setFailed] = useState(false);
  if (avatarUrl && !failed) {
    return <Image source={{ uri: avatarUrl }} style={styles.fill} contentFit="cover" onError={() => setFailed(true)} />;
  }
  return (
    <View style={[styles.fill, styles.fallback]}>
      <Text style={styles.fallbackText}>{username.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

const useStyles = createStyles(() => ({
  // `.social-facebook-stories mb-2 flex gap-2 px-2 pb-2` on a card background.
  strip: { flexGrow: 0, marginBottom: 8, backgroundColor: social.card },
  stripContent: { gap: 8, paddingHorizontal: 8, paddingBottom: 8 },
  // `.social-story-tile`: 6.6rem × 9rem, radius 0.75rem, border, muted, light shadow.
  tile: {
    width: 105.6,
    height: 144,
    overflow: 'hidden',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: social.border,
    backgroundColor: social.muted,
    boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.08)',
  },
  createTile: { backgroundColor: social.card },
  createImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 36.8,
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: social.border,
  },
  createPlus: {
    position: 'absolute',
    bottom: 29.6,
    alignSelf: 'center',
    width: 32,
    height: 32,
    marginBottom: -16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 3,
    borderColor: social.card,
    backgroundColor: social.primary,
  },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  shade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage: 'linear-gradient(180deg, transparent 35%, rgba(0, 0, 0, 0.52) 100%)',
  },
  ring: {
    position: 'absolute',
    top: 7.2,
    left: 7.2,
    width: 32,
    height: 32,
    overflow: 'hidden',
    borderRadius: 16,
    borderWidth: 3,
    borderColor: social.primary,
  },
  label: {
    position: 'absolute',
    left: 7.2,
    right: 7.2,
    bottom: 7.2,
    fontSize: 11.52,
    lineHeight: 16.8,
    fontWeight: '800',
    color: '#ffffff',
  },
  createLabel: { textAlign: 'center', color: social.foreground },
  // `bg-gradient-to-br from-primary via-red-700 to-neutral-950 text-2xl font-black text-white`.
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundImage: `linear-gradient(135deg, ${social.primary} 0%, #b91c1c 50%, #0a0a0a 100%)`,
  },
  fallbackText: { fontSize: 24, lineHeight: 32, fontWeight: '900', color: '#ffffff' },
}));
