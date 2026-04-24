import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';

import { cn } from '@/lib/utils';
import {
  getRouletteColor,
  ROULETTE_SPIN_REVEAL_MS,
} from '@/features/casino/lib/roulette';
import {
  computeRouletteTargetRotation,
  getRouletteWheelSegmentAngle,
  ROULETTE_WHEEL_NUMBERS,
} from '@/features/casino/lib/rouletteWheel';

const CX = 160;
const CY = 160;
const R = 150;
const SEGMENT_ANGLE = getRouletteWheelSegmentAngle();

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function segmentPath(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
) {
  const start = polar(cx, cy, r, startAngle);
  const end = polar(cx, cy, r, endAngle);
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${end.x} ${end.y} Z`;
}

interface RouletteWheelProps {
  phase: 'waiting' | 'spinning' | 'settled';
  winningNumber: number | null;
  spinStartedAt: string | null;
  roundId: string | null;
}

export function RouletteWheel({
  phase,
  winningNumber,
  spinStartedAt,
  roundId,
}: RouletteWheelProps) {
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const rotationRef = useRef(0);
  const triggeredRoundRef = useRef<string | null>(null);

  const targetIndex = useMemo(() => {
    if (winningNumber == null) return 0;
    const idx = ROULETTE_WHEEL_NUMBERS.indexOf(winningNumber);
    return idx >= 0 ? idx : 0;
  }, [winningNumber]);

  useEffect(() => {
    if (phase === 'waiting') {
      triggeredRoundRef.current = null;
      setIsSpinning(false);
      return;
    }

    if (
      phase === 'spinning' &&
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

      const nextRotation = computeRouletteTargetRotation(
        rotationRef.current,
        targetIndex,
      );
      rotationRef.current = nextRotation;
      setRotation(nextRotation);

      // If we joined late and spin is almost over, shorten transition
      const duration = Math.max(1.5, remainingMs / 1000);
      setIsSpinning(true);

      // Auto-clear spinning state after transition finishes
      const timer = window.setTimeout(() => {
        setIsSpinning(false);
      }, duration * 1000 + 200);

      return () => {
        window.clearTimeout(timer);
      };
    }

    if (phase === 'settled' && winningNumber != null) {
      const settledRotation = computeRouletteTargetRotation(
        rotationRef.current,
        targetIndex,
      );
      rotationRef.current = settledRotation;
      setRotation(settledRotation);
      setIsSpinning(false);
    }
  }, [phase, winningNumber, spinStartedAt, roundId, targetIndex]);

  const segments = useMemo(() => {
    return ROULETTE_WHEEL_NUMBERS.map((num, i) => {
      const startAngle = i * SEGMENT_ANGLE;
      const endAngle = (i + 1) * SEGMENT_ANGLE;
      const d = segmentPath(CX, CY, R, startAngle, endAngle);
      const color = getRouletteColor(num);
      const fill =
        color === 'red'
          ? '#991b1b'
          : color === 'green'
            ? '#047857'
            : '#262626';
      const midAngle = startAngle + SEGMENT_ANGLE / 2;
      const textPos = polar(CX, CY, R * 0.72, midAngle);
      return { num, d, fill, textPos, midAngle };
    });
  }, []);

  const transitionStyle = isSpinning
    ? `transform ${Math.max(2, Math.min(6, (spinStartedAt
        ? Math.max(0, new Date(spinStartedAt).getTime() + ROULETTE_SPIN_REVEAL_MS - Date.now())
        : ROULETTE_SPIN_REVEAL_MS) / 1000))}s cubic-bezier(0.2, 0.8, 0.25, 1)`
    : 'none';

  const isRevealed = !isSpinning && (phase === 'settled' || (phase === 'spinning' && winningNumber != null && !isSpinning));

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.1, type: 'spring', stiffness: 100 }}
      className="relative mx-auto w-full max-w-full sm:max-w-[300px] lg:max-w-[380px]"
    >
      {/* Ambient glow */}
      <div
        className={cn(
          'absolute inset-0 scale-90 rounded-full blur-3xl transition-colors duration-700',
          isSpinning ? 'bg-amber-500/30' : 'bg-amber-500/10',
        )}
      />

      <div className="relative">
        <svg
          viewBox="0 0 320 320"
          className="w-full"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: transitionStyle,
          }}
        >
          {/* Outer decorative rings */}
          <circle
            cx={CX}
            cy={CY}
            r={R + 2}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="3"
          />
          <circle
            cx={CX}
            cy={CY}
            r={R - 1}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1"
          />

          {segments.map((seg, i) => (
            <g key={i}>
              <path
                d={seg.d}
                fill={seg.fill}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="1"
              />
              <g
                transform={`rotate(${seg.midAngle}, ${seg.textPos.x}, ${seg.textPos.y})`}
              >
                <text
                  x={seg.textPos.x}
                  y={seg.textPos.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="white"
                  fontSize="11"
                  fontWeight="700"
                  transform={`rotate(90, ${seg.textPos.x}, ${seg.textPos.y})`}
                >
                  {seg.num}
                </text>
              </g>
            </g>
          ))}

          {/* Inner hub ring */}
          <circle
            cx={CX}
            cy={CY}
            r={50}
            fill="#09090b"
            stroke="#fbbf24"
            strokeWidth="2"
          />
          <circle
            cx={CX}
            cy={CY}
            r={42}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="1"
          />
        </svg>

        {/* Pointer */}
        <div className="absolute -top-1.5 left-1/2 z-10 -translate-x-1/2">
          <div className="h-0 w-0 border-l-[10px] border-r-[10px] border-t-[20px] border-l-transparent border-r-transparent border-t-amber-400 drop-shadow-[0_4px_8px_rgba(245,158,11,0.5)]" />
        </div>

        {/* Center number overlay */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className={cn(
              'flex items-center justify-center rounded-full border-2 bg-black/80 backdrop-blur-sm transition-all duration-500',
              isRevealed && winningNumber != null
                ? 'h-[72px] w-[72px] border-amber-500/40 shadow-[0_0_30px_rgba(245,158,11,0.2)] sm:h-20 sm:w-20'
                : 'h-[72px] w-[72px] border-white/10',
            )}
          >
            {isRevealed && winningNumber != null ? (
              <motion.span
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={cn(
                  'text-2xl font-black sm:text-3xl',
                  getRouletteColor(winningNumber) === 'red' && 'text-red-400',
                  getRouletteColor(winningNumber) === 'black' &&
                    'text-stone-300',
                  getRouletteColor(winningNumber) === 'green' &&
                    'text-emerald-400',
                )}
              >
                {winningNumber}
              </motion.span>
            ) : (
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                BSPLIC
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
