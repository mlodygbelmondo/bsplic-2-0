import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { ROULETTE_SPIN_REVEAL_MS } from "@/features/casino/lib/roulette";
import {
  computeRouletteBallRotation,
  computeRouletteBallSettledRotation,
  getRouletteBallPocketAngle,
  ROULETTE_WHEEL_NUMBERS,
} from "@/features/casino/lib/rouletteWheel";

const ROULETTE_WHEEL_IMAGE = "/casino/roulette-wheel-new-3.webp";
const ROULETTE_WHEEL_IMAGE_SIZE = 1138;
const ROULETTE_WHEEL_IMAGE_FILTER =
  "brightness(0.87) contrast(1.11) saturate(0.94) drop-shadow(0 34px 48px rgba(0, 0, 0, 0.88)) drop-shadow(0 0 30px rgba(127, 29, 29, 0.38))";
const ROULETTE_WHEEL_MAX_WIDTH_CLASS =
  "max-w-full sm:max-w-[420px] xl:max-w-[560px]";
const ROULETTE_WHEEL_FRAME_MAX_WIDTH_CLASS = "max-w-[1138px]";

const ROULETTE_BALL_SIZE = "clamp(8px, 2.8%, 16px)";
const ROULETTE_BALL_ANGLE_OFFSET_DEG = -1;
const ROULETTE_BALL_SPINNING_TOP_START = "8%";
const ROULETTE_BALL_SPINNING_TOP_END = "12%";
const ROULETTE_BALL_SETTLED_TOP = "25.3%";
const ROULETTE_BALL_ORBIT_ORIGIN = "50% 50%";
const ROULETTE_BALL_TRANSLATE_X = "-50%";
const ROULETTE_BALL_TRANSLATE_Y = "-50%";
const ROULETTE_BALL_SETTLE_DELAY_MS = 100;
const ROULETTE_BALL_SETTLE_DURATION_MS = 800;
const ROULETTE_BALL_MIN_SPIN_DURATION_MS = 6000;
const ROULETTE_BALL_MAX_SPIN_DURATION_MS = 9000;

interface ActiveBallSpin {
  durationMs: number;
  fromRotation: number;
  phase: "staged" | "spinning" | "settled";
  roundId: string;
  targetAngle: number;
  targetIndex: number;
  targetNumber: number;
  targetRotation: number;
}

interface RouletteWheelProps {
  phase: "waiting" | "spinning" | "settled";
  winningNumber: number | null;
  spinStartedAt: string | null;
  roundId: string | null;
}

