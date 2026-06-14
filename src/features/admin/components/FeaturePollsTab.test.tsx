import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import FeaturePollsTab from './FeaturePollsTab';

const fetchAdminFeaturePollsMock = vi.fn();
const createFeaturePollMock = vi.fn();
const deactivateFeaturePollMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock('@/features/feature-polls/feature-poll-api', () => ({
  fetchAdminFeaturePolls: (...args: unknown[]) =>
    fetchAdminFeaturePollsMock(...args),
  createFeaturePoll: (...args: unknown[]) => createFeaturePollMock(...args),
  deactivateFeaturePoll: (...args: unknown[]) =>
    deactivateFeaturePollMock(...args),
}));

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

const now = Date.now();
const poll = {
  id: 'poll-1',
  title: 'Głosowanie',
  title_enabled: true,
  description: 'Odpowiedz na jedno pytanie, żeby kontynuować.',
  description_enabled: true,
  question: 'Co budujemy dalej?',
  question_enabled: true,
  allow_other: true,
  starts_at: null,
  expires_at: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
  is_active: true,
  created_at: '2030-01-01T09:00:00.000Z',
  updated_at: '2030-01-01T09:00:00.000Z',
  total_votes: 4,
  options: [
    { id: 'option-1', label: 'Turnieje', sort_order: 0, vote_count: 3 },
    { id: 'option-2', label: 'Kasyno live', sort_order: 1, vote_count: 1 },
  ],
  other_responses: ['Tryb kariery'],
};

describe('FeaturePollsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchAdminFeaturePollsMock.mockResolvedValue([poll]);
    createFeaturePollMock.mockResolvedValue(undefined);
    deactivateFeaturePollMock.mockResolvedValue(undefined);
  });

  it('renders polls with status, totals, percentages, and other responses', async () => {
    render(<FeaturePollsTab />);

    expect(await screen.findByText('Co budujemy dalej?')).toBeInTheDocument();
    expect(screen.getByText('Aktywna')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('Turnieje')).toBeInTheDocument();
    expect(screen.getByText('3 / 75%')).toBeInTheDocument();
    expect(screen.getByText('Tryb kariery')).toBeInTheDocument();
  });

  it('blocks invalid poll creation', async () => {
    render(<FeaturePollsTab />);

    fireEvent.click(screen.getByRole('button', { name: 'Utwórz głosowanie' }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Pytanie jest wymagane');
    });
  });

  it('creates a poll from the form', async () => {
    render(<FeaturePollsTab />);

    fireEvent.change(screen.getByLabelText('Nagłówek'), {
      target: { value: 'Ankieta' },
    });
    fireEvent.click(screen.getByLabelText('Pokaż opis'));
    fireEvent.change(screen.getByLabelText('Opis'), {
      target: { value: 'Krótki opis' },
    });
    fireEvent.change(screen.getByLabelText('Pytanie'), {
      target: { value: 'Co dalej?' },
    });
    const optionsGroup = screen.getByTestId('feature-poll-options');
    const optionInputs = within(optionsGroup).getAllByRole('textbox');
    fireEvent.change(optionInputs[0], { target: { value: 'Social' } });
    fireEvent.change(optionInputs[1], { target: { value: 'Kasyno' } });
    fireEvent.click(screen.getByRole('button', { name: 'Utwórz głosowanie' }));

    await waitFor(() => {
      expect(createFeaturePollMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Ankieta',
          titleEnabled: true,
          description: 'Krótki opis',
          descriptionEnabled: false,
          question: 'Co dalej?',
          questionEnabled: true,
        }),
      );
      expect(toastSuccessMock).toHaveBeenCalledWith('Głosowanie utworzone');
    });
  });

  it('does not render a start date control for new polls', async () => {
    render(<FeaturePollsTab />);

    expect(screen.queryByLabelText('Start')).not.toBeInTheDocument();
    expect(await screen.findByText('Zakończenie')).toBeInTheDocument();
  });

  it('deactivates a poll instead of deleting it', async () => {
    render(<FeaturePollsTab />);

    await screen.findByText('Co budujemy dalej?');
    fireEvent.click(screen.getByRole('button', { name: 'Wyłącz' }));

    await waitFor(() => {
      expect(deactivateFeaturePollMock).toHaveBeenCalledWith('poll-1');
      expect(toastSuccessMock).toHaveBeenCalledWith('Głosowanie wyłączone');
    });
  });

  it('keeps the mobile deactivate action full-width and centered', async () => {
    render(<FeaturePollsTab />);

    const deactivateButton = await screen.findByRole('button', {
      name: 'Wyłącz',
    });

    expect(deactivateButton).toHaveClass('min-h-11', 'w-full', 'justify-center');
  });
});
