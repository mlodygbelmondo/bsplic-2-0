import { View } from 'react-native';

import type { BetProposalSource } from '@/types/database';
import { useTheme } from '@/theme';
import type { AgentProposalMetadata } from '../../proposal-source';
import { Pill } from './primitives';

const CONFIDENCE_LABEL: Record<NonNullable<AgentProposalMetadata['confidence']>, string> = {
  low: 'Niska',
  medium: 'Średnia',
  high: 'Wysoka',
};

// Tailwind indigo-100/700 and emerald-100/700 (the web's `dark:` variants never apply).
const AGENT_TONE = { background: '#e0e7ff', color: '#4338ca' };
const HUMAN_TONE = { background: '#d1fae5', color: '#047857' };

/** Web `ProposalSourceBadges`: source chip plus agent context chips. */
export function ProposalSourceBadges({
  source,
  metadata,
}: {
  source: BetProposalSource;
  metadata: AgentProposalMetadata | null;
}) {
  const { colors } = useTheme();
  const isAgent = source === 'agent';
  const tone = isAgent ? AGENT_TONE : HUMAN_TONE;
  const chips: string[] = [];
  if (isAgent && metadata?.confidence) chips.push(`Pewność: ${CONFIDENCE_LABEL[metadata.confidence]}`);
  if (isAgent && metadata?.reason) chips.push(metadata.reason);
  if (isAgent && metadata?.sources) chips.push(`Źródła: ${metadata.sources.length}`);
  if (isAgent && metadata?.checkedRecentBetIds?.length) {
    chips.push(`Sprawdzono: ${metadata.checkedRecentBetIds.length}`);
  }

  return (
    <View style={{ marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      <Pill
        label={isAgent ? 'Agent' : 'Użytkownik'}
        background={tone.background}
        color={tone.color}
        size="2xs"
        weight="400"
        paddingX={8}
      />
      {chips.map((chip) => (
        <Pill
          key={chip}
          label={chip}
          background={colors.muted}
          color={colors.mutedForeground}
          size="2xs"
          weight="400"
          paddingX={8}
        />
      ))}
    </View>
  );
}
