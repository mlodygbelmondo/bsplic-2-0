import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  casinoHistoryPreviewQuery,
  HISTORY_PREVIEW_SIZE,
  sportsbookHistoryPreviewQuery,
  toCasinoHistoryEntries,
} from "@/features/profile/api/profileQueries";
import { supabase } from "@/integrations/supabase/client";
import type { CasinoHistoryEntry, CouponHistoryEntry } from "@/types/database";

export { HISTORY_PREVIEW_SIZE };

export type ProfileHistoryType = "sportsbook" | "casino";
export type SportsbookHistoryFilter =
  | "all"
  | "won"
  | "lost"
  | "pending"
  | "refund";

const HISTORY_BATCH_SIZE = 30;
const HISTORY_BATCH_FETCH_LIMIT = HISTORY_BATCH_SIZE + 1;

// The preview is refreshed in the background, so an entry loaded with "show
// more" can shift into it; keep the first occurrence.
function mergeById<Entry extends { id: string }>(
  preview: Entry[],
  more: Entry[],
): Entry[] {
  const seen = new Set(preview.map((entry) => entry.id));
  return [...preview, ...more.filter((entry) => !seen.has(entry.id))];
}

export interface ProfileHistoryState {
  historyType: ProfileHistoryType;
  setHistoryType: (type: ProfileHistoryType) => void;
  filter: SportsbookHistoryFilter;
  setFilter: (filter: SportsbookHistoryFilter) => void;
  coupons: CouponHistoryEntry[];
  casinoHistory: CasinoHistoryEntry[];
  loadingCoupons: boolean;
  loadingCasinoHistory: boolean;
  loadingMoreCoupons: boolean;
  loadingMoreCasinoHistory: boolean;
  sportsbookHistoryExpanded: boolean;
  casinoHistoryExpanded: boolean;
  hasMoreCoupons: boolean;
  hasMoreCasinoHistory: boolean;
  sportsbookHistoryError: string | null;
  casinoHistoryError: string | null;
  expandedCoupons: Set<string>;
  toggleCoupon: (couponId: string) => void;
  showMoreSportsbookHistory: () => void;
  collapseSportsbookHistory: () => void;
  showMoreCasinoHistory: () => void;
  collapseCasinoHistory: () => void;
}

