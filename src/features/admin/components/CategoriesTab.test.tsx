import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Category } from '@/types/database';

import CategoriesTab from './CategoriesTab';

const fromMock = vi.fn();
const insertMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

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

// Rows as the database returns them (sorted by sort_order only).
const DB_ROWS: Category[] = [
  category('premier', 'Premier League', 0, 'football'),
  category('ufc', 'UFC', 1),
  category('football', 'Piłka nożna', 2),
];

// Radix Select relies on pointer-capture APIs that jsdom lacks.
Object.assign(window.HTMLElement.prototype, {
  hasPointerCapture: () => false,
  setPointerCapture: () => undefined,
  releasePointerCapture: () => undefined,
});

describe('CategoriesTab', () => {
  beforeEach(() => {
    fromMock.mockReset();
    insertMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();

    insertMock.mockResolvedValue({ error: null });
    fromMock.mockImplementation(() => ({
      select: () => ({ order: () => Promise.resolve({ data: DB_ROWS, error: null }) }),
      insert: (values: unknown) => insertMock(values),
    }));
  });

  it('lists each league right under its sport', async () => {
    render(<CategoriesTab />);

    const table = screen.getByRole('table');
    await waitFor(() => expect(within(table).getAllByRole('row')).toHaveLength(4));

    // "<top|league>|<name cell>"; a league's name cell also names its sport.
    const rows = within(table)
      .getAllByRole('row')
      .slice(1)
      .map((row) => {
        const [markerCell, nameCell] = within(row).getAllByRole('cell');
        return `${markerCell.textContent?.includes('↳') ? 'league' : 'top'}|${nameCell.textContent}`;
      });
    expect(rows).toEqual(['top|UFC', 'top|Piłka nożna', 'league|Premier LeaguePiłka nożna']);
  });

  it('does not let a sport with leagues get a parent of its own', async () => {
    render(<CategoriesTab />);

    const table = screen.getByRole('table');
    fireEvent.click(await within(table).findByRole('button', { name: 'Edytuj Piłka nożna' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('combobox', { name: 'Kategoria nadrzędna' })).toBeDisabled();
  });

  it('creates a league under the sport picked as its parent', async () => {
    render(<CategoriesTab />);
    await within(screen.getByRole('table')).findByRole('button', { name: 'Edytuj UFC' });

    // The add form renders a mobile and a desktop layout; use the desktop one.
    fireEvent.change(screen.getAllByRole('textbox', { name: 'Nazwa nowej kategorii' })[1], {
      target: { value: 'Ekstraklasa' },
    });
    const parentPicker = screen.getAllByRole('combobox', { name: 'Kategoria nadrzędna nowej kategorii' })[1];
    fireEvent.keyDown(parentPicker, { key: 'Enter' });

    const options = await screen.findAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(['Brak', '🏷️ UFC', '🏷️ Piłka nożna']);

    fireEvent.click(screen.getByRole('option', { name: '🏷️ Piłka nożna' }));
    fireEvent.click(screen.getAllByRole('button', { name: /Dodaj/ })[1]);

    await waitFor(() => expect(insertMock).toHaveBeenCalledTimes(1));
    expect(insertMock.mock.calls[0][0]).toMatchObject({ name: 'Ekstraklasa', parent_id: 'football' });
    expect(toastSuccessMock).toHaveBeenCalledWith('Kategoria dodana');
  });
});
