import { useCallback, useEffect, useMemo, useState } from 'react';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { AppLoader } from '@/components/feedback/AppLoader';
import { StateNotice } from '@/components/feedback/StateNotice';
import { fetchBetsByIds } from '@/features/home/api/bets';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useAuth } from '@/providers/auth-provider';
import { useCoupon } from '@/providers/coupon-provider';
import { useNetwork } from '@/providers/network-provider';
import type { FeedItemType, ReactionEmoji, SocialComment, SocialFeedItem } from '@/types/database';

import { respondAsEniu } from './api/eniuBot';
import { addComment, fetchComments, fetchSocialFeedItem, toggleReaction } from './api/social';
import { readCachedFeed } from './cache';
import { ComposerModal } from './components/composer-modal';
import { FeedCard } from './components/feed-card';
import { ReactorsModal, type ReactionTarget } from './components/reactions';
import { buildSocialContent, mentionsEniu } from './content';
import { useSocialRealtime } from './hooks/use-social-realtime';
import { uploadSocialImage, type PreparedSocialImage } from './images';
import { buildCouponItemsFromSocial } from './lib/copy-coupon';
import { updateReactionCounts } from './lib/feedReactions';

interface SocialItemScreenProps {
  itemType?: FeedItemType;
  itemId?: string;
}

const targetFor = (type: FeedItemType, id: string) => type === 'post' ? { postId: id } : type === 'coupon' ? { couponId: id } : { casinoShareId: id };

