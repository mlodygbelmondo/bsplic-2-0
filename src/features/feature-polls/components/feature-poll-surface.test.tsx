import type { ComponentProps, ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FeaturePollSurface } from './feature-poll-surface';

const fetchAvailableFeaturePollMock = vi.fn();
const submitFeaturePollVoteMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

let mockUser: Record<string, unknown> | null = null;
let mockProfile: Record<string, unknown> | null = null;
let mockLoading = false;

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    profile: mockProfile,
    loading: mockLoading,
  }),
}));

vi.mock('../feature-poll-api', () => ({
  fetchAvailableFeaturePoll: (...args: unknown[]) =>
    fetchAvailableFeaturePollMock(...args),
  submitFeaturePollVote: (...args: unknown[]) =>
    submitFeaturePollVoteMock(...args),
}));

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: ComponentProps<'div'>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const poll = {
  id: 'poll-1',
  title: 'Szybkie głosowanie',
  title_enabled: true,
  description: 'Wybierz jedną odpowiedź.',
  description_enabled: true,
  question: 'Co mamy zbudować jako następne?',
  question_enabled: true,
  allow_other: true,
  starts_at: null,
  expires_at: '2030-01-02T10:00:00.000Z',
  options: [
    { id: 'option-1', label: 'Turnieje kuponów', sort_order: 0 },
    { id: 'option-2', label: 'Kasyno live', sort_order: 1 },
  ],
};

describe('FeaturePollSurface', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoading = false;
    mockUser = { id: 'user-1' };
    mockProfile = { id: 'user-1', username: 'Tester' };
    fetchAvailableFeaturePollMock.mockResolvedValue(poll);
    submitFeaturePollVoteMock.mockResolvedValue({
      poll_id: 'poll-1',
      submitted_at: '2030-01-01T12:00:00.000Z',
    });
  });

  it('shows a mandatory poll dialog for an eligible user', async () => {
    render(<FeaturePollSurface />);

    expect(await screen.findByText('Szybkie głosowanie')).toBeInTheDocument();
    expect(screen.getByText('Wybierz jedną odpowiedź.')).toBeInTheDocument();
    expect(
      screen.getByText('Co mamy zbudować jako następne?'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Turnieje kuponów')).toBeInTheDocument();
    expect(screen.getByLabelText('Inne')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
  });

  it('honors copy visibility settings from the poll', async () => {
    fetchAvailableFeaturePollMock.mockResolvedValue({
      ...poll,
      title_enabled: false,
      description_enabled: false,
      question_enabled: false,
    });

    render(<FeaturePollSurface />);

    expect(await screen.findByLabelText('Turnieje kuponów')).toBeInTheDocument();
    expect(screen.queryByText('Szybkie głosowanie')).not.toBeInTheDocument();
    expect(screen.queryByText('Wybierz jedną odpowiedź.')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Co mamy zbudować jako następne?'),
    ).not.toBeInTheDocument();
  });

  it('does not show when no poll is available', async () => {
    fetchAvailableFeaturePollMock.mockResolvedValue(null);

    render(<FeaturePollSurface />);

    await waitFor(() => {
      expect(screen.queryByText('Głosowanie')).not.toBeInTheDocument();
    });
  });

  it('submits a fixed option vote and unlocks the app', async () => {
    render(<FeaturePollSurface />);

    fireEvent.click(await screen.findByLabelText('Kasyno live'));
    fireEvent.click(screen.getByRole('button', { name: 'Oddaj głos' }));

    await waitFor(() => {
      expect(submitFeaturePollVoteMock).toHaveBeenCalledWith({
        pollId: 'poll-1',
        optionId: 'option-2',
        otherText: null,
      });
      expect(toastSuccessMock).toHaveBeenCalledWith('Dziękujemy za głos');
    });
    expect(screen.queryByText('Głosowanie')).not.toBeInTheDocument();
  });

  it('requires custom text only for Other votes', async () => {
    render(<FeaturePollSurface />);

    expect(screen.queryByTestId('feature-poll-other-panel')).not.toBeInTheDocument();
    fireEvent.click(await screen.findByLabelText('Inne'));
    expect(screen.getByTestId('feature-poll-other-panel')).toHaveClass(
      'overflow-hidden',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Oddaj głos' }));

    expect(
      await screen.findByText('Wpisz swoją propozycję'),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Twoja propozycja'), {
      target: { value: 'Tryb kariery typera' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Oddaj głos' }));

    await waitFor(() => {
      expect(submitFeaturePollVoteMock).toHaveBeenCalledWith({
        pollId: 'poll-1',
        optionId: null,
        otherText: 'Tryb kariery typera',
      });
    });
  });

  it('keeps the dialog open and shows feedback when submission fails', async () => {
    submitFeaturePollVoteMock.mockRejectedValue({ message: 'Głos już oddany' });

    render(<FeaturePollSurface />);

    fireEvent.click(await screen.findByLabelText('Turnieje kuponów'));
    fireEvent.click(screen.getByRole('button', { name: 'Oddaj głos' }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Głos już oddany');
      expect(screen.getByText('Szybkie głosowanie')).toBeInTheDocument();
    });
  });
});
