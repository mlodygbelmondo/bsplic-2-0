import { useMemo, useState } from "react";

import { Navigate } from "react-router-dom";
import { toast } from "sonner";

import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useMarketAssets } from "@/features/markets/hooks/useMarketAssets";
import { useMarketQuotes } from "@/features/markets/hooks/useMarketQuotes";
import { useFxRatesToPln } from "@/features/markets/hooks/useFxRates";
import { useMarketTransactions } from "@/features/markets/hooks/useMarketTransactions";
import { buildAssetBalancesById } from "@/features/markets/balances";
import {
  buildAssetPosition,
  calculatePortfolioSummary,
} from "@/features/markets/portfolio";
import {
  convertPriceToPln,
  roundAssetAmount,
} from "@/features/markets/pricing";
import {
  parseAssetAmount,
  validateAssetAmount,
  validateCashStake,
} from "@/features/markets/assets";
import { placeMarketOrderSecure } from "@/features/markets/api";
import { MarketAsset, MarketAssetType } from "@/types/markets";

const FILTERS: Array<{ value: MarketAssetType | "all"; label: string }> = [
  { value: "all", label: "Wszystkie" },
  { value: "stock", label: "Akcje" },
  { value: "etf", label: "ETF" },
  { value: "crypto", label: "Krypto" },
  { value: "forex", label: "Forex" },
  { value: "commodity", label: "Surowce" },
];

const SIDE_LABEL: Record<"buy" | "sell", string> = {
  buy: "Kup",
  sell: "Sprzedaj",
};

const TYPE_LABEL: Record<MarketAssetType, string> = {
  stock: "Akcja",
  etf: "ETF",
  crypto: "Krypto",
  forex: "Forex",
  commodity: "Surowiec",
};

