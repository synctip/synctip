import { QueryClient } from "@tanstack/react-query";

/**
 * Single QueryClient for the whole app. Tune defaults here.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 5s of "fresh" data before background refetch.
      staleTime: 5_000,
      // Don't hammer the network when the user tab-switches.
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
