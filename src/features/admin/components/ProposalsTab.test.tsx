import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ProposalsTab from './ProposalsTab';

const fromMock = vi.fn();
const rpcMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
const toastInfoMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
    info: (...args: unknown[]) => toastInfoMock(...args),
  },
}));

describe('ProposalsTab', () => {
  const humanProposal = {
    id: 'proposal-human',
    user_id: 'user-human',
    title: 'Człowiek: nowy kupon',
    category_id: null,
    bet_type: '1x2',
    options: [
      { name: '1', odds: 1.9 },
      { name: 'X', odds: 3.2 },
      { name: '2', odds: 2.1 },
    ],
    ends_at: '2030-01-01T10:00:00.000Z',
    created_at: '2030-01-01T09:00:00.000Z',
  };

  const agentProposal = {
    id: 'proposal-agent',
    user_id: 'user-agent',
    title: 'Agent: sygnał wartościowy',
    category_id: null,
    bet_type: '12',
    options: [
      { name: '1', odds: 2.05 },
      { name: '2', odds: 1.75 },
    ],
    ends_at: '2030-01-02T10:00:00.000Z',
    created_at: '2030-01-02T09:00:00.000Z',
    proposal_source: 'agent',
    agent_metadata: {
      confidence: 'high',
      reason: 'Kurs odchyla się od historycznej średniej',
      sources: ['https://example.com/source-1', 'https://example.com/source-2'],
      checkedRecentBetIds: ['bet-1', 'bet-2', 'bet-3'],
      eventStartTime: '2030-01-02T20:00:00.000Z',
    },
    agent_duplicate_key: 'dup-123',
  } as const;

  const categories = [
    {
      id: 'cat-1',
      name: 'Piłka nożna',
      emoji: '⚽',
      color: '#10b981',
      sort_order: 1,
      created_at: '2026-01-01T00:00:00.000Z',
    },
  ];

  const profiles = [
    { id: 'user-human', username: 'Tomek' },
    { id: 'user-agent', username: 'RobotX' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    rpcMock.mockResolvedValue({ data: { status: 'rejected' }, error: null });

    fromMock.mockImplementation((table: string) => {
      if (table === 'bet_proposals') {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({
                data: [humanProposal, agentProposal],
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === 'categories') {
        return {
          select: () => ({
            order: async () => ({
              data: categories,
              error: null,
            }),
          }),
        };
      }

      if (table === 'profiles') {
        return {
          select: () => ({
            in: async () => ({
              data: profiles,
              error: null,
            }),
          }),
        };
      }

      return {
        select: () => ({
          eq: async () => ({ data: [], error: null }),
        }),
      };
    });
  });

  it('renders human and agent proposals and shows agent context only for agent rows', async () => {
    render(<ProposalsTab />);

    expect(await screen.findByText('Człowiek: nowy kupon')).toBeInTheDocument();
    expect(
      await screen.findByText('Agent: sygnał wartościowy'),
    ).toBeInTheDocument();

    const humanCard = screen
      .getByText('Człowiek: nowy kupon')
      .closest('div')
      ?.closest('div');
    const agentCard = screen
      .getByText('Agent: sygnał wartościowy')
      .closest('div')
      ?.closest('div');

    expect(humanCard).toBeTruthy();
    expect(agentCard).toBeTruthy();

    if (!humanCard || !agentCard) {
      return;
    }

    expect(within(humanCard).getByText('Użytkownik')).toBeInTheDocument();
    expect(within(agentCard).getByText('Agent')).toBeInTheDocument();
    expect(within(humanCard).queryByText('Pewność:')).not.toBeInTheDocument();
    expect(within(agentCard).getByText('Pewność: Wysoka')).toBeInTheDocument();
    expect(
      within(agentCard).getByText('Kurs odchyla się od historycznej średniej'),
    ).toBeInTheDocument();
    expect(within(agentCard).getByText('Źródła: 2')).toBeInTheDocument();
    expect(within(agentCard).getByText('Sprawdzono: 3')).toBeInTheDocument();
  });

  it('rejects proposals through the review RPC', async () => {
    render(<ProposalsTab />);

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Odrzuć propozycję: Człowiek: nowy kupon',
      }),
    );

    await waitFor(() =>
      expect(rpcMock).toHaveBeenCalledWith('review_bet_proposal', {
        p_proposal_id: 'proposal-human',
        p_status: 'rejected',
      }),
    );
    expect(toastInfoMock).toHaveBeenCalledWith('Propozycja odrzucona');
  });

  it('keeps proposal card actions large enough on mobile', async () => {
    render(<ProposalsTab />);

    const acceptButton = await screen.findByRole('button', {
      name: 'Akceptuj propozycję: Człowiek: nowy kupon',
    });
    const rejectButton = screen.getByRole('button', {
      name: 'Odrzuć propozycję: Człowiek: nowy kupon',
    });

    expect(acceptButton).toHaveClass('min-h-11', 'justify-center');
    expect(rejectButton).toHaveClass('min-h-11', 'justify-center');
  });

  it('accepts edited proposals through the review RPC', async () => {
    render(<ProposalsTab />);

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Akceptuj propozycję: Człowiek: nowy kupon',
      }),
    );

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Akceptuj propozycję' }),
    );

    await waitFor(() =>
      expect(rpcMock).toHaveBeenCalledWith('review_bet_proposal', {
        p_proposal_id: 'proposal-human',
        p_status: 'accepted',
        p_title: 'Człowiek: nowy kupon',
        p_category_id: null,
        p_bet_type: '1x2',
        p_options: [
          { name: '1', odds: 1.9 },
          { name: 'X', odds: 3.2 },
          { name: '2', odds: 2.1 },
        ],
        p_ends_at: '2030-01-01T10:00:00.000Z',
        p_is_bsplicboost: false,
      }),
    );
    expect(toastSuccessMock).toHaveBeenCalledWith('Propozycja zaakceptowana');
  });
});
