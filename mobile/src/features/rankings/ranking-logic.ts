/** Pure rankings rules ported from the web `RankingsPage` and `rankings/queries.ts`. */

export interface RankEntry {
  id: string;
  username: string;
  total_profit: number;
  win_rate: number;
  total_bets: number;
  won_bets: number;
  lost_bets: number;
  balance: number;
}

export type RankingType = 'sportsbook' | 'casino';

export type SortKey = 'total_profit' | 'win_rate' | 'total_bets';

export type ProfitTone = 'success' | 'destructive' | null;

export const RANKING_TYPES: readonly { value: RankingType; label: string }[] = [
  { value: 'sportsbook', label: 'Zakłady' },
  { value: 'casino', label: 'Kasyno' },
];

export const SORT_TABS: readonly { key: SortKey; label: string }[] = [
  { key: 'total_profit', label: 'Profit' },
  { key: 'win_rate', label: 'Win rate' },
  { key: 'total_bets', label: 'Zakłady' },
];

/** Numeric columns can arrive as strings from PostgREST. */
export function normalizeRankingRows(data: unknown): RankEntry[] {
  return ((data ?? []) as RankEntry[]).map((row) => ({
    ...row,
    total_profit: Number(row.total_profit),
    win_rate: Number(row.win_rate),
    total_bets: Number(row.total_bets),
    won_bets: Number(row.won_bets),
    lost_bets: Number(row.lost_bets),
    balance: Number(row.balance),
  }));
}

/** Descending by the chosen metric; ties keep the server order. */
export function sortRankings(rows: readonly RankEntry[], sortBy: SortKey): RankEntry[] {
  return [...rows].sort((a, b) => b[sortBy] - a[sortBy]);
}

export function formatProfit(profit: number): string {
  return `${profit >= 0 ? '+' : ''}${profit.toFixed(2)} zł`;
}

export function getProfitTone(profit: number): ProfitTone {
  if (profit > 0) return 'success';
  if (profit < 0) return 'destructive';
  return null;
}

export function getMedal(rank: number): string | null {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return null;
}

/** Right-hand metric of a mobile row, driven by the active sort tab. */
export function getPrimaryMetric(
  entry: RankEntry,
  sortBy: SortKey,
): { label: string; value: string; tone: ProfitTone } {
  if (sortBy === 'win_rate') {
    return { label: 'Win rate', value: `${entry.win_rate.toFixed(1)}%`, tone: null };
  }
  if (sortBy === 'total_bets') {
    return { label: 'Zakłady', value: entry.total_bets.toString(), tone: null };
  }
  return {
    label: 'Profit',
    value: formatProfit(entry.total_profit),
    tone: getProfitTone(entry.total_profit),
  };
}

export function getRankingSubline(entry: RankEntry): string {
  return `Profit ${formatProfit(entry.total_profit)} · WR ${entry.win_rate.toFixed(1)}% · ${entry.total_bets} zakł.`;
}

export function getEmptyRankingsMessage(type: RankingType): string {
  return type === 'sportsbook'
    ? 'Brak danych — nikt jeszcze nie postawił zakładu'
    : 'Brak danych — nikt jeszcze nie zagrał w kasynie';
}
