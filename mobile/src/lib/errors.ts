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

export const getErrorMessage = (error: unknown, fallback: string): string => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    const { message, code } = error as { message: string; code?: unknown };
    if (typeof code === 'string' && BACKEND_UNAVAILABLE_CODES.has(code)) return fallback;
    return NETWORK_FAILURE.test(message) ? fallback : message;
  }
  return fallback;
};
