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

function renderHiddenBottomNav(pathname: string) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[pathname]}>
        <AppMobileBottomNav hidden />
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
    expect(activeLink).toHaveClass("text-[12px]");
  });

  it("renders labels above the glass filter layer so text does not pick up glass shadows", () => {
    renderBottomNav("/");

    const glassLayer = screen.getByTestId("liquid-glass");
    const itemsLayer = screen.getByTestId("mobile-bottom-nav-items");
    const activeLink = screen.getByRole("link", { name: "Zakłady" });

    expect(glassLayer).not.toContainElement(activeLink);
    expect(itemsLayer).toContainElement(activeLink);
  });

  it("keeps the light active item free of label-like drop shadows", () => {
    renderBottomNav("/");

    const activeLink = screen.getByRole("link", { name: "Zakłady" });
    const glassSurface = screen.getByTestId("liquid-glass").firstElementChild;

    expect(activeLink.className).not.toContain("0_4px_12px");
    expect(activeLink.className).not.toContain("0_10px_24px");
    expect(glassSurface).toHaveClass("bg-white");
    expect(glassSurface?.className).not.toContain("bg-white/[0.86]");
    expect(glassSurface?.className).not.toContain("bg-white/[0.98]");
  });

  it("slides the mobile nav out without fading it away first", () => {
    renderHiddenBottomNav("/");

    const nav = screen.getByRole("navigation", {
      name: "Nawigacja aplikacji",
    });

    expect(nav).toHaveClass("translate-y-full", "opacity-100");
    expect(nav).not.toHaveClass("opacity-0");
  });
});
