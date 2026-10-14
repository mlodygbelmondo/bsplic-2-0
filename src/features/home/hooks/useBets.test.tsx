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
});
