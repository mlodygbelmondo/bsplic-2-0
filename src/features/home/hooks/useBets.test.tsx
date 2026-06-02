import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useBets } from "./useBets";

const fetchActiveBetsMock = vi.fn();
const unsubscribeMock = vi.fn();
const subscribeToBetsChangesMock = vi.fn(() => unsubscribeMock);

vi.mock("@/features/home/api/bets", () => ({
  ACTIVE_BETS_PAGE_SIZE: 80,
  fetchActiveBets: (
    selectedCategory: string | null,
    sort: string,
    limit: number,
    offset: number,
  ) => fetchActiveBetsMock(selectedCategory, sort, limit, offset),
  subscribeToBetsChanges: (onChange: unknown) =>
    subscribeToBetsChangesMock(onChange),
}));

describe("useBets", () => {
  beforeEach(() => {
    fetchActiveBetsMock.mockReset();
    subscribeToBetsChangesMock.mockClear();
    unsubscribeMock.mockClear();
  });

  it("loads and subscribes", async () => {
    fetchActiveBetsMock.mockResolvedValue([]);

    const { result, unmount } = renderHook(() => useBets(null, "newest"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(fetchActiveBetsMock).toHaveBeenCalledWith(null, "newest", 81, 0);
    expect(subscribeToBetsChangesMock).toHaveBeenCalledTimes(1);

    unmount();
    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
  });

  it("reloads data without recreating the realtime channel when sort changes", async () => {
    fetchActiveBetsMock.mockResolvedValue([]);

    const { result, rerender, unmount } = renderHook(
      ({ sort }) => useBets(null, sort),
      {
        initialProps: { sort: "newest" as const },
      },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    rerender({ sort: "popular" });

    await waitFor(() =>
      expect(fetchActiveBetsMock).toHaveBeenCalledWith(null, "popular", 81, 0),
    );
    expect(subscribeToBetsChangesMock).toHaveBeenCalledTimes(1);

    unmount();
  });
});
