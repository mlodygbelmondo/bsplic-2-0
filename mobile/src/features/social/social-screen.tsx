import { useCallback, useEffect, useMemo, useState } from 'react';
import { router, type Href } from 'expo-router';
import { MessageSquarePlus } from 'lucide-react-native';
import { Alert, AppState, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { AppAvatar } from '@/components/ui/AppAvatar';
import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { AppLoader } from '@/components/feedback/AppLoader';
import { StateNotice } from '@/components/feedback/StateNotice';
import { fetchBetsByIds } from '@/features/home/api/bets';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useRouteActive } from '@/hooks/use-route-active';
import { useAuth } from '@/providers/auth-provider';
import { useCoupon } from '@/providers/coupon-provider';
import { useNetwork } from '@/providers/network-provider';
import type { FeedItemType, ReactionEmoji, SocialComment, SocialFeedItem, SocialStory } from '@/types/database';

import { respondAsEniu } from './api/eniuBot';
import { addComment, createPost, createSocialStory, fetchActiveSocialStories, fetchComments, fetchSocialFeed, fetchSocialFeedItem, toggleReaction } from './api/social';
import { cacheSocialFeed, cacheSocialStories, readCachedFeed, readCachedStories } from './cache';
import { ComposerModal } from './components/composer-modal';
import { FeedCard } from './components/feed-card';
import { ReactorsModal, type ReactionTarget } from './components/reactions';
import { Stories, type StoryProfile } from './components/stories';
import { buildSocialContent, mentionsEniu } from './content';
import { useSocialRealtime } from './hooks/use-social-realtime';
import { uploadSocialImage, type PreparedSocialImage } from './images';
import { buildCouponItemsFromSocial } from './lib/copy-coupon';
import { updateReactionCounts } from './lib/feedReactions';

const PAGE_SIZE = 30;
const EMPTY_COMMENTS: SocialComment[] = [];
type FeedFilter = 'all' | FeedItemType;
const FILTERS: Array<{ value: FeedFilter; label: string }> = [
  { value: 'all', label: 'Wszystko' },
  { value: 'coupon', label: 'Kupony' },
  { value: 'post', label: 'Posty' },
  { value: 'casino', label: 'Kasyno' },
];

const itemKey = (type: FeedItemType, id: string) => `${type}:${id}`;
const targetFor = (type: FeedItemType, id: string) => type === 'post' ? { postId: id } : type === 'coupon' ? { couponId: id } : { casinoShareId: id };

