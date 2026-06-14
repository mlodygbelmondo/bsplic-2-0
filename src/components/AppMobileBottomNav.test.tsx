import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { AppMobileBottomNav } from "./AppMobileBottomNav";

describe("AppMobileBottomNav", () => {
  it("renders five regular mobile destinations without a center plus action", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppMobileBottomNav />
      </MemoryRouter>,
    );

    const nav = screen.getByRole("navigation", {
      name: "Nawigacja aplikacji",
    });

    expect(within(nav).getByRole("link", { name: "Zakłady" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(within(nav).getByRole("link", { name: "Poker" })).toHaveAttribute(
      "href",
      "/casino",
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

    expect(nav.firstElementChild).toHaveClass("rounded-t-lg");
  });
});
