/**
 * canvas-confetti's particle model (v1.9 `randomPhysics` / `updateFetti`) in
 * closed form, so a frame can be drawn for any tick on the UI thread without
 * stepping every particle through every previous tick.
 *
 * Per tick the library does: `x += cos(angle2D) * velocity + drift`,
 * `y += sin(angle2D) * velocity + gravity`, `velocity *= decay`,
 * `wobble += wobbleSpeed`, `tiltAngle += 0.1`, then draws with opacity
 * `1 - tick / ticks`. After `n` updates the travelled distance is the
 * geometric sum `v0 * (1 - decay^n) / (1 - decay)`.
 */

export interface ConfettiOptions {
  particleCount: number;
  /** Degrees; 90 shoots straight up. */
  angle: number;
  spread: number;
  startVelocity: number;
  decay: number;
  gravity: number;
  drift: number;
  ticks: number;
  /** Origin as fractions of the canvas. */
  origin: { x: number; y: number };
  colors: string[];
  scalar: number;
}

/** canvas-confetti defaults, overridden by the roulette win burst. */
export const ROULETTE_WIN_CONFETTI: ConfettiOptions = {
  particleCount: 150,
  angle: 90,
  spread: 70,
  startVelocity: 45,
  decay: 0.9,
  gravity: 1,
  drift: 0,
  ticks: 200,
  origin: { x: 0.5, y: 0.6 },
  colors: ['#fbbf24', '#f59e0b', '#ef4444', '#22c55e', '#ffffff'],
  scalar: 1,
};

/** canvas-confetti advances one tick per 60 Hz frame. */
export const CONFETTI_TICK_MS = 1000 / 60;

export interface ConfettiParticle {
  x0: number;
  y0: number;
  wobble0: number;
  wobbleSpeed: number;
  velocity0: number;
  angle2D: number;
  tilt0: number;
  color: string;
  circle: boolean;
  decay: number;
  drift: number;
  gravity: number;
  scalar: number;
  /** Seed for the per-tick size jitter (`random = Math.random() + 2`). */
  seed: number;
}

export function createConfettiParticles(
  options: ConfettiOptions,
  width: number,
  height: number,
  random: () => number = Math.random,
): ConfettiParticle[] {
  const radAngle = options.angle * (Math.PI / 180);
  const radSpread = options.spread * (Math.PI / 180);
  return Array.from({ length: options.particleCount }, (_, index) => ({
    x0: width * options.origin.x,
    y0: height * options.origin.y,
    wobble0: random() * 10,
    wobbleSpeed: Math.min(0.11, random() * 0.1 + 0.05),
    velocity0: options.startVelocity * 0.5 + random() * options.startVelocity,
    angle2D: -radAngle + (0.5 * radSpread - random() * radSpread),
    tilt0: (random() * (0.75 - 0.25) + 0.25) * Math.PI,
    color: options.colors[index % options.colors.length],
    // `shapes[randomInt(0, 2)]` of the default `['square', 'circle']`.
    circle: random() < 0.5,
    decay: options.decay,
    drift: options.drift,
    gravity: options.gravity * 3,
    scalar: options.scalar,
    seed: random() * 1000,
  }));
}

export interface ConfettiFrame {
  x: number;
  y: number;
  wobble: number;
  wobbleX: number;
  wobbleY: number;
  tiltSin: number;
  tiltCos: number;
  /** Size jitter in [2, 3). */
  random: number;
}

/** Particle state after `updates` library ticks (fractional ticks interpolate for 120 Hz screens). */
export function confettiFrameAt(particle: ConfettiParticle, updates: number): ConfettiFrame {
  'worklet';
  const travelled = (particle.velocity0 * (1 - Math.pow(particle.decay, updates))) / (1 - particle.decay);
  const x = particle.x0 + Math.cos(particle.angle2D) * travelled + particle.drift * updates;
  const y = particle.y0 + Math.sin(particle.angle2D) * travelled + particle.gravity * updates;
  const wobble = particle.wobble0 + particle.wobbleSpeed * updates;
  const tilt = particle.tilt0 + 0.1 * updates;
  const jitter = Math.sin(particle.seed + Math.floor(updates) * 78.233) * 43758.5453;
  return {
    x,
    y,
    wobble,
    wobbleX: x + 10 * particle.scalar * Math.cos(wobble),
    wobbleY: y + 10 * particle.scalar * Math.sin(wobble),
    tiltSin: Math.sin(tilt),
    tiltCos: Math.cos(tilt),
    random: 2 + (jitter - Math.floor(jitter)),
  };
}
