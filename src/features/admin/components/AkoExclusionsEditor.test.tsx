import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Bet } from '@/types/database';

import { AkoExclusionsEditor } from './AkoExclusionsEditor';

const createBet = (id: string, title: string): Bet => ({
  id,
  title,
  category_id: null,
  bet_type: '12',
  options: [],
  ends_at: '2030-01-01T12:00:00.000Z',
  is_live: false,
  is_active: true,
  winning_option: null,
  bet_count: 0,
  created_at: '2030-01-01T10:00:00.000Z',
});

describe('AkoExclusionsEditor', () => {
  it('adds matching bets and never offers the current bet', () => {
    const onChange = vi.fn();

    render(
      <AkoExclusionsEditor
        availableBets={[
          createBet('bet-current', 'Aktualny zakład'),
          createBet('bet-2', 'Team X wygra mecz'),
        ]}
        currentBetId="bet-current"
        value={[]}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText('Szukaj wykluczenia AKO'), {
      target: { value: 'Team X' },
    });

    expect(screen.queryByText('Aktualny zakład')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Dodaj Team X/i }));

    expect(onChange).toHaveBeenCalledWith([
      { betId: 'bet-2', title: 'Team X wygra mecz', reason: null },
    ]);
  });

  it('updates reasons and removes selected exclusions', () => {
    const onChange = vi.fn();

    render(
      <AkoExclusionsEditor
        availableBets={[]}
        value={[
          {
            betId: 'bet-2',
            title: 'Team X wygra mecz',
            reason: null,
          },
        ]}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText('Powód dla Team X wygra mecz'), {
      target: { value: 'Ten sam mecz' },
    });

    expect(onChange).toHaveBeenCalledWith([
      {
        betId: 'bet-2',
        title: 'Team X wygra mecz',
        reason: 'Ten sam mecz',
      },
    ]);

    fireEvent.click(screen.getByRole('button', { name: /Usuń Team X/i }));

    expect(onChange).toHaveBeenLastCalledWith([]);
  });
});
