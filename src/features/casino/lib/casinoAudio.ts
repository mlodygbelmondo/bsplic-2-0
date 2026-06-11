const SOUND_STORAGE_KEY = 'bsplic.casino.sound';

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  const AudioContextCtor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextCtor) return null;

  try {
    if (!audioContext) {
      audioContext = new AudioContextCtor();
    }
    if (audioContext.state === 'suspended') {
      void audioContext.resume();
    }
    return audioContext;
  } catch {
    return null;
  }
}

export function isCasinoSoundMuted(): boolean {
  try {
    return window.localStorage.getItem(SOUND_STORAGE_KEY) === 'muted';
  } catch {
    return false;
  }
}

export function setCasinoSoundMuted(muted: boolean) {
  try {
    window.localStorage.setItem(SOUND_STORAGE_KEY, muted ? 'muted' : 'on');
  } catch {
    // Preference simply won't persist.
  }
}

function scheduleTick(
  context: AudioContext,
  atTime: number,
  frequency: number,
  strength: number,
): OscillatorNode | null {
  try {
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(frequency, atTime);
    gain.gain.setValueAtTime(0.05 * strength, atTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, atTime + 0.035);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(atTime);
    oscillator.stop(atTime + 0.04);
    return oscillator;
  } catch {
    return null;
  }
}

// Clicks of the ball passing pockets: frequent at full speed, stretching out
// as the wheel decelerates over the spin duration.
export function playRouletteSpinTicks(durationMs: number): () => void {
  if (isCasinoSoundMuted()) return () => {};
  const context = getAudioContext();
  if (!context) return () => {};

  const startTime = context.currentTime + 0.05;
  const durationS = Math.max(0.3, durationMs / 1000);
  const scheduled: OscillatorNode[] = [];

  let elapsed = 0;
  let interval = 0.045;
  while (elapsed < durationS) {
    const progress = elapsed / durationS;
    const oscillator = scheduleTick(
      context,
      startTime + elapsed,
      2100 - progress * 600,
      1 - progress * 0.55,
    );
    if (!oscillator) break;
    scheduled.push(oscillator);

    elapsed += interval;
    interval *= 1.085;
  }

  return () => {
    scheduled.forEach((oscillator) => {
      try {
        oscillator.stop();
        oscillator.disconnect();
      } catch {
        // Already stopped.
      }
    });
  };
}

export function playRouletteBallSettleClick() {
  const context = isCasinoSoundMuted() ? null : getAudioContext();
  if (context) {
    scheduleTick(context, context.currentTime + 0.01, 1500, 1.6);
  }
}

export function playCasinoWinChime() {
  if (isCasinoSoundMuted()) return;
  const context = getAudioContext();
  if (!context) return;

  const notes = [659.25, 880, 1318.5];
  try {
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const atTime = context.currentTime + 0.02 + index * 0.11;

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, atTime);
      gain.gain.setValueAtTime(0.0001, atTime);
      gain.gain.exponentialRampToValueAtTime(0.12, atTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, atTime + 0.5);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(atTime);
      oscillator.stop(atTime + 0.55);
    });
  } catch {
    // Audio is best effort.
  }
}

export function vibrateCasino(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Haptics are best effort.
  }
}
