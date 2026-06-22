import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BetList } from "./BetList";

const useBetsMock = vi.fn(
  (_selectedCategory: string | null, _sort: string) => ({
    loading: false,
    liveBets: [],
    sortedBets: [],
  }),
);

vi.mock("@/features/home/hooks/useBets", () => ({
  useBets: (selectedCategory: string | null, sort: string) =>
    useBetsMock(selectedCategory, sort),
}));

describe("BetList tabs", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useBetsMock.mockClear();
  });

  it("defaults to newest and supports ending-soon sort tab", () => {
    render(
      <BetList selectedCategory={null} categories={[]} categoryMap={{}} />,
    );

    const tabButtons = screen.getAllByRole("button", {
      name: /Najnowsze|Popularne|Kończące się/i,
    });

    // Sort options render both in the desktop tab row and in the mobile
    // dropdown, so labels appear more than once.
    const labels = new Set(tabButtons.map((button) => button.textContent));
    expect(labels).toEqual(new Set(["Najnowsze", "Popularne", "Kończące się"]));

    expect(useBetsMock).toHaveBeenCalledWith(null, "newest");

    fireEvent.click(screen.getAllByRole("button", { name: "Popularne" })[0]);
    expect(useBetsMock).toHaveBeenLastCalledWith(null, "popular");

    fireEvent.click(screen.getAllByRole("button", { name: "Kończące się" })[0]);
    expect(useBetsMock).toHaveBeenLastCalledWith(null, "ending_soon");
  });

  it("keeps the propose bet action off the mobile home toolbar", () => {
    render(
      <BetList
        selectedCategory={null}
        categories={[]}
        categoryMap={{}}
        onProposeClick={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /zaproponuj zakład/i }),
    ).toHaveClass("hidden", "lg:inline-flex");
  });

  it("renders an optional top banner before the bet cards", () => {
    render(
      <BetList
        selectedCategory={null}
        categories={[]}
        categoryMap={{}}
        topBanner={<div data-testid="home-top-banner">Jackpot</div>}
      />,
    );

    expect(screen.getByTestId("home-top-banner")).toHaveTextContent("Jackpot");
  });

  it("animates the mobile filter toolbar with explicit transform states instead of disappearing", () => {
    render(
      <BetList selectedCategory={null} categories={[]} categoryMap={{}} />,
    );

    const mobileToolbar = screen.getByTestId("bet-list-mobile-toolbar");
    expect(mobileToolbar).toHaveClass("translate-y-0", "opacity-100");

    const scrollContainer = screen.getByTestId("bet-list-scroll-container");
    Object.defineProperties(scrollContainer, {
      scrollTop: { configurable: true, value: 90 },
      scrollHeight: { configurable: true, value: 1800 },
      clientHeight: { configurable: true, value: 700 },
    });

    fireEvent.scroll(scrollContainer);

    expect(mobileToolbar).toHaveClass(
      "-translate-y-full",
      "opacity-100",
      "pointer-events-none",
    );
    expect(mobileToolbar).not.toHaveClass(
      "grid-rows-[0fr]",
    );
  });

  it("uses taller one-line mobile filter buttons and dropdown options", async () => {
    render(
      <BetList
        selectedCategory={null}
        categories={[
          {
            id: "sport",
            name: "Sport",
            emoji: "⚽",
            color: "#16a34a",
            sort_order: 1,
            created_at: "2026-06-22T00:00:00.000Z",
          },
        ]}
        categoryMap={{}}
        onSelectCategory={vi.fn()}
      />,
    );

    const mobileToolbar = screen.getByTestId("bet-list-mobile-toolbar");
    const sortTrigger = within(mobileToolbar).getByRole("button", {
      expanded: false,
      name: "Najnowsze",
    });
    const categoryTrigger = within(mobileToolbar).getByRole("button", {
      expanded: false,
      name: /Wszystkie/,
    });

    expect(sortTrigger).toHaveClass("h-11", "text-sm");
    expect(categoryTrigger).toHaveClass("h-11", "text-sm");

    fireEvent.click(sortTrigger);

    const popularOption = within(mobileToolbar).getByRole("button", {
      name: "Popularne",
    });
    const activeOnlyOption = within(mobileToolbar).getByRole("button", {
      name: "Aktywne",
    });

    await waitFor(() => {
      expect(popularOption).toHaveClass("h-11", "text-sm");
      expect(activeOnlyOption).toHaveClass("h-11", "text-sm");
    });
  });

  it("prevents crowded mobile category options from shrinking inside the scroll panel", async () => {
    const categories = Array.from({ length: 14 }, (_, index) => ({
      id: `category-${index}`,
      name: `Kategoria ${index + 1}`,
      emoji: "⚽",
      color: "#16a34a",
      sort_order: index,
      created_at: "2026-06-22T00:00:00.000Z",
    }));

    render(
      <BetList
        selectedCategory={null}
        categories={categories}
        categoryMap={{}}
        onSelectCategory={vi.fn()}
      />,
    );

    const mobileToolbar = screen.getByTestId("bet-list-mobile-toolbar");
    const categoryTrigger = within(mobileToolbar).getByRole("button", {
      expanded: false,
      name: /Wszystkie/,
    });

    fireEvent.click(categoryTrigger);

    const firstCategoryOption = within(mobileToolbar)
      .getAllByRole("button")
      .find((button) => button.textContent?.trim() === "⚽ Kategoria 1");

    await waitFor(() => {
      expect(firstCategoryOption).toBeDefined();
      expect(firstCategoryOption).toHaveClass("h-11", "shrink-0");
    });
  });

  it("keeps visible mobile filter controls tappable when a dropdown is open", async () => {
    render(
      <BetList selectedCategory={null} categories={[]} categoryMap={{}} />,
    );

    const mobileToolbar = screen.getByTestId("bet-list-mobile-toolbar");

    fireEvent.click(
      within(mobileToolbar).getByRole("button", {
        expanded: false,
        name: "Najnowsze",
      }),
    );

    await waitFor(() => {
      expect(mobileToolbar).toHaveClass("z-50");
      expect(mobileToolbar).toHaveClass("translate-y-0");
      expect(mobileToolbar).not.toHaveClass("will-change-transform");
      expect(mobileToolbar).not.toHaveClass("pointer-events-none");
    });
  });

  it("closes mobile dropdowns from outside taps without a click-capturing backdrop", async () => {
    render(
      <BetList
        selectedCategory={null}
        categories={[
          {
            id: "sport",
            name: "Sport",
            emoji: "⚽",
            color: "#16a34a",
            sort_order: 1,
            created_at: "2026-06-22T00:00:00.000Z",
          },
        ]}
        categoryMap={{}}
        onSelectCategory={vi.fn()}
      />,
    );

    const mobileToolbar = screen.getByTestId("bet-list-mobile-toolbar");
    const sortTrigger = within(mobileToolbar).getByRole("button", {
      expanded: false,
      name: "Najnowsze",
    });

    fireEvent.click(sortTrigger);

    await waitFor(() => {
      expect(sortTrigger).toHaveAttribute("aria-expanded", "true");
    });
    expect(document.querySelector(".fixed.inset-0")).toBeNull();

    fireEvent.pointerDown(document.body);

    await waitFor(() => {
      expect(sortTrigger).toHaveAttribute("aria-expanded", "false");
    });

    const categoryTrigger = within(mobileToolbar).getByRole("button", {
      expanded: false,
      name: /Wszystkie/,
    });

    fireEvent.click(categoryTrigger);

    await waitFor(() => {
      expect(categoryTrigger).toHaveAttribute("aria-expanded", "true");
    });

    fireEvent.pointerDown(document.body);

    await waitFor(() => {
      expect(categoryTrigger).toHaveAttribute("aria-expanded", "false");
    });
  });

  it("hides the desktop action toolbar with transform on downward scroll", () => {
    render(
      <BetList
        selectedCategory={null}
        categories={[]}
        categoryMap={{}}
        onProposeClick={vi.fn()}
      />,
    );

    const scrollContainer = screen.getByTestId("bet-list-scroll-container");
    Object.defineProperties(scrollContainer, {
      scrollTop: { configurable: true, value: 90 },
      scrollHeight: { configurable: true, value: 1800 },
      clientHeight: { configurable: true, value: 700 },
    });

    fireEvent.scroll(scrollContainer);

    expect(screen.getByTestId("bet-list-desktop-toolbar")).toHaveClass(
      "-translate-y-full",
      "opacity-0",
    );
  });
});
