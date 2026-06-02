import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { CasinoHistoryEntry, CouponHistoryEntry } from "@/types/database";

export type ProfileHistoryType = "sportsbook" | "casino";
export type SportsbookHistoryFilter =
  | "all"
  | "won"
  | "lost"
  | "pending"
  | "refund";

export const HISTORY_PREVIEW_SIZE = 10;
const HISTORY_PREVIEW_FETCH_LIMIT = HISTORY_PREVIEW_SIZE + 1;
const HISTORY_BATCH_SIZE = 30;
const HISTORY_BATCH_FETCH_LIMIT = HISTORY_BATCH_SIZE + 1;

function toCasinoHistoryEntries(data: unknown): CasinoHistoryEntry[] {
  return ((data as CasinoHistoryEntry[] | null) ?? []).map((entry) => ({
    ...entry,
    stake: Number(entry.stake),
    payout: Number(entry.payout),
  }));
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
  const [coupons, setCoupons] = useState<CouponHistoryEntry[]>([]);
  const [casinoHistory, setCasinoHistory] = useState<CasinoHistoryEntry[]>([]);
  const [filter, setFilter] = useState<SportsbookHistoryFilter>("all");
  const [historyType, setHistoryType] =
    useState<ProfileHistoryType>("sportsbook");
  const [loadingCoupons, setLoadingCoupons] = useState(true);
  const [loadingCasinoHistory, setLoadingCasinoHistory] = useState(false);
  const [loadingMoreCoupons, setLoadingMoreCoupons] = useState(false);
  const [loadingMoreCasinoHistory, setLoadingMoreCasinoHistory] =
    useState(false);
  const [sportsbookPreviewLoaded, setSportsbookPreviewLoaded] = useState(false);
  const [casinoPreviewLoaded, setCasinoPreviewLoaded] = useState(false);
  const [sportsbookHistoryExpanded, setSportsbookHistoryExpanded] =
    useState(false);
  const [casinoHistoryExpanded, setCasinoHistoryExpanded] = useState(false);
  const [hasMoreCoupons, setHasMoreCoupons] = useState(false);
  const [hasMoreCasinoHistory, setHasMoreCasinoHistory] = useState(false);
  const [sportsbookHistoryError, setSportsbookHistoryError] = useState<
    string | null
  >(null);
  const [casinoHistoryError, setCasinoHistoryError] = useState<string | null>(
    null,
  );
  const [expandedCoupons, setExpandedCoupons] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    setLoadingCoupons(false);
    setLoadingCasinoHistory(false);
    setCoupons([]);
    setCasinoHistory([]);
    setHasMoreCoupons(false);
    setHasMoreCasinoHistory(false);
    setSportsbookPreviewLoaded(false);
    setCasinoPreviewLoaded(false);
    setSportsbookHistoryExpanded(false);
    setCasinoHistoryExpanded(false);
    setSportsbookHistoryError(null);
    setCasinoHistoryError(null);
    setExpandedCoupons(new Set());
  }, [targetUserId]);

  useEffect(() => {
    if (
      !targetUserId ||
      historyType !== "sportsbook" ||
      sportsbookPreviewLoaded
    ) {
      return;
    }
    let cancelled = false;

    setLoadingCoupons(true);
    setSportsbookHistoryError(null);

    const loadSportsbookHistoryPreview = async () => {
      try {
        const { data, error } = await supabase.rpc("get_user_coupon_history", {
          p_user_id: targetUserId,
          p_limit: HISTORY_PREVIEW_FETCH_LIMIT,
          p_offset: 0,
        });
        if (error) throw error;
        const entries = (data as CouponHistoryEntry[] | null) ?? [];
        if (cancelled) return;
        setCoupons(entries.slice(0, HISTORY_PREVIEW_SIZE));
        setHasMoreCoupons(entries.length > HISTORY_PREVIEW_SIZE);
        setSportsbookPreviewLoaded(true);
      } catch (error) {
        console.error("Failed to load sportsbook history", error);
        if (cancelled) return;
        setHasMoreCoupons(false);
        setSportsbookHistoryError("Nie udało się załadować historii zakładów");
      } finally {
        if (!cancelled) {
          setLoadingCoupons(false);
        }
      }
    };

    void loadSportsbookHistoryPreview();

    return () => {
      cancelled = true;
    };
  }, [historyType, sportsbookPreviewLoaded, targetUserId]);

  useEffect(() => {
    if (!targetUserId || historyType !== "casino" || casinoPreviewLoaded) {
      return;
    }
    let cancelled = false;

    setLoadingCasinoHistory(true);
    setCasinoHistoryError(null);

    const loadCasinoHistoryPreview = async () => {
      try {
        const { data, error } = await supabase.rpc("get_user_casino_history", {
          p_user_id: targetUserId,
          p_limit: HISTORY_PREVIEW_FETCH_LIMIT,
          p_offset: 0,
        });
        if (error) throw error;
        const entries = toCasinoHistoryEntries(data);
        if (cancelled) return;
        setCasinoHistory(entries.slice(0, HISTORY_PREVIEW_SIZE));
        setHasMoreCasinoHistory(entries.length > HISTORY_PREVIEW_SIZE);
        setCasinoPreviewLoaded(true);
      } catch (error) {
        console.error("Failed to load casino history", error);
        if (cancelled) return;
        setHasMoreCasinoHistory(false);
        setCasinoHistoryError("Nie udało się załadować historii kasyna");
      } finally {
        if (!cancelled) {
          setLoadingCasinoHistory(false);
        }
      }
    };

    void loadCasinoHistoryPreview();

    return () => {
      cancelled = true;
    };
  }, [casinoPreviewLoaded, historyType, targetUserId]);

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
      const entries = (data as CouponHistoryEntry[] | null) ?? [];
      setCoupons((prev) => [...prev, ...entries.slice(0, HISTORY_BATCH_SIZE)]);
      setHasMoreCoupons(entries.length > HISTORY_BATCH_SIZE);
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
      setCasinoHistory((prev) => [
        ...prev,
        ...entries.slice(0, HISTORY_BATCH_SIZE),
      ]);
      setHasMoreCasinoHistory(entries.length > HISTORY_BATCH_SIZE);
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
