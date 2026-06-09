const SOUND_MUTED_STORAGE_KEY = 'notifications_sound_muted';

interface WindowWithWebkitAudio extends Window {
  webkitAudioContext?: typeof AudioContext;
}

let notificationAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  if (notificationAudioContext && notificationAudioContext.state !== 'closed') {
    return notificationAudioContext;
  }

  const win = window as WindowWithWebkitAudio;
  const AudioContextCtor = window.AudioContext ?? win.webkitAudioContext;
  if (!AudioContextCtor) return null;

  notificationAudioContext = new AudioContextCtor();
  return notificationAudioContext;
}

export function getNotificationsSoundMuted(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(SOUND_MUTED_STORAGE_KEY) === '1';
}

export function setNotificationsSoundMuted(muted: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SOUND_MUTED_STORAGE_KEY, muted ? '1' : '0');
}

export async function prepareNotificationSound(): Promise<void> {
  const context = getAudioContext();
  if (!context) return;

  if (context.state === 'suspended') {
    await context.resume();
  }
}

export async function playNotificationSound(): Promise<void> {
  try {
    await prepareNotificationSound();
    const context = getAudioContext();
    if (!context || context.state === 'closed') return;

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
  } catch {
    // Browsers may reject audio playback until the user interacts with the page.
  }
}
