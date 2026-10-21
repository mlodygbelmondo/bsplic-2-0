import { callRpc } from '@/lib/rpc';
import { supabase } from '@/lib/supabase';
import type {
  Bet,
  FeedItemType,
  ReactionEmoji,
  RouletteBetType,
  RouletteColor,
  SocialComment,
  SocialFeedItem,
  SocialStory,
} from '@/types/database';
import type { ReactorUser } from '@/types/social';
import type { ReactorsTarget, SocialItemTarget } from '../lib/routes';

/** RPC wrappers of the web `features/social/api/social.ts` and `api/reactions.ts`. */

// ── Feed ──────────────────────────────────────────────────────

export async function fetchSocialFeed(limit: number, offset: number, userId?: string | null): Promise<SocialFeedItem[]> {
  const data = await callRpc('get_social_feed', { p_limit: limit, p_offset: offset, p_user_id: userId ?? null });
  return data ?? [];
}

export async function fetchSocialFeedItem(
  itemType: FeedItemType,
  itemId: string,
  userId?: string | null,
): Promise<SocialFeedItem | null> {
  const data = await callRpc('get_social_feed_item', {
    p_item_type: itemType,
    p_item_id: itemId,
    p_user_id: userId ?? null,
  });
  return data ?? null;
}

// ── Posts and stories ─────────────────────────────────────────

export async function createPost(userId: string, content: string): Promise<string> {
  return callRpc('create_social_post', { p_user_id: userId, p_content: content });
}

export async function fetchActiveSocialStories(): Promise<SocialStory[]> {
  const data = await callRpc('get_active_social_stories', undefined);
  return data ?? [];
}

export async function createSocialStory(userId: string, content: string): Promise<string> {
  return callRpc('create_social_story', { p_user_id: userId, p_content: content });
}

export async function createCasinoShare(params: {
  userId: string;
  betId: string;
  content: string;
  betType: RouletteBetType;
  betValue: string;
  stake: number;
  payout: number;
  roundNumber: number | null;
  winningNumber: number | null;
  winningColor: RouletteColor | null;
}): Promise<string> {
  return callRpc('create_casino_social_share', {
    p_user_id: params.userId,
    p_roulette_bet_id: params.betId,
    p_content: params.content,
    p_casino_bet_type: params.betType,
    p_casino_bet_value: params.betValue,
    p_casino_stake: params.stake,
    p_casino_payout: params.payout,
    p_casino_round_number: params.roundNumber,
    p_casino_winning_number: params.winningNumber,
    p_casino_winning_color: params.winningColor,
  });
}

// ── Comments ──────────────────────────────────────────────────

export async function fetchComments(target: SocialItemTarget, userId?: string | null): Promise<SocialComment[]> {
  const data = await callRpc('get_comments_for_target', {
    p_post_id: target.postId ?? null,
    p_coupon_id: target.couponId ?? null,
    p_casino_share_id: target.casinoShareId ?? null,
    p_user_id: userId ?? null,
  });
  return data ?? [];
}

export async function addComment(params: SocialItemTarget & {
  userId: string;
  content: string;
  parentId?: string;
}): Promise<string> {
  return callRpc('add_social_comment', {
    p_user_id: params.userId,
    p_content: params.content,
    p_post_id: params.postId ?? null,
    p_coupon_id: params.couponId ?? null,
    p_casino_share_id: params.casinoShareId ?? null,
    p_parent_id: params.parentId ?? null,
  });
}

// ── Reactions ─────────────────────────────────────────────────

export async function toggleReaction(params: ReactorsTarget & { userId: string; emoji: ReactionEmoji }): Promise<ReactionEmoji | null> {
  return callRpc('toggle_reaction', {
    p_user_id: params.userId,
    p_emoji: params.emoji,
    p_post_id: params.postId ?? null,
    p_coupon_id: params.couponId ?? null,
    p_casino_share_id: params.casinoShareId ?? null,
    p_comment_id: params.commentId ?? null,
  });
}

/** Everyone who reacted to an item or comment (the feed never filters by emoji). */
export async function fetchReactors(target: ReactorsTarget): Promise<ReactorUser[]> {
  const data = await callRpc('get_reactors_for_target', {
    p_post_id: target.postId ?? null,
    p_coupon_id: target.couponId ?? null,
    p_casino_share_id: target.casinoShareId ?? null,
    p_comment_id: target.commentId ?? null,
    p_emoji: null,
  });
  return data ?? [];
}

// ── Coupon copy ───────────────────────────────────────────────

/** Web `fetchBetsByIds` (`features/home/api/bets.ts`), used to copy a shared coupon. */
export async function fetchBetsByIds(ids: string[]): Promise<Bet[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from('bets').select('*').in('id', ids);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Bet[];
}

// ── Eniu ──────────────────────────────────────────────────────

export interface EniuReplyResult {
  ok: boolean;
  text?: string | null;
  providerDiagnostic?: Record<string, unknown>;
  result?: unknown;
  error?: string;
}

/** Asks Eniu to reply to a post or comment that mentions him (web `api/eniuBot.ts`). */
export async function respondAsEniu(sourceType: 'post' | 'comment', sourceId: string): Promise<EniuReplyResult> {
  const { data, error } = await supabase.functions.invoke('respond-as-eniu', { body: { sourceType, sourceId } });
  if (error) throw new Error(error.message);
  return data as EniuReplyResult;
}
