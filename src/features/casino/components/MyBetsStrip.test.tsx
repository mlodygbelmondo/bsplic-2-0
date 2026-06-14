import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MyBetsStrip } from './MyBetsStrip';
import type { RouletteBetRecord } from '@/types/database';

const settledBet: RouletteBetRecord = {
  id: 'bet-1',
  round_id: 'round-1',
  user_id: 'user-1',
  bet_type: 'color',
  bet_value: 'red',
  stake: 10,
  payout: 20,
  is_win: true,
  created_at: '2026-01-01T00:00:00.000Z',
};

describe('MyBetsStrip', () => {
  it('labels the repeat button with the number of settled bets', () => {
    render(
      <MyBetsStrip
        liveBets={[]}
        settledBets={[settledBet]}
        resultNumber={1}
        resultColor="red"
        isRepeating={false}
        onRepeat={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Powtórz 1 ostatni zakład' }),
    ).toBeInTheDocument();
  });

  it('announces when repeat betting is in progress', () => {
    render(
      <MyBetsStrip
        liveBets={[]}
        settledBets={[settledBet, { ...settledBet, id: 'bet-2' }]}
        resultNumber={1}
        resultColor="red"
        isRepeating
        onRepeat={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Stawianie 2 ostatnich zakładów' }),
    ).toBeDisabled();
  });
});
