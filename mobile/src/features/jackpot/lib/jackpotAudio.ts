import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

import { usePreferences } from '@/lib/preferences';

/**
 * Jackpot sounds (port of the web `jackpotAudio.ts`). The web synthesizes
 * every tone with Web Audio; `../sounds/*.wav` are exact renders of the same
 * oscillators (44.1 kHz mono): gain ramps exponentially from the volume to
 * 0.001 over the duration, frequency ramps exponentially to the end frequency.
 *
 * - tick(f, d, v): triangle f → 0.4 f.
 * - `drum-spin`: the drum's ticks, one per 60 fps frame that crosses a face
 *   boundary during the 2.85 s spin (eased `1 - (1 - p)^3.8`, 6 turns, 12
 *   faces), tick(820 - 340 p, 0.025 s, 0.12).
 * - `reveal`: ticket pop (triangle 220 → 920 Hz, 0.32, 0.16 s; sine 1480 Hz,
 *   0.2, 0.37 s at +0.08 s) and golden chime (sines 1200/1500/1900/2400 Hz,
 *   0.1, 0.5 s, 0.05 s apart).
 * - `reveal-winner`: reveal plus impact (sine 140 → 35 Hz, 0.4, 0.4 s) and the
 *   fanfare at +0.18 s (triangles 261.63 … 1046.5 Hz, 0.15, 0.6 s, 0.08 s apart).
 * - `coin`: sines 987.77 Hz (0.08 s) and 1318.51 Hz (0.32 s at +0.08 s), 0.18.
 * - `tick-option-n`: tick(700 + 100 n, 0.03 s, 0.1); `tick-toggle`: tick(900, 0.04 s, 0.1).
 *
 * Mute follows the `jackpotSound` preference (web `bsplic:jackpot-sound-muted`).
 */

const SOUNDS = {
  drumSpin: require('../sounds/drum-spin.wav') as number,
  reveal: require('../sounds/reveal.wav') as number,
  revealWinner: require('../sounds/reveal-winner.wav') as number,
  coin: require('../sounds/coin.wav') as number,
  toggle: require('../sounds/tick-toggle.wav') as number,
  option1: require('../sounds/tick-option-1.wav') as number,
  option2: require('../sounds/tick-option-2.wav') as number,
  option3: require('../sounds/tick-option-3.wav') as number,
  option4: require('../sounds/tick-option-4.wav') as number,
};

type JackpotSound = keyof typeof SOUNDS;

const DRAW_SOUNDS: JackpotSound[] = ['drumSpin', 'reveal', 'revealWinner'];
const OPTION_SOUNDS: JackpotSound[] = ['option1', 'option2', 'option3', 'option4'];

const players: Partial<Record<JackpotSound, AudioPlayer>> = {};

function soundEnabled(): boolean {
  return usePreferences.getState().jackpotSound;
}

function getPlayer(sound: JackpotSound): AudioPlayer {
  const existing = players[sound];
  if (existing) return existing;
  const player = createAudioPlayer(SOUNDS[sound]);
  players[sound] = player;
  return player;
}

function play(sound: JackpotSound) {
  if (!soundEnabled()) return;
  try {
    const player = getPlayer(sound);
    void player.seekTo(0).catch(() => undefined);
    player.play();
  } catch {
    // Audio is decorative; a failed sound must never break the draw.
  }
}

function pauseAll() {
  for (const player of Object.values(players)) {
    try {
      player?.pause();
    } catch {
      // Best effort.
    }
  }
}

export const jackpotAudio = {
  /** Loads the draw sounds ahead of the first tap so the drum ticks start on time. */
  prepareDraw() {
    if (!soundEnabled()) return;
    try {
      for (const sound of DRAW_SOUNDS) getPlayer(sound);
    } catch {
      // Best effort.
    }
  },
  playDrumSpin() {
    play('drumSpin');
  },
  stopDrumSpin() {
    try {
      players.drumSpin?.pause();
    } catch {
      // Best effort.
    }
  },
  /** Everyone hears the reveal; only the winner gets the impact and fanfare. */
  playReveal(isCurrentUserWinner: boolean) {
    play(isCurrentUserWinner ? 'revealWinner' : 'reveal');
  },
  playCoin() {
    play('coin');
  },
  /** Ticket count choice in the buy dialog (`700 + count × 100` Hz). */
  playOptionTick(count: number) {
    play(OPTION_SOUNDS[Math.min(Math.max(count, 1), OPTION_SOUNDS.length) - 1]);
  },
  /** Frees the draw players when the draw screen closes. */
  releaseDraw() {
    for (const sound of DRAW_SOUNDS) {
      try {
        players[sound]?.remove();
      } catch {
        // Best effort.
      }
      delete players[sound];
    }
  },
};

/** Draw page sound switch (web `useJackpotSound`), bound to `jackpotSound`. */
export function useJackpotSound() {
  const soundEnabledState = usePreferences((state) => state.jackpotSound);

  const toggleSound = () => {
    const next = !usePreferences.getState().jackpotSound;
    usePreferences.getState().setJackpotSound(next);
    if (next) {
      jackpotAudio.prepareDraw();
      play('toggle');
    } else {
      pauseAll();
    }
  };

  return { soundEnabled: soundEnabledState, toggleSound };
}
