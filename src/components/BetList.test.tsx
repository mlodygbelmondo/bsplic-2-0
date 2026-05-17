import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { BetList } from './BetList';

const useBetsMock = vi.fn((_selectedCategory: string | null, _sort: string) => ({
  loading: false,
  liveBets: [],
  sortedBets: [],
}));

vi.mock('@/features/home/hooks/useBets', () => ({
  useBets: (selectedCategory: string | null, sort: string) => useBetsMock(selectedCategory, sort),
}));

describe('BetList tabs', () => {
  it('defaults to newest and supports ending-soon sort tab', () => {
    render(
      <BetList
        selectedCategory={null}
        categories={[]}
        categoryMap={{}}
      />,
    );

    const tabButtons = screen.getAllByRole('button', {
      name: /Najnowsze|Popularne|Kończące się/i,
    });

    expect(tabButtons.map((button) => button.textContent)).toEqual([
      'Najnowsze',
      'Popularne',
      'Kończące się',
    ]);

    expect(screen.getByText('Brak dostępnych zdarzeń')).toBeInTheDocument();

    expect(useBetsMock).toHaveBeenCalledWith(null, 'newest');

    fireEvent.click(screen.getByRole('button', { name: 'Popularne' }));
    expect(useBetsMock).toHaveBeenLastCalledWith(null, 'popular');

    fireEvent.click(screen.getByRole('button', { name: 'Kończące się' }));
    expect(useBetsMock).toHaveBeenLastCalledWith(null, 'ending_soon');
  });
});
