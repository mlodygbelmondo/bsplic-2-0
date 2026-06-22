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

  it("keeps the original glass nav structure while shielding light labels from text artifacts", () => {
    renderBottomNav("/");

    const glassLayer = screen.getByTestId("liquid-glass");
    const activeLink = screen.getByRole("link", { name: "Zakłady" });
    const activeLabel = screen.getByText("Zakłady");
    const inactiveLabel = screen.getByText("Social");

    expect(glassLayer).toContainElement(activeLink);
    expect(screen.queryByTestId("mobile-bottom-nav-items")).not.toBeInTheDocument();
    expect(activeLabel).toHaveClass(
      "bg-[#fae6e8]/[0.7]",
      "shadow-none",
      "[text-shadow:none]",
    );
    expect(activeLabel.className).not.toContain("bg-[#c90018]/");
    expect(inactiveLabel).toHaveClass(
      "bg-white/[0.7]",
      "shadow-none",
      "[text-shadow:none]",
    );
  });
});
