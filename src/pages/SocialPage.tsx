import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { SocialCouponEntry } from "@/types/database";
import { cn } from "@/lib/utils";
import { Link, useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ChevronUp, Copy, Loader2 } from "lucide-react";
import { getDisplayedCouponOdds } from "@/features/coupons/display";
import { useCoupon } from "@/contexts/CouponContext";
import { buildCouponItemsFromSocial } from "@/features/social/copyCoupon";
import { fetchBetsByIds } from "@/features/home/api/bets";
import { toast } from "sonner";

export default function SocialPage() {
  const [coupons, setCoupons] = useState<SocialCouponEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCoupons, setExpandedCoupons] = useState<Set<string>>(
    new Set(),
  );
  const [copyingCoupons, setCopyingCoupons] = useState<Set<string>>(new Set());
  const { addItems, setPreferredCouponType } = useCoupon();
  const navigate = useNavigate();

  const toggleCoupon = (couponId: string) => {
    setExpandedCoupons((prev) => {
      const next = new Set(prev);
      if (next.has(couponId)) next.delete(couponId);
      else next.add(couponId);
      return next;
    });
  };

  useEffect(() => {
    supabase
      .rpc("get_social_coupon_feed", { p_limit: 50, p_offset: 0 })
      .then(({ data }) => {
        if (data) setCoupons(data as unknown as SocialCouponEntry[]);
        setLoading(false);
      });
  }, []);

  const isAko = (c: SocialCouponEntry) => c.legs !== null && c.legs.length > 1;

  const formatEventsCount = (count: number) => {
    if (count === 1) return `${count} zdarzenie`;
    const lastTwoDigits = count % 100;
    if (lastTwoDigits >= 12 && lastTwoDigits <= 14) return `${count} zdarzeń`;
    const lastDigit = count % 10;
    if (lastDigit >= 2 && lastDigit <= 4) return `${count} zdarzenia`;
    return `${count} zdarzeń`;
  };

  const setCouponCopying = (couponId: string, isCopying: boolean) => {
    setCopyingCoupons((previous) => {
      const next = new Set(previous);
      if (isCopying) {
        next.add(couponId);
      } else {
        next.delete(couponId);
      }
      return next;
    });
  };

  const handleCopyCoupon = async (coupon: SocialCouponEntry) => {
    const legs = coupon.legs ?? [];
    const betIds = Array.from(
      new Set(
        legs
          .map((leg) => leg.bet_id)
          .filter((betId): betId is string => Boolean(betId)),
      ),
    );

    if (betIds.length === 0) {
      toast.error("Ten kupon nie zawiera zdarzeń możliwych do skopiowania");
      return;
    }

    setCouponCopying(coupon.id, true);

    try {
      const bets = await fetchBetsByIds(betIds);
      const { items, skippedCount } = buildCouponItemsFromSocial({
        legs,
        bets,
      });

      if (items.length === 0) {
        toast.error(
          "Wszystkie zdarzenia z tego kuponu są już niedostępne lub rozliczone",
        );
        return;
      }

      addItems(items);
      setPreferredCouponType(items.length > 1 ? "ako" : "single");

      if (skippedCount > 0) {
        toast.success(
          `Skopiowano ${formatEventsCount(items.length)}, pominięto ${formatEventsCount(skippedCount)}`,
        );
      } else {
        toast.success(`Skopiowano kupon: ${formatEventsCount(items.length)}`);
      }

      navigate("/");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Nie udało się skopiować kuponu";
      toast.error(message);
    } finally {
      setCouponCopying(coupon.id, false);
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "przed chwilą";
    if (minutes < 60) return `${minutes} min temu`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} godz. temu`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} dn. temu`;
    return new Date(dateStr).toLocaleDateString("pl-PL");
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-3xl mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Social</h1>

        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : coupons.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg font-medium">Brak kuponów</p>
            <p className="text-sm mt-1">Nikt jeszcze nie postawił zakładu.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {coupons.map((coupon) => {
              const ako = isAko(coupon);
              const expanded = expandedCoupons.has(coupon.id);
              const isCopying = copyingCoupons.has(coupon.id);
              const displayedOdds = getDisplayedCouponOdds({
                totalOdds: Number(coupon.total_odds),
                legs: (coupon.legs ?? []).map((leg) => ({
                  oddsAtTime: Number(leg.odds_at_time),
                })),
              });

              return (
                <div
                  key={coupon.id}
                  className="bg-card rounded-xl card-shadow overflow-hidden"
                >
                  {/* User header */}
                  <div className="flex items-center justify-between px-4 pt-3 pb-1">
                    <Link
                      to={`/profile/${coupon.user_id}`}
                      className="flex items-center gap-2 group"
                    >
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary group-hover:bg-primary/20 transition-colors">
                        {coupon.username.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-semibold group-hover:text-primary transition-colors">
                        {coupon.username}
                      </span>
                    </Link>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground">
                        {formatTimeAgo(coupon.created_at)}
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleCopyCoupon(coupon)}
                        disabled={isCopying}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-muted disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                        aria-label="Skopiuj kupon"
                      >
                        {isCopying ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                        Skopiuj kupon
                      </button>
                    </div>
                  </div>

                  {/* Coupon content */}
                  <button
                    type="button"
                    className="flex items-center justify-between px-4 py-2 w-full text-sm text-left"
                    onClick={() => ako && toggleCoupon(coupon.id)}
                  >
                    <div className="min-w-0 flex-1">
                      {ako ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary">
                            AKO {coupon.legs!.length}
                          </span>
                          <span className="font-medium text-xs text-muted-foreground">
                            kurs {displayedOdds.toFixed(2)}
                          </span>
                          {expanded ? (
                            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </div>
                      ) : (
                        <>
                          <p className="font-medium truncate">
                            {coupon.legs?.[0]?.bet_title || "Zakład"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {coupon.legs?.[0]?.selected_option} • kurs{" "}
                            {displayedOdds.toFixed(2)}
                          </p>
                        </>
                      )}
                    </div>
                    <div className="text-right ml-3 shrink-0">
                      <p className="font-bold">
                        {Number(coupon.stake).toFixed(2)} zł
                      </p>
                      <p
                        className={cn(
                          "text-xs font-medium",
                          coupon.status === "won"
                            ? "text-success"
                            : coupon.status === "lost"
                              ? "text-destructive"
                              : "text-muted-foreground",
                        )}
                      >
                        {coupon.status === "won"
                          ? `+${Number(coupon.payout).toFixed(2)} zł`
                          : coupon.status === "lost"
                            ? "Przegrana"
                            : "W toku"}
                      </p>
                    </div>
                  </button>

                  {/* AKO legs */}
                  {ako && expanded && (
                    <div className="border-t border-border px-4 pb-3 pt-2 space-y-1.5">
                      {coupon.legs!.map((leg) => (
                        <div
                          key={leg.id}
                          className="flex items-center justify-between text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">
                              {leg.bet_title || "Zakład"}
                            </p>
                            <p className="text-muted-foreground">
                              {leg.selected_option} • kurs{" "}
                              {Number(leg.odds_at_time).toFixed(2)}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "ml-2 shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded",
                              leg.result === "won"
                                ? "bg-success/10 text-success"
                                : leg.result === "lost"
                                  ? "bg-destructive/10 text-destructive"
                                  : "bg-muted-foreground/10 text-muted-foreground",
                            )}
                          >
                            {leg.result === "won"
                              ? "Wygrana"
                              : leg.result === "lost"
                                ? "Przegrana"
                                : "W toku"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
