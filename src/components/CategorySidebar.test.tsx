import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Category } from '@/types/database';

import { CategorySidebar } from './CategorySidebar';

function category(id: string, name: string, sortOrder: number, parentId: string | null = null): Category {
  return {
    id,
    name,
    emoji: '🏷️',
    color: '#000000',
    sort_order: sortOrder,
    created_at: '2026-10-01T00:00:00.000Z',
    parent_id: parentId,
    slug: null,
  };
}

const HIERARCHY: Category[] = [
  category('football', 'Piłka nożna', 1),
  category('ekstraklasa', 'Ekstraklasa', 2, 'football'),
  category('premier', 'Premier League', 1, 'football'),
  category('ufc', 'UFC', 2),
];

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

  it('shows leagues only under the selected sport and selects a sport on click', () => {
    const onSelectCategory = vi.fn();
    const { rerender } = render(
      <CategorySidebar selectedCategory={null} onSelectCategory={onSelectCategory} categories={HIERARCHY} loading={false} />,
    );

    expect(screen.queryByText('Ekstraklasa')).not.toBeInTheDocument();
    const sport = screen.getByRole('button', { name: /Piłka nożna/ });
    expect(sport).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(sport);
    expect(onSelectCategory).toHaveBeenLastCalledWith('football');

    rerender(
      <CategorySidebar selectedCategory="football" onSelectCategory={onSelectCategory} categories={HIERARCHY} loading={false} />,
    );

    expect(screen.getByRole('button', { name: /Piłka nożna/ })).toHaveAttribute('aria-expanded', 'true');
    const rowNames = screen.getAllByRole('button').map((button) => button.textContent?.trim());
    expect(rowNames).toEqual(['⭐Wszystkie', '🏷️Piłka nożna', '🏷️Premier League', '🏷️Ekstraklasa', '🏷️UFC']);

    fireEvent.click(screen.getByRole('button', { name: /Ekstraklasa/ }));
    expect(onSelectCategory).toHaveBeenLastCalledWith('ekstraklasa');
  });

  it('finds leagues of collapsed sports when searching and names their sport', () => {
    const onSelectCategory = vi.fn();
    render(
      <CategorySidebar selectedCategory={null} onSelectCategory={onSelectCategory} categories={HIERARCHY} loading={false} />,
    );

    fireEvent.change(screen.getByPlaceholderText('Szukaj kategorii...'), {
      target: { value: 'ekstra' },
    });

    const result = screen.getByRole('button', { name: /Ekstraklasa/ });
    expect(result).toHaveTextContent('Piłka nożna › Ekstraklasa');
    expect(screen.queryByRole('button', { name: /UFC/ })).not.toBeInTheDocument();

    fireEvent.click(result);
    expect(onSelectCategory).toHaveBeenLastCalledWith('ekstraklasa');
  });
});
