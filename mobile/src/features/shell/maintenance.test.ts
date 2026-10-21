import { describe, expect, it, vi } from 'vitest';

import { createMaintenanceModeChecker, fetchMaintenanceMode } from './maintenance';

const ENDPOINT = 'https://example.test/api/maintenance';

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

describe('fetchMaintenanceMode', () => {
  it('reads the uncached maintenance status endpoint', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ maintenanceMode: true }));

    await expect(fetchMaintenanceMode({ endpoint: ENDPOINT, fetcher })).resolves.toBe(true);

    expect(fetcher).toHaveBeenCalledWith(
      ENDPOINT,
      expect.objectContaining({
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      }),
    );
  });

  it('treats anything but a literal true as off', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ maintenanceMode: 'true' }));

    await expect(fetchMaintenanceMode({ endpoint: ENDPOINT, fetcher })).resolves.toBe(false);
  });

  it('treats a non-ok response as off', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ maintenanceMode: true }, { status: 500 }));

    await expect(fetchMaintenanceMode({ endpoint: ENDPOINT, fetcher })).resolves.toBe(false);
  });

  it('surfaces status endpoint failures to the caller', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('offline'));

    await expect(fetchMaintenanceMode({ endpoint: ENDPOINT, fetcher })).rejects.toThrow('offline');
  });
});

describe('createMaintenanceModeChecker', () => {
  it('reports the flag when the check succeeds', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ maintenanceMode: true }));
    const check = createMaintenanceModeChecker({ endpoint: ENDPOINT, fetcher });

    await expect(check()).resolves.toBe(true);
  });

  it('fails open with null when the check itself fails', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('network'));
    const check = createMaintenanceModeChecker({ endpoint: ENDPOINT, fetcher });

    await expect(check()).resolves.toBeNull();
  });

  it('skips overlapping checks while one is in flight', async () => {
    let resolveFetch: (response: Response) => void = () => undefined;
    const fetcher = vi.fn().mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );
    const check = createMaintenanceModeChecker({ endpoint: ENDPOINT, fetcher });

    const first = check();
    await expect(check()).resolves.toBeNull();
    resolveFetch(jsonResponse({ maintenanceMode: false }));

    await expect(first).resolves.toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('aborts a hung request after the timeout and fails open', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(
      (_input: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const check = createMaintenanceModeChecker({ endpoint: ENDPOINT, fetcher, timeoutMs: 1000 });

    const result = check();
    await vi.advanceTimersByTimeAsync(1000);

    await expect(result).resolves.toBeNull();
    vi.useRealTimers();
  });
});
