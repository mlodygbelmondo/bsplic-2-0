import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { memo, useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { PREFETCH_PRESS_DELAY_MS, prefetchPublicProfile } from '@/features/profile/api/profileQueries';
import { useScreenActive } from '@/lib/focus';
import { createStyles } from '@/theme';
import type { SocialStory } from '@/types/database';
import { Text } from '@/ui';
import { social } from '../components/socialColors';
import type { SocialImageAttachment } from '../images';
import { getSocialImageUrl } from '../images';
import { parseSocialContent } from '../lib/content';
import type { SocialStoryProfile } from '../lib/feedList';
import { storyComposerHandler } from './storyComposerHandler';
import { STORY_CLOCK_MS, getActiveStories } from './storyFormat';
import { StoryImage } from './StoryImage';

export type { SocialStoryProfile } from '../lib/feedList';

export interface SocialStoriesProps {
  stories: SocialStory[];
  profileFallbacks: SocialStoryProfile[];
  currentUsername: string;
  currentAvatarUrl: string | null;
  onCreateStory: (content: string, image?: SocialImageAttachment) => Promise<void>;
  disabled?: boolean;
}

/**
 * Web `SocialStories` strip: create tile, active stories, and profile tiles
 * when nobody has a story. The composer is `/sheets/compose-story` and the
 * viewer `/sheets/story-viewer`.
 */
export const SocialStories = memo(function SocialStories({
  stories,
  profileFallbacks,
  currentUsername,
  currentAvatarUrl,
  onCreateStory,
  disabled,
}: SocialStoriesProps) {
  const styles = useStyles();
  const [now, setNow] = useState(() => Date.now());
  const activeStories = getActiveStories(stories, now);
  const screenActive = useScreenActive();

  // Expired stories drop off while the strip is on view.
  useEffect(() => {
    if (!screenActive) return;
    const interval = setInterval(() => setNow(Date.now()), STORY_CLOCK_MS);
    return () => clearInterval(interval);
  }, [screenActive]);

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
        accessibilityState={{ disabled: Boolean(disabled) }}
        disabled={disabled}
        onPress={() => {
          storyComposerHandler.set(onCreateStory);
          router.push('/sheets/compose-story');
        }}
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
          onPress={() =>
            router.push({ pathname: '/sheets/story-viewer', params: { index: String(index), id: story.id } })
          }
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
              unstable_pressDelay={PREFETCH_PRESS_DELAY_MS}
              onPressIn={() => prefetchPublicProfile(profile.userId)}
              onPress={() => router.push({ pathname: '/profile/[userId]', params: { userId: profile.userId } })}
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
});

/** Web `StoryCoverImage`: the story photo, else the author's avatar. */
function StoryCover({ story }: { story: SocialStory }) {
  const styles = useStyles();
  const { imagePath } = parseSocialContent(story.content);
  if (imagePath) {
    return (
      <Image
        source={{ uri: getSocialImageUrl(imagePath) }}
        style={styles.fill}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
    );
  }
  return <StoryImage username={story.username} avatarUrl={story.avatar_url ?? null} />;
}

const useStyles = createStyles(() => ({
  // Phone `.social-facebook-stories mb-2 flex gap-2 px-2 pb-2`: card background, no border.
  strip: { flexGrow: 0, marginBottom: 8, backgroundColor: social.card },
  stripContent: { gap: 8, paddingHorizontal: 8, paddingBottom: 8 },
  // `.social-story-tile`: 6.6rem × 9rem, radius 0.75rem, border, muted, light shadow.
  tile: {
    width: 105.6,
    height: 144,
    overflow: 'hidden',
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: social.border,
    backgroundColor: social.muted,
    boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.08)',
  },
  createTile: { backgroundColor: social.card },
  // `.social-story-create-image`: bottom 2.3rem, bottom border.
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
  // `.social-story-create-plus`: 2rem circle centred at bottom 1.85rem, 3px card ring.
  createPlus: {
    position: 'absolute',
    bottom: 29.6,
    left: '50%',
    width: 32,
    height: 32,
    marginLeft: -16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 3,
    borderColor: social.card,
    backgroundColor: social.primary,
  },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  // `::after`: `linear-gradient(180deg, transparent 35%, rgb(0 0 0 / 0.52))`.
  shade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage: 'linear-gradient(180deg, rgba(0, 0, 0, 0) 35%, rgba(0, 0, 0, 0.52) 100%)',
  },
  // `.social-story-avatar-ring`: 2rem at 0.45rem, 3px primary border, card fill.
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
    backgroundColor: social.card,
  },
  // `.social-story-label`: 0.72rem, weight 800, line 1.05rem, inset 0.45rem.
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
}));
