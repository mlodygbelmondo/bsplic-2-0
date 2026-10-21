import { useEffect, useState } from 'react';

import { authActions, useAuthStore } from '@/features/auth/auth-store';
import { queryClient } from '@/lib/query-client';
import { useRealtimeChannel } from '@/lib/realtime';
import { useAppActive, useScreenActive } from '@/lib/focus';

import { prepareCasinoWinChime } from '../../shared/audio';
import { rouletteHistoryQuery, rouletteLiveSnapshotQuery } from '../api/queries';
import {
  advanceRouletteRoundIfDue,
  getRouletteTableSnapshot,
  listenToRouletteRounds,
  placeRouletteBet,
  rouletteRoundsChannelName,
} from '../api/roulette';
import { celebrateRouletteWin, registerRouletteController } from './actions';
import { rouletteSession, useRouletteSession } from './sessionStore';
import { createRouletteTableController, type RouletteTableController } from './tableController';
import { createInitialTableState, rouletteTableStore } from './tableStore';

function createScreenController(): RouletteTableController {
  // A fresh visit never shows the previous live round: reset before the first
  // render, seeding only past spins and wins from the cache.
  rouletteTableStore.setState(createInitialTableState(queryClient.getQueryData(rouletteHistoryQuery().queryKey)), true);
  rouletteSession.reset();

  return createRouletteTableController({
    store: rouletteTableStore,
    api: {
      getSnapshot: () => getRouletteTableSnapshot(),
      getInitialSnapshot: () => queryClient.fetchQuery(rouletteLiveSnapshotQuery()),
      placeBet: placeRouletteBet,
      advance: () => advanceRouletteRoundIfDue(),
    },
    identity: () => {
      const { user, profile } = useAuthStore.getState();
      return { userId: user?.id ?? '', username: profile?.username ?? 'Ty', avatarUrl: profile?.avatar_url ?? null };
    },
    refreshProfile: () => authActions.refreshProfile(),
    onBetAccepted: (bet) => {
      // The server already took the stake; show it in the balance chip now and
      // let the profile refresh confirm it.
      const balance = Number(useAuthStore.getState().profile?.balance ?? 0);
      authActions.updateProfileBalance(Math.round((balance - bet.stake) * 100) / 100);
    },
    onSnapshot: (snapshot) => {
      queryClient.setQueryData(rouletteLiveSnapshotQuery().queryKey, snapshot);
      queryClient.setQueryData(rouletteHistoryQuery().queryKey, {
        recentSpins: snapshot.recentSpins,
        recentWins: snapshot.recentWins,
      });
    },
  });
}

/**
 * Runs the shared table while the roulette screen is mounted: polling and
 * resync only while it is focused (or under the stake sheet) and the app is in
 * the foreground (resuming always reads the server state), realtime round
 * changes while focused, win tracking.
 */
export function useRouletteTableSync(userId: string) {
  const [controller] = useState(createScreenController);
  const screenActive = useScreenActive();
  const appActive = useAppActive();
  // The stake form sheet blurs the table screen, but the round goes on under it.
  const stakeSheetOpen = useRouletteSession((state) => state.stakeSheetOpen);
  const active = screenActive || (appActive && stakeSheetOpen);

  useEffect(() => {
    registerRouletteController(controller);
    prepareCasinoWinChime();
    return () => {
      registerRouletteController(null);
      controller.dispose();
    };
  }, [controller]);

  useEffect(() => {
    controller.setActive(active);
  }, [controller, active]);

  useEffect(
    () =>
      rouletteTableStore.subscribe((table) => {
        if (rouletteSession.syncWithTable(table, userId)) celebrateRouletteWin();
      }),
    [userId],
  );

  useRealtimeChannel(
    rouletteRoundsChannelName(),
    (channel) => listenToRouletteRounds(channel, () => void controller.syncSnapshot()),
    { onSubscribed: () => void controller.syncSnapshot() },
  );
}
