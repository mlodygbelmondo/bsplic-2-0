// Transport failures carry the platform's English text ("Network request
// failed" from React Native fetch, "Failed to fetch" from supabase-js); the
// caller's Polish fallback reads better than either.
const NETWORK_FAILURE = /network request failed|failed to fetch|network error|load failed/i;

export const getErrorMessage = (error: unknown, fallback: string): string => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    const { message } = error as { message: string };
    return NETWORK_FAILURE.test(message) ? fallback : message;
  }
  return fallback;
};
