import { queryOptions } from '@tanstack/react-query';

import { PAGE_DATA_QUERY_OPTIONS } from '@/lib/query-client';
import { callRpc } from '@/lib/rpc';
import { supabase } from '@/lib/supabase';
import type { EniuBotRun } from '@/types/social';
import type { EniuSourceType } from '../logic/eniu-runs';

/** Admin calls of the web `features/social/api/eniuBot.ts`. */

interface EniuReplyResult {
  ok: boolean;
  text?: string | null;
  error?: string;
}

interface EniuCommandResult {
  ok: boolean;
  preview: boolean;
  text: string;
  error?: string;
}

export const ADMIN_ENIU_RUNS_QUERY_KEY = ['admin', 'eniu-runs'] as const;

export const eniuRunsQueryOptions = () =>
  queryOptions({
    queryKey: ADMIN_ENIU_RUNS_QUERY_KEY,
    queryFn: async (): Promise<EniuBotRun[]> =>
      (await callRpc('admin_get_social_bot_runs', { p_limit: 20 })) ?? [],
    ...PAGE_DATA_QUERY_OPTIONS,
  });

export async function retryEniuResponse(
  sourceType: EniuSourceType,
  sourceId: string,
): Promise<EniuReplyResult> {
  const { data, error } = await supabase.functions.invoke('respond-as-eniu', {
    body: { sourceType, sourceId, retry: true },
  });
  if (error) throw new Error(error.message);
  return data as EniuReplyResult;
}

export async function commandEniu(command: string, preview: boolean): Promise<EniuCommandResult> {
  const { data, error } = await supabase.functions.invoke('command-eniu', {
    body: { command, preview },
  });
  if (error) throw new Error(error.message);
  return data as EniuCommandResult;
}
