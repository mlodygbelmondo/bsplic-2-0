export interface SportsbookSummary {
  totalBets: number;
  wins: number;
  winRate: number;
  totalProfit: number;
  currentStreak: number;
}

export type PlayerCardArchetypeKey = 'na-plusie' | 'na-fali' | 'weteran-kuponow' | 'nowy-gracz';

export interface PlayerCardDisplayModel {
  profit: number;
  winRate: number;
  currentStreak: number;
  totalCoupons: number;
  wins: number;
  archetype: {
    key: PlayerCardArchetypeKey;
    label: string;
  };
}

const archetypes = {
  positiveResult: { key: 'na-plusie', label: 'Na plusie' },
  strongStreak: { key: 'na-fali', label: 'Na fali' },
  experienced: { key: 'weteran-kuponow', label: 'Weteran kuponów' },
  lowData: { key: 'nowy-gracz', label: 'Nowy gracz' },
} as const;

const STRONG_STREAK_MINIMUM = 3;
const EXPERIENCED_COUPONS_MINIMUM = 25;

function deriveArchetype(summary: SportsbookSummary): PlayerCardDisplayModel['archetype'] {
  if (summary.totalProfit > 0) return archetypes.positiveResult;
  if (summary.currentStreak >= STRONG_STREAK_MINIMUM) return archetypes.strongStreak;
  if (summary.totalBets >= EXPERIENCED_COUPONS_MINIMUM) return archetypes.experienced;
  return archetypes.lowData;
}

export function derivePlayerCardDisplayModel(summary: SportsbookSummary): PlayerCardDisplayModel {
  return {
    profit: summary.totalProfit,
    winRate: summary.winRate,
    currentStreak: summary.currentStreak,
    totalCoupons: summary.totalBets,
    wins: summary.wins,
    archetype: deriveArchetype(summary),
  };
}
