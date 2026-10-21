import type { RouletteRoundPhase } from '@/types/database';

import { ROULETTE_SPIN_REVEAL_MS } from './roulette';
import {
  computeRouletteBallRotation,
  computeRouletteBallSettledRotation,
  ROULETTE_WHEEL_NUMBERS,
} from './rouletteWheel';

/**
 * The ball's spin state machine from the web `RouletteWheel` effect, kept
 * pure so the screen only turns its commands into UI-thread animations.
 */

export const ROULETTE_BALL_SETTLE_DELAY_MS = 100;
export const ROULETTE_BALL_SETTLE_DURATION_MS = 800;
export const ROULETTE_BALL_MAX_SPIN_DURATION_MS = 9000;
/** Ball center as a fraction of the wheel frame from its top edge (web `top` in %). */
export const ROULETTE_BALL_SPINNING_TOP_START = 0.08;
export const ROULETTE_BALL_SPINNING_TOP_END = 0.12;
export const ROULETTE_BALL_SETTLED_TOP = 0.253;

export interface BallMotionInput {
  phase: RouletteRoundPhase;
  winningNumber: number | null;
  roundId: string | null;
  spinStartedAt: string | null;
}

export interface BallSpin {
  roundId: string;
  targetNumber: number;
  targetIndex: number;
  /** Orbit rotation the spin starts from (without the per-number offset). */
  fromRotation: number;
  /** Orbit rotation of the winning pocket (without the per-number offset). */
  targetRotation: number;
  durationMs: number;
  /** When the ball starts dropping into the pocket (spin end + settle delay). */
  settlesAt: number;
}

export interface BallMotionState {
  triggeredRoundId: string | null;
  /** Web `ballRotationRef`: where the orbit ends up after the current command. */
  rotation: number;
  spin: BallSpin | null;
}

export type BallCommand =
  | { kind: 'none' }
  /** Spin from `fromRotation` to `targetRotation`, then drop into the pocket. */
  | { kind: 'spin'; spin: BallSpin }
  /** Show the ball resting in the pocket immediately. */
  | { kind: 'settle'; spin: BallSpin };

export const INITIAL_BALL_MOTION: BallMotionState = { triggeredRoundId: null, rotation: 0, spin: null };

function wheelIndex(winningNumber: number) {
  const index = ROULETTE_WHEEL_NUMBERS.indexOf(winningNumber);
  return index >= 0 ? index : 0;
}

export function nextBallMotion(
  state: BallMotionState,
  input: BallMotionInput,
  now: number,
): { state: BallMotionState; command: BallCommand } {
  const none = { kind: 'none' } as const;

  if (input.phase === 'waiting') {
    return { state: { ...state, triggeredRoundId: null }, command: none };
  }

  const { winningNumber, roundId } = input;

  if (input.phase === 'spinning' && winningNumber != null && roundId && state.triggeredRoundId !== roundId) {
    const remainingMs = input.spinStartedAt
      ? Math.max(0, new Date(input.spinStartedAt).getTime() + ROULETTE_SPIN_REVEAL_MS - now)
      : ROULETTE_SPIN_REVEAL_MS;
    const durationMs = Math.max(0, Math.min(ROULETTE_BALL_MAX_SPIN_DURATION_MS, remainingMs));
    const targetIndex = wheelIndex(winningNumber);
    const spin: BallSpin = {
      roundId,
      targetNumber: winningNumber,
      targetIndex,
      fromRotation: state.rotation,
      targetRotation: computeRouletteBallRotation(state.rotation, targetIndex),
      durationMs,
      settlesAt: now + durationMs + ROULETTE_BALL_SETTLE_DELAY_MS,
    };
    return {
      state: { triggeredRoundId: roundId, rotation: spin.targetRotation, spin },
      command: { kind: 'spin', spin },
    };
  }

  if (input.phase === 'settled' && winningNumber != null) {
    const current = state.spin;
    if (current && current.targetNumber === winningNumber) {
      // Either still spinning toward this number or already resting on it.
      return { state, command: none };
    }
    const targetIndex = wheelIndex(winningNumber);
    const rotation = computeRouletteBallSettledRotation(state.rotation, targetIndex);
    const spin: BallSpin = {
      roundId: roundId ?? `settled-${winningNumber}`,
      targetNumber: winningNumber,
      targetIndex,
      fromRotation: rotation,
      targetRotation: rotation,
      durationMs: 0,
      settlesAt: now,
    };
    return { state: { ...state, rotation, spin }, command: { kind: 'settle', spin } };
  }

  return { state, command: none };
}
