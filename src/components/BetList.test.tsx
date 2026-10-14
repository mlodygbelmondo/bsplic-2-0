import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Category } from "@/types/database";

import { BetList } from "./BetList";

const useBetsMock = vi.fn(
  (_categoryIds: readonly string[] | null, _sort: string, _enabled: boolean) => ({
    loading: false,
    liveBets: [],
    sortedBets: [],
  }),
);

vi.mock("@/features/home/hooks/useBets", () => ({
  useBets: (
    categoryIds: readonly string[] | null,
    sort: string,
    _includeInProgress?: boolean,
    enabled = true,
  ) => useBetsMock(categoryIds, sort, enabled),
}));

function category(
  id: string,
  name: string,
  sortOrder: number,
  parentId: string | null = null,
): Category {
  return {
    id,
    name,
    emoji: "🏷️",
    color: "#000000",
    sort_order: sortOrder,
    created_at: "2026-10-01T00:00:00.000Z",
    parent_id: parentId,
    slug: null,
  };
}

const HIERARCHY: Category[] = [
  category("football", "Piłka nożna", 1),
  category("ekstraklasa", "Ekstraklasa", 2, "football"),
  category("premier", "Premier League", 1, "football"),
  category("ufc", "UFC", 2),
];

const HIERARCHY_MAP = Object.fromEntries(
  HIERARCHY.map((entry) => [entry.id, entry]),
) as Record<string, Category>;

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

    expect(useBetsMock).toHaveBeenCalledWith(null, "newest", true);

    fireEvent.click(screen.getAllByRole("button", { name: "Popularne" })[0]);
    expect(useBetsMock).toHaveBeenLastCalledWith(null, "popular", true);

    fireEvent.click(screen.getAllByRole("button", { name: "Kończące się" })[0]);
    expect(useBetsMock).toHaveBeenLastCalledWith(null, "ending_soon", true);
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
            parent_id: null,
            slug: null,
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

describe("BetList category hierarchy", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useBetsMock.mockClear();
  });

  it("loads bets of the sport and all its leagues when a sport is selected", () => {
    render(
      <BetList
        selectedCategory="football"
        categories={HIERARCHY}
        categoryMap={HIERARCHY_MAP}
      />,
    );

    const [ids, , enabled] = useBetsMock.mock.lastCall ?? [];
    expect([...(ids ?? [])].sort()).toEqual([
      "ekstraklasa",
      "football",
      "premier",
    ]);
    expect(enabled).toBe(true);
  });

  it("loads only the league when a league is selected", () => {
    render(
      <BetList
        selectedCategory="premier"
        categories={HIERARCHY}
        categoryMap={HIERARCHY_MAP}
      />,
    );

    expect(useBetsMock).toHaveBeenLastCalledWith(["premier"], "newest", true);
  });

  it("holds off loading a remembered category until categories are known", () => {
    const { rerender } = render(
      <BetList selectedCategory="football" categories={[]} categoryMap={{}} />,
    );

    expect(useBetsMock.mock.lastCall?.[2]).toBe(false);

    rerender(
      <BetList
        selectedCategory="football"
        categories={HIERARCHY}
        categoryMap={HIERARCHY_MAP}
      />,
    );

    expect(useBetsMock.mock.lastCall?.[2]).toBe(true);
  });

  it("keeps the mobile panel open after picking a sport so a league can be picked next", () => {
    const onSelectCategory = vi.fn();
    const { rerender } = render(
      <BetList
        selectedCategory={null}
        onSelectCategory={onSelectCategory}
        categories={HIERARCHY}
        categoryMap={HIERARCHY_MAP}
      />,
    );

    // Selecting a category remounts the list, so look elements up again.
    const getToolbar = () => screen.getByTestId("bet-list-mobile-toolbar");
    const getCategoryTrigger = () =>
      screen.getByTestId("bet-list-category-trigger");

    fireEvent.click(getCategoryTrigger());
    expect(getCategoryTrigger()).toHaveAttribute("aria-expanded", "true");
    expect(
      within(getToolbar()).queryByRole("button", { name: /Ekstraklasa/ }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(getToolbar()).getByRole("button", {
        name: /Piłka nożna/,
        expanded: false,
      }),
    );
    expect(onSelectCategory).toHaveBeenLastCalledWith("football");

    rerender(
      <BetList
        selectedCategory="football"
        onSelectCategory={onSelectCategory}
        categories={HIERARCHY}
        categoryMap={HIERARCHY_MAP}
      />,
    );

    expect(getCategoryTrigger()).toHaveTextContent("Piłka nożna");
    expect(getCategoryTrigger()).toHaveAttribute("aria-expanded", "true");
    const leagueNames = within(getToolbar())
      .getAllByRole("button", { name: /Premier League|Ekstraklasa/ })
      .map((button) => button.textContent?.trim());
    expect(leagueNames).toEqual(["🏷️ Premier League", "🏷️ Ekstraklasa"]);

    fireEvent.click(
      within(getToolbar()).getByRole("button", { name: /Ekstraklasa/ }),
    );
    expect(onSelectCategory).toHaveBeenLastCalledWith("ekstraklasa");
    expect(getCategoryTrigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("closes the mobile panel after picking a sport without leagues", () => {
    const onSelectCategory = vi.fn();
    render(
      <BetList
        selectedCategory={null}
        onSelectCategory={onSelectCategory}
        categories={HIERARCHY}
        categoryMap={HIERARCHY_MAP}
      />,
    );

    const toolbar = screen.getByTestId("bet-list-mobile-toolbar");
    const trigger = screen.getByTestId("bet-list-category-trigger");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(within(toolbar).getByRole("button", { name: /UFC/ }));

    expect(onSelectCategory).toHaveBeenLastCalledWith("ufc");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});
