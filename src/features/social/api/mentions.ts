import { callRpc } from '@/integrations/supabase/rpc';

export interface MentionUser {
  id: string;
  username: string;
}

export async function searchMentionUsers(
  query: string,
  currentUserId?: string,
  limit = 6,
): Promise<MentionUser[]> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];

  const data = await callRpc('search_mention_users', {
    p_query: normalizedQuery,
    p_current_user_id: currentUserId ?? null,
    p_limit: limit,
  });

  return data ?? [];
}
