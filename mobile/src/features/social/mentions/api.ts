import { callRpc } from '@/lib/rpc';
import type { MentionUser } from '@/types/social';

export type { MentionUser } from '@/types/social';

/** `search_mention_users` (web `api/mentions.ts`): blank queries never hit the server. */
export async function searchMentionUsers(query: string, currentUserId?: string, limit = 6): Promise<MentionUser[]> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];

  const data = await callRpc('search_mention_users', {
    p_query: normalizedQuery,
    p_current_user_id: currentUserId ?? null,
    p_limit: limit,
  });

  return data ?? [];
}