export function SocialScreen() {
  const routeActive = useRouteActive();
  const { tokens } = useAppTheme();
  const { user, profile } = useAuth();
  const network = useNetwork();
  const coupon = useCoupon();
  const cachedFeed = useMemo(readCachedFeed, []);
  const [items, setItems] = useState<SocialFeedItem[]>(cachedFeed);
  const [stories, setStories] = useState<SocialStory[]>(readCachedStories);
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [loading, setLoading] = useState(cachedFeed.length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, SocialComment[]>>({});
  const [commentsLoaded, setCommentsLoaded] = useState<Record<string, boolean>>({});
  const [commentsLoading, setCommentsLoading] = useState<Record<string, boolean>>({});
  const [composerOpen, setComposerOpen] = useState(false);
  const [commentComposer, setCommentComposer] = useState<{ item: SocialFeedItem; parentId?: string; initialText?: string } | null>(null);
  const [reactorsTarget, setReactorsTarget] = useState<ReactionTarget | null>(null);
  const [copyingId, setCopyingId] = useState<string | null>(null);

  const writesDisabled = !user || !network.canPerformWrites;
  const visibleItems = useMemo(() => filter === 'all' ? items : items.filter((item) => item.item_type === filter), [filter, items]);
  const storyProfiles = useMemo<StoryProfile[]>(() => {
    const seen = new Set<string>();
    const profiles: StoryProfile[] = [];

    for (const item of items) {
      if (seen.has(item.user_id)) continue;
      seen.add(item.user_id);
      profiles.push({ userId: item.user_id, username: item.username, avatarUrl: item.avatar_url ?? null });
      if (profiles.length >= 8) break;
    }

    return profiles;
  }, [items]);

  const loadStories = useCallback(async () => {
    if (!user || network.isOnline === false) return;
    const next = await fetchActiveSocialStories();
    setStories(next);
    cacheSocialStories(next);
  }, [network.isOnline, user]);

  const loadFeed = useCallback(async (refresh = false) => {
    if (network.isOnline === false) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const next = await fetchSocialFeed(PAGE_SIZE, 0, user?.id);
      setItems(next);
      cacheSocialFeed(next);
      setHasMore(next.length === PAGE_SIZE);
      if (refresh) await loadStories();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Nie udało się wczytać Socialu.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadStories, network.isOnline, user?.id]);

  const loadMore = useCallback(async () => {
    if (loading || refreshing || loadingMore || !hasMore || network.isOnline === false) return;
    setLoadingMore(true);
    try {
      const next = await fetchSocialFeed(PAGE_SIZE, items.length, user?.id);
      setItems((current) => {
        const known = new Set(current.map((item) => itemKey(item.item_type, item.id)));
        const merged = [...current, ...next.filter((item) => !known.has(itemKey(item.item_type, item.id)))];
        cacheSocialFeed(merged);
        return merged;
      });
      setHasMore(next.length === PAGE_SIZE);
    } catch (reason) {
      Alert.alert('Nie udało się wczytać kolejnych wpisów', reason instanceof Error ? reason.message : 'Spróbuj ponownie.');
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, items.length, loading, loadingMore, network.isOnline, refreshing, user?.id]);

  useEffect(() => { if (routeActive) { void loadFeed(); void loadStories().catch(() => undefined); } }, [loadFeed, loadStories, routeActive]);
  useEffect(() => {
    if (!routeActive) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && network.isOnline === true) void loadFeed(true);
    });
    return () => subscription.remove();
  }, [loadFeed, network.isOnline, routeActive]);

  const refreshItem = useCallback(async (type: FeedItemType, id: string, allowInsert: boolean) => {
    const next = await fetchSocialFeedItem(type, id, user?.id);
    setItems((current) => {
      const index = current.findIndex((item) => item.id === id && item.item_type === type);
      let updated = current;
      if (!next) updated = current.filter((_, candidate) => candidate !== index);
      else if (index >= 0) updated = current.map((item, candidate) => candidate === index ? next : item);
      else if (allowInsert) updated = [next, ...current];
      cacheSocialFeed(updated);
      return updated;
    });
  }, [user?.id]);

  const loadComments = useCallback(async (id: string, type: FeedItemType) => {
    const key = itemKey(type, id);
    if (network.isOnline === false) return;
    setCommentsLoading((state) => ({ ...state, [key]: true }));
    try {
      const next = await fetchComments(targetFor(type, id), user?.id);
      setComments((state) => ({ ...state, [key]: next }));
      setCommentsLoaded((state) => ({ ...state, [key]: true }));
      setItems((current) => current.map((item) => item.id === id && item.item_type === type ? { ...item, comment_count: next.length } : item));
    } catch (reason) {
      Alert.alert('Nie udało się wczytać komentarzy', reason instanceof Error ? reason.message : 'Spróbuj ponownie.');
    } finally {
      setCommentsLoading((state) => ({ ...state, [key]: false }));
    }
  }, [network.isOnline, user?.id]);

  useSocialRealtime({ enabled: routeActive && network.isOnline === true, feedItems: items, commentsLoaded, refreshItem, refreshComments: loadComments });

  const createContent = async (kind: 'post' | 'story', text: string, image: PreparedSocialImage | null) => {
    if (!user || !network.canPerformWrites) throw new Error('Publikowanie wymaga połączenia z internetem.');
    const imagePath = image ? await uploadSocialImage(user.id, image) : null;
    const payload = buildSocialContent(text, imagePath);
    if (kind === 'story') {
      await createSocialStory(user.id, payload);
      await loadStories();
      Alert.alert('Gotowe', 'Relacja została opublikowana.');
      return;
    }
    const id = await createPost(user.id, payload);
    await loadFeed(true);
    if (mentionsEniu(text)) triggerEniu('post', id, () => loadComments(id, 'post'));
  };

  const addNewComment = async (text: string, image: PreparedSocialImage | null) => {
    const current = commentComposer;
    if (!user || !current || !network.canPerformWrites) throw new Error('Komentowanie wymaga połączenia z internetem.');
    const imagePath = image ? await uploadSocialImage(user.id, image) : null;
    const id = await addComment({ userId: user.id, content: buildSocialContent(text, imagePath), ...targetFor(current.item.item_type, current.item.id), parentId: current.parentId });
    await loadComments(current.item.id, current.item.item_type);
    if (mentionsEniu(text)) triggerEniu('comment', id, () => loadComments(current.item.id, current.item.item_type));
  };

  const reactItem = async (item: SocialFeedItem, emoji: ReactionEmoji) => {
    if (!user || !network.canPerformWrites) return;
    try {
      const next = await toggleReaction({ userId: user.id, emoji, ...targetFor(item.item_type, item.id) });
      setItems((current) => current.map((candidate) => candidate.id === item.id && candidate.item_type === item.item_type ? { ...candidate, reactions: updateReactionCounts(candidate.reactions, candidate.my_reaction, next), my_reaction: next } : candidate));
    } catch (reason) { Alert.alert('Nie udało się zapisać reakcji', reason instanceof Error ? reason.message : 'Spróbuj ponownie.'); }
  };

  const reactComment = async (item: SocialFeedItem, commentId: string, emoji: ReactionEmoji) => {
    if (!user || !network.canPerformWrites) return;
    try {
      const next = await toggleReaction({ userId: user.id, emoji, commentId });
      const key = itemKey(item.item_type, item.id);
      setComments((state) => ({ ...state, [key]: (state[key] ?? []).map((comment) => comment.id === commentId ? { ...comment, reactions: updateReactionCounts(comment.reactions, comment.my_reaction, next), my_reaction: next } : comment) }));
    } catch (reason) { Alert.alert('Nie udało się zapisać reakcji', reason instanceof Error ? reason.message : 'Spróbuj ponownie.'); }
  };

  const copyCoupon = async (item: SocialFeedItem) => {
    if (!network.canPerformWrites) return;
    const ids = Array.from(new Set((item.legs ?? []).map((leg) => leg.bet_id).filter((id): id is string => !!id)));
    if (ids.length === 0) return Alert.alert('Nie można skopiować', 'Ten kupon nie zawiera dostępnych zdarzeń.');
    setCopyingId(item.id);
    try {
      const bets = await fetchBetsByIds(ids);
      const result = buildCouponItemsFromSocial(item.legs ?? [], bets);
      if (result.items.length === 0) return Alert.alert('Nie można skopiować', 'Wszystkie zdarzenia są już zamknięte lub rozliczone.');
      coupon.addItems(result.items);
      coupon.setPreferredMode(result.items.length > 1 ? 'ako' : 'single');
      Alert.alert('Kupon skopiowany', result.skippedCount ? `Dodano ${result.items.length}, pominięto ${result.skippedCount}.` : `Dodano ${result.items.length} zdarzeń.`);
      router.push('/' as Href);
    } catch (reason) { Alert.alert('Nie udało się skopiować kuponu', reason instanceof Error ? reason.message : 'Spróbuj ponownie.'); }
    finally { setCopyingId(null); }
  };

  const header = (
    <View>
      {network.isOnline === false ? <View style={[styles.offlineBanner, { backgroundColor: tokens.colors.warning }]}><AppText variant="caption" style={{ color: '#1B1918' }}>Tryb offline — pokazujemy zapisane dane, operacje są wyłączone.</AppText></View> : null}
      {error && network.isOnline !== false ? <Pressable accessibilityRole="button" onPress={() => void loadFeed(true)} style={[styles.errorBanner, { backgroundColor: `${tokens.colors.destructive}18` }]}><AppText selectable variant="caption" tone="danger">Nie udało się odświeżyć: {error} Dotknij, aby spróbować ponownie.</AppText></Pressable> : null}
      <View style={[styles.filters, { backgroundColor: tokens.colors.card, borderColor: tokens.colors.border }]}>
        {FILTERS.map((entry) => <Pressable key={entry.value} accessibilityRole="button" accessibilityState={{ selected: filter === entry.value }} onPress={() => setFilter(entry.value)} style={[styles.filter, filter === entry.value && { backgroundColor: tokens.colors.primary }]}><AppText variant="caption" style={filter === entry.value ? { color: tokens.colors.primaryForeground, fontWeight: '700' } : undefined}>{entry.label}</AppText></Pressable>)}
      </View>
      {user ? <Pressable accessibilityRole="button" disabled={writesDisabled} onPress={() => setComposerOpen(true)} style={[styles.composeEntry, { backgroundColor: tokens.colors.card, borderColor: tokens.colors.border }]}><AppAvatar name={profile?.username ?? 'Ty'} source={profile?.avatar_url ? { uri: profile.avatar_url } : undefined} size={40} /><View style={[styles.composePrompt, { backgroundColor: tokens.colors.muted }]}><AppText tone="muted">Co nowego?</AppText></View><MessageSquarePlus size={22} color={tokens.colors.primary} /></Pressable> : null}
      {user ? <Stories stories={stories} profileFallbacks={storyProfiles} currentUserId={user.id} currentUsername={profile?.username ?? 'Ty'} currentAvatarUrl={profile?.avatar_url} writesDisabled={writesDisabled} onCreate={(text, image) => createContent('story', text, image)} /> : null}
    </View>
  );

  if (loading && items.length === 0) return <View style={[styles.center, { backgroundColor: tokens.colors.background }]}><AppLoader label="Wczytywanie aktywności…" /></View>;
  if (error && items.length === 0) return <View style={[styles.state, { backgroundColor: tokens.colors.background }]}><StateNotice kind={network.isOnline === false ? 'offline' : 'error'} message={error} onAction={() => void loadFeed()} /></View>;

  return (
    <View style={[styles.screen, { backgroundColor: tokens.colors.background }]}>
      <FlatList
        data={visibleItems}
        keyExtractor={(item) => itemKey(item.item_type, item.id)}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.list}
        ListHeaderComponent={header}
        renderItem={({ item }) => {
          const key = itemKey(item.item_type, item.id);
          return <FeedCard item={item} comments={comments[key] ?? EMPTY_COMMENTS} commentsLoaded={!!commentsLoaded[key]} commentsLoading={!!commentsLoading[key]} writesDisabled={writesDisabled} copying={copyingId === item.id} onOpen={() => router.push(`/social/${item.item_type}/${item.id}` as Href)} onCopyCoupon={item.item_type === 'coupon' ? () => void copyCoupon(item) : undefined} onLoadComments={() => void loadComments(item.id, item.item_type)} onComposeComment={(parentId, initialText) => setCommentComposer({ item, parentId, initialText })} onReact={(emoji) => void reactItem(item, emoji)} onReactComment={(id, emoji) => void reactComment(item, id, emoji)} onOpenReactors={setReactorsTarget} />;
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadFeed(true)} tintColor={tokens.colors.primary} />}
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.8}
        ListEmptyComponent={<StateNotice kind="empty" title={filter === 'all' ? 'Brak aktywności' : 'Brak wpisów dla tego filtra'} message="Nowe wpisy pojawią się tutaj." />}
        ListFooterComponent={loadingMore ? <AppLoader size="small" label="Ładowanie kolejnych wpisów…" /> : <View style={styles.footer} />}
      />
      <ComposerModal visible={composerOpen} title="Utwórz post" placeholder="Co nowego? Oznacz użytkownika przez @…" draftScope="post" currentUserId={user?.id} onClose={() => setComposerOpen(false)} onSubmit={(text, image) => createContent('post', text, image)} />
      <ComposerModal key={`${commentComposer?.item.item_type ?? ''}:${commentComposer?.item.id ?? ''}:${commentComposer?.parentId ?? ''}`} visible={!!commentComposer} title={commentComposer?.parentId ? 'Odpowiedz' : 'Dodaj komentarz'} placeholder="Napisz komentarz…" draftScope={commentComposer ? `comment.${itemKey(commentComposer.item.item_type, commentComposer.item.id)}.${commentComposer.parentId ?? 'root'}` : 'comment'} currentUserId={user?.id} initialText={commentComposer?.initialText} onClose={() => setCommentComposer(null)} onSubmit={addNewComment} />
      <ReactorsModal visible={!!reactorsTarget} target={reactorsTarget} onClose={() => setReactorsTarget(null)} />
    </View>
  );
}

function triggerEniu(type: 'post' | 'comment', id: string, refresh: () => void | Promise<void>) {
  void respondAsEniu(type, id).then(() => refresh()).catch((error: unknown) => console.warn('Eniu response failed', error instanceof Error ? error.message : error));
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, justifyContent: 'center' },
  state: { flex: 1, justifyContent: 'center', padding: 16 },
  list: { gap: 8, paddingBottom: 110 },
  offlineBanner: { paddingHorizontal: 14, paddingVertical: 8 },
  errorBanner: { paddingHorizontal: 14, paddingVertical: 9 },
  filters: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, padding: 7, gap: 5 },
  filter: { flex: 1, minHeight: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  composeEntry: { minHeight: 62, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 9 },
  composePrompt: { flex: 1, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10 },
  footer: { height: 20 },
});
