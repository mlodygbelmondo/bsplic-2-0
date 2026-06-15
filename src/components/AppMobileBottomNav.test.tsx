import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppMobileBottomNav } from "./AppMobileBottomNav";

const useThemeMock = vi.fn(() => ({ theme: "light" as const }));

vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => useThemeMock(),
}));

describe("AppMobileBottomNav", () => {
  beforeEach(() => {
    useThemeMock.mockReturnValue({ theme: "light" });
  });

  it("renders five regular mobile destinations without a center plus action", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppMobileBottomNav />
      </MemoryRouter>,
    );

    const nav = screen.getByRole("navigation", {
      name: "Nawigacja aplikacji",
    });
    const labels = within(nav)
      .getAllByRole("link")
      .map((link) => link.textContent);

    expect(labels).toEqual([
      "Zakłady",
      "Social",
      "Ruletka",
      "Blackjack",
      "Rankingi",
    ]);

    expect(within(nav).getByRole("link", { name: "Zakłady" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(within(nav).getByRole("link", { name: "Ruletka" })).toHaveAttribute(
      "href",
      "/casino/roulette",
    );
    expect(
      within(nav).getByRole("link", { name: "Blackjack" }),
    ).toHaveAttribute("href", "/casino/blackjack");
    expect(within(nav).getByRole("link", { name: "Social" })).toHaveAttribute(
      "href",
      "/social",
    );
    expect(
      within(nav).getByRole("link", { name: "Rankingi" }),
    ).toHaveAttribute("href", "/rankings");

    expect(within(nav).queryByRole("button")).not.toBeInTheDocument();
    expect(within(nav).queryByLabelText(/utwórz|dodaj/i)).not.toBeInTheDocument();
  });

  it("slides out with transform classes when hidden", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppMobileBottomNav hidden />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("navigation", { name: "Nawigacja aplikacji" }),
    ).toHaveClass("translate-y-full", "opacity-0");
  });

  it("rounds only the top edge of the bottom bar surface", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppMobileBottomNav />
      </MemoryRouter>,
    );

    const nav = screen.getByRole("navigation", {
      name: "Nawigacja aplikacji",
    });

    expect(nav.lastElementChild).toHaveClass("rounded-t-lg");
    expect(nav.lastElementChild?.firstElementChild).toHaveClass("rounded-t-lg");
  });

  it("uses a white glass base on regular light-mode pages without an active capsule", () => {
    render(
      <MemoryRouter initialEntries={["/social"]}>
        <AppMobileBottomNav />
      </MemoryRouter>,
    );

    const nav = screen.getByRole("navigation", {
      name: "Nawigacja aplikacji",
    });

    expect(nav.firstElementChild).toHaveClass("bg-white");
    expect(nav.firstElementChild?.firstElementChild).toHaveClass(
      "bg-white/72",
      "backdrop-blur-xl",
    );
    const socialLink = within(nav).getByRole("link", { name: "Social" });
    expect(socialLink).toHaveClass("text-[#eab308]");
    expect(socialLink).not.toHaveClass("bg-white/15");
  });

  it("uses a dark glass base on casino pages in light mode", () => {
    render(
      <MemoryRouter initialEntries={["/casino/blackjack"]}>
        <AppMobileBottomNav />
      </MemoryRouter>,
    );

    const nav = screen.getByRole("navigation", {
      name: "Nawigacja aplikacji",
    });

    expect(nav.firstElementChild).not.toHaveClass("bg-white", "bg-zinc-950");
    expect(nav.firstElementChild?.firstElementChild).toHaveClass("bg-zinc-950/86");
  });

  it("uses the ruby-black glass base in dark mode across the app", () => {
    useThemeMock.mockReturnValue({ theme: "dark" });

    render(
      <MemoryRouter initialEntries={["/rankings"]}>
        <AppMobileBottomNav />
      </MemoryRouter>,
    );

    const nav = screen.getByRole("navigation", {
      name: "Nawigacja aplikacji",
    });

    expect(nav.firstElementChild).not.toHaveClass("bg-white", "bg-[#16070d]");
    expect(nav.firstElementChild?.firstElementChild).toHaveClass("bg-[#16070d]/90");
  });
});
