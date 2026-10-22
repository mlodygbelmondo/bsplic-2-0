// Transport failures carry English text: "Network request failed" (React
// Native fetch), "fetch failed: …" (expo/fetch, also when the request timeout
// aborts), "Failed to fetch" (supabase-js), gateway pages, upstream and
// database-overload errors when the backend is down (also matched by text,
// because some APIs rethrow `new Error(error.message)` without the code).
// The caller's Polish fallback reads better.
const NETWORK_FAILURE =
  /network request failed|failed to fetch|fetch failed|network error|load failed|aborted|upstream|<html|<!doctype|connection pool|statement timeout|could not connect with the database/i;

// PostgREST cannot reach the database (PGRST000–002), its connection pool
// timed out (PGRST003), or Postgres cancelled the statement (57014).
const BACKEND_UNAVAILABLE_CODES = new Set(['PGRST000', 'PGRST001', 'PGRST002', 'PGRST003', '57014']);

const errorMessageOf = (error: unknown): string | null =>
  typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
    ? error.message
    : null;

/** The request failed in transit or the backend could not run it. */
export const isTransportFailure = (error: unknown): boolean => {
  const message = errorMessageOf(error);
  if (message === null) return false;
  const code = (error as { code?: unknown }).code;
  if (typeof code === 'string' && BACKEND_UNAVAILABLE_CODES.has(code)) return true;
  return NETWORK_FAILURE.test(message);
};

// The request never left the device (offline, server unreachable) or the
// database never ran it (pool timeout, cancelled statement, no database).
const NOT_RUN =
  /appears to be offline|could not connect to the server|hostname could not be found|unable to resolve host|failed to connect to|connection pool|statement timeout|could not connect with the database/i;

/**
 * A write failed in transit in a way that leaves its outcome unknown: a timeout,
 * a dropped connection (also iOS killing the socket when the app is suspended),
 * a gateway giving up. Any transport failure counts unless it surely did not run.
 */
export const isOutcomeUnknown = (error: unknown): boolean => {
  if (!isTransportFailure(error)) return false;
  const code = (error as { code?: unknown }).code;
  if (typeof code === 'string' && BACKEND_UNAVAILABLE_CODES.has(code)) return false;
  return !NOT_RUN.test(errorMessageOf(error) ?? '');
};

export const getErrorMessage = (error: unknown, fallback: string): string => {
  const message = errorMessageOf(error);
  if (message === null || isTransportFailure(error)) return fallback;
  return message;
};
