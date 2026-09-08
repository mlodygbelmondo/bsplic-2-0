import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { spinSchema, stateSchema, type SlotGame, type SlotSpin } from "./model";

interface PendingSpin {
  id: string;
  stake: number;
}
const pendingKey = (userId: string, game: SlotGame) =>
  `bsplic:slot-pending:v1:${userId}:${game}`;
function readPending(key: string): PendingSpin | null {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    const parsed = z
      .object({
        id: z.string().uuid(),
        stake: z.number().finite().min(1),
      })
      .safeParse(raw);
    if (parsed.success) return { id: parsed.data.id, stake: parsed.data.stake };
  } catch {
    /* Storage can be unavailable in private browsing. */
  }
  return null;
}
const errorMessages: Record<string, string> = {
  INSUFFICIENT_BALANCE: "Za mało środków. Zmniejsz stawkę.",
  BONUS_STAKE_LOCKED:
    "Darmowe obroty zachowują stawkę z momentu zdobycia bonusu.",
  INVALID_STAKE: "Wpisz poprawną stawkę minimum 1 zł.",
  AUTH_REQUIRED: "Zaloguj się ponownie.",
};
export function useSlotGame(game: SlotGame) {
  const { user, profile, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const key = pendingKey(user?.id ?? "", game);
  const [pending, setPending] = useState<PendingSpin | null>(() =>
    readPending(key),
  );
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
  const queryKey = ["slots", user?.id, game];
  const state = useQuery({
    queryKey,
    enabled: Boolean(user),
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("casino_slot_state", {
        p_game: game,
      });
      if (error) throw error;
      return stateSchema.parse(data);
    },
  });
  const spin = useCallback(
    async (stake: number): Promise<SlotSpin | null> => {
      if (lock.current || !user) return null;
      lock.current = true;
      setBusy(true);
      setError(null);
      const request = pending ?? { id: crypto.randomUUID(), stake };
      setPending(request);
      try {
        localStorage.setItem(key, JSON.stringify(request));
      } catch {
        /* In-memory retry still preserves the request ID. */
      }
      try {
        const { data, error: rpcError } = await supabase.rpc(
          "casino_slot_spin",
          { p_game: game, p_stake: request.stake, p_request_id: request.id },
        );
        if (rpcError) {
          if (rpcError.code === "P0001" || rpcError.code === "PGRST202") {
            try {
              localStorage.removeItem(key);
            } catch {
              /* See above. */
            }
            if (alive.current) setPending(null);
          }
          throw rpcError;
        }
        const result = spinSchema.parse(data);
        try {
          localStorage.removeItem(key);
        } catch {
          /* See above. */
        }
        if (alive.current) setPending(null);
        return result;
      } catch (caught) {
        const message =
          caught && typeof caught === "object" && "message" in caught
            ? String(caught.message)
            : "";
        const friendly =
          errorMessages[message] ??
          "Nie udało się potwierdzić obrotu. Ponów sprawdzenie tego samego obrotu.";
        if (alive.current) {
          setError(friendly);
          toast.error(friendly);
        }
        return null;
      } finally {
        void queryClient.invalidateQueries({ queryKey: ["slots", user.id] });
        lock.current = false;
        if (alive.current) setBusy(false);
        void refreshProfile().catch(() =>
          toast.error("Nie udało się odświeżyć salda."),
        );
      }
    },
    [game, key, pending, queryClient, refreshProfile, user],
  );
  return {
    state,
    spin,
    busy,
    pending,
    error,
    balance: Number(profile?.balance ?? 0),
  };
}
