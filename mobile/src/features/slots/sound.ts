import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

/**
 * Slot tones. The web synthesizes a sine (gain 0.055 → 0.001 over 220 ms)
 * with Web Audio: 260 Hz when a spin starts and 660 Hz on a winning spin.
 * The same envelopes are rendered into `assets/tone-*.wav` and played with
 * expo-audio. The caller checks the screen's sound switch (off on every visit, like the web).
 *
 * Local stand-in for the shared casino audio helper
 * (`features/casino/shared/audio.ts`); merge once that exists.
 */

const TONES = {
  spin: require('./assets/tone-spin.wav') as number,
  win: require('./assets/tone-win.wav') as number,
};

export type SlotTone = keyof typeof TONES;

const players: Partial<Record<SlotTone, AudioPlayer>> = {};

export function playSlotTone(tone: SlotTone): void {
  try {
    const player = (players[tone] ??= createAudioPlayer(TONES[tone]));
    void player.seekTo(0).catch(() => undefined);
    player.play();
  } catch {
    // Audio is optional; playback failures are never surfaced (web swallows them too).
  }
}

/** Frees the players when the slot screen unmounts (web closes its AudioContext). */
export function releaseSlotTones(): void {
  for (const tone of Object.keys(players) as SlotTone[]) {
    try {
      players[tone]?.remove();
    } catch {
      // Already released.
    }
    delete players[tone];
  }
}
