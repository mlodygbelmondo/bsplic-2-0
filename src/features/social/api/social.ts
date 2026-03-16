import { supabase } from '@/integrations/supabase/client';
import type { SocialFeedItem, SocialComment, ReactionEmoji } from '@/types/database';

// The generated Supabase types don't know about our new RPC functions yet.
// We cast .rpc via unknown until types are regenerated.
const rpc = supabase.rpc.bind(supabase) as (...args: unknown[]) => ReturnType<typeof supabase.rpc>;

// ── Feed ──────────────────────────────────────────────────────

export async function fetchSocialFeed(
  limit = 30,
  offset = 0,
  userId?: string
): Promise<SocialFeedItem[]> {
  const { data, error } = await rpc('get_social_feed', {
    p_limit: limit,
    p_offset: offset,
    p_user_id: userId ?? null,
  });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as SocialFeedItem[];
}

// ── Posts ──────────────────────────────────────────────────────

export async function createPost(userId: string, content: string): Promise<string> {
  const { data, error } = await rpc('create_social_post', {
    p_user_id: userId,
    p_content: content,
  });

  if (error) throw new Error(error.message);
  return data as unknown as string;
}

// ── Comments ──────────────────────────────────────────────────

export async function fetchComments(
  target: { postId?: string; couponId?: string },
  userId?: string
): Promise<SocialComment[]> {
  const { data, error } = await rpc('get_comments_for_target', {
    p_post_id: target.postId ?? null,
    p_coupon_id: target.couponId ?? null,
    p_user_id: userId ?? null,
  });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as SocialComment[];
}

export async function addComment(params: {
  userId: string;
  content: string;
  postId?: string;
  couponId?: string;
  parentId?: string;
}): Promise<string> {
  const { data, error } = await rpc('add_social_comment', {
    p_user_id: params.userId,
    p_content: params.content,
    p_post_id: params.postId ?? null,
    p_coupon_id: params.couponId ?? null,
    p_parent_id: params.parentId ?? null,
  });

  if (error) throw new Error(error.message);
  return data as unknown as string;
}

// ── Reactions ─────────────────────────────────────────────────

export async function toggleReaction(params: {
  userId: string;
  emoji: ReactionEmoji;
  postId?: string;
  couponId?: string;
  commentId?: string;
}): Promise<ReactionEmoji | null> {
  const { data, error } = await rpc('toggle_reaction', {
    p_user_id: params.userId,
    p_emoji: params.emoji,
    p_post_id: params.postId ?? null,
    p_coupon_id: params.couponId ?? null,
    p_comment_id: params.commentId ?? null,
  });

  if (error) throw new Error(error.message);
  return data as unknown as ReactionEmoji | null;
}
