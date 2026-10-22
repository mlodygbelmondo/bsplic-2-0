import { describe, expect, it } from 'vitest';

import type { RouletteBetRecord, RouletteRecentWin, RouletteTableRound } from '@/types/database';

import {
  adjustRouletteStake,
  computeRouletteStats,
  deriveLastSettled,
  getBetChipColor,
  getLatestUserWin,
  getLeadingColorStreak,
  getMaxRouletteStake,
  getRepeatBetsLabel,
  getRouletteBetSummary,
  getRoulettePotentialWin,
  getRouletteShareContent,
  getRouletteStakeStatusLine,
  getRouletteSubmitHint,
  getRouletteWinKey,
  getWinningOptionValue,
  normalizeStakeInput,
  upsertLocalRoundParticipant,
} from './rouletteGame';

function spin(id: string, winningNumber: number | null, color: RouletteTableRound['winning_color']): RouletteTableRound {
  return {
    id,
    table_key: 'main',
    round_number: Number(id.replace(/\D/g, '')) || 1,
    phase: 'settled',
    betting_opens_at: '2026-04-17T12:00:00.000Z',
    betting_closes_at: '2026-04-17T12:00:15.000Z',
    spin_started_at: '2026-04-17T12:00:15.000Z',
    settled_at: '2026-04-17T12:00:21.000Z',
    winning_number: winningNumber,
    winning_color: color,
    created_at: '2026-04-17T12:00:00.000Z',
  };
}

function bet(overrides: Partial<RouletteBetRecord>): RouletteBetRecord {
  return {
    id: 'bet-1',
    round_id: 'round-1',
    user_id: 'user-1',
    bet_type: 'color',
    bet_value: 'red',
    stake: 20,
    payout: 0,
    is_win: null,
    created_at: '2026-04-17T12:00:04.000Z',
    settled_at: null,
    ...overrides,
  };
}

function recentWin(overrides: Partial<RouletteRecentWin>): RouletteRecentWin {
  return {
    ...bet({ is_win: true, payout: 40 }),
    username: 'Ty',
    avatar_url: null,
    round_number: 123,
    ...overrides,
  };
}

describe('getRouletteSubmitHint', () => {
  it('asks for each missing part of the selection in order', () => {
    expect(getRouletteSubmitHint({ betType: '', betValue: '', stake: '10', balance: 100 })).toBe('Wybierz typ zakładu');
    expect(getRouletteSubmitHint({ betType: 'straight', betValue: '', stake: '10', balance: 100 })).toBe(
      'Wybierz wartość zakładu',
    );
    expect(getRouletteSubmitHint({ betType: 'straight', betValue: '0', stake: '', balance: 100 })).toBe('Podaj stawkę');
    expect(getRouletteSubmitHint({ betType: 'straight', betValue: '0', stake: '120', balance: 100 })).toBe(
      'Stawka przekracza saldo',
    );
    expect(getRouletteSubmitHint({ betType: 'straight', betValue: '0', stake: '100', balance: 100 })).toBeNull();
  });
});

describe('getRoulettePotentialWin', () => {
  it('returns the total return for a complete selection', () => {
    expect(getRoulettePotentialWin({ betType: 'straight', betValue: '17', stake: '10', balance: 100 })).toBe(360);
    expect(getRoulettePotentialWin({ betType: 'range', betValue: 'low', stake: '12.5', balance: 100 })).toBe(25);
  });

  it('returns null while the selection is incomplete or over the balance', () => {
    expect(getRoulettePotentialWin({ betType: 'color', betValue: '', stake: '10', balance: 100 })).toBeNull();
    expect(getRoulettePotentialWin({ betType: 'color', betValue: 'red', stake: '101', balance: 100 })).toBeNull();
  });
});

describe('stake bar copy', () => {
  it('shows the hint while the bet cannot be placed', () => {
    expect(getRouletteStakeStatusLine('Podaj stawkę', '17', null)).toBe('Podaj stawkę');
  });

  it('summarizes the selected value and payout', () => {
    expect(getRouletteStakeStatusLine(null, getRouletteBetSummary('color', 'black'), 50)).toBe('Czarne · wypłata 50.00 zł');
    expect(getRouletteStakeStatusLine(null, getRouletteBetSummary('straight', '0'), 360)).toBe('0 · wypłata 360.00 zł');
  });
});

