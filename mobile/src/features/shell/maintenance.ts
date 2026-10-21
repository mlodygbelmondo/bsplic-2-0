/**
 * Maintenance flag (port of the web's `src/lib/maintenance-mode.ts`). The web
 * origin serves `GET /api/maintenance` → `{ maintenanceMode: boolean }`, read
 * from Vercel Edge Config. Checks fail open: a network or server error never
 * locks users out.
 */

export const MAINTENANCE_CHECK_INTERVAL_MS = 30_000;
export const MAINTENANCE_STATUS_PATH = '/api/maintenance';
const REQUEST_TIMEOUT_MS = 8_000;

interface MaintenanceStatusResponse {
  maintenanceMode?: unknown;
}

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

interface FetchMaintenanceModeOptions {
  endpoint: string;
  fetcher?: Fetcher;
  signal?: AbortSignal;
}

/** Reads the flag. Rejects on network errors; a non-ok response counts as off. */
export async function fetchMaintenanceMode({ endpoint, fetcher = fetch, signal }: FetchMaintenanceModeOptions) {
  const response = await fetcher(endpoint, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!response.ok) {
    return false;
  }

  const status = (await response.json()) as MaintenanceStatusResponse;
  return status.maintenanceMode === true;
}

interface MaintenanceCheckerOptions {
  endpoint: string;
  fetcher?: Fetcher;
  timeoutMs?: number;
}

/**
 * Returns a check function that resolves to the flag, or `null` when the
 * check failed or another check is still running (callers keep their
 * current state on `null`).
 */
export function createMaintenanceModeChecker({
  endpoint,
  fetcher,
  timeoutMs = REQUEST_TIMEOUT_MS,
}: MaintenanceCheckerOptions) {
  let checking = false;

  return async (): Promise<boolean | null> => {
    if (checking) {
      return null;
    }

    checking = true;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetchMaintenanceMode({ endpoint, fetcher, signal: controller.signal });
    } catch {
      // Fail open: transient network/config errors keep the app usable.
      return null;
    } finally {
      clearTimeout(timeoutId);
      checking = false;
    }
  };
}
