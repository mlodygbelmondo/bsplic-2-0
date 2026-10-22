import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

import { haptics } from '@/lib/haptics';
import { usePreferences } from '@/lib/preferences';

/**
 * Casino sound and haptics (port of the web `casinoAudio.ts`), shared by
 * roulette and, later, the slots.
 *
 * The web synthesizes the win chime with Web Audio: three sine notes at
 * 659.25, 880 and 1318.5 Hz starting at +0.02 s, +0.13 s and +0.24 s, each
 * ramping exponentially 0.0001 → 0.12 in 20 ms and back to 0.0001 at +0.5 s,
 * stopped at +0.55 s. `assets/win-chime.wav` is that exact render (44.1 kHz,
 * mono). Mute is the roulette `casinoSound` preference (web `bsplic.casino.sound`
 * = `'muted'` | `'on'`). Like the web, mute never silences haptics.
 */

const WIN_CHIME = require('./assets/win-chime.wav') as number;

let winChimePlayer: AudioPlayer | null = null;

export function isCasinoSoundMuted(): boolean {
  return !usePreferences.getState().casinoSound;
}

export function setCasinoSoundMuted(muted: boolean) {
  usePreferences.getState().setCasinoSound(!muted);
}

/** Subscribes to the mute switch (sound toggle buttons). */
export function useCasinoSoundMuted(): boolean {
  return usePreferences((state) => !state.casinoSound);
}

/** Loads the chime ahead of the first win so it plays without delay. */
export function prepareCasinoWinChime() {
  if (isCasinoSoundMuted()) return;
  try {
    winChimePlayer ??= createAudioPlayer(WIN_CHIME);
  } catch {
    winChimePlayer = null;
  }
}

export function playCasinoWinChime() {
  if (isCasinoSoundMuted()) return;
  try {
    winChimePlayer ??= createAudioPlayer(WIN_CHIME);
    void winChimePlayer.seekTo(0).catch(() => undefined);
    winChimePlayer.play();
  } catch {
    // Audio is best effort.
  }
}

/**
 * Web `vibrateCasino` call sites: win `[60, 40, 90]` → success notification,
 * ball settling in the pocket (`35` ms) → light impact. Accepted bets get a
 * medium impact and errors an error notification.
 */
export const casinoHaptics = {
  win: haptics.success,
  ballSettled: haptics.light,
  betPlaced: haptics.medium,
  error: haptics.error,
  select: haptics.selection,
};
