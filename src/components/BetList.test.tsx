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
    useBetsMock.mockReset();
    useBetsMock.mockReturnValue({
      loading: false,
      liveBets: [],
      sortedBets: [],
    });
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

  it("changes the sort from the bottom sheet, remembers it and closes the sheet", async () => {
    render(
      <BetList selectedCategory={null} categories={[]} categoryMap={{}} />,
    );

    const trigger = screen.getByTestId("bet-list-sort-trigger");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(trigger);
    const sheet = screen.getByRole("dialog", { name: "Sortowanie" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(
      within(sheet).getByRole("radio", { name: /Najnowsze/ }),
    ).toHaveAttribute("aria-checked", "true");

    fireEvent.click(within(sheet).getByRole("radio", { name: /Popularne/ }));

    expect(useBetsMock).toHaveBeenLastCalledWith(null, "popular", true);
    expect(window.localStorage.getItem("bsplic.home.sort")).toBe("popular");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveTextContent("Popularne");
  });

  it("closes the sort sheet with Escape", async () => {
    render(
      <BetList selectedCategory={null} categories={[]} categoryMap={{}} />,
    );

    fireEvent.click(screen.getByTestId("bet-list-sort-trigger"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(useBetsMock).toHaveBeenLastCalledWith(null, "newest", true);
  });

  it("keeps the filters and the previous bets on screen while the next category loads", () => {
    const { rerender } = render(
      <BetList
        selectedCategory={null}
        onSelectCategory={vi.fn()}
        categories={HIERARCHY}
        categoryMap={HIERARCHY_MAP}
      />,
    );
    const toolbar = screen.getByTestId("bet-list-mobile-toolbar");

    useBetsMock.mockReturnValue({
      loading: true,
      liveBets: [],
      sortedBets: [],
    });
    rerender(
      <BetList
        selectedCategory="ufc"
        onSelectCategory={vi.fn()}
        categories={HIERARCHY}
        categoryMap={HIERARCHY_MAP}
      />,
    );

    expect(screen.getByTestId("bet-list-mobile-toolbar")).toBe(toolbar);
    expect(screen.queryByText("Wczytywanie zakładów...")).not.toBeInTheDocument();
    expect(screen.getByTestId("bet-list-results")).toHaveAttribute(
      "aria-busy",
      "true",
    );
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
    useBetsMock.mockReset();
    useBetsMock.mockReturnValue({
      loading: false,
      liveBets: [],
      sortedBets: [],
    });
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

  it("picks sports from the rail and leagues from the tabs under the selected sport", () => {
    const onSelectCategory = vi.fn();
    const renderList = (selectedCategory: string | null) => (
      <BetList
        selectedCategory={selectedCategory}
        onSelectCategory={onSelectCategory}
        categories={HIERARCHY}
        categoryMap={HIERARCHY_MAP}
      />
    );
    const { rerender } = render(renderList(null));
    const rail = () => screen.getByTestId("category-rail");

    expect(
      within(rail()).getByRole("button", { name: "Wszystko" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByTestId("league-tabs")).not.toBeInTheDocument();

    fireEvent.click(within(rail()).getByRole("button", { name: "Piłka nożna" }));
    expect(onSelectCategory).toHaveBeenLastCalledWith("football");

    rerender(renderList("football"));
    const tabs = screen.getByTestId("league-tabs");
    expect(
      within(tabs).getAllByRole("button").map((tab) => tab.textContent),
    ).toEqual(["Wszystkie", "Premier League", "Ekstraklasa"]);
    expect(within(tabs).getByRole("button", { name: "Wszystkie" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.click(within(tabs).getByRole("button", { name: "Ekstraklasa" }));
    expect(onSelectCategory).toHaveBeenLastCalledWith("ekstraklasa");

    rerender(renderList("ekstraklasa"));
    expect(
      within(rail()).getByRole("button", { name: "Piłka nożna" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(screen.getByTestId("league-tabs")).getByRole("button", {
        name: "Ekstraklasa",
      }),
    ).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(
      within(screen.getByTestId("league-tabs")).getByRole("button", {
        name: "Wszystkie",
      }),
    );
    expect(onSelectCategory).toHaveBeenLastCalledWith("football");

    fireEvent.click(within(rail()).getByRole("button", { name: "Wszystko" }));
    expect(onSelectCategory).toHaveBeenLastCalledWith(null);
  });

  it("shows no league tabs under a sport without leagues", () => {
    render(
      <BetList
        selectedCategory="ufc"
        onSelectCategory={vi.fn()}
        categories={HIERARCHY}
        categoryMap={HIERARCHY_MAP}
      />,
    );

    expect(
      within(screen.getByTestId("category-rail")).getByRole("button", {
        name: "UFC",
      }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByTestId("league-tabs")).not.toBeInTheDocument();
  });
});