export function useProfileHistory(
  targetUserId: string | null,
): ProfileHistoryState {
  const [filter, setFilter] = useState<SportsbookHistoryFilter>("all");
  const [historyType, setHistoryType] =
    useState<ProfileHistoryType>("sportsbook");
  const [moreCoupons, setMoreCoupons] = useState<CouponHistoryEntry[]>([]);
  const [moreCasinoHistory, setMoreCasinoHistory] = useState<
    CasinoHistoryEntry[]
  >([]);
  // null until "show more" loads a batch; before that the preview decides.
  const [moreCouponsAvailable, setMoreCouponsAvailable] = useState<
    boolean | null
  >(null);
  const [moreCasinoHistoryAvailable, setMoreCasinoHistoryAvailable] =
    useState<boolean | null>(null);
  const [loadingMoreCoupons, setLoadingMoreCoupons] = useState(false);
  const [loadingMoreCasinoHistory, setLoadingMoreCasinoHistory] =
    useState(false);
  const [sportsbookHistoryExpanded, setSportsbookHistoryExpanded] =
    useState(false);
  const [casinoHistoryExpanded, setCasinoHistoryExpanded] = useState(false);
  const [expandedCoupons, setExpandedCoupons] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    setMoreCoupons([]);
    setMoreCasinoHistory([]);
    setMoreCouponsAvailable(null);
    setMoreCasinoHistoryAvailable(null);
    setSportsbookHistoryExpanded(false);
    setCasinoHistoryExpanded(false);
    setExpandedCoupons(new Set());
  }, [targetUserId]);

  const sportsbookPreview = useQuery({
    ...sportsbookHistoryPreviewQuery(targetUserId ?? ""),
    enabled: Boolean(targetUserId),
  });
  const casinoPreview = useQuery({
    ...casinoHistoryPreviewQuery(targetUserId ?? ""),
    enabled: Boolean(targetUserId) && historyType === "casino",
  });

  useEffect(() => {
    if (sportsbookPreview.error) {
      console.error(
        "Failed to load sportsbook history",
        sportsbookPreview.error,
      );
    }
  }, [sportsbookPreview.error]);

  useEffect(() => {
    if (casinoPreview.error) {
      console.error("Failed to load casino history", casinoPreview.error);
    }
  }, [casinoPreview.error]);

  const coupons = useMemo(
    () => mergeById(sportsbookPreview.data?.entries ?? [], moreCoupons),
    [moreCoupons, sportsbookPreview.data],
  );
  const casinoHistory = useMemo(
    () => mergeById(casinoPreview.data?.entries ?? [], moreCasinoHistory),
    [casinoPreview.data, moreCasinoHistory],
  );
  const hasMoreCoupons =
    moreCouponsAvailable ?? sportsbookPreview.data?.hasMore ?? false;
  const hasMoreCasinoHistory =
    moreCasinoHistoryAvailable ?? casinoPreview.data?.hasMore ?? false;
  // Cached data stays on screen during a background refresh; only a first
  // load without data shows the loader or the error.
  const loadingCoupons = Boolean(targetUserId) && sportsbookPreview.isPending;
  const loadingCasinoHistory =
    Boolean(targetUserId) &&
    historyType === "casino" &&
    casinoPreview.isPending;
  const sportsbookHistoryError =
    sportsbookPreview.isError && !sportsbookPreview.data
      ? "Nie udało się załadować historii zakładów"
      : null;
  const casinoHistoryError =
    casinoPreview.isError && !casinoPreview.data
      ? "Nie udało się załadować historii kasyna"
      : null;

  const toggleCoupon = (couponId: string) => {
    setExpandedCoupons((prev) => {
      const next = new Set(prev);
      if (next.has(couponId)) next.delete(couponId);
      else next.add(couponId);
      return next;
    });
  };

  const loadMoreSportsbookHistory = async () => {
    if (!targetUserId || loadingMoreCoupons) return;
    setLoadingMoreCoupons(true);

    try {
      const { data, error } = await supabase.rpc("get_user_coupon_history", {
        p_user_id: targetUserId,
        p_limit: HISTORY_BATCH_FETCH_LIMIT,
        p_offset: coupons.length,
      });
      if (error) throw error;
      const entries = (data as unknown as CouponHistoryEntry[] | null) ?? [];
      setMoreCoupons((prev) => [
        ...prev,
        ...entries.slice(0, HISTORY_BATCH_SIZE),
      ]);
      setMoreCouponsAvailable(entries.length > HISTORY_BATCH_SIZE);
      setSportsbookHistoryExpanded(true);
    } catch (error) {
      console.error("Failed to load more sportsbook history", error);
      toast.error("Nie udało się załadować kolejnych zakładów");
    } finally {
      setLoadingMoreCoupons(false);
    }
  };

  const showMoreSportsbookHistory = () => {
    if (!sportsbookHistoryExpanded && coupons.length > HISTORY_PREVIEW_SIZE) {
      setSportsbookHistoryExpanded(true);
      return;
    }

    void loadMoreSportsbookHistory();
  };

  const loadMoreCasinoHistory = async () => {
    if (!targetUserId || loadingMoreCasinoHistory) return;
    setLoadingMoreCasinoHistory(true);

    try {
      const { data, error } = await supabase.rpc("get_user_casino_history", {
        p_user_id: targetUserId,
        p_limit: HISTORY_BATCH_FETCH_LIMIT,
        p_offset: casinoHistory.length,
      });
      if (error) throw error;
      const entries = toCasinoHistoryEntries(data);
      setMoreCasinoHistory((prev) => [
        ...prev,
        ...entries.slice(0, HISTORY_BATCH_SIZE),
      ]);
      setMoreCasinoHistoryAvailable(entries.length > HISTORY_BATCH_SIZE);
      setCasinoHistoryExpanded(true);
    } catch (error) {
      console.error("Failed to load more casino history", error);
      toast.error("Nie udało się załadować kolejnych wpisów kasyna");
    } finally {
      setLoadingMoreCasinoHistory(false);
    }
  };

  const showMoreCasinoHistory = () => {
    if (!casinoHistoryExpanded && casinoHistory.length > HISTORY_PREVIEW_SIZE) {
      setCasinoHistoryExpanded(true);
      return;
    }

    void loadMoreCasinoHistory();
  };

  return {
    historyType,
    setHistoryType,
    filter,
    setFilter,
    coupons,
    casinoHistory,
    loadingCoupons,
    loadingCasinoHistory,
    loadingMoreCoupons,
    loadingMoreCasinoHistory,
    sportsbookHistoryExpanded,
    casinoHistoryExpanded,
    hasMoreCoupons,
    hasMoreCasinoHistory,
    sportsbookHistoryError,
    casinoHistoryError,
    expandedCoupons,
    toggleCoupon,
    showMoreSportsbookHistory,
    collapseSportsbookHistory: () => setSportsbookHistoryExpanded(false),
    showMoreCasinoHistory,
    collapseCasinoHistory: () => setCasinoHistoryExpanded(false),
  };
}
