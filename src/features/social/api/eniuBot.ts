import { supabase } from '@/integrations/supabase/client';
import { callRpc } from '@/integrations/supabase/rpc';

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

interface EniuReplyResult {
  ok: boolean;
  text?: string | null;
  providerDiagnostic?: Record<string, unknown>;
  result?: unknown;
  error?: string;
}

interface EniuCommandResult {
  ok: boolean;
  preview: boolean;
  text: string;
  providerDiagnostic?: Record<string, unknown>;
  result?: unknown;
  error?: string;
}

export async function respondAsEniu(
  sourceType: EniuSourceType,
  sourceId: string,
) {
  const { data, error } = await supabase.functions.invoke('respond-as-eniu', {
    body: { sourceType, sourceId },
  });

  if (error) throw new Error(error.message);
  return data as EniuReplyResult;
}

export async function retryEniuResponse(
  sourceType: EniuSourceType,
  sourceId: string,
) {
  const { data, error } = await supabase.functions.invoke('respond-as-eniu', {
    body: { sourceType, sourceId, retry: true },
  });

  if (error) throw new Error(error.message);
  return data as EniuReplyResult;
}

export async function commandEniu(command: string, preview: boolean) {
  const { data, error } = await supabase.functions.invoke('command-eniu', {
    body: { command, preview },
  });

  if (error) throw new Error(error.message);
  return data as EniuCommandResult;
}

export async function fetchEniuBotRuns(limit = 20): Promise<EniuBotRun[]> {
  const data = await callRpc('admin_get_social_bot_runs', {
    p_limit: limit,
  });

  return data ?? [];
}
