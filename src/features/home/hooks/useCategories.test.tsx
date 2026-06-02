import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCategories } from "./useCategories";

const fetchCategoriesMock = vi.fn();
const unsubscribeMock = vi.fn();
const subscribeToCategoryChangesMock = vi.fn(() => unsubscribeMock);

vi.mock("@/features/home/api/categories", () => ({
  fetchCategories: () => fetchCategoriesMock(),
  subscribeToCategoryChanges: (onChange: () => void) =>
    subscribeToCategoryChangesMock(onChange),
}));

function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function QueryWrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("useCategories", () => {
  beforeEach(() => {
    fetchCategoriesMock.mockReset();
    subscribeToCategoryChangesMock.mockClear();
    unsubscribeMock.mockClear();
  });

  it("loads and subscribes", async () => {
    fetchCategoriesMock.mockResolvedValue([
      {
        id: "cat-1",
        name: "Football",
        emoji: "ball",
        color: "#22c55e",
        sort_order: 1,
        created_at: "2030-01-01T00:00:00.000Z",
      },
    ]);

    const { result, unmount } = renderHook(() => useCategories(), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.categories).toHaveLength(1);
    expect(result.current.categoryMap["cat-1"].name).toBe("Football");
    expect(fetchCategoriesMock).toHaveBeenCalledTimes(1);
    expect(subscribeToCategoryChangesMock).toHaveBeenCalledTimes(1);

    unmount();
    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
  });
});
