import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useBets } from "./useBets";

const fetchActiveBetsMock = vi.fn();
const unsubscribeMock = vi.fn();
const subscribeToBetsChangesMock = vi.fn(() => unsubscribeMock);

vi.mock("@/features/home/api/bets", () => ({
  ACTIVE_BETS_PAGE_SIZE: 80,
  fetchActiveBets: (
    categoryIds: readonly string[] | null,
    sort: string,
    limit: number,
    offset: number,
  ) => fetchActiveBetsMock(categoryIds, sort, limit, offset),
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

  it("fetches once for an id list that is recreated with the same contents", async () => {
    fetchActiveBetsMock.mockResolvedValue([]);

    const { result, rerender, unmount } = renderHook(
      ({ ids }) => useBets(ids, "newest"),
      { initialProps: { ids: ["football", "premier"] } },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    rerender({ ids: ["football", "premier"] });
    rerender({ ids: ["football", "premier"] });

    expect(fetchActiveBetsMock).toHaveBeenCalledTimes(1);
    expect(fetchActiveBetsMock).toHaveBeenCalledWith(
      ["football", "premier"],
      "newest",
      81,
      0,
    );

    unmount();
  });

  it("reloads when the selected category ids change", async () => {
    fetchActiveBetsMock.mockResolvedValue([]);

    const { result, rerender, unmount } = renderHook(
      ({ ids }) => useBets(ids, "newest"),
      { initialProps: { ids: ["football", "premier"] } },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    rerender({ ids: ["premier"] });

    await waitFor(() =>
      expect(fetchActiveBetsMock).toHaveBeenLastCalledWith(
        ["premier"],
        "newest",
        81,
        0,
      ),
    );
    expect(fetchActiveBetsMock).toHaveBeenCalledTimes(2);

    unmount();
  });

  it("waits until enabled before fetching", async () => {
    fetchActiveBetsMock.mockResolvedValue([]);

    const { result, rerender, unmount } = renderHook(
      ({ enabled }) => useBets(["football"], "newest", false, enabled),
      { initialProps: { enabled: false } },
    );

    expect(result.current.loading).toBe(true);
    expect(fetchActiveBetsMock).not.toHaveBeenCalled();

    rerender({ enabled: true });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchActiveBetsMock).toHaveBeenCalledWith(
      ["football"],
      "newest",
      81,
      0,
    );

    unmount();
  });

  it("reports loading from the render that changes the category and keeps the previous bets until the new ones arrive", async () => {
    const footballBet = {
      id: "bet-football",
      title: "Legia – Lech",
      is_live: false,
      is_active: true,
      bet_count: 3,
      category_id: "football",
      created_at: "2026-10-14T10:00:00.000Z",
      ends_at: "2026-10-20T18:00:00.000Z",
    };
    const ufcBet = { ...footballBet, id: "bet-ufc", category_id: "ufc" };
    let resolveUfc: (bets: unknown[]) => void = () => {};
    fetchActiveBetsMock
      .mockResolvedValueOnce([footballBet])
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveUfc = resolve;
        }),
      );

    const renders: { ids: string[]; loading: boolean; betIds: string[] }[] =
      [];
    const { result, rerender, unmount } = renderHook(
      ({ ids }) => {
        const bets = useBets(ids, "newest");
        renders.push({
          ids,
          loading: bets.loading,
          betIds: bets.sortedBets.map((bet) => bet.id),
        });
        return bets;
      },
      { initialProps: { ids: ["football"] } },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    rerender({ ids: ["ufc"] });

    // No render may present the football bets as the finished UFC list.
    const ufcRendersWithOldBets = renders.filter(
      (entry) => entry.ids[0] === "ufc" && entry.betIds[0] === "bet-football",
    );
    expect(ufcRendersWithOldBets.length).toBeGreaterThan(0);
    expect(ufcRendersWithOldBets.every((entry) => entry.loading)).toBe(true);

    resolveUfc([ufcBet]);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.sortedBets.map((bet) => bet.id)).toEqual(["bet-ufc"]);

    unmount();
  });
});
