import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Bet } from "@/types/database";
import type { SortMode } from "@/features/home/hooks/sortBets";

type BetRow = Database["public"]["Tables"]["bets"]["Row"];

export const ACTIVE_BETS_PAGE_SIZE = 80;

export async function fetchActiveBets(
  selectedCategory: string | null,
  sort: SortMode = "newest",
  limit = ACTIVE_BETS_PAGE_SIZE,
  offset = 0,
) {
  let query = supabase.from("bets").select("*").eq("is_active", true);

  if (selectedCategory) {
    query = query.eq("category_id", selectedCategory);
  }

  if (sort === "popular") {
    query = query
      .order("bet_count", { ascending: false })
      .order("created_at", { ascending: false });
  } else if (sort === "ending_soon") {
    query = query
      .order("ends_at", { ascending: true })
      .order("created_at", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as Bet[];
}

export async function fetchBetsByIds(ids: string[]) {
  if (ids.length === 0) {
    return [] as Bet[];
  }

  const { data, error } = await supabase.from("bets").select("*").in("id", ids);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as Bet[];
}

export function subscribeToBetsChanges(
  onChange: (payload: RealtimePostgresChangesPayload<BetRow>) => void,
) {
  const channel = supabase
    .channel("bets-realtime")
    .on<BetRow>(
      "postgres_changes",
      { event: "*", schema: "public", table: "bets" },
      onChange,
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
