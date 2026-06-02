import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useBets } from "./useBets";

const fetchActiveBetsMock = vi.fn();
const unsubscribeMock = vi.fn();
const subscribeToBetsChangesMock = vi.fn(() => unsubscribeMock);

vi.mock("@/features/home/api/bets", () => ({
  fetchActiveBets: (selectedCategory: string | null) =>
    fetchActiveBetsMock(selectedCategory),
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

    expect(fetchActiveBetsMock).toHaveBeenCalledWith(null);
    expect(subscribeToBetsChangesMock).toHaveBeenCalledTimes(1);

    unmount();
    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
  });
});
