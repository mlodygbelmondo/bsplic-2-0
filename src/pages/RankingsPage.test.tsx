import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import RankingsPage from "./RankingsPage";

const rpcMock = vi.fn();
const navbarMock = vi.hoisted(() => vi.fn(() => <div>Navbar</div>));

vi.mock("@/components/Navbar", () => ({
  Navbar: (props: { mobileBottomNavHidden?: boolean }) => navbarMock(props),
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
    navbarMock.mockClear();
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

    expect((await screen.findAllByText("Tester")).length).toBeGreaterThan(0);
    expect(container.querySelector(".app-surface")).toBeInTheDocument();
    expect(rpcMock).toHaveBeenCalledWith("get_user_rankings");

    fireEvent.click(screen.getByRole("button", { name: "Kasyno" }));

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith("get_casino_rankings");
    });

    expect((await screen.findAllByText("CasinoKing")).length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Tester")).toHaveLength(0);
  });

  it("renders a mobile ranking list while preserving the desktop table from sm up", async () => {
    const { container } = renderWithProviders(<RankingsPage />);

    expect((await screen.findAllByText("Tester")).length).toBeGreaterThan(0);

    expect(container.querySelector("[data-testid='rankings-mobile-list']")).toHaveClass(
      "sm:hidden",
    );
    expect(container.querySelector("[data-testid='rankings-mobile-row']")).toHaveClass(
      "grid",
      "grid-cols-[auto_minmax(0,1fr)_auto]",
    );
    expect(container.querySelector("[data-testid='rankings-desktop-table']")).toHaveClass(
      "hidden",
      "sm:block",
    );
  });

  it("keeps the desktop table shell around the loading state", () => {
    rpcMock.mockReturnValue(new Promise(() => {}));

    const { container } = renderWithProviders(<RankingsPage />);

    const desktopTable = container.querySelector("[data-testid='rankings-desktop-table']");

    expect(desktopTable).toHaveClass("hidden", "sm:block");
    expect(desktopTable).toHaveTextContent("#");
    expect(desktopTable).toHaveTextContent("Profit");
    expect(screen.getAllByText("Wczytywanie rankingu...").length).toBeGreaterThan(0);
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

    const { container } = renderWithProviders(<RankingsPage />);

    expect(
      (await screen.findAllByText("Nie udało się wczytać rankingu")).length,
    ).toBeGreaterThan(0);
    expect(container.querySelector("[data-testid='rankings-desktop-table']")).toHaveClass(
      "hidden",
      "sm:block",
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Spróbuj ponownie" })[0]);

    expect((await screen.findAllByText("Tester")).length).toBeGreaterThan(0);
    expect(rpcMock).toHaveBeenCalledTimes(2);
  });

  it("hides mobile bottom nav on deliberate downward scroll", async () => {
    const { container } = renderWithProviders(<RankingsPage />);

    expect((await screen.findAllByText("Tester")).length).toBeGreaterThan(0);
    expect(navbarMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ mobileBottomNavHidden: false }),
    );

    const scrollContainer = container.querySelector(
      "[data-testid='rankings-scroll-container']",
    ) as HTMLDivElement;
    Object.defineProperties(scrollContainer, {
      scrollTop: { configurable: true, value: 90 },
      scrollHeight: { configurable: true, value: 1800 },
      clientHeight: { configurable: true, value: 700 },
    });
    fireEvent.scroll(scrollContainer);

    expect(navbarMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ mobileBottomNavHidden: true }),
    );
  });

  it("reserves bottom scroll space for the mobile nav", async () => {
    const { container } = renderWithProviders(<RankingsPage />);

    expect((await screen.findAllByText("Tester")).length).toBeGreaterThan(0);
    expect(
      container.querySelector("[data-testid='rankings-scroll-container']"),
    ).toHaveClass("pb-[var(--mobile-bottom-nav-scroll-padding)]");
  });
});
