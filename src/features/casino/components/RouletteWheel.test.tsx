import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getRouletteBallAngleOffset } from "@/features/casino/lib/rouletteWheel";

import { RouletteWheel } from "./RouletteWheel";

const normalizeRotation = (rotation: number) => ((rotation % 360) + 360) % 360;

function getRotation(style: string) {
  const match = style.match(/rotate\(([-\d.]+)deg\)/);
  return match ? Number(match[1]) : null;
}

function mockRequestAnimationFrame() {
  let nextRafId = 1;
  const timeouts = new Map<number, number>();

  const requestAnimationFrameSpy = vi
    .spyOn(window, "requestAnimationFrame")
    .mockImplementation((callback: FrameRequestCallback) => {
      const rafId = nextRafId;
      nextRafId += 1;
      const timeoutId = window.setTimeout(() => {
        timeouts.delete(rafId);
        callback(performance.now());
      }, 16);
      timeouts.set(rafId, timeoutId);
      return rafId;
    });

  const cancelAnimationFrameSpy = vi
    .spyOn(window, "cancelAnimationFrame")
    .mockImplementation((rafId: number) => {
      const timeoutId = timeouts.get(rafId);
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
        timeouts.delete(rafId);
      }
    });

  return () => {
    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();
  };
}

describe("RouletteWheel", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the roulette wheel WebP asset without exceeding its native size", () => {
    render(
      <RouletteWheel
        phase="waiting"
        winningNumber={null}
        spinStartedAt={null}
        roundId="round-1"
      />,
    );

    const wheelImage = screen.getByRole("img", { name: "Koło ruletki" });

    expect(wheelImage.getAttribute("src")).toBe(
      "/casino/roulette-wheel-new-3.webp",
    );
    expect(wheelImage.getAttribute("width")).toBe("1138");
    expect(wheelImage.getAttribute("height")).toBe("1138");
    expect(
      screen
        .getByTestId("roulette-wheel-frame")
        .classList.contains("max-w-[1138px]"),
    ).toBe(true);
    expect(document.querySelector("svg")).toBeNull();
  });

  it("stages a rotating wheel rotor and a responsive ball for the winning pocket", () => {
    render(
      <RouletteWheel
        phase="spinning"
        winningNumber={13}
        spinStartedAt="2026-04-25T12:00:00.000Z"
        roundId="round-2"
      />,
    );

    const wheelRotor = screen.getByTestId("roulette-wheel-rotor");
    const ballOrbit = screen.getByTestId("roulette-ball-orbit");
    const ball = screen.getByTestId("roulette-ball");

    // Staged: the wheel still sits at its previous resting rotation.
    expect(Number(wheelRotor.getAttribute("data-wheel-rotation"))).toBe(0);
    expect(wheelRotor.style.transition).toBe("none");
    expect(ballOrbit.getAttribute("data-target-number")).toBe("13");
    expect(ballOrbit.getAttribute("data-target-index")).toBe("12");
    expect(Number(ballOrbit.getAttribute("data-target-angle"))).toBeCloseTo(
      116.756,
      2,
    );
    expect(ballOrbit.getAttribute("data-animation-state")).toBe("staged");
    expect(ball.style.getPropertyValue("--roulette-ball-size")).toBe(
      "clamp(8px, 2.8%, 16px)",
    );
  });

  it("stages the ball before starting the transform transition", () => {
    vi.useFakeTimers();
    const restoreAnimationFrameMocks = mockRequestAnimationFrame();

    render(
      <RouletteWheel
        phase="spinning"
        winningNumber={13}
        spinStartedAt="2026-04-25T12:00:00.000Z"
        roundId="round-2"
      />,
    );

    let ballOrbit = screen.getByTestId("roulette-ball-orbit");
    expect(ballOrbit.getAttribute("data-animation-state")).toBe("staged");
    expect(ballOrbit.getAttribute("style") ?? "").toContain("transition: none");
    expect(
      normalizeRotation(
        getRotation(ballOrbit.getAttribute("style") ?? "") ?? 0,
      ),
    ).toBe(normalizeRotation(getRouletteBallAngleOffset(13)));

    act(() => {
      vi.advanceTimersByTime(32);
    });

    ballOrbit = screen.getByTestId("roulette-ball-orbit");
    const wheelRotor = screen.getByTestId("roulette-wheel-rotor");
    const wheelRotation = Number(
      wheelRotor.getAttribute("data-wheel-rotation"),
    );
    expect(ballOrbit.getAttribute("data-animation-state")).toBe("spinning");
    expect(ballOrbit.getAttribute("style") ?? "").not.toContain(
      "transition: none",
    );
    expect(wheelRotation).toBeLessThanOrEqual(-720);
    expect(wheelRotor.style.transition).toContain("transform");
    expect(wheelRotor.style.transition).toContain("cubic-bezier");
    expect(
      normalizeRotation(
        getRotation(ballOrbit.getAttribute("style") ?? "") ?? 0,
      ),
    ).toBeCloseTo(
      normalizeRotation(
        Number(ballOrbit.getAttribute("data-target-angle")) +
          wheelRotation +
          getRouletteBallAngleOffset(13),
      ),
      2,
    );

    restoreAnimationFrameMocks();
  });

  it("moves the spinning ball from the configured start top to the configured end top", () => {
    vi.useFakeTimers();
    const restoreAnimationFrameMocks = mockRequestAnimationFrame();

    render(
      <RouletteWheel
        phase="spinning"
        winningNumber={13}
        spinStartedAt={null}
        roundId="round-2"
      />,
    );

    let ball = screen.getByTestId("roulette-ball");
    expect(ball.style.top).toBe("8%");

    act(() => {
      vi.advanceTimersByTime(32);
    });

    ball = screen.getByTestId("roulette-ball");
    expect(ball.style.top).toBe("12%");
    expect(ball.style.transition).toContain("top 6s");

    restoreAnimationFrameMocks();
  });

  it("shortens the ball transition for late-joined spins", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-25T12:00:05.000Z"));
    const restoreAnimationFrameMocks = mockRequestAnimationFrame();

    render(
      <RouletteWheel
        phase="spinning"
        winningNumber={13}
        spinStartedAt="2026-04-25T12:00:00.000Z"
        roundId="round-2"
      />,
    );

    act(() => {
      vi.advanceTimersByTime(32);
    });

    const ball = screen.getByTestId("roulette-ball");
    expect(ball.style.transition).toContain("top 1s");

    restoreAnimationFrameMocks();
  });

  it("uses a dedicated transition duration when the spinning ball settles", () => {
    vi.useFakeTimers();
    const restoreAnimationFrameMocks = mockRequestAnimationFrame();

    render(
      <RouletteWheel
        phase="spinning"
        winningNumber={13}
        spinStartedAt={null}
        roundId="round-2"
      />,
    );

    act(() => {
      vi.advanceTimersByTime(32);
    });

    act(() => {
      vi.advanceTimersByTime(6100);
    });

    const ball = screen.getByTestId("roulette-ball");
    expect(
      screen
        .getByTestId("roulette-ball-orbit")
        .getAttribute("data-animation-state"),
    ).toBe("settled");
    expect(ball.style.top).toBe("25.3%");
    expect(ball.style.transition).toContain("top 0.8s");

    restoreAnimationFrameMocks();
  });

  it("keeps the previous ball settled while waiting for the next spin", () => {
    vi.useFakeTimers();
    const restoreAnimationFrameMocks = mockRequestAnimationFrame();

    const { rerender } = render(
      <RouletteWheel
        phase="spinning"
        winningNumber={13}
        spinStartedAt={null}
        roundId="round-2"
      />,
    );

    act(() => {
      vi.advanceTimersByTime(32);
    });

    rerender(
      <RouletteWheel
        phase="waiting"
        winningNumber={null}
        spinStartedAt={null}
        roundId="round-3"
      />,
    );

    expect(
      screen
        .getByTestId("roulette-ball-orbit")
        .getAttribute("data-target-number"),
    ).toBe("13");

    act(() => {
      vi.advanceTimersByTime(6900);
    });

    const ballOrbit = screen.getByTestId("roulette-ball-orbit");
    expect(ballOrbit.getAttribute("data-animation-state")).toBe("settled");
    expect(ballOrbit.getAttribute("data-target-number")).toBe("13");
    restoreAnimationFrameMocks();
  });

  it("replaces the persistent settled ball when the next spin starts", () => {
    vi.useFakeTimers();
    const restoreAnimationFrameMocks = mockRequestAnimationFrame();

    const { rerender } = render(
      <RouletteWheel
        phase="settled"
        winningNumber={13}
        spinStartedAt={null}
        roundId="round-2"
      />,
    );

    expect(
      screen
        .getByTestId("roulette-ball-orbit")
        .getAttribute("data-target-number"),
    ).toBe("13");

    rerender(
      <RouletteWheel
        phase="spinning"
        winningNumber={26}
        spinStartedAt="2026-04-25T12:00:00.000Z"
        roundId="round-3"
      />,
    );

    const ballOrbit = screen.getByTestId("roulette-ball-orbit");
    expect(ballOrbit.getAttribute("data-animation-state")).toBe("staged");
    expect(ballOrbit.getAttribute("data-target-number")).toBe("26");
    restoreAnimationFrameMocks();
  });

  it("does not let an early settled phase interrupt the local spin animation", () => {
    vi.useFakeTimers();
    const restoreAnimationFrameMocks = mockRequestAnimationFrame();

    const { rerender } = render(
      <RouletteWheel
        phase="spinning"
        winningNumber={13}
        spinStartedAt="2026-04-25T12:00:00.000Z"
        roundId="round-2"
      />,
    );

    act(() => {
      vi.advanceTimersByTime(32);
    });

    rerender(
      <RouletteWheel
        phase="settled"
        winningNumber={13}
        spinStartedAt="2026-04-25T12:00:00.000Z"
        roundId="round-2"
      />,
    );

    expect(
      screen
        .getByTestId("roulette-ball-orbit")
        .getAttribute("data-animation-state"),
    ).toBe("spinning");
    restoreAnimationFrameMocks();
  });

  it("does not let settled before the start frame interrupt a staged spin", () => {
    vi.useFakeTimers();
    const restoreAnimationFrameMocks = mockRequestAnimationFrame();

    const { rerender } = render(
      <RouletteWheel
        phase="spinning"
        winningNumber={13}
        spinStartedAt="2026-04-25T12:00:00.000Z"
        roundId="round-2"
      />,
    );

    rerender(
      <RouletteWheel
        phase="settled"
        winningNumber={13}
        spinStartedAt="2026-04-25T12:00:00.000Z"
        roundId="round-2"
      />,
    );

    expect(
      screen
        .getByTestId("roulette-ball-orbit")
        .getAttribute("data-animation-state"),
    ).toBe("staged");

    act(() => {
      vi.advanceTimersByTime(32);
    });

    expect(
      screen
        .getByTestId("roulette-ball-orbit")
        .getAttribute("data-animation-state"),
    ).toBe("spinning");
    restoreAnimationFrameMocks();
  });

  it("shows a settled ball when the component receives a settled round directly", () => {
    render(
      <RouletteWheel
        phase="settled"
        winningNumber={13}
        spinStartedAt={null}
        roundId="round-2"
      />,
    );

    const ballOrbit = screen.getByTestId("roulette-ball-orbit");
    const ball = screen.getByTestId("roulette-ball");
    const wheelRotation = Number(
      screen
        .getByTestId("roulette-wheel-rotor")
        .getAttribute("data-wheel-rotation"),
    );

    expect(ballOrbit.getAttribute("data-animation-state")).toBe("settled");
    expect(ballOrbit.getAttribute("data-target-number")).toBe("13");
    expect(
      normalizeRotation(
        getRotation(ballOrbit.getAttribute("style") ?? "") ?? 0,
      ),
    ).toBeCloseTo(
      normalizeRotation(
        Number(ballOrbit.getAttribute("data-target-angle")) +
          wheelRotation +
          getRouletteBallAngleOffset(13),
      ),
      2,
    );
    expect(ball.style.top).toBe("25.3%");
  });

  it("applies a per-number angle offset to the final ball rotation", () => {
    render(
      <RouletteWheel
        angleOffsetsDeg={{ 13: -2 }}
        phase="settled"
        winningNumber={13}
        spinStartedAt={null}
        roundId="round-2"
      />,
    );

    const ballOrbit = screen.getByTestId("roulette-ball-orbit");
    const wheelRotation = Number(
      screen
        .getByTestId("roulette-wheel-rotor")
        .getAttribute("data-wheel-rotation"),
    );

    expect(ballOrbit.getAttribute("data-angle-offset")).toBe("-2");
    expect(
      normalizeRotation(
        getRotation(ballOrbit.getAttribute("style") ?? "") ?? 0,
      ),
    ).toBeCloseTo(
      normalizeRotation(
        Number(ballOrbit.getAttribute("data-target-angle")) +
          wheelRotation -
          2,
      ),
      2,
    );
  });

  it("uses custom animation timing for quick preview spins", () => {
    vi.useFakeTimers();
    const restoreAnimationFrameMocks = mockRequestAnimationFrame();

    render(
      <RouletteWheel
        animationTiming={{
          settleDelayMs: 0,
          settleDurationMs: 0,
          spinDurationMs: 300,
        }}
        phase="spinning"
        winningNumber={13}
        spinStartedAt={null}
        roundId="round-2"
      />,
    );

    act(() => {
      vi.advanceTimersByTime(32);
    });

    expect(screen.getByTestId("roulette-ball").style.transition).toContain(
      "top 0.3s",
    );

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(
      screen
        .getByTestId("roulette-ball-orbit")
        .getAttribute("data-animation-state"),
    ).toBe("settled");
    expect(screen.getByTestId("roulette-ball").style.transition).toContain(
      "top 0s",
    );

    restoreAnimationFrameMocks();
  });

  it("updates a direct settled preview when the winning number changes", () => {
    const { rerender } = render(
      <RouletteWheel
        phase="settled"
        winningNumber={13}
        spinStartedAt={null}
        roundId="round-2"
      />,
    );

    rerender(
      <RouletteWheel
        phase="settled"
        winningNumber={26}
        spinStartedAt={null}
        roundId="round-3"
      />,
    );

    const ballOrbit = screen.getByTestId("roulette-ball-orbit");
    expect(ballOrbit.getAttribute("data-target-number")).toBe("26");
    expect(ballOrbit.getAttribute("data-target-index")).toBe("36");
  });

  it("continues a staged spin when the same round timestamp refreshes before the next frame", () => {
    vi.useFakeTimers();
    const restoreAnimationFrameMocks = mockRequestAnimationFrame();

    const { rerender } = render(
      <RouletteWheel
        phase="spinning"
        winningNumber={13}
        spinStartedAt={null}
        roundId="round-2"
      />,
    );

    rerender(
      <RouletteWheel
        phase="spinning"
        winningNumber={13}
        spinStartedAt="2026-04-25T12:00:00.000Z"
        roundId="round-2"
      />,
    );

    act(() => {
      vi.advanceTimersByTime(32);
    });

    expect(
      screen
        .getByTestId("roulette-ball-orbit")
        .getAttribute("data-animation-state"),
    ).toBe("spinning");
    restoreAnimationFrameMocks();
  });

  it("renders the winning number and color in the wheel hub for settled rounds", () => {
    render(
      <RouletteWheel
        phase="settled"
        winningNumber={13}
        spinStartedAt={null}
        roundId="round-2"
      />,
    );

    const hubResult = screen.getByTestId("roulette-hub-result");
    expect(hubResult.textContent).toContain("13");
    expect(hubResult.textContent).toContain("czarne");
  });

  it("shows the betting countdown in the wheel hub while waiting", () => {
    render(
      <RouletteWheel
        phase="waiting"
        winningNumber={null}
        spinStartedAt={null}
        roundId="round-1"
        countdownLabel="00:12"
      />,
    );

    expect(
      screen.getByTestId("roulette-hub-countdown").textContent,
    ).toContain("00:12");
  });

  it("hides the hub countdown when the table is idle", () => {
    render(
      <RouletteWheel
        phase="waiting"
        winningNumber={null}
        spinStartedAt={null}
        roundId={null}
        countdownLabel="00:00"
        isIdle
      />,
    );

    expect(screen.queryByTestId("roulette-hub-countdown")).toBeNull();
  });
});