export function SocialItemScreen(props: SocialItemScreenProps = {}) {
  const params = useLocalSearchParams<{ itemType?: string | string[]; itemId?: string | string[] }>();
  const typeValue = props.itemType ?? (Array.isArray(params.itemType) ? params.itemType[0] : params.itemType);
  const id = props.itemId ?? (Array.isArray(params.itemId) ? params.itemId[0] : params.itemId);
  const type = typeValue === 'post' || typeValue === 'coupon' || typeValue === 'casino' ? typeValue : null;
  const { tokens } = useAppTheme();
  const { user } = useAuth();
  const network = useNetwork();
  const coupon = useCoupon();
  const cached = useMemo(() => type && id ? readCachedFeed().find((entry) => entry.item_type === type && entry.id === id) ?? null : null, [id, type]);
  const [item, setItem] = useState<SocialFeedItem | null>(cached);
  const [comments, setComments] = useState<SocialComment[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);
  const [composer, setComposer] = useState<{ parentId?: string; initialText?: string } | null>(null);
  const [reactors, setReactors] = useState<ReactionTarget | null>(null);
  const [copying, setCopying] = useState(false);
  const writesDisabled = !user || !network.canPerformWrites;

  const loadItem = useCallback(async () => {
    if (!type || !id) {
      setError('Nieprawidłowy link do publikacji.');
      setLoading(false);
      return;
    }
    if (network.isOnline === false) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const next = await fetchSocialFeedItem(type, id, user?.id);
      setItem(next);
      if (!next) setError('Ta publikacja nie istnieje lub nie jest już dostępna.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Nie udało się wczytać publikacji.'); }
    finally { setLoading(false); }
  }, [id, network.isOnline, type, user?.id]);

  const loadComments = useCallback(async () => {
    if (!type || !id || network.isOnline === false) return;
    setCommentsLoading(true);
    try {
      const next = await fetchComments(targetFor(type, id), user?.id);
      setComments(next);
      setCommentsLoaded(true);
      setItem((current) => current ? { ...current, comment_count: next.length } : current);
    } catch (reason) { Alert.alert('Nie udało się wczytać komentarzy', reason instanceof Error ? reason.message : 'Spróbuj ponownie.'); }
    finally { setCommentsLoading(false); }
  }, [id, network.isOnline, type, user?.id]);

  useEffect(() => { void loadItem(); }, [loadItem]);
  const loadedItemId = item?.id;
  useEffect(() => {
    if (loadedItemId && network.isOnline !== false) void loadComments();
  }, [loadComments, loadedItemId, network.isOnline]);
  const refreshRealtimeItem = useCallback(async (nextType: FeedItemType, nextId: string) => {
    const next = await fetchSocialFeedItem(nextType, nextId, user?.id);
    setItem(next);
  }, [user?.id]);
  const refreshRealtimeComments = useCallback(() => loadComments(), [loadComments]);
  useSocialRealtime({ enabled: !!item && network.isOnline === true, feedItems: item ? [item] : [], commentsLoaded: item ? { [`${item.item_type}:${item.id}`]: commentsLoaded } : {}, refreshItem: refreshRealtimeItem, refreshComments: refreshRealtimeComments });

  const reactItem = async (emoji: ReactionEmoji) => {
    if (!item || !user || !network.canPerformWrites) return;
    try {
      const next = await toggleReaction({ userId: user.id, emoji, ...targetFor(item.item_type, item.id) });
      setItem({ ...item, reactions: updateReactionCounts(item.reactions, item.my_reaction, next), my_reaction: next });
    } catch (reason) { Alert.alert('Nie udało się zapisać reakcji', reason instanceof Error ? reason.message : 'Spróbuj ponownie.'); }
  };

  const reactComment = async (commentId: string, emoji: ReactionEmoji) => {
    if (!user || !network.canPerformWrites) return;
    try {
      const next = await toggleReaction({ userId: user.id, emoji, commentId });
      setComments((current) => current.map((comment) => comment.id === commentId ? { ...comment, reactions: updateReactionCounts(comment.reactions, comment.my_reaction, next), my_reaction: next } : comment));
    } catch (reason) { Alert.alert('Nie udało się zapisać reakcji', reason instanceof Error ? reason.message : 'Spróbuj ponownie.'); }
  };

  const submitComment = async (text: string, image: PreparedSocialImage | null) => {
    if (!item || !user || !network.canPerformWrites) throw new Error('Komentowanie wymaga połączenia z internetem.');
    const imagePath = image ? await uploadSocialImage(user.id, image) : null;
    const commentId = await addComment({ userId: user.id, content: buildSocialContent(text, imagePath), ...targetFor(item.item_type, item.id), parentId: composer?.parentId });
    await loadComments();
    if (mentionsEniu(text)) void respondAsEniu('comment', commentId).then(loadComments).catch((reason: unknown) => console.warn('Eniu response failed', reason));
  };

  const copyCoupon = async () => {
    if (!item || item.item_type !== 'coupon' || !network.canPerformWrites) return;
    const ids = Array.from(new Set((item.legs ?? []).map((leg) => leg.bet_id).filter((value): value is string => !!value)));
    if (!ids.length) return Alert.alert('Nie można skopiować', 'Brak dostępnych zdarzeń.');
    setCopying(true);
    try {
      const result = buildCouponItemsFromSocial(item.legs ?? [], await fetchBetsByIds(ids));
      if (!result.items.length) return Alert.alert('Nie można skopiować', 'Wszystkie zdarzenia są zamknięte lub rozliczone.');
      coupon.addItems(result.items);
      coupon.setPreferredMode(result.items.length > 1 ? 'ako' : 'single');
      router.push('/' as Href);
    } catch (reason) { Alert.alert('Nie udało się skopiować kuponu', reason instanceof Error ? reason.message : 'Spróbuj ponownie.'); }
    finally { setCopying(false); }
  };

  if (loading && !item) return <View style={[styles.center, { backgroundColor: tokens.colors.background }]}><AppLoader label="Wczytywanie publikacji…" /></View>;
  if (!item) return <View style={[styles.state, { backgroundColor: tokens.colors.background }]}><StateNotice kind={network.isOnline === false ? 'offline' : 'error'} title={network.isOnline === false && cached ? 'Publikacja z pamięci' : 'Nie znaleziono publikacji'} message={error ?? 'Połącz się z internetem i spróbuj ponownie.'} onAction={() => void loadItem()} /></View>;

  return (
    <View style={[styles.screen, { backgroundColor: tokens.colors.background }]}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content} refreshControl={undefined}>
        {network.isOnline === false ? <StateNotice kind="offline" message="Wyświetlasz zapisaną publikację. Reakcje i komentarze są wyłączone." /> : null}
        <FeedCard item={item} comments={comments} commentsLoaded={commentsLoaded} commentsLoading={commentsLoading} writesDisabled={writesDisabled} copying={copying} showComments onCopyCoupon={item.item_type === 'coupon' ? () => void copyCoupon() : undefined} onLoadComments={() => void loadComments()} onComposeComment={(parentId, initialText) => setComposer({ parentId, initialText })} onReact={(emoji) => void reactItem(emoji)} onReactComment={(commentId, emoji) => void reactComment(commentId, emoji)} onOpenReactors={setReactors} />
      </ScrollView>
      <ComposerModal key={`${composer?.parentId ?? 'root'}:${composer?.initialText ?? ''}`} visible={!!composer} title={composer?.parentId ? 'Odpowiedz' : 'Dodaj komentarz'} placeholder="Napisz komentarz…" draftScope={`comment.${item.item_type}:${item.id}.${composer?.parentId ?? 'root'}`} currentUserId={user?.id} initialText={composer?.initialText} onClose={() => setComposer(null)} onSubmit={submitComment} />
      <ReactorsModal visible={!!reactors} target={reactors} onClose={() => setReactors(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, justifyContent: 'center' },
  state: { flex: 1, justifyContent: 'center', padding: 16 },
  content: { gap: 10, paddingBottom: 110 },
});
