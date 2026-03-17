import { supabase } from '@/integrations/supabase/client';

export interface MentionUser {
  id: string;
  username: string;
}

const rpc = supabase.rpc.bind(supabase) as (...args: unknown[]) => ReturnType<typeof supabase.rpc>;

export async function searchMentionUsers(
  query: string,
  currentUserId?: string,
  limit = 6,
): Promise<MentionUser[]> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];

  const { data, error } = await rpc('search_mention_users', {
    p_query: normalizedQuery,
    p_current_user_id: currentUserId ?? null,
    p_limit: limit,
  });

  if (error) throw new Error(error.message);

  return (data ?? []) as unknown as MentionUser[];
}
