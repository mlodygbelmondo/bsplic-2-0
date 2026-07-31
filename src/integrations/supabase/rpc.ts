import { supabase } from '@/integrations/supabase/client';
import type { EniuBotRun } from '@/features/social/api/eniuBot';
import type { MentionUser } from '@/features/social/api/mentions';
import type { ReactorUser } from '@/features/social/api/reactions';
import type { ReactionType } from '@/features/social/reactions';
import type {
  ReactionEmoji,
  RouletteBetType,
  RouletteColor,
  SocialComment,
  SocialFeedItem,
  SocialStory,
  UserNotification,
} from '@/types/database';

/**
 * Client-side contract for every RPC the generated Supabase types don't
 * know about yet. `returns` is the raw PostgREST payload (may be null);
 * callers normalize. Add new RPCs here instead of casting `supabase.rpc`.
 */
export interface RpcContracts {
  get_social_feed: {
    args: { p_limit: number; p_offset: number; p_user_id: string | null };
    returns: SocialFeedItem[] | null;
  };
  get_social_feed_item: {
    args: {
      p_item_type: 'post' | 'coupon' | 'casino';
      p_item_id: string;
      p_user_id: string | null;
    };
    returns: SocialFeedItem | null;
  };
  create_social_post: {
    args: { p_user_id: string; p_content: string };
    returns: string;
  };
  get_active_social_stories: {
    args: undefined;
    returns: SocialStory[] | null;
  };
  create_social_story: {
    args: { p_user_id: string; p_content: string };
    returns: string;
  };
  create_casino_social_share: {
    args: {
      p_user_id: string;
      p_roulette_bet_id: string;
      p_content: string;
      p_casino_bet_type: RouletteBetType;
      p_casino_bet_value: string;
      p_casino_stake: number;
      p_casino_payout: number;
      p_casino_round_number: number | null;
      p_casino_winning_number: number | null;
      p_casino_winning_color: RouletteColor | null;
    };
    returns: string;
  };
  get_comments_for_target: {
    args: {
      p_post_id: string | null;
      p_coupon_id: string | null;
      p_casino_share_id: string | null;
      p_user_id: string | null;
    };
    returns: SocialComment[] | null;
  };
  add_social_comment: {
    args: {
      p_user_id: string;
      p_content: string;
      p_post_id: string | null;
      p_coupon_id: string | null;
      p_casino_share_id: string | null;
      p_parent_id: string | null;
    };
    returns: string;
  };
  toggle_reaction: {
    args: {
      p_user_id: string;
      p_emoji: ReactionEmoji;
      p_post_id: string | null;
      p_coupon_id: string | null;
      p_casino_share_id: string | null;
      p_comment_id: string | null;
    };
    returns: ReactionEmoji | null;
  };
  get_reactors_for_target: {
    args: {
      p_post_id: string | null;
      p_coupon_id: string | null;
      p_casino_share_id: string | null;
      p_comment_id: string | null;
      p_emoji: ReactionType | null;
    };
    returns: ReactorUser[] | null;
  };
  search_mention_users: {
    args: { p_query: string; p_current_user_id: string | null; p_limit: number };
    returns: MentionUser[] | null;
  };
  admin_get_social_bot_runs: {
    args: { p_limit: number };
    returns: EniuBotRun[] | null;
  };
  get_user_notifications: {
    args: { p_user_id: string; p_limit: number; p_offset: number };
    returns: UserNotification[] | null;
  };
  get_unread_notifications_count: {
    args: { p_user_id: string };
    returns: number | null;
  };
  mark_notification_read: {
    args: { p_user_id: string; p_notification_id: string };
    returns: boolean | null;
  };
  mark_all_notifications_read: {
    args: { p_user_id: string };
    returns: number | null;
  };
}

export type RpcName = keyof RpcContracts;

const rawRpc = supabase.rpc.bind(supabase) as (
  name: string,
  args?: Record<string, unknown>,
) => ReturnType<typeof supabase.rpc>;

export async function callRpc<N extends RpcName>(
  name: N,
  args: RpcContracts[N]['args'],
): Promise<RpcContracts[N]['returns']> {
  const { data, error } =
    args === undefined ? await rawRpc(name) : await rawRpc(name, args);
  if (error) throw new Error(error.message);
  return data as RpcContracts[N]['returns'];
}
