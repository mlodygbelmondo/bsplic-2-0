import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { useScreenVisible } from '@/lib/focus';
import { toast } from '@/lib/toast';
import type { CasinoHistoryEntry, CouponHistoryEntry } from '@/types/database';
import {
  casinoHistoryPreviewQueryOptions,
  fetchCasinoHistoryPage,
  fetchSportsbookHistoryPage,
  HISTORY_PREVIEW_SIZE,
  sportsbookHistoryPreviewQueryOptions,
} from '../api/profileQueries';
import { mergeById, type ProfileHistoryType, type SportsbookHistoryFilter } from '../logic/historyRows';

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
  expandedCoupons: ReadonlySet<string>;
  toggleCoupon: (couponId: string) => void;
  showMoreSportsbookHistory: () => void;
  collapseSportsbookHistory: () => void;
  showMoreCasinoHistory: () => void;
  collapseCasinoHistory: () => void;
  /** Pull-to-refresh: refetches the previews that are on screen. */
  refresh: () => Promise<unknown>;
}

interface MoreState {
  coupons: CouponHistoryEntry[];
  casino: CasinoHistoryEntry[];
  /** null until "show more" loads a batch; before that the preview decides. */
  couponsAvailable: boolean | null;
  casinoAvailable: boolean | null;
  sportsbookExpanded: boolean;
  casinoExpanded: boolean;
  expandedCoupons: ReadonlySet<string>;
  /** Bumped whenever the extra pages are dropped: a batch requested before is discarded. */
  generation: number;
}

const INITIAL_MORE_STATE: MoreState = {
  coupons: [],
  casino: [],
  couponsAvailable: null,
  casinoAvailable: null,
  sportsbookExpanded: false,
  casinoExpanded: false,
  expandedCoupons: new Set(),
  generation: 0,
};

/**
 * Port of the web `useProfileHistory`: cached 10-entry previews (casino only
 * once its tab opens), "Pokaż więcej" batches of 30 kept in memory, collapse
 * without dropping them.
 */
