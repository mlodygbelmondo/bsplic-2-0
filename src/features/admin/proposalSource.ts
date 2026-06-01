import type { Json } from '@/integrations/supabase/types';
import type { BetProposalSource } from '@/types/database';

export interface AgentProposalMetadata {
  confidence?: 'low' | 'medium' | 'high';
  reason?: string;
  sources?: string[];
  eventStartTime?: string;
  checkedRecentBetIds?: string[];
}

export const normalizeProposalSource = (value: unknown): BetProposalSource =>
  value === 'agent' ? 'agent' : 'human';

export const normalizeAgentMetadata = (
  value: Json | null | undefined,
): AgentProposalMetadata | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const metadata = value as Record<string, unknown>;
  const confidence =
    typeof metadata.confidence === 'string' ? metadata.confidence : undefined;

  return {
    confidence:
      confidence === 'low' || confidence === 'medium' || confidence === 'high'
        ? confidence
        : undefined,
    reason: typeof metadata.reason === 'string' ? metadata.reason : undefined,
    sources: Array.isArray(metadata.sources)
      ? metadata.sources.filter(
          (source): source is string => typeof source === 'string',
        )
      : undefined,
    eventStartTime:
      typeof metadata.eventStartTime === 'string'
        ? metadata.eventStartTime
        : undefined,
    checkedRecentBetIds: Array.isArray(metadata.checkedRecentBetIds)
      ? metadata.checkedRecentBetIds.filter(
          (id): id is string => typeof id === 'string',
        )
      : undefined,
  };
};
