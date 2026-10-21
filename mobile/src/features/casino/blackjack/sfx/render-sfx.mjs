// Renders the web blackjack sounds (src/features/casino/lib/blackjackSfx.ts,
// synthesized live with WebAudio) into small WAV files for expo-audio.
// The graphs are reproduced offline: bandpass-filtered noise bursts and
// sine/triangle tones with the same frequencies, gains and envelopes.
//
//   node mobile/src/features/casino/blackjack/sfx/render-sfx.mjs

import { Buffer } from 'node:buffer';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SAMPLE_RATE = 44100;
const OUT_DIR = dirname(fileURLToPath(import.meta.url));

/** Deterministic noise so the committed files are reproducible. */
function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** WebAudio `exponentialRampToValueAtTime` between two events. */
function expRamp(from, to, t0, t1, t) {
  if (t <= t0) return from;
  if (t >= t1) return to;
  return from * Math.pow(to / from, (t - t0) / (t1 - t0));
}

/** WebAudio BiquadFilter `bandpass` (RBJ cookbook, constant 0 dB peak gain). */
function bandpass(frequency, q) {
  const w0 = (2 * Math.PI * frequency) / SAMPLE_RATE;
  const alpha = Math.sin(w0) / (2 * q);
  const a0 = 1 + alpha;
  return {
    b0: alpha / a0,
    b1: 0,
    b2: -alpha / a0,
    a1: (-2 * Math.cos(w0)) / a0,
    a2: (1 - alpha) / a0,
  };
}

function addNoise(out, start, { duration, frequency, gain }, seed) {
  const random = createRandom(seed);
  const { b0, b1, b2, a1, a2 } = bandpass(frequency, 1.2);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  const offset = Math.round(start * SAMPLE_RATE);
  const length = Math.ceil(duration * SAMPLE_RATE);
  for (let i = 0; i < length; i += 1) {
    const x = random() * 2 - 1;
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    const envelope = expRamp(gain, 0.0001, 0, duration, i / SAMPLE_RATE);
    out[offset + i] += y * envelope;
  }
}

function addTone(out, start, { frequency, endFrequency, duration, gain, type = 'sine' }) {
  const offset = Math.round(start * SAMPLE_RATE);
  const length = Math.ceil((duration + 0.02) * SAMPLE_RATE);
  let phase = 0;
  for (let i = 0; i < length; i += 1) {
    const t = i / SAMPLE_RATE;
    const f = endFrequency ? expRamp(frequency, endFrequency, 0, duration, t) : frequency;
    phase += (2 * Math.PI * f) / SAMPLE_RATE;
    const wave = type === 'triangle' ? (2 / Math.PI) * Math.asin(Math.sin(phase)) : Math.sin(phase);
    const envelope = t < 0.012 ? expRamp(0.0001, gain, 0, 0.012, t) : expRamp(gain, 0.0001, 0.012, duration, t);
    out[offset + i] += wave * envelope;
  }
}

function writeWav(name, seconds, draw) {
  const samples = new Float32Array(Math.ceil(seconds * SAMPLE_RATE));
  draw(samples);
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i += 1) {
    const value = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE(Math.round(value * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  writeFileSync(join(OUT_DIR, `${name}.wav`), Buffer.concat([header, data]));
}

// playCardSound: short snap of a card hitting the felt.
writeWav('card', 0.05, (out) => addNoise(out, 0, { duration: 0.05, frequency: 2600, gain: 0.16 }, 1));

// playFlipSound: longer swoosh for the hole-card flip.
writeWav('flip', 0.12, (out) => {
  addNoise(out, 0, { duration: 0.12, frequency: 1400, gain: 0.12 }, 2);
  addNoise(out, 0.07, { duration: 0.05, frequency: 2800, gain: 0.14 }, 3);
});

// playChipSound: two quick clacks of stacked chips.
writeWav('chip', 0.105, (out) => {
  addTone(out, 0, { frequency: 1900, duration: 0.04, gain: 0.1, type: 'triangle' });
  addTone(out, 0.045, { frequency: 2300, duration: 0.04, gain: 0.08, type: 'triangle' });
});

// playResultSound('won'): C5, E5, G5.
writeWav('won', 0.46, (out) => {
  addTone(out, 0, { frequency: 523.25, duration: 0.18, gain: 0.09 });
  addTone(out, 0.09, { frequency: 659.25, duration: 0.18, gain: 0.09 });
  addTone(out, 0.18, { frequency: 783.99, duration: 0.26, gain: 0.1 });
});

// playResultSound('lost'): 190 Hz sliding down to 110 Hz.
writeWav('lost', 0.3, (out) =>
  addTone(out, 0, { frequency: 190, endFrequency: 110, duration: 0.28, gain: 0.11 }),
);

// playResultSound('push'): a single 440 Hz blip.
writeWav('push', 0.16, (out) => addTone(out, 0, { frequency: 440, duration: 0.14, gain: 0.07 }));
