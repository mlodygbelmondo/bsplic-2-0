import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import CasinoRouletteDevPage from "./CasinoRouletteDevPage";

const rouletteWheelMock = vi.fn();

vi.mock("@/features/casino/components/RouletteWheel", () => ({
  RouletteWheel: (props: {
    angleOffsetsDeg?: Record<number, number>;
    animationTiming?: {
      settleDelayMs?: number;
      settleDurationMs?: number;
      spinDurationMs?: number;
    };
    phase: "waiting" | "spinning" | "settled";
    winningNumber: number | null;
  }) => {
    rouletteWheelMock(props);

    return (
      <div
        data-testid="roulette-wheel-stub"
        data-phase={props.phase}
        data-winning-number={props.winningNumber}
        data-offset={props.angleOffsetsDeg?.[props.winningNumber ?? -1]}
        data-spin-duration={props.animationTiming?.spinDurationMs ?? "instant"}
      />
    );
  },
}));

describe("CasinoRouletteDevPage", () => {
  it("renders the roulette dev shell and number controls", () => {
    render(<CasinoRouletteDevPage />);

    expect(screen.getByTestId("casino-roulette-dev-shell")).toHaveStyle({
      "--casino-bg-desktop": "url('/casino/roulette-background.webp')",
      "--casino-bg-mobile": "url('/casino/roulette-mobile-background.webp')",
    });
    expect(
      screen.getByTestId("roulette-dev-selected-number"),
    ).toHaveTextContent("0");
    expect(screen.getByRole("button", { name: "36" })).toBeInTheDocument();
    expect(screen.getByTestId("roulette-wheel-stub")).toHaveAttribute(
      "data-spin-duration",
      "300",
    );
  });

  it("updates the preview number when a number button is clicked", () => {
    render(<CasinoRouletteDevPage />);

    fireEvent.click(screen.getByRole("button", { name: "10" }));

    expect(
      screen.getByTestId("roulette-dev-selected-number"),
    ).toHaveTextContent("10");
    expect(screen.getByTestId("roulette-wheel-stub")).toHaveAttribute(
      "data-winning-number",
      "10",
    );
  });

  it("passes live offset overrides to the wheel preview", () => {
    render(<CasinoRouletteDevPage />);

    fireEvent.click(screen.getByRole("button", { name: "10" }));
    fireEvent.change(screen.getByTestId("roulette-dev-offset-input"), {
      target: { value: "-2" },
    });

    expect(screen.getByTestId("roulette-wheel-stub")).toHaveAttribute(
      "data-offset",
      "-2",
    );
  });

  it("switches instant mode to a settled direct preview", () => {
    render(<CasinoRouletteDevPage />);

    fireEvent.click(screen.getByRole("button", { name: "Instant" }));

    expect(screen.getByTestId("roulette-wheel-stub")).toHaveAttribute(
      "data-phase",
      "settled",
    );
    expect(screen.getByTestId("roulette-wheel-stub")).toHaveAttribute(
      "data-spin-duration",
      "instant",
    );
  });
});
