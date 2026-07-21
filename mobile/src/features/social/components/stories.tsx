import { useEffect, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppAvatar } from '@/components/ui/AppAvatar';
import { AppModal } from '@/components/ui/AppModal';
import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/hooks/use-app-theme';
import type { SocialStory } from '@/types/database';

import { parseSocialContent } from '../content';
import { formatSocialTimeAgo } from '../lib/socialFormatters';
import { getSocialImageUrl, type PreparedSocialImage } from '../images';
import { ComposerModal } from './composer-modal';

interface StoriesProps {
  stories: SocialStory[];
  profileFallbacks: StoryProfile[];
  currentUserId?: string;
  currentUsername: string;
  currentAvatarUrl?: string | null;
  writesDisabled: boolean;
  onCreate(text: string, image: PreparedSocialImage | null): Promise<void>;
}

export interface StoryProfile {
  userId: string;
  username: string;
  avatarUrl: string | null;
}

export function Stories({ stories, profileFallbacks, currentUserId, currentUsername, currentAvatarUrl, writesDisabled, onCreate }: StoriesProps) {
  const { tokens } = useAppTheme();
  const [now, setNow] = useState(Date.now());
  const [compose, setCompose] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const active = useMemo(() => stories.filter((story) => new Date(story.expires_at).getTime() > now), [now, stories]);
  const story = selected === null ? null : active[selected] ?? null;

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    if (!story) return;
    const timeout = setTimeout(() => {
      if (selected !== null && selected < active.length - 1) setSelected(selected + 1);
      else setSelected(null);
    }, 7_000);
    return () => clearTimeout(timeout);
  }, [active.length, selected, story]);

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        <Pressable accessibilityRole="button" accessibilityLabel="Utwórz relację" disabled={writesDisabled} onPress={() => setCompose(true)} style={[styles.tile, { backgroundColor: tokens.colors.card, borderColor: tokens.colors.border }]}>
          <AppAvatar name={currentUsername} source={currentAvatarUrl ? { uri: currentAvatarUrl } : undefined} size={52} />
          <View style={[styles.plus, { backgroundColor: tokens.colors.primary }]}><Plus size={15} color={tokens.colors.primaryForeground} /></View>
          <AppText variant="caption" numberOfLines={2} style={styles.label}>Utwórz relację</AppText>
        </Pressable>
        {active.map((item, index) => {
          const parsed = parseSocialContent(item.content);
          return (
            <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Otwórz relację ${item.username}`} onPress={() => setSelected(index)} style={[styles.tile, { backgroundColor: tokens.colors.card, borderColor: tokens.colors.primary }]}>
              {parsed.imagePath ? <Image source={{ uri: getSocialImageUrl(parsed.imagePath) }} contentFit="cover" style={StyleSheet.absoluteFill} /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: `${tokens.colors.primary}1C` }]} />}
              <AppAvatar name={item.username} source={item.avatar_url ? { uri: item.avatar_url } : undefined} size={34} style={{ borderColor: tokens.colors.primary, borderWidth: 2 }} />
              <AppText variant="caption" numberOfLines={2} style={styles.storyLabel}>{item.username}</AppText>
            </Pressable>
          );
        })}
        {active.length === 0 ? profileFallbacks.map((profile) => (
          <Pressable
            key={profile.userId}
            accessibilityRole="link"
            accessibilityLabel={`Profil ${profile.username}`}
            onPress={() => router.push(`/profile/${profile.userId}` as Href)}
            style={[styles.tile, { backgroundColor: tokens.colors.card, borderColor: tokens.colors.border }]}
          >
            {profile.avatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} contentFit="cover" style={StyleSheet.absoluteFill} />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: `${tokens.colors.primary}1C` }]} />
            )}
            <AppAvatar
              name={profile.username}
              source={profile.avatarUrl ? { uri: profile.avatarUrl } : undefined}
              size={34}
              style={{ borderColor: tokens.colors.primary, borderWidth: 2 }}
            />
            <AppText variant="caption" numberOfLines={2} style={styles.storyLabel}>{profile.username}</AppText>
          </Pressable>
        )) : null}
      </ScrollView>
      <ComposerModal visible={compose} title="Utwórz relację" placeholder="Dodaj opis relacji…" draftScope="story" currentUserId={currentUserId} onClose={() => setCompose(false)} onSubmit={onCreate} />
      <AppModal visible={!!story} title={story?.username ?? 'Relacja'} onClose={() => setSelected(null)} presentation="center">
        {story ? <StoryViewer story={story} canPrevious={(selected ?? 0) > 0} canNext={(selected ?? 0) < active.length - 1} onPrevious={() => setSelected((value) => Math.max(0, (value ?? 0) - 1))} onNext={() => selected !== null && selected < active.length - 1 ? setSelected(selected + 1) : setSelected(null)} /> : null}
      </AppModal>
    </>
  );
}

function StoryViewer({ story, canPrevious, canNext, onPrevious, onNext }: { story: SocialStory; canPrevious: boolean; canNext: boolean; onPrevious(): void; onNext(): void }) {
  const { tokens } = useAppTheme();
  const parsed = parseSocialContent(story.content);
  return (
    <View style={styles.viewer}>
      <AppText variant="caption" tone="muted">{formatSocialTimeAgo(story.created_at)}</AppText>
      {parsed.imagePath ? <Image source={{ uri: getSocialImageUrl(parsed.imagePath) }} contentFit="contain" style={[styles.viewerImage, { backgroundColor: tokens.colors.muted }]} /> : null}
      {parsed.text ? <AppText selectable style={styles.center}>{parsed.text}</AppText> : null}
      <View style={styles.viewerControls}>
        <Pressable accessibilityRole="button" accessibilityLabel="Poprzednia relacja" disabled={!canPrevious} onPress={onPrevious} style={[styles.nav, !canPrevious && styles.disabled]}><ChevronLeft color={tokens.colors.foreground} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Następna relacja" onPress={onNext} style={styles.nav}><ChevronRight color={tokens.colors.foreground} /><AppText variant="caption">{canNext ? 'Dalej' : 'Zamknij'}</AppText></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { gap: 9, paddingHorizontal: 10, paddingVertical: 10 },
  tile: { width: 104, height: 148, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 8, overflow: 'hidden', justifyContent: 'space-between' },
  plus: { position: 'absolute', left: 43, top: 45, width: 25, height: 25, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  label: { textAlign: 'center' },
  storyLabel: { color: '#fff', fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 5 },
  viewer: { gap: 14, alignItems: 'center' },
  viewerImage: { width: '100%', aspectRatio: 9 / 14, borderRadius: 16 },
  center: { textAlign: 'center' },
  viewerControls: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  nav: { minHeight: 44, flexDirection: 'row', gap: 5, alignItems: 'center', paddingHorizontal: 8 },
  disabled: { opacity: 0.35 },
});
