import { useEffect, useState } from 'react';
import { useStore } from 'zustand';

import { authActions } from '@/features/auth/auth-store';
import { useIsOffline } from '@/lib/connectivity';
import { useScreenActive } from '@/lib/focus';
import { useReducedMotion } from '@/lib/motion';
import { queryClient } from '@/lib/query-client';
import { toast } from '@/lib/toast';
import {
  blackjackDeclineInsurance,
  blackjackDoubleDown,
  blackjackHit,
  blackjackSplit,
  blackjackStand,
  blackjackTakeInsurance,
  getBlackjackTableInfo,
  getCurrentBlackjackGame,
  placeBlackjackBet,
} from '../api/blackjack';
import { blackjackSnapshotQuery } from '../api/queries';
import { createBlackjackGame, type BlackjackApi, type BlackjackSnapshotCache } from '../logic/game';
import { loadBlackjackSfx, playBlackjackHaptic, playBlackjackSound, unloadBlackjackSfx } from '../sfx/blackjackSfx';

const API: BlackjackApi = {
  getTableInfo: getBlackjackTableInfo,
  getCurrentGame: getCurrentBlackjackGame,
  placeBet: placeBlackjackBet,
  hit: blackjackHit,
  stand: blackjackStand,
  doubleDown: blackjackDoubleDown,
  split: blackjackSplit,
  takeInsurance: blackjackTakeInsurance,
  declineInsurance: blackjackDeclineInsurance,
};

function snapshotCache(userId: string): BlackjackSnapshotCache {
  const { queryKey } = blackjackSnapshotQuery(userId);
  return {
    read: () => queryClient.getQueryData(queryKey),
    write: (snapshot) => queryClient.setQueryData(queryKey, snapshot),
    remove: () => queryClient.removeQueries({ queryKey }),
  };
}

/**
 * One blackjack table per screen mount. Live state comes from the server on
 * every mount, focus and foreground; leaving the screen mid-reveal lands the
 * result at once instead of replaying it later.
 */
export function useBlackjackTable(userId: string) {
  // Bumped on every on-screen win; the screen fires confetti per value.
  const [celebration, setCelebration] = useState(0);
  const [game] = useState(() =>
    createBlackjackGame({
      userId,
      api: API,
      cache: snapshotCache(userId),
      refreshProfile: authActions.refreshProfile,
      sound: playBlackjackSound,
      haptic: playBlackjackHaptic,
      onError: (message) => toast.error(message),
      onSettled: (status, { offscreen }) => {
        if (status !== 'won') return;
        toast.success('Blackjack: wygrana!');
        if (!offscreen) setCelebration((value) => value + 1);
      },
    }),
  );

  const reducedMotion = useReducedMotion();
  useEffect(() => {
    game.setReducedMotion(reducedMotion);
  }, [game, reducedMotion]);

  useEffect(() => {
    // Send the table requests before creating the sound players.
    game.start();
    loadBlackjackSfx();
    return () => {
      game.stop();
      unloadBlackjackSfx();
    };
  }, [game]);

  const screenActive = useScreenActive();
  useEffect(() => {
    game.setActive(screenActive);
  }, [game, screenActive]);

  const offline = useIsOffline();
  useEffect(() => {
    game.setOnline(!offline);
  }, [game, offline]);

  const state = useStore(game.store);

  return { game, state, celebration, offline };
}
