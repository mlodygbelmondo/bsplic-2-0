import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Navbar } from "./Navbar";

// ── Mocks ────────────────────────────────────────────────────

const signOutMock = vi.fn();
const refreshProfileMock = vi.fn();
const updateProfileBalanceMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
const rpcMock = vi.fn();

let mockProfile: Record<string, unknown> | null = null;
let mockUser: Record<string, unknown> | null = null;
let mockIsAdmin = false;
let mockIsModerator = false;

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: mockUser,
    profile: mockProfile,
    isAdmin: mockIsAdmin,
    isModerator: mockIsModerator,
    signOut: signOutMock,
    refreshProfile: refreshProfileMock,
    updateProfileBalance: updateProfileBalanceMock,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

vi.mock("@/features/social/polishDay", () => ({
  canClaimTopup: vi.fn(),
}));

const notificationsBellMock = vi.fn(({ userId }: { userId?: string }) => (
  <div data-testid="notifications-bell">notifications-{userId ?? "none"}</div>
));

vi.mock("@/features/notifications/components/NotificationsBell", () => ({
  NotificationsBell: (props: { userId?: string; className?: string }) =>
    notificationsBellMock(props),
}));

vi.mock("@/features/transfers/components/MoneyTransferDialog", () => ({
  default: ({ open }: { open: boolean }) =>
    open ? <div role="dialog" aria-label="Transfer pieniędzy" /> : null,
}));

// Import the mocked function so we can control its return value per test
import { canClaimTopup } from "@/features/social/polishDay";
import { ThemeProvider } from "@/contexts/ThemeContext";
const canClaimTopupMock = vi.mocked(canClaimTopup);

// ── Helpers ──────────────────────────────────────────────────

type NavbarTestProps = ComponentProps<typeof Navbar> & {
  onOpenProposeModal?: () => void;
};

function renderNavbar(pathname = "/", props: NavbarTestProps = {}) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[pathname]}>
        <Navbar {...props} />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

// ── Tests ────────────────────────────────────────────────────

