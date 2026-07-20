/* eslint-disable @typescript-eslint/no-require-imports -- Metro resolves bundled audio through static require calls. */
import { useCallback, useMemo } from 'react';
import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

export function useCasinoFeedback() {
  const chipPlayer = useAudioPlayer(require('../../../../assets/audio/chip.wav'));
  const cardPlayer = useAudioPlayer(require('../../../../assets/audio/card.wav'));
  const resultPlayer = useAudioPlayer(require('../../../../assets/audio/result.wav'));
  const replay = useCallback(async (player: typeof chipPlayer) => {
    await player.seekTo(0);
    player.play();
  }, []);
  return useMemo(() => ({
    chip: () => { void replay(chipPlayer); void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); },
    card: () => { void replay(cardPlayer); void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); },
    result: (won: boolean) => { void replay(resultPlayer); void Haptics.notificationAsync(won ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning); },
  }), [cardPlayer, chipPlayer, replay, resultPlayer]);
}
