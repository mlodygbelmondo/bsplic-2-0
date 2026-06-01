import type { ComponentProps, ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BonusCampaignSurface } from './bonus-campaign-surface';

const refreshProfileMock = vi.fn();
const fetchAvailableBonusCampaignsMock = vi.fn();
const claimBonusCampaignMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
const confettiMock = vi.fn();

let mockUser: Record<string, unknown> | null = null;
let mockProfile: Record<string, unknown> | null = null;
let mockLoading = false;

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    profile: mockProfile,
    loading: mockLoading,
    refreshProfile: refreshProfileMock,
  }),
}));

vi.mock('../bonus-campaign-api', () => ({
  fetchAvailableBonusCampaigns: (...args: unknown[]) => fetchAvailableBonusCampaignsMock(...args),
  claimBonusCampaign: (...args: unknown[]) => claimBonusCampaignMock(...args),
}));

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

vi.mock('canvas-confetti', () => ({
  default: (...args: unknown[]) => confettiMock(...args),
}));

vi.mock('framer-motion', () => ({
  motion: {
    button: ({ children, ...props }: ComponentProps<'button'>) => <button {...props}>{children}</button>,
    div: ({ children, ...props }: ComponentProps<'div'>) => <div {...props}>{children}</div>,
    p: ({ children, ...props }: ComponentProps<'p'>) => <p {...props}>{children}</p>,
  },
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const campaign = {
  id: 'campaign-1',
  title: 'Freebet z okazji Dnia Dziecka',
  description: 'Odbierz swoje 1000 złotych',
  amount: 1000,
  starts_at: '2030-01-01T10:00:00.000Z',
  expires_at: '2030-01-02T10:00:00.000Z',
};

describe('BonusCampaignSurface', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoading = false;
    mockUser = { id: 'user-1' };
    mockProfile = { id: 'user-1', username: 'Tester', balance: 500 };
    fetchAvailableBonusCampaignsMock.mockResolvedValue([campaign]);
    claimBonusCampaignMock.mockResolvedValue({
      campaign_id: 'campaign-1',
      amount: 1000,
      balance_after: 1500,
      claimed_at: '2030-01-01T12:00:00.000Z',
    });
    refreshProfileMock.mockResolvedValue(undefined);
  });

  it('shows the bonus modal when a campaign is available', async () => {
    render(<BonusCampaignSurface />);

    expect(await screen.findByText('Freebet z okazji Dnia Dziecka')).toBeInTheDocument();
    expect(screen.getByText('1000 zł', { exact: true })).toBeInTheDocument();
  });

  it('keeps a CTA visible after closing the modal without claiming', async () => {
    render(<BonusCampaignSurface />);

    await screen.findByText('Freebet z okazji Dnia Dziecka');
    fireEvent.click(screen.getByRole('button', { name: 'Później' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Odbierz bonus' })).toBeInTheDocument();
    });
  });

  it('claims the bonus, refreshes profile, and celebrates', async () => {
    render(<BonusCampaignSurface />);

    await screen.findByText('Freebet z okazji Dnia Dziecka');
    fireEvent.click(screen.getByRole('button', { name: 'Odbierz bonus' }));

    await waitFor(() => {
      expect(claimBonusCampaignMock).toHaveBeenCalledWith('campaign-1');
      expect(refreshProfileMock).toHaveBeenCalled();
      expect(toastSuccessMock).toHaveBeenCalled();
      expect(confettiMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Odbierz bonus' })).not.toBeInTheDocument();
    });
  });

  it('shows an error toast when claim fails', async () => {
    claimBonusCampaignMock.mockRejectedValue({ message: 'Kampania wygasła' });
    render(<BonusCampaignSurface />);

    await screen.findByText('Freebet z okazji Dnia Dziecka');
    fireEvent.click(screen.getByRole('button', { name: 'Odbierz bonus' }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Kampania wygasła');
      expect(fetchAvailableBonusCampaignsMock).toHaveBeenCalledTimes(2);
    });
  });
});
