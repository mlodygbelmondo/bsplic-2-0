import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import EniuBotTab from './EniuBotTab';

const commandEniuMock = vi.fn();
const fetchEniuBotRunsMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock('@/features/social/api/eniuBot', () => ({
  commandEniu: (...args: unknown[]) => commandEniuMock(...args),
  fetchEniuBotRuns: (...args: unknown[]) => fetchEniuBotRunsMock(...args),
}));

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

describe('EniuBotTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchEniuBotRunsMock.mockResolvedValue([
      {
        id: 'run-1',
        sourceType: 'post',
        sourceId: 'post-1',
        status: 'success',
        responseCommentId: 'comment-1',
        responsePostId: null,
        error: null,
        providerDiagnostic: {
          model: 'kimi-k2.6',
          stream: true,
          maxTokens: 16000,
          reasoningPresent: false,
          contentPresent: true,
          contentChars: 34,
        },
        createdAt: '2030-01-01T10:00:00.000Z',
        updatedAt: '2030-01-01T10:00:00.000Z',
      },
    ]);
    commandEniuMock.mockResolvedValue({
      ok: true,
      preview: false,
      text: 'Eniu wrzucił post',
    });
  });

  it('publishes command immediately by default', async () => {
    render(<EniuBotTab />);

    fireEvent.change(screen.getByPlaceholderText(/Napisz post/i), {
      target: { value: 'Napisz post o kuponach' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Wyślij Eniu' }));

    await waitFor(() => {
      expect(commandEniuMock).toHaveBeenCalledWith(
        'Napisz post o kuponach',
        false,
      );
      expect(toastSuccessMock).toHaveBeenCalledWith('Eniu opublikował post');
    });
  });

  it('returns preview when preview mode is enabled', async () => {
    commandEniuMock.mockResolvedValueOnce({
      ok: true,
      preview: true,
      text: 'Preview posta Eniu',
    });

    render(<EniuBotTab />);

    fireEvent.click(screen.getByText('Tylko podgląd'));
    fireEvent.change(screen.getByPlaceholderText(/Napisz post/i), {
      target: { value: 'Zrób podgląd' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Wygeneruj podgląd' }));

    await waitFor(() => {
      expect(commandEniuMock).toHaveBeenCalledWith('Zrób podgląd', true);
      expect(screen.getByText('Preview posta Eniu')).toBeInTheDocument();
    });
  });

  it('shows sanitized provider diagnostics in run logs', async () => {
    render(<EniuBotTab />);

    expect(await screen.findByText('kimi-k2.6')).toBeInTheDocument();
    expect(screen.getByText('stream')).toBeInTheDocument();
    expect(screen.getByText('16k')).toBeInTheDocument();
    expect(screen.getByText('reasoning: nie')).toBeInTheDocument();
    expect(screen.getByText('content: tak')).toBeInTheDocument();
  });
});
