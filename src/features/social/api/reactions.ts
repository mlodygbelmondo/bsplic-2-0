import { supabase } from '@/integrations/supabase/client';
import type { ReactionType } from '@/features/social/reactions';

const rpc = supabase.rpc.bind(supabase) as (...args: unknown[]) => ReturnType<typeof supabase.rpc>;

export interface ReactorUser {
  user_id: string;
  username: string;
  emoji: ReactionType;
  created_at: string;
}

export async function fetchReactors(params: {
  postId?: string;
  couponId?: string;
  commentId?: string;
  emoji?: ReactionType;
}): Promise<ReactorUser[]> {
  const { data, error } = await rpc('get_reactors_for_target', {
    p_post_id: params.postId ?? null,
    p_coupon_id: params.couponId ?? null,
    p_comment_id: params.commentId ?? null,
    p_emoji: params.emoji ?? null,
  });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ReactorUser[];
}