export function useProfileHistory(targetUserId: string | null): ProfileHistoryState {
  const [filter, setFilter] = useState<SportsbookHistoryFilter>('all');
  const [historyType, setHistoryType] = useState<ProfileHistoryType>('sportsbook');
  const [more, setMore] = useState<MoreState>(INITIAL_MORE_STATE);
  const [moreTarget, setMoreTarget] = useState(targetUserId);
  const [loadingMoreCoupons, setLoadingMoreCoupons] = useState(false);
  const [loadingMoreCasinoHistory, setLoadingMoreCasinoHistory] = useState(false);

  // A different player resets everything loaded for the previous one
  // (filter and history type stay, like the web).
  if (moreTarget !== targetUserId) {
    setMoreTarget(targetUserId);
    setMore((prev) => ({ ...INITIAL_MORE_STATE, generation: prev.generation + 1 }));
  }

  const active = Boolean(targetUserId);
  // Screens stay mounted under tabs and pushes: refetch whenever on view again, like a web page visit.
  const focused = useScreenVisible();
  const sportsbookPreview = useQuery({
    ...sportsbookHistoryPreviewQueryOptions(targetUserId ?? ''),
    enabled: active,
    subscribed: focused,
  });
  const casinoPreview = useQuery({
    ...casinoHistoryPreviewQueryOptions(targetUserId ?? ''),
    enabled: active && historyType === 'casino',
    subscribed: focused,
  });

  // A preview with different rows shifts the offsets the extra pages were
  // loaded at (new coupons or spins push rows down), so drop those pages. An
  // unchanged refetch (focus back after a sheet) keeps its data object, and the pages.
  const [sportsbookBase, setSportsbookBase] = useState(sportsbookPreview.data);
  const [casinoBase, setCasinoBase] = useState(casinoPreview.data);
  if (sportsbookBase !== sportsbookPreview.data) {
    setSportsbookBase(sportsbookPreview.data);
    if (more.coupons.length > 0 || loadingMoreCoupons) {
      setMore((prev) => ({
        ...prev,
        coupons: [],
        couponsAvailable: null,
        sportsbookExpanded: false,
        generation: prev.generation + 1,
      }));
    }
  }
  if (casinoBase !== casinoPreview.data) {
    setCasinoBase(casinoPreview.data);
    if (more.casino.length > 0 || loadingMoreCasinoHistory) {
      setMore((prev) => ({
        ...prev,
        casino: [],
        casinoAvailable: null,
        casinoExpanded: false,
        generation: prev.generation + 1,
      }));
    }
  }

  useEffect(() => {
    if (sportsbookPreview.error) console.error('Failed to load sportsbook history', sportsbookPreview.error);
  }, [sportsbookPreview.error]);

  useEffect(() => {
    if (casinoPreview.error) console.error('Failed to load casino history', casinoPreview.error);
  }, [casinoPreview.error]);

  const coupons = mergeById(sportsbookPreview.data?.entries ?? [], more.coupons);
  const casinoHistory = mergeById(casinoPreview.data?.entries ?? [], more.casino);
  const hasMoreCoupons = more.couponsAvailable ?? sportsbookPreview.data?.hasMore ?? false;
  const hasMoreCasinoHistory = more.casinoAvailable ?? casinoPreview.data?.hasMore ?? false;
  // Cached data stays on screen during a background refresh; only a first
  // load without data shows the loader or the error.
  const loadingCoupons = Boolean(targetUserId) && sportsbookPreview.isPending;
  const loadingCasinoHistory = Boolean(targetUserId) && historyType === 'casino' && casinoPreview.isPending;
  const sportsbookHistoryError =
    sportsbookPreview.isError && !sportsbookPreview.data ? 'Nie udało się załadować historii zakładów' : null;
  const casinoHistoryError =
    casinoPreview.isError && !casinoPreview.data ? 'Nie udało się załadować historii kasyna' : null;

  const toggleCoupon = (couponId: string) => {
    setMore((prev) => {
      const next = new Set(prev.expandedCoupons);
      if (next.has(couponId)) next.delete(couponId);
      else next.add(couponId);
      return { ...prev, expandedCoupons: next };
    });
  };

  const loadMoreSportsbookHistory = () => {
    if (!targetUserId || loadingMoreCoupons) return;
    const { generation } = more;
    setLoadingMoreCoupons(true);
    fetchSportsbookHistoryPage(targetUserId, coupons.length)
      .then((page) =>
        setMore((prev) =>
          prev.generation !== generation
            ? prev
            : { ...prev, coupons: [...prev.coupons, ...page.entries], couponsAvailable: page.hasMore, sportsbookExpanded: true },
        ),
      )
      .catch((error: unknown) => {
        console.error('Failed to load more sportsbook history', error);
        toast.error('Nie udało się załadować kolejnych zakładów');
      })
      .finally(() => setLoadingMoreCoupons(false));
  };

  const showMoreSportsbookHistory = () => {
    if (!more.sportsbookExpanded && coupons.length > HISTORY_PREVIEW_SIZE) {
      setMore((prev) => ({ ...prev, sportsbookExpanded: true }));
      return;
    }
    loadMoreSportsbookHistory();
  };

  const loadMoreCasinoHistory = () => {
    if (!targetUserId || loadingMoreCasinoHistory) return;
    const { generation } = more;
    setLoadingMoreCasinoHistory(true);
    fetchCasinoHistoryPage(targetUserId, casinoHistory.length)
      .then((page) =>
        setMore((prev) =>
          prev.generation !== generation
            ? prev
            : { ...prev, casino: [...prev.casino, ...page.entries], casinoAvailable: page.hasMore, casinoExpanded: true },
        ),
      )
      .catch((error: unknown) => {
        console.error('Failed to load more casino history', error);
        toast.error('Nie udało się załadować kolejnych wpisów kasyna');
      })
      .finally(() => setLoadingMoreCasinoHistory(false));
  };

  const showMoreCasinoHistory = () => {
    if (!more.casinoExpanded && casinoHistory.length > HISTORY_PREVIEW_SIZE) {
      setMore((prev) => ({ ...prev, casinoExpanded: true }));
      return;
    }
    loadMoreCasinoHistory();
  };

  const refresh = () => {
    if (!active) return Promise.resolve();
    // A pull starts over from fresh previews, like reloading the web page.
    setMore((prev) => ({
      ...INITIAL_MORE_STATE,
      expandedCoupons: prev.expandedCoupons,
      generation: prev.generation + 1,
    }));
    return Promise.all([
      sportsbookPreview.refetch(),
      historyType === 'casino' ? casinoPreview.refetch() : undefined,
    ]);
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
    sportsbookHistoryExpanded: more.sportsbookExpanded,
    casinoHistoryExpanded: more.casinoExpanded,
    hasMoreCoupons,
    hasMoreCasinoHistory,
    sportsbookHistoryError,
    casinoHistoryError,
    expandedCoupons: more.expandedCoupons,
    toggleCoupon,
    showMoreSportsbookHistory,
    collapseSportsbookHistory: () => setMore((prev) => ({ ...prev, sportsbookExpanded: false })),
    showMoreCasinoHistory,
    collapseCasinoHistory: () => setMore((prev) => ({ ...prev, casinoExpanded: false })),
    refresh,
  };
}
