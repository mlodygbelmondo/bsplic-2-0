import { describe, expect, it } from 'vitest';

import { INITIAL_BALL_MOTION, nextBallMotion, type BallMotionInput } from './ballMotion';

const NOW = Date.parse('2026-04-25T12:00:04.000Z');

const spinning = (overrides: Partial<BallMotionInput> = {}): BallMotionInput => ({
  phase: 'spinning',
  winningNumber: 13,
  roundId: 'round-1',
  spinStartedAt: '2026-04-25T12:00:00.000Z',
  ...overrides,
});

describe('nextBallMotion', () => {
  it('spins four full turns onto the winning pocket for the rest of the 6 s reveal', () => {
    const { command, state } = nextBallMotion(INITIAL_BALL_MOTION, spinning(), NOW);

    expect(command.kind).toBe('spin');
    if (command.kind !== 'spin') return;
    // 13 sits 12 pockets clockwise from 0: 12 × 360/37 = 116.7568°, plus 4 × 360.
    expect(command.spin.fromRotation).toBe(0);
    expect(command.spin.targetRotation).toBeCloseTo(1440 + 116.7568, 3);
    // Started 4 s ago, so 2 s of the 6 s reveal remain.
    expect(command.spin.durationMs).toBe(2000);
    expect(command.spin.settlesAt).toBe(NOW + 2100);
    expect(state.rotation).toBeCloseTo(1556.7568, 3);
  });

  it('does not restart the spin for the same round', () => {
    const first = nextBallMotion(INITIAL_BALL_MOTION, spinning(), NOW);
    const again = nextBallMotion(first.state, spinning(), NOW + 500);

    expect(again.command.kind).toBe('none');
    expect(again.state).toBe(first.state);
  });

  it('runs a zero-length spin when joining after the reveal ended', () => {
    const { command } = nextBallMotion(INITIAL_BALL_MOTION, spinning(), NOW + 9000);

    expect(command.kind === 'spin' && command.spin.durationMs).toBe(0);
  });

  it('uses the full reveal when the spin start time is unknown', () => {
    const { command } = nextBallMotion(INITIAL_BALL_MOTION, spinning({ spinStartedAt: null }), NOW);

    expect(command.kind === 'spin' && command.spin.durationMs).toBe(6000);
  });

  it('continues the next spin forward from where the last one ended', () => {
    const first = nextBallMotion(INITIAL_BALL_MOTION, spinning(), NOW);
    const waiting = nextBallMotion(first.state, { ...spinning(), phase: 'waiting', winningNumber: null }, NOW + 20_000);
    const second = nextBallMotion(
      waiting.state,
      spinning({ roundId: 'round-2', winningNumber: 0, spinStartedAt: '2026-04-25T12:00:30.000Z' }),
      NOW + 26_000,
    );

    expect(second.command.kind).toBe('spin');
    if (second.command.kind !== 'spin') return;
    expect(second.command.spin.fromRotation).toBeCloseTo(1556.7568, 3);
    // From 116.76° forward to the 0 pocket (360°) plus four turns.
    expect(second.command.spin.targetRotation).toBeCloseTo(1800 + 1440, 3);
  });

  it('drops the ball straight into the pocket when the screen opens on a settled round', () => {
    const { command } = nextBallMotion(
      INITIAL_BALL_MOTION,
      { phase: 'settled', winningNumber: 26, roundId: 'round-9', spinStartedAt: null },
      NOW,
    );

    expect(command.kind).toBe('settle');
    if (command.kind !== 'settle') return;
    expect(command.spin.targetRotation).toBeCloseTo(350.2703, 3);
    expect(command.spin.roundId).toBe('round-9');
  });

  it('lets a running spin finish when the round settles on the same number', () => {
    const first = nextBallMotion(INITIAL_BALL_MOTION, spinning(), NOW);
    const settled = nextBallMotion(first.state, { ...spinning(), phase: 'settled' }, NOW + 1000);

    expect(settled.command.kind).toBe('none');
  });

  it('corrects the ball when the settled number differs from the spin target', () => {
    const first = nextBallMotion(INITIAL_BALL_MOTION, spinning(), NOW);
    const settled = nextBallMotion(first.state, { ...spinning(), phase: 'settled', winningNumber: 0 }, NOW + 1000);

    expect(settled.command.kind).toBe('settle');
    if (settled.command.kind !== 'settle') return;
    expect(settled.command.spin.targetNumber).toBe(0);
    expect(settled.command.spin.targetRotation).toBeCloseTo(1800, 3);
  });

  it('ignores a spinning round without a winning number yet', () => {
    const { command } = nextBallMotion(INITIAL_BALL_MOTION, spinning({ winningNumber: null }), NOW);

    expect(command.kind).toBe('none');
  });
});
