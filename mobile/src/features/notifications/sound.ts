import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

import { usePreferences } from '@/lib/preferences';

/**
 * Port of the web `sound.ts`. The web synthesizes an 880 Hz sine blip with
 * Web Audio (gain 0.0001 → 0.08 in 10 ms → 0.0001 at 220 ms); the same
 * envelope is rendered into `assets/notification.wav` and played with
 * expo-audio. The mute switch is the shared `notificationSound` preference
 * (web: `notifications_sound_muted` in localStorage).
 */

const NOTIFICATION_SOUND = require('./assets/notification.wav') as number;

let player: AudioPlayer | null = null;

export function getNotificationsSoundMuted(): boolean {
  return !usePreferences.getState().notificationSound;
}

export function setNotificationsSoundMuted(muted: boolean): void {
  usePreferences.getState().setNotificationSound(!muted);
}

/** Loads the player ahead of the first blip (web: resumes the AudioContext on a gesture). */
export function prepareNotificationSound(): void {
  try {
    player ??= createAudioPlayer(NOTIFICATION_SOUND);
  } catch {
    player = null;
  }
}

export function playNotificationSound(): void {
  try {
    prepareNotificationSound();
    if (!player) return;
    void player.seekTo(0).catch(() => undefined);
    player.play();
  } catch {
    // Playback failures are never surfaced (web swallows them too).
  }
}
