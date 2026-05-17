import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Navbar } from "./Navbar";

// ── Mocks ────────────────────────────────────────────────────

const signOutMock = vi.fn();
const refreshProfileMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
const rpcMock = vi.fn();

let mockProfile: Record<string, unknown> | null = null;
let mockUser: Record<string, unknown> | null = null;
let mockIsAdmin = false;

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: mockUser,
    profile: mockProfile,
    isAdmin: mockIsAdmin,
    signOut: signOutMock,
    refreshProfile: refreshProfileMock,
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
  <div data-testid="notifications-bell">notifications-{userId ?? 'none'}</div>
));

vi.mock("@/features/notifications/components/NotificationsBell", () => ({
  NotificationsBell: (props: { userId?: string; className?: string }) => notificationsBellMock(props),
}));

// Import the mocked function so we can control its return value per test
import { canClaimTopup } from "@/features/social/polishDay";
const canClaimTopupMock = vi.mocked(canClaimTopup);

// ── Helpers ──────────────────────────────────────────────────

function renderNavbar(pathname = "/") {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <Navbar />
    </MemoryRouter>,
  );
}

// ── Tests ────────────────────────────────────────────────────

describe("Navbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: "user-1", email: "test@test.com" };
    mockProfile = {
      id: "user-1",
      username: "Tester",
      balance: 500,
      last_topup_at: "2026-03-15T10:00:00.000Z",
    };
    mockIsAdmin = false;
    canClaimTopupMock.mockReturnValue(true);
    rpcMock.mockResolvedValue({ error: null });
    refreshProfileMock.mockResolvedValue(undefined);
    notificationsBellMock.mockClear();
  });

  // ── Basic rendering ──────────────────────────────────────

  it("renders app name and navigation links", () => {
    renderNavbar();
    expect(screen.getByText("BSPLIC 2.0")).toBeInTheDocument();
    // Desktop links
    expect(screen.getByText("Zakłady")).toBeInTheDocument();
    expect(screen.getAllByText("Kasyno").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Social").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Rankingi").length).toBeGreaterThan(0);
  });

  it("shows admin link when user is admin", () => {
    mockIsAdmin = true;
    renderNavbar();
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("does not show admin link for non-admin users", () => {
    mockIsAdmin = false;
    renderNavbar();
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
  });

  it("displays user balance in the wallet button", () => {
    renderNavbar();
    expect(screen.getByText("500.00 zł")).toBeInTheDocument();
  });

  it("renders notifications bell and passes current user id", () => {
    renderNavbar();
    expect(screen.getAllByTestId("notifications-bell").length).toBeGreaterThan(0);
    expect(notificationsBellMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1" }),
    );
  });

  // ── Topup — canClaimTopup is true ─────────────────────

  it("opens topup dialog when canClaimTopup returns true", () => {
    canClaimTopupMock.mockReturnValue(true);
    renderNavbar();

    const walletButton = screen.getByTitle("Doładuj portfel");
    fireEvent.click(walletButton);

    expect(screen.getByText("Doładuj portfel")).toBeInTheDocument();
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
    const confirmButton = screen.getByRole("button", {
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

    const confirmButton = screen.getByRole("button", {
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
    expect(screen.queryByText("Doładuj portfel")).not.toBeInTheDocument();
  });

  it("sets wallet button title to deny message when cannot topup", () => {
    canClaimTopupMock.mockReturnValue(false);
    renderNavbar();
    expect(
      screen.getByTitle("Już doładowano dzisiaj. Wróć jutro!"),
    ).toBeInTheDocument();
  });

  // ── Sign out ─────────────────────────────────────────────

  it("calls signOut when logout button is clicked", () => {
    renderNavbar();
    const logoutButton = screen.getByTitle("Wyloguj");
    fireEvent.click(logoutButton);
    expect(signOutMock).toHaveBeenCalled();
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
