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
const isTransportFailure = (error: unknown): boolean => {
  const message = errorMessageOf(error);
  if (message === null) return false;
  const code = (error as { code?: unknown }).code;
  if (typeof code === 'string' && BACKEND_UNAVAILABLE_CODES.has(code)) return true;
  return NETWORK_FAILURE.test(message);
};

// The request timed out or the connection dropped mid-flight, or a gateway gave
// up waiting: the server may still have run it. Pool timeouts (PGRST003),
// cancelled statements (57014) and "offline" mean it did not run.
const OUTCOME_UNKNOWN = /aborted|canceled|cancelled|timed out|connection was lost|upstream|<html|<!doctype/i;

/** A write failed in a way that leaves its outcome unknown. */
export const isOutcomeUnknown = (error: unknown): boolean => {
  const message = errorMessageOf(error);
  if (message === null) return false;
  const code = (error as { code?: unknown }).code;
  if (typeof code === 'string' && BACKEND_UNAVAILABLE_CODES.has(code)) return false;
  return OUTCOME_UNKNOWN.test(message);
};

export const getErrorMessage = (error: unknown, fallback: string): string => {
  const message = errorMessageOf(error);
  if (message === null || isTransportFailure(error)) return fallback;
  return message;
};
