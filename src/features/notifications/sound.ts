const SOUND_MUTED_STORAGE_KEY = 'notifications_sound_muted';

interface WindowWithWebkitAudio extends Window {
  webkitAudioContext?: typeof AudioContext;
}

export function getNotificationsSoundMuted(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(SOUND_MUTED_STORAGE_KEY) === '1';
}

export function setNotificationsSoundMuted(muted: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SOUND_MUTED_STORAGE_KEY, muted ? '1' : '0');
}

export async function playNotificationSound(): Promise<void> {
  if (typeof window === 'undefined') return;

  const win = window as WindowWithWebkitAudio;
  const AudioContextCtor = window.AudioContext ?? win.webkitAudioContext;
  if (!AudioContextCtor) return;

  let context: AudioContext | null = null;

  try {
    context = new AudioContextCtor();
    if (context.state === 'suspended') {
      await context.resume();
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start(now);
    oscillator.stop(now + 0.22);
    oscillator.onended = () => {
      void context?.close();
      context = null;
    };
  } catch {
    if (context) {
      await context.close().catch(() => undefined);
    }
  }
}
