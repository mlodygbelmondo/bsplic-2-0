import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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

  it("hides the mobile filter toolbar with transform instead of collapsing layout height", () => {
    render(
      <BetList selectedCategory={null} categories={[]} categoryMap={{}} />,
    );

    const scrollContainer = screen.getByTestId("bet-list-scroll-container");
    Object.defineProperties(scrollContainer, {
      scrollTop: { configurable: true, value: 90 },
      scrollHeight: { configurable: true, value: 1800 },
      clientHeight: { configurable: true, value: 700 },
    });

    fireEvent.scroll(scrollContainer);

    expect(screen.getByTestId("bet-list-mobile-toolbar")).toHaveClass(
      "-translate-y-full",
      "opacity-0",
    );
    expect(screen.getByTestId("bet-list-mobile-toolbar")).not.toHaveClass(
      "grid-rows-[0fr]",
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
