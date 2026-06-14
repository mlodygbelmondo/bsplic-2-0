import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CategorySidebar } from './CategorySidebar';

const categories = [
  {
    id: 'football',
    name: 'Piłka nożna',
    emoji: '⚽',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'tennis',
    name: 'Tenis',
    emoji: '🎾',
    created_at: '2026-01-01T00:00:00.000Z',
  },
];

describe('CategorySidebar', () => {
  it('lets users clear a category search with one click', () => {
    render(
      <CategorySidebar
        selectedCategory={null}
        onSelectCategory={vi.fn()}
        categories={categories}
        loading={false}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Szukaj kategorii...'), {
      target: { value: 'tenis' },
    });

    expect(screen.getByText('Tenis')).toBeInTheDocument();
    expect(screen.queryByText('Piłka nożna')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Wyczyść wyszukiwanie kategorii' }));

    expect(screen.getByText('Tenis')).toBeInTheDocument();
    expect(screen.getByText('Piłka nożna')).toBeInTheDocument();
  });
});
