/* eslint-disable @typescript-eslint/no-require-imports -- Metro resolves bundled audio through static require calls. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import AsyncStorage from 'expo-sqlite/kv-store';

const CASINO_SOUND_MUTED_KEY = 'bsplic.casino.sound-muted';

export function useCasinoFeedback() {
  const chipPlayer = useAudioPlayer(require('../../../../assets/audio/chip.wav'));
  const cardPlayer = useAudioPlayer(require('../../../../assets/audio/card.wav'));
  const resultPlayer = useAudioPlayer(require('../../../../assets/audio/result.wav'));
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    void AsyncStorage.getItem(CASINO_SOUND_MUTED_KEY).then((value) => setMuted(value === 'true'));
  }, []);

  useEffect(() => {
    chipPlayer.muted = muted;
    cardPlayer.muted = muted;
    resultPlayer.muted = muted;
  }, [cardPlayer, chipPlayer, muted, resultPlayer]);

  const toggleMuted = useCallback(() => {
    setMuted((current) => {
      const next = !current;
      void AsyncStorage.setItem(CASINO_SOUND_MUTED_KEY, String(next));
      return next;
    });
  }, []);
  const replay = useCallback(async (player: typeof chipPlayer) => {
    await player.seekTo(0);
    player.play();
  }, []);
  return useMemo(() => ({
    muted,
    toggleMuted,
    chip: () => { void replay(chipPlayer); void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); },
    card: () => { void replay(cardPlayer); void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); },
    result: (won: boolean) => { void replay(resultPlayer); void Haptics.notificationAsync(won ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning); },
  }), [cardPlayer, chipPlayer, muted, replay, resultPlayer, toggleMuted]);
}
