import { callRpc } from '@/integrations/supabase/rpc';
import type { ReactionType } from '@/features/social/reactions';

export interface ReactorUser {
  user_id: string;
  username: string;
  emoji: ReactionType;
  created_at: string;
}

export async function fetchReactors(params: {
  postId?: string;
  couponId?: string;
  casinoShareId?: string;
  commentId?: string;
  emoji?: ReactionType;
}): Promise<ReactorUser[]> {
  const data = await callRpc('get_reactors_for_target', {
    p_post_id: params.postId ?? null,
    p_coupon_id: params.couponId ?? null,
    p_casino_share_id: params.casinoShareId ?? null,
    p_comment_id: params.commentId ?? null,
    p_emoji: params.emoji ?? null,
  });

  return data ?? [];
}
