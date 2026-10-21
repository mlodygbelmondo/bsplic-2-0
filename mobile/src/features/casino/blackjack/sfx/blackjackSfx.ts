import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

import { haptics } from '@/lib/haptics';
import { usePreferences } from '@/lib/preferences';
import type { BlackjackHaptic, BlackjackSound } from '../logic/game';

/**
 * Table sounds (web `blackjackSfx.ts`). The web synthesizes them with
 * WebAudio; here the same graphs are pre-rendered to WAV (`render-sfx.mjs`)
 * and played with expo-audio. Fire-and-forget: a failing player never breaks
 * the game. Muted when the casino sound preference is off.
 */

const SOURCES: Record<BlackjackSound, number> = {
  card: require('./card.wav'),
  flip: require('./flip.wav'),
  chip: require('./chip.wav'),
  won: require('./won.wav'),
  lost: require('./lost.wav'),
  push: require('./push.wav'),
};

const players = new Map<BlackjackSound, AudioPlayer>();

/** Creates the players while the table is open so the first sound is instant. */
export function loadBlackjackSfx(): void {
  for (const kind of Object.keys(SOURCES) as BlackjackSound[]) {
    if (players.has(kind)) continue;
    try {
      players.set(kind, createAudioPlayer(SOURCES[kind]));
    } catch {
      // Audio unavailable: the game stays silent.
    }
  }
}

/** Releases the native players when the table closes. */
export function unloadBlackjackSfx(): void {
  for (const player of players.values()) {
    try {
      player.remove();
    } catch {
      // Already released.
    }
  }
  players.clear();
}

export function playBlackjackSound(kind: BlackjackSound): void {
  if (!usePreferences.getState().casinoSound) return;
  const player = players.get(kind);
  if (!player) return;
  try {
    void player.seekTo(0).catch(() => undefined);
    player.play();
  } catch {
    // Never let sound break the game.
  }
}

/**
 * Web `vibrate()` call sites mapped to native haptics: a light tick per card,
 * a warning on a bust, a heavy hit on a natural blackjack, and a success
 * notification on a win.
 */
export function playBlackjackHaptic(kind: BlackjackHaptic): void {
  switch (kind) {
    case 'card':
      haptics.light();
      break;
    case 'bust':
      haptics.warning();
      break;
    case 'blackjack':
      haptics.heavy();
      break;
    case 'won':
      haptics.success();
      break;
    case 'lost':
    case 'push':
      haptics.medium();
      break;
  }
}