export default function MarketsPage() {
  const { user, loading, refreshProfile } = useAuth();

  const {
    data: assets = [],
    isLoading: assetsLoading,
    refetch: refetchAssets,
  } = useMarketAssets();
  const {
    data: quotesPayload,
    isLoading: quotesLoading,
    isFetching: quotesFetching,
    refetch: refetchQuotes,
  } = useMarketQuotes(assets, {
    refetchIntervalMs: 15_000,
    staleTimeMs: 10_000,
    refetchOnWindowFocus: true,
  });
  const {
    data: fxRates = { PLN: 1 },
    isLoading: fxLoading,
    refetch: refetchFx,
  } = useFxRatesToPln();
  const {
    data: transactions = [],
    isLoading: transactionsLoading,
    refetch: refetchTransactions,
  } = useMarketTransactions(user?.id);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<MarketAssetType | "all">("all");
  const [selectedAssetId, setSelectedAssetId] = useState<string>("");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [quantityInput, setQuantityInput] = useState("1");
  const [placingOrder, setPlacingOrder] = useState(false);

  const quotesBySymbol = useMemo(
    () => quotesPayload?.quotesBySymbol ?? {},
    [quotesPayload?.quotesBySymbol],
  );

  const visibleAssets = useMemo(() => {
    const term = search.trim().toLowerCase();

    return assets.filter((asset) => {
      if (typeFilter !== "all" && asset.type !== typeFilter) return false;
      if (!term) return true;

      return (
        asset.display_name.toLowerCase().includes(term) ||
        asset.symbol.toLowerCase().includes(term)
      );
    });
  }, [assets, search, typeFilter]);

  const selectedAsset = useMemo(() => {
    return assets.find((asset) => asset.id === selectedAssetId) ?? null;
  }, [assets, selectedAssetId]);

  const selectedQuote = selectedAsset
    ? quotesBySymbol[selectedAsset.symbol.toUpperCase()]
    : null;
  const selectedUnitPricePln = selectedQuote
    ? convertPriceToPln({
        price: selectedQuote.price,
        quoteCurrency: selectedQuote.quoteCurrency,
        fxRatesToPln: fxRates,
      })
    : null;

  const balancesByAssetId = useMemo(
    () => buildAssetBalancesById(transactions),
    [transactions],
  );
  const selectedAssetBalance = selectedAsset
    ? (balancesByAssetId[selectedAsset.id] ?? 0)
    : 0;

  const positions = useMemo(() => {
    const byAssetId = new Map<string, typeof transactions>();
    transactions.forEach((transaction) => {
      const list = byAssetId.get(transaction.asset_id) ?? [];
      list.push(transaction);
      byAssetId.set(transaction.asset_id, list);
    });

    return assets
      .map((asset) => {
        const quote = quotesBySymbol[asset.symbol.toUpperCase()] ?? null;
        return buildAssetPosition({
          asset,
          transactions: byAssetId.get(asset.id) ?? [],
          quote,
          fxRatesToPln: fxRates,
        });
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  }, [assets, fxRates, quotesBySymbol, transactions]);

  const portfolioSummary = useMemo(
    () => calculatePortfolioSummary(positions),
    [positions],
  );

  const quantityValue = parseAssetAmount(quantityInput);
  const orderValuePln =
    quantityValue && selectedUnitPricePln
      ? Math.round(quantityValue * selectedUnitPricePln * 100) / 100
      : 0;

  const placeOrder = async () => {
    if (!user) {
      toast.error("Zaloguj się ponownie");
      return;
    }

    if (!selectedAsset || !selectedQuote || !selectedUnitPricePln) {
      toast.error("Wybierz aktywo z aktualną ceną");
      return;
    }

    if (!quantityValue) {
      toast.error("Podaj poprawną ilość");
      return;
    }

    const quantityError = validateAssetAmount({
      type: selectedAsset.type,
      amount: quantityValue,
    });
    if (quantityError) {
      toast.error(quantityError);
      return;
    }

    const minBetError = validateCashStake({
      amountInPln: orderValuePln,
      minStakePln: Number(selectedAsset.min_bet_pln),
    });
    if (minBetError) {
      toast.error(minBetError);
      return;
    }

    if (side === "sell" && quantityValue > selectedAssetBalance) {
      toast.error(
        `Brak wystarczającej ilości aktywa (masz ${roundAssetAmount(selectedAssetBalance)})`,
      );
      return;
    }

    const quoteCurrency = selectedQuote.quoteCurrency.toUpperCase();
    const fxRateToPln = quoteCurrency === "PLN" ? 1 : fxRates[quoteCurrency];
    if (!fxRateToPln || fxRateToPln <= 0) {
      toast.error(`Brak kursu FX dla ${quoteCurrency}`);
      return;
    }

    setPlacingOrder(true);
    try {
      await placeMarketOrderSecure({
        userId: user.id,
        assetId: selectedAsset.id,
        side,
        quantity: quantityValue,
        unitPrice: selectedQuote.price,
        quoteCurrency,
        fxRateToPln,
      });

      await Promise.all([
        refreshProfile(),
        refetchTransactions(),
        refetchQuotes(),
      ]);

      toast.success(
        `${SIDE_LABEL[side]}: ${quantityValue} ${selectedAsset.symbol}`,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Nie udało się zapisać transakcji";
      toast.error(message);
    } finally {
      setPlacingOrder(false);
    }
  };

  if (loading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/" />;
  }

  const isLoadingPage =
    assetsLoading || quotesLoading || fxLoading || transactionsLoading;

  return (
    <div className="h-safe-screen bg-background overflow-hidden flex flex-col">
      <Navbar />

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-4 space-y-4">
          <div className="bg-card rounded-xl p-4 card-shadow">
            <h1 className="text-2xl font-bold">Giełda</h1>
            <p className="text-xs text-muted-foreground mt-1">
              {quotesFetching
                ? "Aktualizuję notowania..."
                : "Notowania aktualizują się automatycznie co pewien czas"}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <StatCard
              label="Wartość portfela"
              value={`${portfolioSummary.totalValuePln.toFixed(2)} zł`}
            />
            <StatCard
              label="Koszt nabycia"
              value={`${portfolioSummary.totalCostBasisPln.toFixed(2)} zł`}
            />
            <StatCard
              label="Niezrealizowany P/L"
              value={`${portfolioSummary.totalUnrealizedPnlPln >= 0 ? "+" : ""}${portfolioSummary.totalUnrealizedPnlPln.toFixed(2)} zł`}
              accent={
                portfolioSummary.totalUnrealizedPnlPln >= 0
                  ? "text-success"
                  : "text-destructive"
              }
            />
            <StatCard
              label="Niezrealizowany P/L %"
              value={`${portfolioSummary.unrealizedPnlPct >= 0 ? "+" : ""}${portfolioSummary.unrealizedPnlPct.toFixed(2)}%`}
              accent={
                portfolioSummary.unrealizedPnlPct >= 0
                  ? "text-success"
                  : "text-destructive"
              }
            />
          </div>

          <div className="bg-card rounded-xl p-4 card-shadow space-y-3">
            <h2 className="font-bold text-lg">Nowa transakcja</h2>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="md:col-span-2 space-y-2">
                <Label>Aktywo</Label>
                <Select
                  value={selectedAssetId}
                  onValueChange={setSelectedAssetId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz aktywo" />
                  </SelectTrigger>
                  <SelectContent>
                    {assets.map((asset) => (
                      <SelectItem key={asset.id} value={asset.id}>
                        {asset.symbol} - {asset.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Strona</Label>
                <Select
                  value={side}
                  onValueChange={(value: "buy" | "sell") => setSide(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buy">Kup</SelectItem>
                    <SelectItem value="sell">Sprzedaj</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Ilość</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.00000001"
                  value={quantityInput}
                  onChange={(event) => setQuantityInput(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Wartość</Label>
                <Input value={`${orderValuePln.toFixed(2)} zł`} disabled />
              </div>
            </div>

            {selectedAsset && (
              <p className="text-xs text-muted-foreground">
                Min. wartość transakcji:{" "}
                {Number(selectedAsset.min_bet_pln).toFixed(2)} zł • Dostępna
                ilość: {roundAssetAmount(selectedAssetBalance)}
              </p>
            )}

            <Button
              onClick={placeOrder}
              disabled={placingOrder || isLoadingPage || !selectedAssetId}
            >
              {placingOrder ? "Zapisywanie..." : `${SIDE_LABEL[side]} aktywo`}
            </Button>
          </div>

          <div className="bg-card rounded-xl p-4 card-shadow space-y-3">
            <div className="flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
              <h2 className="font-bold text-lg">Rynek</h2>
              <div className="flex gap-2">
                <Input
                  placeholder="Szukaj po nazwie lub symbolu"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                <Select
                  value={typeFilter}
                  onValueChange={(value: MarketAssetType | "all") =>
                    setTypeFilter(value)
                  }
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FILTERS.map((filter) => (
                      <SelectItem key={filter.value} value={filter.value}>
                        {filter.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isLoadingPage ? (
              <div className="space-y-2">
                {[...Array(6)].map((_, index) => (
                  <Skeleton key={index} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-border text-muted-foreground">
                      <th className="p-2">Symbol</th>
                      <th className="p-2">Nazwa</th>
                      <th className="p-2">Typ</th>
                      <th className="p-2">Cena</th>
                      <th className="p-2">Cena (PLN)</th>
                      <th className="p-2">Aktualizacja</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleAssets.map((asset) => {
                      const quote =
                        quotesBySymbol[asset.symbol.toUpperCase()] ?? null;
                      const unitPricePln = quote
                        ? convertPriceToPln({
                            price: quote.price,
                            quoteCurrency: quote.quoteCurrency,
                            fxRatesToPln: fxRates,
                          })
                        : null;

                      return (
                        <tr
                          key={asset.id}
                          className="border-b border-border/60"
                        >
                          <td className="p-2 font-semibold">{asset.symbol}</td>
                          <td className="p-2">{asset.display_name}</td>
                          <td className="p-2">{TYPE_LABEL[asset.type]}</td>
                          <td className="p-2">
                            {quote
                              ? `${quote.price.toFixed(4)} ${quote.quoteCurrency}`
                              : "Brak danych"}
                          </td>
                          <td className="p-2">
                            {unitPricePln
                              ? `${unitPricePln.toFixed(2)} zł`
                              : "Brak FX"}
                          </td>
                          <td className="p-2 text-xs text-muted-foreground">
                            {quote
                              ? new Date(quote.asOf).toLocaleString("pl-PL")
                              : "--"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="bg-card rounded-xl p-4 card-shadow">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold ${accent ?? ""}`}>{value}</p>
    </div>
  );
}
