import { QueryClient } from "@tanstack/react-query";

// One client for the whole app, so the boot preloader and the pages share a
// single cache: data warmed during the splash is what a page shows first.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      // One retry keeps a failed first load from holding a loader for long.
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Page data (feeds, profiles, rankings, casino tables): kept for the whole
 * session so returning to a page shows its last data instantly, and always
 * refreshed in the background when the page opens.
 */
export const PAGE_DATA_QUERY_OPTIONS = {
  gcTime: 60 * 60_000,
  refetchOnMount: "always",
} as const;