export const RouletteWheel = memo(function RouletteWheel({
  phase,
  winningNumber,
  spinStartedAt,
  roundId,
}: RouletteWheelProps) {
  const [activeSpin, setActiveSpin] = useState<ActiveBallSpin | null>(null);
  const ballRotationRef = useRef(0);
  const triggeredRoundRef = useRef<string | null>(null);
  const cleanupRef = useRef<{
    settleTimer: number | null;
    rafIds: number[];
  }>({ rafIds: [], settleTimer: null });

  const targetIndex = useMemo(() => {
    if (winningNumber == null) return 0;
    const idx = ROULETTE_WHEEL_NUMBERS.indexOf(winningNumber);
    return idx >= 0 ? idx : 0;
  }, [winningNumber]);

  useEffect(() => {
    const clearPendingAnimationWork = () => {
      cleanupRef.current.rafIds.forEach((rafId) => {
        window.cancelAnimationFrame(rafId);
      });
      cleanupRef.current.rafIds = [];

      if (cleanupRef.current.settleTimer !== null) {
        window.clearTimeout(cleanupRef.current.settleTimer);
        cleanupRef.current.settleTimer = null;
      }
    };

    if (phase === "waiting") {
      triggeredRoundRef.current = null;
      return;
    }

    if (
      phase === "spinning" &&
      winningNumber != null &&
      roundId &&
      triggeredRoundRef.current !== roundId
    ) {
      triggeredRoundRef.current = roundId;

      const remainingMs = spinStartedAt
        ? Math.max(
            0,
            new Date(spinStartedAt).getTime() +
              ROULETTE_SPIN_REVEAL_MS -
              Date.now(),
          )
        : ROULETTE_SPIN_REVEAL_MS;

      clearPendingAnimationWork();

      const fromRotation = ballRotationRef.current;
      const targetRotation = computeRouletteBallRotation(
        ballRotationRef.current,
        targetIndex,
      );

      const durationMs = Math.max(
        0,
        Math.min(ROULETTE_BALL_MAX_SPIN_DURATION_MS, remainingMs),
      );
      const targetAngle = getRouletteBallPocketAngle(targetIndex);
      const targetNumber = winningNumber;

      setActiveSpin({
        durationMs,
        fromRotation,
        phase: "staged",
        roundId,
        targetAngle,
        targetIndex,
        targetNumber,
        targetRotation,
      });

      const firstRaf = window.requestAnimationFrame(() => {
        const secondRaf = window.requestAnimationFrame(() => {
          ballRotationRef.current = targetRotation;
          setActiveSpin((current) =>
            current?.roundId === roundId
              ? { ...current, phase: "spinning" }
              : current,
          );
        });

        cleanupRef.current.rafIds = cleanupRef.current.rafIds.filter(
          (rafId) => rafId !== firstRaf,
        );
        cleanupRef.current.rafIds.push(secondRaf);
      });

      cleanupRef.current.rafIds.push(firstRaf);

      cleanupRef.current.settleTimer = window.setTimeout(() => {
        setActiveSpin((current) => {
          if (current?.roundId !== roundId) return current;
          const settledRotation = computeRouletteBallSettledRotation(
            current.targetRotation,
            current.targetIndex,
          );
          ballRotationRef.current = settledRotation;
          return {
            ...current,
            phase: "settled",
            targetRotation: settledRotation,
          };
        });
        cleanupRef.current.settleTimer = null;
      }, durationMs + ROULETTE_BALL_SETTLE_DELAY_MS);

      return undefined;
    }

    if (phase === "settled" && winningNumber != null) {
      setActiveSpin((current) => {
        const targetAngle = getRouletteBallPocketAngle(targetIndex);
        if (!current) {
          const settledRotation = computeRouletteBallSettledRotation(
            ballRotationRef.current,
            targetIndex,
          );
          ballRotationRef.current = settledRotation;
          return {
            durationMs: 0,
            fromRotation: settledRotation,
            phase: "settled",
            roundId: roundId ?? `settled-${winningNumber}`,
            targetAngle,
            targetIndex,
            targetNumber: winningNumber,
            targetRotation: settledRotation,
          };
        }

        if (current.targetNumber !== winningNumber) return current;
        if (current.phase === "staged" || current.phase === "spinning") {
          return current;
        }

        const settledRotation = computeRouletteBallSettledRotation(
          current.targetRotation,
          targetIndex,
        );
        ballRotationRef.current = settledRotation;
        return {
          ...current,
          phase: "settled",
          targetRotation: settledRotation,
        };
      });
    }
  }, [phase, winningNumber, spinStartedAt, roundId, targetIndex]);

  useEffect(() => {
    const cleanup = cleanupRef.current;

    return () => {
      cleanup.rafIds.forEach((rafId) => {
        window.cancelAnimationFrame(rafId);
      });
      if (cleanup.settleTimer !== null) {
        window.clearTimeout(cleanup.settleTimer);
      }
    };
  }, []);

  const ballOrbitTransition =
    activeSpin?.phase === "spinning"
      ? `transform ${activeSpin.durationMs / 1000}s cubic-bezier(0.2, 0.8, 0.25, 1)`
      : "none";
  const ballRotation =
    activeSpin?.phase === "staged"
      ? activeSpin.fromRotation
      : (activeSpin?.targetRotation ?? 0);
  const adjustedBallRotation = ballRotation + ROULETTE_BALL_ANGLE_OFFSET_DEG;
  const isSpinning = activeSpin?.phase === "spinning";
  const ballTop =
    activeSpin?.phase === "staged"
      ? ROULETTE_BALL_SPINNING_TOP_START
      : activeSpin?.phase === "spinning"
        ? ROULETTE_BALL_SPINNING_TOP_END
        : ROULETTE_BALL_SETTLED_TOP;
  const ballTransition =
    activeSpin?.phase === "spinning"
      ? `top ${activeSpin.durationMs / 1000}s cubic-bezier(0.2, 0.8, 0.25, 1), opacity 0.5s ease-out, transform 0.5s ease-out`
      : activeSpin?.phase === "settled"
        ? `top ${ROULETTE_BALL_SETTLE_DURATION_MS / 1000}s cubic-bezier(0.18, 0.72, 0.2, 1), opacity 0.5s ease-out, transform 0.5s ease-out`
        : "none";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.1, type: "spring", stiffness: 100 }}
      className={cn("relative mx-auto w-full", ROULETTE_WHEEL_MAX_WIDTH_CLASS)}
    >
      {/* Ambient glow */}
      <div
        className={cn(
          "absolute inset-0 scale-90 rounded-full blur-3xl transition-colors duration-700",
          isSpinning ? "bg-red-950/60" : "bg-red-950/25",
        )}
      />

      <div
        data-testid="roulette-wheel-frame"
        className={cn(
          "relative mx-auto aspect-square w-full",
          ROULETTE_WHEEL_FRAME_MAX_WIDTH_CLASS,
        )}
      >
        <div
          aria-hidden="true"
          className="absolute inset-[7%] rounded-full bg-black/70 blur-3xl"
        />

        <img
          src={ROULETTE_WHEEL_IMAGE}
          alt="Koło ruletki"
          width={ROULETTE_WHEEL_IMAGE_SIZE}
          height={ROULETTE_WHEEL_IMAGE_SIZE}
          draggable={false}
          className="relative z-10 block h-full w-full select-none object-contain opacity-95"
          style={{ filter: ROULETTE_WHEEL_IMAGE_FILTER }}
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 rounded-full bg-[radial-gradient(circle_at_50%_48%,transparent_42%,rgba(8,3,3,0.34)_68%,rgba(0,0,0,0.74)_100%)] mix-blend-multiply"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-[8%] z-10 rounded-full shadow-[inset_0_0_60px_rgba(0,0,0,0.58),0_0_68px_rgba(127,29,29,0.28)]"
        />

        {activeSpin && (
          <div
            aria-hidden="true"
            data-testid="roulette-ball-orbit"
            data-animation-state={activeSpin.phase}
            data-target-angle={activeSpin.targetAngle.toFixed(3)}
            data-target-index={activeSpin.targetIndex}
            data-target-number={activeSpin.targetNumber}
            className="pointer-events-none absolute inset-0 z-20 transform-gpu"
            style={{
              transform: `rotate(${adjustedBallRotation}deg)`,
              transformOrigin: ROULETTE_BALL_ORBIT_ORIGIN,
              transition: ballOrbitTransition,
            }}
          >
            <div
              data-testid="roulette-ball"
              className="absolute left-1/2 rounded-full border border-white/90 bg-[radial-gradient(circle_at_35%_30%,#ffffff_0%,#fff7d6_30%,#d8b46a_58%,#7b4a18_100%)] shadow-[0_0_12px_rgba(255,246,198,0.85),0_5px_12px_rgba(0,0,0,0.55)]"
              style={
                {
                  "--roulette-ball-size": ROULETTE_BALL_SIZE,
                  height: "var(--roulette-ball-size)",
                  top: ballTop,
                  transform: `translate3d(${ROULETTE_BALL_TRANSLATE_X}, ${ROULETTE_BALL_TRANSLATE_Y}, 0)`,
                  transition: ballTransition,
                  width: "var(--roulette-ball-size)",
                } as CSSProperties & { "--roulette-ball-size": string }
              }
            />
          </div>
        )}
      </div>
    </motion.div>
  );
});
