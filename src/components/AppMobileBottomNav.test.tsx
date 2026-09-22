import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@/contexts/ThemeContext";

import { AppMobileBottomNav } from "./AppMobileBottomNav";

const liquidGlassMock = vi.hoisted(() =>
  vi.fn(
    ({
      children,
      overLight,
      mode,
    }: {
      children: ReactNode;
      overLight?: boolean;
      mode?: string;
    }) => (
      <div
        data-testid="liquid-glass"
        data-mode={mode}
        data-over-light={String(overLight)}
      >
        {children}
      </div>
    ),
  ),
);

vi.mock("liquid-glass-react", () => ({
  default: liquidGlassMock,
}));

function renderBottomNav(pathname: string) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[pathname]}>
        <AppMobileBottomNav />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe("AppMobileBottomNav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    document.documentElement.classList.remove("light");
  });

  it.each(["/casino", "/casino/roulette", "/casino/blackjack", "/casino/slots/bandit", "/casino/slots/candy"])("groups all casino routes under one Games tab: %s", (path) => {
    renderBottomNav(path);
    expect(screen.getAllByRole("link")).toHaveLength(5);
    expect(screen.getByRole("link", { name: "Gry" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Gry" })).toHaveAttribute("href", "/casino");
  });

  it("links to the profile and marks it active", () => {
    renderBottomNav("/profile");
    expect(screen.getByRole("link", { name: "Profil" })).toHaveAttribute("href", "/profile");
    expect(screen.getByRole("link", { name: "Profil" })).toHaveAttribute("aria-current", "page");
  });

  it("renders the mobile navigation through the liquid glass surface", () => {
    renderBottomNav("/social");

    expect(screen.getByTestId("liquid-glass")).toBeInTheDocument();
    expect(liquidGlassMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "standard",
        overLight: false,
      }),
      undefined,
    );
  });

  it("marks the active mobile link for the highlighted glass pill", () => {
    renderBottomNav("/social");

    const activeLink = screen.getByRole("link", { name: "Social" });

    expect(activeLink).toHaveAttribute("aria-current", "page");
    expect(activeLink).toHaveAttribute("data-active", "true");
  });
});