describe('stake helpers', () => {
  it('halves and doubles to cents without going below one grosz', () => {
    expect(adjustRouletteStake('10', 0.5)).toBe('5');
    expect(adjustRouletteStake('0.03', 0.5)).toBe('0.02');
    expect(adjustRouletteStake('0.01', 0.5)).toBe('0.01');
    expect(adjustRouletteStake('12.5', 2)).toBe('25');
    expect(adjustRouletteStake('', 2)).toBe('0.01');
  });

  it('uses the whole balance floored to cents as MAX', () => {
    expect(getMaxRouletteStake(123.456)).toBe('123.45');
    expect(getMaxRouletteStake(0)).toBe('0.01');
  });

  it('turns a Polish decimal comma into a dot', () => {
    expect(normalizeStakeInput('12,50')).toBe('12.50');
    expect(normalizeStakeInput('1 0')).toBe('10');
  });
});

describe('upsertLocalRoundParticipant', () => {
  it('adds the player at the top when they had no bet in the round', () => {
    const others = [{ user_id: 'u2', username: 'LuckyFox', avatar_url: null, total_stake: 50, bet_count: 1, bets: [] }];

    const result = upsertLocalRoundParticipant(others, {
      userId: 'user-1',
      username: 'Ty',
      avatarUrl: 'a.webp',
      acceptedBet: bet({ bet_type: 'straight', bet_value: '7', stake: 5 }),
    });

    expect(result[0]).toEqual({
      user_id: 'user-1',
      username: 'Ty',
      avatar_url: 'a.webp',
      total_stake: 5,
      bet_count: 1,
      bets: [{ bet_type: 'straight', bet_value: '7', stake: 5 }],
    });
    expect(result[1]).toBe(others[0]);
  });

  it('adds the bet to the player row they already have', () => {
    const result = upsertLocalRoundParticipant(
      [
        {
          user_id: 'user-1',
          username: 'Ty',
          avatar_url: null,
          total_stake: 10,
          bet_count: 1,
          bets: [{ bet_type: 'color', bet_value: 'red', stake: 10 }],
        },
      ],
      { userId: 'user-1', username: 'Ty', avatarUrl: 'a.webp', acceptedBet: bet({ bet_value: 'black', stake: 15 }) },
    );

    expect(result).toEqual([
      {
        user_id: 'user-1',
        username: 'Ty',
        avatar_url: 'a.webp',
        total_stake: 25,
        bet_count: 2,
        bets: [
          { bet_type: 'color', bet_value: 'black', stake: 15 },
          { bet_type: 'color', bet_value: 'red', stake: 10 },
        ],
      },
    ]);
  });
});

describe('getLatestUserWin', () => {
  it('ignores an old win from a round the player did not bet on in this session', () => {
    expect(
      getLatestUserWin({
        activeBets: [],
        recentWins: [recentWin({ round_id: 'round-previous' })],
        userId: 'user-1',
        pendingRoundIds: new Set(),
      }),
    ).toBeNull();
  });

  it('announces a recent win from a round the player bet on', () => {
    const win = recentWin({ round_id: 'round-previous' });
    expect(
      getLatestUserWin({
        activeBets: [],
        recentWins: [recentWin({ id: 'other', user_id: 'user-2', round_id: 'round-previous' }), win],
        userId: 'user-1',
        pendingRoundIds: new Set(['round-previous']),
      }),
    ).toBe(win);
  });

  it('prefers a settled winning bet on the table', () => {
    const settled = bet({ is_win: true, payout: 72, bet_type: 'straight', bet_value: '7', stake: 2 });
    expect(
      getLatestUserWin({
        activeBets: [bet({ id: 'lost', is_win: false }), settled],
        recentWins: [recentWin({ round_id: 'round-previous' })],
        userId: 'user-1',
        pendingRoundIds: new Set(['round-previous']),
      }),
    ).toBe(settled);
  });

  it('keys a win by round, bet and amounts', () => {
    expect(getRouletteWinKey(recentWin({ round_id: 'r9', bet_type: 'straight', bet_value: '0', stake: 1, payout: 36 }))).toBe(
      'r9:straight:0:1:36',
    );
  });
});