describe("Navbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-dark-palette");
    document.documentElement.classList.remove("light");
    mockUser = { id: "user-1", email: "test@test.com" };
    mockProfile = {
      id: "user-1",
      username: "Tester",
      balance: 500,
      last_topup_at: "2026-03-15T10:00:00.000Z",
    };
    mockIsAdmin = false;
    mockIsModerator = false;
    canClaimTopupMock.mockReturnValue(true);
    rpcMock.mockResolvedValue({ error: null });
    refreshProfileMock.mockResolvedValue(undefined);
    notificationsBellMock.mockClear();
    document.body.classList.remove("mobile-bottom-nav-hidden");
  });

  // ── Basic rendering ──────────────────────────────────────

  it("renders app name and navigation links", async () => {
    renderNavbar();
    expect(screen.getByText("BSPLIC 2.0")).toBeInTheDocument();
    // Desktop links
    expect(screen.getAllByText("Zakłady").length).toBeGreaterThan(0);
    expect(screen.getByText("Kasyno")).toBeInTheDocument();
    expect(screen.getAllByText("Social").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Rankingi").length).toBeGreaterThan(0);
    expect(
      (await screen.findAllByTestId("notifications-bell")).length,
    ).toBeGreaterThan(0);
  });

  it("shows admin link when user is admin", () => {
    mockIsAdmin = true;
    renderNavbar();
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("keeps the regular mobile bottom navigation for admins outside the admin panel", () => {
    mockIsAdmin = true;
    renderNavbar("/");

    expect(
      screen.getByRole("navigation", { name: "Nawigacja aplikacji" }),
    ).toBeInTheDocument();
  });

  it("hides the regular mobile bottom navigation inside the admin panel", () => {
    mockIsAdmin = true;
    renderNavbar("/admin");

    expect(
      screen.queryByRole("navigation", { name: "Nawigacja aplikacji" }),
    ).not.toBeInTheDocument();
  });

  it("marks the floating CTA stack as lowered when the mobile bottom navigation is hidden", () => {
    renderNavbar("/", { mobileBottomNavHidden: true });

    expect(document.body).toHaveClass("mobile-bottom-nav-hidden");
  });

  it("marks the floating CTA stack as lowered when the mobile bottom navigation is absent", () => {
    renderNavbar("/admin");

    expect(document.body).toHaveClass("mobile-bottom-nav-hidden");
  });

  it("does not show admin link for non-admin users", () => {
    mockIsAdmin = false;
    renderNavbar();
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
  });

  it("shows desktop proposals link for moderators", () => {
    mockIsModerator = true;
    renderNavbar();

    const proposalsLink = screen.getByRole("link", { name: /propozycje/i });
    expect(proposalsLink).toHaveAttribute("href", "/admin");
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
  });

  it("does not add moderator proposals link to the mobile menu", async () => {
    mockIsModerator = true;
    renderNavbar();

    fireEvent.click(screen.getByRole("button", { name: "Otwórz menu" }));

    const menu = await screen.findByRole("dialog");
    expect(within(menu).queryByText("Propozycje")).not.toBeInTheDocument();
  });

  it("shows propose bet action in the mobile menu when provided", async () => {
    const onOpenProposeModal = vi.fn();
    renderNavbar("/", { onOpenProposeModal });

    fireEvent.click(screen.getByRole("button", { name: "Otwórz menu" }));

    const menu = await screen.findByRole("dialog");
    const proposeButton = within(menu).getByRole("button", {
      name: /zaproponuj zakład/i,
    });

    fireEvent.click(proposeButton);

    expect(onOpenProposeModal).toHaveBeenCalledTimes(1);
  });

  it("displays user balance in the wallet button", () => {
    renderNavbar();
    expect(screen.getByText("500.00 zł")).toBeInTheDocument();
  });

  it("labels the wallet button with balance and top-up availability", () => {
    renderNavbar();

    expect(
      screen.getByRole("button", {
        name: "Portfel: 500.00 zł. Doładuj portfel",
      }),
    ).toBeInTheDocument();
  });

  it("renders notifications bell and passes current user id", async () => {
    renderNavbar();
    expect(
      (await screen.findAllByTestId("notifications-bell")).length,
    ).toBeGreaterThan(0);
    await waitFor(() =>
      expect(notificationsBellMock).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "user-1" }),
      ),
    );
  });

  it("dims inactive desktop navigation links more clearly", () => {
    renderNavbar("/");

    expect(screen.getAllByRole("link", { name: "Zakłady" })[0]).toHaveClass(
      "text-navbar-foreground",
    );
    expect(screen.getAllByRole("link", { name: "Rankingi" })[0]).toHaveClass(
      "text-navbar-foreground/60",
    );
  });

  it("keeps desktop navbar actions on a consistent center line", async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === "(min-width: 1024px)",
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }));

    try {
      renderNavbar();

      await waitFor(() => {
        expect(screen.getByTitle("Doładuj portfel")).toHaveClass(
          "h-8",
          "leading-none",
        );
      });
      expect(screen.getByTitle("Menu użytkownika")).toHaveClass(
        "h-8",
        "leading-none",
      );
      expect(notificationsBellMock).toHaveBeenCalledWith(
        expect.objectContaining({
          className: expect.stringContaining("h-8 w-8"),
        }),
      );
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it("uses a smaller notification bell icon on mobile", async () => {
    renderNavbar();

    await waitFor(() => {
      expect(
        notificationsBellMock.mock.calls.some(([props]) =>
          typeof props.className === "string" &&
          props.className.includes("[&>svg]:h-5 [&>svg]:w-5") &&
          !props.className.includes("p-0"),
        ),
      ).toBe(true);
    });
  });

  // ── Topup — canClaimTopup is true ─────────────────────

  it("opens topup dialog when canClaimTopup returns true", async () => {
    canClaimTopupMock.mockReturnValue(true);
    renderNavbar();

    const walletButton = screen.getByTitle("Doładuj portfel");
    fireEvent.click(walletButton);

    expect(await screen.findByText("💰 Doładuj portfel")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /doładuj 100 zł/i }),
    ).toBeInTheDocument();
  });

  it("calls canClaimTopup with profile.last_topup_at", () => {
    canClaimTopupMock.mockReturnValue(true);
    renderNavbar();

    const walletButton = screen.getByTitle("Doładuj portfel");
    fireEvent.click(walletButton);

    expect(canClaimTopupMock).toHaveBeenCalledWith("2026-03-15T10:00:00.000Z");
  });

  it("executes topup RPC and refreshes profile on confirm", async () => {
    canClaimTopupMock.mockReturnValue(true);
    rpcMock.mockResolvedValue({ error: null });

    renderNavbar();

    // Open dialog
    const walletButton = screen.getByTitle("Doładuj portfel");
    fireEvent.click(walletButton);

    // Click confirm
    const confirmButton = await screen.findByRole("button", {
      name: /doładuj 100 zł/i,
    });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith("secure_daily_topup", {
        p_user_id: "user-1",
      });
      expect(refreshProfileMock).toHaveBeenCalled();
      expect(toastSuccessMock).toHaveBeenCalledWith(
        "💰 Doładowano 100 zł. Wróć jutro po więcej!",
      );
    });
  });

  it("shows error toast when topup RPC fails", async () => {
    canClaimTopupMock.mockReturnValue(true);
    rpcMock.mockResolvedValue({ error: { message: "Limit reached" } });

    renderNavbar();

    const walletButton = screen.getByTitle("Doładuj portfel");
    fireEvent.click(walletButton);

    const confirmButton = await screen.findByRole("button", {
      name: /doładuj 100 zł/i,
    });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Limit reached");
      expect(refreshProfileMock).not.toHaveBeenCalled();
    });
  });

  // ── Topup — canClaimTopup is false ────────────────────

  it("shows error toast when topup already claimed today", () => {
    canClaimTopupMock.mockReturnValue(false);
    renderNavbar();

    const walletButton = screen.getByTitle(
      "Już doładowano dzisiaj. Wróć jutro!",
    );
    fireEvent.click(walletButton);

    expect(toastErrorMock).toHaveBeenCalledWith(
      "Już doładowano dzisiaj. Wróć jutro!",
    );
    // Dialog should NOT open
    expect(screen.queryByText("💰 Doładuj portfel")).not.toBeInTheDocument();
  });

  it("sets wallet button title to deny message when cannot topup", () => {
    canClaimTopupMock.mockReturnValue(false);
    renderNavbar();
    expect(
      screen.getByTitle("Już doładowano dzisiaj. Wróć jutro!"),
    ).toBeInTheDocument();
  });

  // ── Sign out ─────────────────────────────────────────────

  it("calls signOut from the user dropdown menu", async () => {
    renderNavbar();
    // Open the user menu (Radix trigger responds to keyboard activation)
    fireEvent.keyDown(screen.getByTitle("Menu użytkownika"), { key: "Enter" });
    fireEvent.click(await screen.findByText("Wyloguj"));
    expect(signOutMock).toHaveBeenCalled();
  });

  it("shows theme toggle inside the user dropdown menu", async () => {
    renderNavbar();
    fireEvent.keyDown(screen.getByTitle("Menu użytkownika"), { key: "Enter" });
    expect(await screen.findByText("Tryb ciemny")).toBeInTheDocument();
  });

  it("opens money transfers from the user dropdown menu", async () => {
    renderNavbar();

    fireEvent.keyDown(screen.getByTitle("Menu użytkownika"), { key: "Enter" });
    fireEvent.click(await screen.findByText("Wyślij pieniądze"));

    expect(
      await screen.findByRole("dialog", { name: "Transfer pieniędzy" }),
    ).toBeInTheDocument();
  });

  it("does not expose the temporary dark palette picker in the desktop menu", async () => {
    renderNavbar();

    fireEvent.keyDown(screen.getByTitle("Menu użytkownika"), { key: "Enter" });

    await screen.findByText("Tryb ciemny");

    expect(screen.queryByText("Paleta dark")).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /ruby/i })).not.toBeInTheDocument();
    expect(window.localStorage.getItem("bsplic.darkPalette")).toBeNull();
  });

  it("does not expose the temporary dark palette picker in the mobile menu", async () => {
    renderNavbar();

    fireEvent.click(screen.getByRole("button", { name: "Otwórz menu" }));

    const menu = await screen.findByRole("dialog");
    expect(within(menu).queryByText("Paleta dark")).not.toBeInTheDocument();
    expect(
      within(menu).queryByRole("button", { name: /ruby/i }),
    ).not.toBeInTheDocument();
    expect(window.localStorage.getItem("bsplic.darkPalette")).toBeNull();
  });

  it("keeps the single ruby palette out of theme storage", async () => {
    renderNavbar();

    await waitFor(() => {
      expect(document.documentElement).not.toHaveAttribute("data-dark-palette");
    });
    expect(window.localStorage.getItem("bsplic.darkPalette")).toBeNull();
  });

  // ── No profile ───────────────────────────────────────────

  it("does not render wallet button when profile is null", () => {
    mockProfile = null;
    renderNavbar();
    expect(screen.queryByTitle("Doładuj portfel")).not.toBeInTheDocument();
    expect(
      screen.queryByTitle("Już doładowano dzisiaj. Wróć jutro!"),
    ).not.toBeInTheDocument();
  });

  // ── canClaimTopup with null last_topup_at ─────────────

  it("passes null to canClaimTopup when last_topup_at is not set", () => {
    mockProfile = { ...mockProfile, last_topup_at: undefined };
    canClaimTopupMock.mockReturnValue(true);
    renderNavbar();

    const walletButton = screen.getByTitle("Doładuj portfel");
    fireEvent.click(walletButton);

    expect(canClaimTopupMock).toHaveBeenCalledWith(undefined);
  });
});
