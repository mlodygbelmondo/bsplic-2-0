import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { useEffect, useRef, useState } from 'react';

import { authActions, useBalance, useUserId } from '@/features/auth/auth-store';
import { kv } from '@/lib/storage';
import { toast } from '@/lib/toast';
import { requestSpin, SlotRpcError, slotStateQuery, slotStateRootKey } from './api';
import {
  BALANCE_REFRESH_FAILED_MESSAGE,
  isFinalSpinError,
  parsePending,
  pendingKey,
  slotErrorMessage,
  type PendingSpin,
  type SlotGame,
  type SlotSpin,
} from './model';

/**
 * Port of the web `useSlotGame`: live state query, idempotent spin requests
 * whose id survives app restarts (same storage key as the web), friendly
 * errors and balance refresh. Returns `null` from `spin` on failure.
 */
export function useSlotGame(game: SlotGame) {
  const userId = useUserId();
  const balance = useBalance();
  const queryClient = useQueryClient();
  const key = pendingKey(userId ?? '', game);
  const [pending, setPending] = useState<PendingSpin | null>(() => parsePending(kv.getString(key)));
  // The user id can arrive after mount (cold-start link): read that user's pending spin then.
  const [pendingFor, setPendingFor] = useState(key);
  if (pendingFor !== key) {
    setPendingFor(key);
    setPending(parsePending(kv.getString(key)));
  }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const state = useQuery(slotStateQuery(userId, game));

  const forgetPending = () => {
    kv.remove(key);
    if (alive.current) setPending(null);
  };

  const spin = async (stake: number, bonusOnly = false): Promise<SlotSpin | null> => {
    if (lock.current || !userId) return null;
    lock.current = true;
    setBusy(true);
    setError(null);
    const retry = pending !== null;
    const request = pending ?? { id: Crypto.randomUUID(), stake, bonusOnly };
    setPending(request);
    kv.set(key, JSON.stringify(request));
    try {
      const result = await requestSpin(game, request).catch((caught: unknown) => {
        if (caught instanceof SlotRpcError && isFinalSpinError(caught.code)) forgetPending();
        throw caught;
      });
      forgetPending();
      // A retried request returns the stored result with that spin's old balance; the refresh below has the real one.
      if (!retry) authActions.updateProfileBalance(result.balance);
      return result;
    } catch (caught) {
      const message =
        caught && typeof caught === 'object' && 'message' in caught ? String((caught as { message: unknown }).message) : '';
      const friendly = slotErrorMessage(message);
      if (alive.current) {
        setError(friendly);
        toast.error(friendly);
      }
      return null;
    } finally {
      void queryClient.invalidateQueries({ queryKey: slotStateRootKey(userId) });
      lock.current = false;
      if (alive.current) setBusy(false);
      void authActions.refreshProfile().catch(() => toast.error(BALANCE_REFRESH_FAILED_MESSAGE));
    }
  };

  /** When the cached state last changed; read after a spin, when older fetches are already cancelled. */
  const readStateUpdatedAt = () => queryClient.getQueryState(slotStateQuery(userId, game).queryKey)?.dataUpdatedAt ?? 0;

  return { state, spin, readStateUpdatedAt, busy, pending, error, balance: Number(balance) };
}
