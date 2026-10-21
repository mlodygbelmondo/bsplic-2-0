import { queryOptions } from '@tanstack/react-query';

import { PAGE_DATA_QUERY_OPTIONS } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';
import type { AgentRun } from '../logic/agent-runs';

export const ADMIN_AGENT_RUNS_QUERY_KEY = ['admin', 'agent-runs'] as const;

async function fetchAgentRuns(): Promise<AgentRun[]> {
  const { data, error } = await supabase
    .from('agent_runs')
    .select(
      'id, kind, status, started_at, finished_at, created_count, settled_count, held_count, summary, report',
    )
    .order('started_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data ?? [];
}

export const agentRunsQueryOptions = () =>
  queryOptions({
    queryKey: ADMIN_AGENT_RUNS_QUERY_KEY,
    queryFn: fetchAgentRuns,
    ...PAGE_DATA_QUERY_OPTIONS,
  });
