/* eslint-disable @typescript-eslint/no-require-imports -- Metro resolves bundled audio through static require calls. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAudioPlayer } from 'expo-audio';
import AsyncStorage from 'expo-sqlite/kv-store';
import * as Haptics from 'expo-haptics';

const SOUND_MUTED_KEY = 'bsplic.notifications.sound-muted';

export function useNotificationSound() {
  const player = useAudioPlayer(require('../../../../assets/audio/notification.wav'));
  const [muted, setMuted] = useState(false);
  useEffect(() => { void AsyncStorage.getItem(SOUND_MUTED_KEY).then(value => setMuted(value === 'true')); }, []);
  const toggle = useCallback(() => setMuted(current => {
    const next = !current;
    void AsyncStorage.setItem(SOUND_MUTED_KEY, String(next));
    return next;
  }), []);
  const play = useCallback(() => {
    if (muted) return;
    void player.seekTo(0).then(() => player.play());
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [muted, player]);
  return useMemo(() => ({ muted, toggle, play }), [muted, play, toggle]);
}
