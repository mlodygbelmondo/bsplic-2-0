import { useCallback, useState } from 'react';

// Web Audio synthesizer for the Jackpot draw (no audio files to download).

const SOUND_MUTED_STORAGE_KEY = 'bsplic:jackpot-sound-muted';

function readStoredSoundEnabled() {
  try {
    return window.localStorage.getItem(SOUND_MUTED_STORAGE_KEY) !== '1';
  } catch {
    return true;
  }
}

class JackpotAudioEngine {
  private ctx: AudioContext | null = null;
  private soundEnabled =
    typeof window === 'undefined' ? false : readStoredSoundEnabled();

  get enabled() {
    return this.soundEnabled;
  }

  setEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
    try {
      window.localStorage.setItem(SOUND_MUTED_STORAGE_KEY, enabled ? '0' : '1');
    } catch {
      // Private mode storage can be unavailable; keep the in-memory choice.
    }
  }

  /**
   * Call from a tap handler. iOS Safari only lets an AudioContext start
   * inside a user gesture, and the draw sounds play later from timers.
   */
  unlock() {
    this.getContext();
  }

  private getContext() {
    if (!this.soundEnabled || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private playTone({
    type,
    frequency,
    endFrequency,
    volume,
    duration,
    delay = 0,
  }: {
    type: OscillatorType;
    frequency: number;
    endFrequency?: number;
    volume: number;
    duration: number;
    delay?: number;
  }) {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const startTime = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, startTime);
      if (endFrequency) {
        osc.frequency.exponentialRampToValueAtTime(
          endFrequency,
          startTime + duration,
        );
      }
      gain.gain.setValueAtTime(volume, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    } catch {
      // Audio is decorative; a failed tone must never break the draw.
    }
  }

  playTick(frequency = 750, duration = 0.03, volume = 0.12) {
    this.playTone({
      type: 'triangle',
      frequency,
      endFrequency: frequency * 0.4,
      volume,
      duration,
    });
  }

  playImpact(volume = 0.3) {
    this.playTone({
      type: 'sine',
      frequency: 140,
      endFrequency: 35,
      volume,
      duration: 0.4,
    });
  }

  playFanfare() {
    [261.63, 329.63, 392.0, 523.25, 659.25, 783.99, 1046.5].forEach(
      (frequency, index) => {
        this.playTone({
          type: 'triangle',
          frequency,
          volume: 0.15,
          duration: 0.6,
          delay: index * 0.08,
        });
      },
    );
  }

  playCoinSound() {
    this.playTone({
      type: 'sine',
      frequency: 987.77,
      volume: 0.18,
      duration: 0.08,
    });
    this.playTone({
      type: 'sine',
      frequency: 1318.51,
      volume: 0.18,
      duration: 0.32,
      delay: 0.08,
    });
  }

  playGoldenChime() {
    [1200, 1500, 1900, 2400].forEach((frequency, index) => {
      this.playTone({
        type: 'sine',
        frequency,
        volume: 0.1,
        duration: 0.5,
        delay: index * 0.05,
      });
    });
  }

  playTicketPop() {
    this.playTone({
      type: 'triangle',
      frequency: 220,
      endFrequency: 920,
      volume: 0.32,
      duration: 0.16,
    });
    this.playTone({
      type: 'sine',
      frequency: 1480,
      volume: 0.2,
      duration: 0.37,
      delay: 0.08,
    });
  }
}

export const jackpotAudio = new JackpotAudioEngine();

export function useJackpotSound() {
  const [soundEnabled, setSoundEnabled] = useState(jackpotAudio.enabled);

  const toggleSound = useCallback(() => {
    const nextEnabled = !jackpotAudio.enabled;
    jackpotAudio.setEnabled(nextEnabled);
    setSoundEnabled(nextEnabled);
    if (nextEnabled) {
      jackpotAudio.unlock();
      jackpotAudio.playTick(900, 0.04, 0.1);
    }
  }, []);

  return { soundEnabled, toggleSound };
}
