import { describe, expect, it } from 'vitest';

import {
  formatProfit,
  getEmptyRankingsMessage,
  getMedal,
  getPrimaryMetric,
  getProfitTone,
  getRankingSubline,
  normalizeRankingRows,
  sortRankings,
  type RankEntry,
} from './ranking-logic';

const entry = (overrides: Partial<RankEntry>): RankEntry => ({
  id: 'user',
  username: 'User',
  total_profit: 0,
  win_rate: 0,
  total_bets: 0,
  won_bets: 0,
  lost_bets: 0,
  balance: 0,
  ...overrides,
});

describe('normalizeRankingRows', () => {
  it('coerces numeric columns that arrive as strings', () => {
    const [row] = normalizeRankingRows([
      {
        id: 'a',
        username: 'Ala',
        total_profit: '36.00',
        win_rate: '66.7',
        total_bets: '14',
        won_bets: '9',
        lost_bets: '5',
        balance: '1036.5',
      },
    ]);

    expect(row).toEqual({
      id: 'a',
      username: 'Ala',
      total_profit: 36,
      win_rate: 66.7,
      total_bets: 14,
      won_bets: 9,
      lost_bets: 5,
      balance: 1036.5,
    });
  });

  it('treats a null payload as an empty board', () => {
    expect(normalizeRankingRows(null)).toEqual([]);
  });
});

describe('sortRankings', () => {
  const rows = [
    entry({ id: 'a', total_profit: 10, win_rate: 80, total_bets: 3 }),
    entry({ id: 'b', total_profit: 50, win_rate: 20, total_bets: 9 }),
    entry({ id: 'c', total_profit: 10, win_rate: 55, total_bets: 1 }),
  ];

  it('orders by the chosen metric, highest first', () => {
    expect(sortRankings(rows, 'win_rate').map((r) => r.id)).toEqual(['a', 'c', 'b']);
    expect(sortRankings(rows, 'total_bets').map((r) => r.id)).toEqual(['b', 'a', 'c']);
  });

  it('keeps the server order for ties and does not mutate the input', () => {
    expect(sortRankings(rows, 'total_profit').map((r) => r.id)).toEqual(['b', 'a', 'c']);
    expect(rows.map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('row formatting', () => {
  it('formats profit with a sign, dot decimals and no grouping', () => {
    expect(formatProfit(1234.5)).toBe('+1234.50 zł');
    expect(formatProfit(-5)).toBe('-5.00 zł');
    expect(formatProfit(0)).toBe('+0.00 zł');
  });

  it('tones profit by sign and leaves zero neutral', () => {
    expect(getProfitTone(0.01)).toBe('success');
    expect(getProfitTone(-0.01)).toBe('destructive');
    expect(getProfitTone(0)).toBeNull();
  });

  it('gives medals to the top three ranks only', () => {
    expect([1, 2, 3, 4].map(getMedal)).toEqual(['🥇', '🥈', '🥉', null]);
  });

  it('shows the sorted metric on the right of the row', () => {
    const row = entry({ total_profit: -12.5, win_rate: 66.66, total_bets: 14 });
    expect(getPrimaryMetric(row, 'total_profit')).toEqual({
      label: 'Profit',
      value: '-12.50 zł',
      tone: 'destructive',
    });
    expect(getPrimaryMetric(row, 'win_rate')).toEqual({ label: 'Win rate', value: '66.7%', tone: null });
    expect(getPrimaryMetric(row, 'total_bets')).toEqual({ label: 'Zakłady', value: '14', tone: null });
  });

  it('builds the summary subline', () => {
    expect(getRankingSubline(entry({ total_profit: 36, win_rate: 66.66, total_bets: 14 }))).toBe(
      'Profit +36.00 zł · WR 66.7% · 14 zakł.',
    );
  });

  it('uses mode-specific empty copy', () => {
    expect(getEmptyRankingsMessage('sportsbook')).toBe('Brak danych — nikt jeszcze nie postawił zakładu');
    expect(getEmptyRankingsMessage('casino')).toBe('Brak danych — nikt jeszcze nie zagrał w kasynie');
  });
});
