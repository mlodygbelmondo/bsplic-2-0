import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import RankingsPage from "./RankingsPage";

const rpcMock = vi.fn();

vi.mock("@/components/Navbar", () => ({
  Navbar: () => <div>Navbar</div>,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

function renderWithProviders(children: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("RankingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpcMock.mockImplementation((fn: string) => {
      if (fn === "get_user_rankings") {
        return Promise.resolve({
          data: [
            {
              id: "user-1",
              username: "Tester",
              total_profit: 30,
              win_rate: 50,
              total_bets: 2,
              won_bets: 1,
              lost_bets: 1,
              balance: 130,
            },
          ],
        });
      }

      if (fn === "get_casino_rankings") {
        return Promise.resolve({
          data: [
            {
              id: "casino-user",
              username: "CasinoKing",
              total_profit: 80,
              win_rate: 100,
              total_bets: 1,
              won_bets: 1,
              lost_bets: 0,
              balance: 180,
            },
          ],
        });
      }

      return Promise.resolve({ data: [] });
    });
  });

  it("switches rankings between sportsbook and casino leaderboards", async () => {
    const { container } = renderWithProviders(<RankingsPage />);

    expect(await screen.findByText("Tester")).toBeInTheDocument();
    expect(container.querySelector(".app-surface")).toBeInTheDocument();
    expect(rpcMock).toHaveBeenCalledWith("get_user_rankings");

    fireEvent.click(screen.getByRole("button", { name: "Kasyno" }));

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith("get_casino_rankings");
    });

    expect(await screen.findByText("CasinoKing")).toBeInTheDocument();
    expect(screen.queryByText("Tester")).not.toBeInTheDocument();
  });

  it("shows a retry action when rankings fail to load", async () => {
    rpcMock.mockRejectedValueOnce(new Error("network down")).mockResolvedValueOnce({
      data: [
        {
          id: "user-1",
          username: "Tester",
          total_profit: 30,
          win_rate: 50,
          total_bets: 2,
          won_bets: 1,
          lost_bets: 1,
          balance: 130,
        },
      ],
    });

    renderWithProviders(<RankingsPage />);

    expect(
      await screen.findByText("Nie udało się wczytać rankingu"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Spróbuj ponownie" }));

    expect(await screen.findByText("Tester")).toBeInTheDocument();
    expect(rpcMock).toHaveBeenCalledTimes(2);
  });
});
