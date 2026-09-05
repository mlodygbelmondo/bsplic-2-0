import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { parseReplayHistory } from './model';
import ReplayPage from './ReplayPage';
import { coupon, REPLAY_TEST_NOW } from './testing/fixtures';

const mocks = vi.hoisted(() => ({ history: vi.fn(), refetch: vi.fn() }));
vi.mock('@/components/Navbar', () => ({ Navbar: () => <nav aria-label="Nawigacja aplikacji" /> }));
vi.mock('./useReplayHistory', () => ({ useReplayHistory: mocks.history }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-1' }, profile: { username: 'Astra Demo' } }) }));
vi.mock('./ReplayExperience', () => ({ ReplayExperience: ({ model }: { model: { periodLabel: string } }) => <div>Replay: {model.periodLabel}</div> }));
const data = parseReplayHistory([coupon()], REPLAY_TEST_NOW);
const ready = { data, isPending: false, isFetching: false, isError: false, dataUpdatedAt: 1, refetch: mocks.refetch };
const show = () => render(<MemoryRouter><ReplayPage /></MemoryRouter>);
beforeEach(() => { vi.clearAllMocks(); mocks.history.mockReturnValue(ready); });
afterEach(cleanup);

describe('Replay page states', () => {
  it('uses the app shell and keeps methodology collapsed', () => {
    const { container } = show();
    expect(screen.getByRole('navigation', { name: 'Nawigacja aplikacji' })).toBeInTheDocument();
    expect(container.querySelector('details')).not.toHaveAttribute('open');
  });
  it('changes periods without issuing an extra history request', () => {
    show();
    expect(screen.getByText('Replay: 30 dni')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '7 dni' }));
    expect(screen.getByText('Replay: 7 dni')).toBeInTheDocument();
    expect(mocks.refetch).not.toHaveBeenCalled();
  });
  it('shows a loading state without fabricated statistics', () => {
    mocks.history.mockReturnValue({ ...ready, data: undefined, isPending: true, isFetching: true });
    show();
    expect(screen.getByRole('status', { name: 'Wczytywanie Replay' })).toBeInTheDocument();
    expect(screen.queryByText('Replay: 30 dni')).not.toBeInTheDocument();
  });
  it('offers a retry on initial failure', () => {
    mocks.history.mockReturnValue({ ...ready, data: undefined, isError: true });
    show();
    expect(screen.getByRole('alert')).toHaveTextContent('Nie udało się wczytać');
    fireEvent.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
    expect(mocks.refetch).toHaveBeenCalledOnce();
  });
  it('preserves the last snapshot after a refresh failure', () => {
    mocks.history.mockReturnValue({ ...ready, isError: true });
    show();
    expect(screen.getByRole('alert')).toHaveTextContent('poprzedni zapis');
    expect(screen.getByText('Replay: 30 dni')).toBeInTheDocument();
  });
  it('offers older history instead of pushing empty-state users to place bets', () => {
    mocks.history.mockReturnValue({ ...ready, data: parseReplayHistory([coupon({ created_at: '2026-01-01T00:00:00Z' })], REPLAY_TEST_NOW) });
    show();
    expect(screen.getByRole('region', { name: 'Pusty Replay' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Zobacz ostatnie kupony' }));
    expect(screen.getByText('Replay: Ostatnie kupony')).toBeInTheDocument();
  });
  it('discloses a partial period above the experience', () => {
    mocks.history.mockReturnValue({ ...ready, data: { ...data, hasMore: true } });
    show();
    expect(screen.getByRole('status')).toHaveTextContent('zakres jest częściowy');
  });
});
