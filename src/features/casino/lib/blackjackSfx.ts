// Subtle synthesized table sounds (WebAudio, no binary assets) plus haptics.
// Everything is fire-and-forget and safe to call in tests/SSR — missing
// AudioContext or vibration support degrades to a no-op.

const MUTE_STORAGE_KEY = 'bsplic.blackjack.muted';

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) {
    try {
      audioCtx = new Ctor();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume().catch(() => undefined);
  }
  return audioCtx;
}

export function isSfxMuted(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(MUTE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setSfxMuted(muted: boolean): void {
  try {
    window.localStorage.setItem(MUTE_STORAGE_KEY, String(muted));
  } catch {
    // Private mode etc. — sound stays session-only.
  }
}

function withCtx(play: (ctx: AudioContext, now: number) => void): void {
  if (isSfxMuted()) return;
  const ctx = getCtx();
  if (!ctx) return;
  try {
    play(ctx, ctx.currentTime);
  } catch {
    // Never let sound break the game.
  }
}

function noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function playNoise(
  ctx: AudioContext,
  now: number,
  {
    duration,
    frequency,
    gain,
    type = 'bandpass',
  }: { duration: number; frequency: number; gain: number; type?: BiquadFilterType },
): void {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx, duration);
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  filter.Q.value = 1.2;
  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(gain, now);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  source.connect(filter).connect(gainNode).connect(ctx.destination);
  source.start(now);
  source.stop(now + duration);
}

function playTone(
  ctx: AudioContext,
  start: number,
  {
    frequency,
    endFrequency,
    duration,
    gain,
    type = 'sine',
  }: {
    frequency: number;
    endFrequency?: number;
    duration: number;
    gain: number;
    type?: OscillatorType;
  },
): void {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  if (endFrequency) {
    osc.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
  }
  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(0.0001, start);
  gainNode.gain.exponentialRampToValueAtTime(gain, start + 0.012);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gainNode).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

/** Short snap of a card hitting the felt. */
export function playCardSound(): void {
  withCtx((ctx, now) => {
    playNoise(ctx, now, { duration: 0.05, frequency: 2600, gain: 0.16 });
  });
}

/** Slightly longer swoosh for the dealer's hole-card flip. */
export function playFlipSound(): void {
  withCtx((ctx, now) => {
    playNoise(ctx, now, { duration: 0.12, frequency: 1400, gain: 0.12 });
    playNoise(ctx, now + 0.07, { duration: 0.05, frequency: 2800, gain: 0.14 });
  });
}

/** Two quick clacks of stacked chips. */
export function playChipSound(): void {
  withCtx((ctx, now) => {
    playTone(ctx, now, { frequency: 1900, duration: 0.04, gain: 0.1, type: 'triangle' });
    playTone(ctx, now + 0.045, { frequency: 2300, duration: 0.04, gain: 0.08, type: 'triangle' });
  });
}

export function playResultSound(kind: 'won' | 'lost' | 'push'): void {
  withCtx((ctx, now) => {
    if (kind === 'won') {
      playTone(ctx, now, { frequency: 523.25, duration: 0.18, gain: 0.09 });
      playTone(ctx, now + 0.09, { frequency: 659.25, duration: 0.18, gain: 0.09 });
      playTone(ctx, now + 0.18, { frequency: 783.99, duration: 0.26, gain: 0.1 });
    } else if (kind === 'lost') {
      playTone(ctx, now, {
        frequency: 190,
        endFrequency: 110,
        duration: 0.28,
        gain: 0.11,
      });
    } else {
      playTone(ctx, now, { frequency: 440, duration: 0.14, gain: 0.07 });
    }
  });
}

/** Gentle haptic tick — Android only; iOS silently ignores vibrate(). */
export function vibrate(pattern: number | number[]): void {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Some browsers throw without a user gesture — ignore.
  }
}
