import { supabase } from '@/integrations/supabase/client';

export type EniuSourceType = 'post' | 'comment';

export interface EniuBotRun {
  id: string;
  sourceType: string;
  sourceId: string;
  status: 'pending' | 'success' | 'skipped' | 'error';
  responseCommentId: string | null;
  responsePostId: string | null;
  error: string | null;
  providerDiagnostic: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

interface EniuCommandResult {
  ok: boolean;
  preview: boolean;
  text: string;
  providerDiagnostic?: Record<string, unknown>;
  result?: unknown;
  error?: string;
}

const rpc = supabase.rpc.bind(supabase) as (
  ...args: unknown[]
) => ReturnType<typeof supabase.rpc>;

export async function respondAsEniu(
  sourceType: EniuSourceType,
  sourceId: string,
) {
  const { data, error } = await supabase.functions.invoke('respond-as-eniu', {
    body: { sourceType, sourceId },
  });

  if (error) throw new Error(error.message);
  return data as {
    ok: boolean;
    text?: string;
    providerDiagnostic?: Record<string, unknown>;
    result?: unknown;
    error?: string;
  };
}

export async function commandEniu(command: string, preview: boolean) {
  const { data, error } = await supabase.functions.invoke('command-eniu', {
    body: { command, preview },
  });

  if (error) throw new Error(error.message);
  return data as EniuCommandResult;
}

export async function fetchEniuBotRuns(limit = 20): Promise<EniuBotRun[]> {
  const { data, error } = await rpc('admin_get_social_bot_runs', {
    p_limit: limit,
  });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as EniuBotRun[];
}
