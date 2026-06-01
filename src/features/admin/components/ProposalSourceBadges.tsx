import type { BetProposalSource } from '@/types/database';
import type { AgentProposalMetadata } from '../proposalSource';

interface ProposalSourceBadgesProps {
  source: BetProposalSource;
  metadata: AgentProposalMetadata | null;
}

const confidenceLabel: Record<
  NonNullable<AgentProposalMetadata['confidence']>,
  string
> = {
  low: 'Niska',
  medium: 'Średnia',
  high: 'Wysoka',
};

const badgeClass =
  'px-2 py-0.5 rounded-full bg-muted text-[10px] text-muted-foreground';

export default function ProposalSourceBadges({
  source,
  metadata,
}: ProposalSourceBadgesProps) {
  const isAgent = source === 'agent';

  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
      <span
        className={`px-2 py-0.5 rounded-full ${
          isAgent
            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200'
            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
        }`}
      >
        {isAgent ? 'Agent' : 'Użytkownik'}
      </span>

      {isAgent && metadata?.confidence ? (
        <span className={badgeClass}>
          Pewność: {confidenceLabel[metadata.confidence]}
        </span>
      ) : null}

      {isAgent && metadata?.reason ? (
        <span className={badgeClass}>{metadata.reason}</span>
      ) : null}

      {isAgent && metadata?.sources ? (
        <span className={badgeClass}>Źródła: {metadata.sources.length}</span>
      ) : null}

      {isAgent && metadata?.checkedRecentBetIds?.length ? (
        <span className={badgeClass}>
          Sprawdzono: {metadata.checkedRecentBetIds.length}
        </span>
      ) : null}
    </div>
  );
}
