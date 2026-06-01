import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import BonusCampaignsTab from './BonusCampaignsTab';

const fetchAdminBonusCampaignsMock = vi.fn();
const createBonusCampaignMock = vi.fn();
const deactivateBonusCampaignMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock('@/features/bonus-campaigns/bonus-campaign-api', () => ({
  fetchAdminBonusCampaigns: (...args: unknown[]) =>
    fetchAdminBonusCampaignsMock(...args),
  createBonusCampaign: (...args: unknown[]) => createBonusCampaignMock(...args),
  deactivateBonusCampaign: (...args: unknown[]) =>
    deactivateBonusCampaignMock(...args),
}));

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

describe('BonusCampaignsTab', () => {
  const now = Date.now();
  const campaign = {
    id: 'campaign-1',
    title: 'Freebet z okazji Dnia Dziecka',
    description: 'Odbierz swoje 1000 złotych',
    amount: 1000,
    starts_at: new Date(now - 60 * 60 * 1000).toISOString(),
    expires_at: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
    is_active: true,
    created_at: '2030-01-01T09:00:00.000Z',
    updated_at: '2030-01-01T09:00:00.000Z',
    claim_count: 3,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    fetchAdminBonusCampaignsMock.mockResolvedValue([campaign]);
    createBonusCampaignMock.mockResolvedValue(undefined);
    deactivateBonusCampaignMock.mockResolvedValue(undefined);
  });

  it('renders campaigns with claim counts and status', async () => {
    render(<BonusCampaignsTab />);

    expect(
      await screen.findByText('Freebet z okazji Dnia Dziecka'),
    ).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Aktywna')).toBeInTheDocument();
  });

  it('blocks invalid campaign form submission', async () => {
    render(<BonusCampaignsTab />);

    fireEvent.change(screen.getByLabelText('Tytuł'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Utwórz kampanię' }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        'Tytuł kampanii jest wymagany',
      );
    });
  });

  it('deactivates a campaign instead of deleting it', async () => {
    render(<BonusCampaignsTab />);

    await screen.findByText('Freebet z okazji Dnia Dziecka');
    fireEvent.click(screen.getByRole('button', { name: 'Wyłącz' }));

    await waitFor(() => {
      expect(deactivateBonusCampaignMock).toHaveBeenCalledWith('campaign-1');
      expect(toastSuccessMock).toHaveBeenCalledWith(
        'Kampania została wyłączona',
      );
    });
  });
});