describe('deriveLastSettled', () => {
  it('keeps the previous result while no table bet is settled', () => {
    const previous = { roundId: 'r1', bets: [], winningNumber: 3, winningColor: 'red' as const };
    expect(deriveLastSettled(previous, [bet({})], null, [])).toBe(previous);
  });

  it('pairs settled bets with the spin result of their round', () => {
    const settled = [bet({ round_id: 'round-7', is_win: false }), bet({ id: 'b2', round_id: 'round-7', is_win: true })];
    expect(deriveLastSettled(null, settled, null, [spin('round-7', 26, 'black')])).toEqual({
      roundId: 'round-7',
      bets: settled,
      winningNumber: 26,
      winningColor: 'black',
    });
  });
});

describe('copy helpers', () => {
  it('builds the Social share text with or without the number', () => {
    expect(getRouletteShareContent(40, 7)).toBe('Wygrana w ruletce: 40.00 zł. Numer 7.');
    expect(getRouletteShareContent(40, null)).toBe('Wygrana w ruletce: 40.00 zł');
  });

  it('labels the repeat button by bet count', () => {
    expect(getRepeatBetsLabel(1, false)).toBe('Powtórz 1 ostatni zakład');
    expect(getRepeatBetsLabel(3, false)).toBe('Powtórz 3 ostatnie zakłady');
    expect(getRepeatBetsLabel(5, false)).toBe('Powtórz 5 ostatnich zakładów');
    expect(getRepeatBetsLabel(1, true)).toBe('Stawianie 1 ostatniego zakładu');
  });
});

describe('chip and highlight colors', () => {
  it('colors number and color bets only', () => {
    expect(getBetChipColor('straight', '0')).toBe('green');
    expect(getBetChipColor('straight', '32')).toBe('red');
    expect(getBetChipColor('color', 'black')).toBe('black');
    expect(getBetChipColor('parity', 'even')).toBeNull();
  });

  it('lights the option the winning number satisfies; zero loses parity and range', () => {
    expect(getWinningOptionValue('straight', 17)).toBe('17');
    expect(getWinningOptionValue('color', 17)).toBe('black');
    expect(getWinningOptionValue('parity', 17)).toBe('odd');
    expect(getWinningOptionValue('range', 19)).toBe('high');
    expect(getWinningOptionValue('parity', 0)).toBeNull();
    expect(getWinningOptionValue('range', 0)).toBeNull();
  });
});

describe('getLeadingColorStreak', () => {
  it('counts the same color at the head of the history from two spins', () => {
    expect(getLeadingColorStreak([spin('r3', 1, 'red'), spin('r2', 3, 'red'), spin('r1', 2, 'black')])).toEqual({
      color: 'red',
      length: 2,
    });
    expect(getLeadingColorStreak([spin('r2', 1, 'red'), spin('r1', 2, 'black')])).toBeNull();
    expect(getLeadingColorStreak([])).toBeNull();
  });
});

describe('computeRouletteStats', () => {
  it('needs five settled spins', () => {
    expect(computeRouletteStats([spin('r1', 1, 'red'), spin('r2', 2, 'black'), spin('r3', 3, 'red'), spin('r4', 0, 'green')])).toBeNull();
  });

  it('splits colors and ranks hot and cold numbers with ties by number', () => {
    const stats = computeRouletteStats([
      spin('r1', 7, 'red'),
      spin('r2', 7, 'red'),
      spin('r3', 0, 'green'),
      spin('r4', 26, 'black'),
      spin('r5', 26, 'black'),
      spin('r6', 7, 'red'),
      spin('r7', null, null),
    ]);

    expect(stats).toEqual({
      hot: [
        { number: 7, count: 3 },
        { number: 26, count: 2 },
        { number: 0, count: 1 },
      ],
      cold: [
        { number: 1, count: 0 },
        { number: 2, count: 0 },
        { number: 3, count: 0 },
      ],
      red: 3,
      black: 2,
      green: 1,
      total: 6,
    });
  });
});
