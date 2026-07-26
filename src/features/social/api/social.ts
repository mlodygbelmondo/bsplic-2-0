import { callRpc } from '@/integrations/supabase/rpc';
import type {
  ReactionEmoji,
  RouletteBetType,
  RouletteColor,
  SocialComment,
  SocialFeedItem,
  SocialStory,
} from '@/types/database';

// ── Feed ──────────────────────────────────────────────────────

export async function fetchSocialFeed(
  limit = 30,
  offset = 0,
  userId?: string
): Promise<SocialFeedItem[]> {
  const data = await callRpc('get_social_feed', {
    p_limit: limit,
    p_offset: offset,
    p_user_id: userId ?? null,
  });

  return data ?? [];
}

export async function fetchSocialFeedItem(
  itemType: 'post' | 'coupon' | 'casino',
  itemId: string,
  userId?: string,
): Promise<SocialFeedItem | null> {
  const data = await callRpc('get_social_feed_item', {
    p_item_type: itemType,
    p_item_id: itemId,
    p_user_id: userId ?? null,
  });

  return data ?? null;
}

// ── Posts ──────────────────────────────────────────────────────

export async function createPost(userId: string, content: string): Promise<string> {
  return callRpc('create_social_post', {
    p_user_id: userId,
    p_content: content,
  });
}

// ── Stories ───────────────────────────────────────────────────

export async function fetchActiveSocialStories(): Promise<SocialStory[]> {
  const data = await callRpc('get_active_social_stories', undefined);
  return data ?? [];
}

export async function createSocialStory(userId: string, content: string): Promise<string> {
  return callRpc('create_social_story', {
    p_user_id: userId,
    p_content: content,
  });
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

export async function fetchComments(
  target: { postId?: string; couponId?: string; casinoShareId?: string },
  userId?: string
): Promise<SocialComment[]> {
  const data = await callRpc('get_comments_for_target', {
    p_post_id: target.postId ?? null,
    p_coupon_id: target.couponId ?? null,
    p_casino_share_id: target.casinoShareId ?? null,
    p_user_id: userId ?? null,
  });

  return data ?? [];
}

export async function addComment(params: {
  userId: string;
  content: string;
  postId?: string;
  couponId?: string;
  casinoShareId?: string;
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

export async function toggleReaction(params: {
  userId: string;
  emoji: ReactionEmoji;
  postId?: string;
  couponId?: string;
  casinoShareId?: string;
  commentId?: string;
}): Promise<ReactionEmoji | null> {
  return callRpc('toggle_reaction', {
    p_user_id: params.userId,
    p_emoji: params.emoji,
    p_post_id: params.postId ?? null,
    p_coupon_id: params.couponId ?? null,
    p_casino_share_id: params.casinoShareId ?? null,
    p_comment_id: params.commentId ?? null,
  });
}
