import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  disableMarketDataRefreshCron,
  setupMarketDataRefreshCronProfile,
} from '@/features/markets/api';

const rpcMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

describe('market API cron helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('configures cron profile and returns first result row', async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          peak_schedule: '0,30 10-16 * * *',
          offpeak_schedule: '0 0,2,4,6,8,18,20,22 * * *',
          estimated_runs_per_day: 22,
        },
      ],
      error: null,
    });

    const result = await setupMarketDataRefreshCronProfile({
      projectUrl: 'https://example.supabase.co',
      anonKey: 'anon-key',
    });

    expect(rpcMock).toHaveBeenCalledWith('setup_market_data_refresh_cron_profile', {
      p_project_url: 'https://example.supabase.co',
      p_anon_key: 'anon-key',
      p_peak_start_hour: 10,
      p_peak_end_hour: 16,
      p_offpeak_step_hours: 2,
    });
    expect(result.estimated_runs_per_day).toBe(22);
  });

  it('throws when cron profile rpc fails', async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'Only admins can configure market refresh cron' },
    });

    await expect(
      setupMarketDataRefreshCronProfile({
        projectUrl: 'https://example.supabase.co',
        anonKey: 'anon-key',
      }),
    ).rejects.toThrow('Only admins can configure market refresh cron');
  });

  it('throws when cron profile rpc returns empty payload', async () => {
    rpcMock.mockResolvedValueOnce({ data: [], error: null });

    await expect(
      setupMarketDataRefreshCronProfile({
        projectUrl: 'https://example.supabase.co',
        anonKey: 'anon-key',
      }),
    ).rejects.toThrow('Nie udało się skonfigurować harmonogramu odświeżania');
  });

  it('calls disable cron rpc', async () => {
    rpcMock.mockResolvedValueOnce({ error: null });

    await disableMarketDataRefreshCron();

    expect(rpcMock).toHaveBeenCalledWith('disable_market_data_refresh_cron');
  });

  it('throws when disable cron rpc fails', async () => {
    rpcMock.mockResolvedValueOnce({
      error: { message: 'disable failed' },
    });

    await expect(disableMarketDataRefreshCron()).rejects.toThrow('disable failed');
  });
});
