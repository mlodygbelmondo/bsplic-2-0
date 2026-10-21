import { describe, expect, it } from 'vitest';

import { confettiFrameAt, createConfettiParticles, ROULETTE_WIN_CONFETTI, type ConfettiParticle } from './confetti';

/** canvas-confetti 1.9.4 `updateFetti`, stepped tick by tick (no drawing). */
function simulate(particle: ConfettiParticle, ticks: number) {
  const fetti = {
    x: particle.x0,
    y: particle.y0,
    velocity: particle.velocity0,
    wobble: particle.wobble0,
    tiltAngle: particle.tilt0,
    wobbleX: 0,
    wobbleY: 0,
  };
  for (let tick = 0; tick < ticks; tick += 1) {
    fetti.x += Math.cos(particle.angle2D) * fetti.velocity + particle.drift;
    fetti.y += Math.sin(particle.angle2D) * fetti.velocity + particle.gravity;
    fetti.velocity *= particle.decay;
    fetti.wobble += particle.wobbleSpeed;
    fetti.wobbleX = fetti.x + 10 * particle.scalar * Math.cos(fetti.wobble);
    fetti.wobbleY = fetti.y + 10 * particle.scalar * Math.sin(fetti.wobble);
    fetti.tiltAngle += 0.1;
  }
  return fetti;
}

/** Deterministic stand-in for Math.random. */
function sequence(values: number[]) {
  let index = 0;
  return () => values[index++ % values.length];
}

describe('createConfettiParticles', () => {
  it('launches every particle from the origin within the spread around straight up', () => {
    const particles = createConfettiParticles(ROULETTE_WIN_CONFETTI, 400, 800, sequence([0, 0.25, 0.5, 0.75, 0.99]));

    expect(particles).toHaveLength(150);
    for (const particle of particles) {
      expect(particle.x0).toBe(200);
      expect(particle.y0).toBe(480);
      // -90° ± 35°
      expect(particle.angle2D).toBeGreaterThanOrEqual((-125 * Math.PI) / 180 - 1e-9);
      expect(particle.angle2D).toBeLessThanOrEqual((-55 * Math.PI) / 180 + 1e-9);
      // 45 * 0.5 + [0, 45)
      expect(particle.velocity0).toBeGreaterThanOrEqual(22.5);
      expect(particle.velocity0).toBeLessThan(67.5);
      expect(particle.gravity).toBe(3);
    }
  });
});

describe('confettiFrameAt', () => {
  it('matches the library stepping a particle tick by tick', () => {
    const [particle] = createConfettiParticles(ROULETTE_WIN_CONFETTI, 390, 844, sequence([0.31, 0.62, 0.13, 0.87, 0.45, 0.7, 0.2]));

    for (const ticks of [1, 10, 57, 199]) {
      const expected = simulate(particle, ticks);
      const frame = confettiFrameAt(particle, ticks);
      expect(frame.x).toBeCloseTo(expected.x, 6);
      expect(frame.y).toBeCloseTo(expected.y, 6);
      expect(frame.wobble).toBeCloseTo(expected.wobble, 6);
      expect(frame.wobbleX).toBeCloseTo(expected.wobbleX, 6);
      expect(frame.wobbleY).toBeCloseTo(expected.wobbleY, 6);
      expect(frame.tiltSin).toBeCloseTo(Math.sin(expected.tiltAngle), 6);
    }
  });

  it('keeps the size jitter in the library range', () => {
    const [particle] = createConfettiParticles(ROULETTE_WIN_CONFETTI, 390, 844, sequence([0.5]));
    for (let tick = 0; tick < 200; tick += 7) {
      const { random } = confettiFrameAt(particle, tick);
      expect(random).toBeGreaterThanOrEqual(2);
      expect(random).toBeLessThan(3);
    }
  });
});
