import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { Bet, BetOption, Category } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Plus, X, Check, Trophy, RotateCcw, CircleOff, Sparkles, Search, Pencil, MoreHorizontal, Trash2, ChevronLeft, ChevronRight, Loader2, AlertTriangle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationEllipsis,
} from '@/components/ui/pagination';
import confetti from 'canvas-confetti';
import {
  BET_WINNING_OPTION_REFUND,
  BET_WINNING_OPTION_FORCED_LOSS,
  NO_CATEGORY_VALUE,
} from '../constants';
import type { EditableBetType } from '../constants';
import {
  getErrorMessage,
  toInputDateTime,
  normalizeType,
  normalizeOptions,
  lockOptionsByType,
  normalizeCouponStatus,
  encodeWinningOptions,
  parseWinningOptions,
} from '../helpers';
import {
  addCreditForUser,
  calculateCreditDeltaAmount,
  calculateLegOutcome,
  type CouponSettlementSnapshot,
} from '../settlement';

type SettlementMode = 'normal' | 'refund' | 'force_lost';
type CorrectionScope = 'pending_only' | 'all';
type ResolveStep = 'selection' | 'non_multi_warning';

interface BetEditor {
  id: string;
  title: string;
  categoryId: string;
  betType: EditableBetType;
  options: BetOption[];
  endsAt: string;
  isLive: boolean;
  isBsplicboost: boolean;
  isActive: boolean;
}

const PAGE_SIZE = 15;

export default function ManageBetsTab() {
  const [bets, setBets] = useState<Bet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & pagination
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  // Editor
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorLoading, setEditorLoading] = useState(false);
  const [editing, setEditing] = useState<BetEditor | null>(null);

  // Resolve
  const [resolveModal, setResolveModal] = useState<Bet | null>(null);
  const [selectedWinners, setSelectedWinners] = useState<string[]>([]);
  const [resolveStep, setResolveStep] = useState<ResolveStep>('selection');
  const [correctionScope, setCorrectionScope] = useState<CorrectionScope>('pending_only');

  // Resolve loading
  const [resolvingBetId, setResolvingBetId] = useState<string | null>(null);

  // Delete
  const [deletingBetId, setDeletingBetId] = useState<string | null>(null);

  const isResolveInProgress = Boolean(resolveModal && resolvingBetId === resolveModal.id);

  const closeResolveModal = () => {
    if (isResolveInProgress) return;
    setResolveModal(null);
    setSelectedWinners([]);
    setResolveStep('selection');
    setCorrectionScope('pending_only');
  };

  const fetchBets = async () => {
    setLoading(true);
    try {
      const [{ data: betRows, error: betError }, { data: categoryRows, error: categoryError }] = await Promise.all([
        supabase.from('bets').select('*').order('created_at', { ascending: false }),
        supabase.from('categories').select('*').order('sort_order'),
      ]);
      if (betError) throw betError;
      if (categoryError) throw categoryError;
      setBets((betRows as unknown as Bet[]) || []);
      setCategories((categoryRows as Category[]) || []);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Nie udało się pobrać zakładów'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBets(); }, []);

  // Filtered + paginated
  const filtered = useMemo(() => {
    if (!search.trim()) return bets;
    const q = search.toLowerCase();
    return bets.filter((b) => b.title.toLowerCase().includes(q));
  }, [bets, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paginated = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  // Reset page when search changes
  useEffect(() => { setPage(0); }, [search]);

  // --- Editor ---
  const openEditor = (bet: Bet) => {
    const betType = normalizeType(bet.bet_type);
    const options = lockOptionsByType(betType, normalizeOptions(bet.options));
    setEditing({
      id: bet.id,
      title: bet.title,
      categoryId: bet.category_id || '',
      betType,
      options,
      endsAt: toInputDateTime(bet.ends_at),
      isLive: Boolean(bet.is_live),
      isBsplicboost: Boolean(bet.is_bsplicboost),
      isActive: Boolean(bet.is_active),
    });
    setEditorOpen(true);
  };

  const updateBet = async () => {
    if (!editing) return;
    if (!editing.title.trim()) { toast.error('Tytuł jest wymagany'); return; }

    const cleanedOptions = editing.options.map((option) => ({
      name: option.name.trim(),
      odds: Number(option.odds) > 0 ? Number(option.odds) : 1,
    }));
    if (cleanedOptions.some((option) => !option.name)) { toast.error('Uzupełnij etykiety wszystkich opcji'); return; }

    const minOptions = editing.betType === 'single' ? 1 : 2;
    if (cleanedOptions.length < minOptions) { toast.error('Zakład musi mieć minimum ' + minOptions + ' opcj' + (minOptions === 1 ? 'ę' : 'e')); return; }

    const endsAtDate = new Date(editing.endsAt);
    if (Number.isNaN(endsAtDate.getTime())) { toast.error('Wybierz poprawną datę zakończenia'); return; }

    setEditorLoading(true);
    try {
      const { error } = await supabase
        .from('bets')
        .update({
          title: editing.title.trim(),
          category_id: editing.categoryId || null,
          bet_type: editing.betType,
          options: cleanedOptions as Json,
          ends_at: endsAtDate.toISOString(),
          is_live: editing.isLive,
          is_bsplicboost: editing.isBsplicboost,
          is_active: editing.isActive,
        })
        .eq('id', editing.id);
      if (error) throw error;
      toast.success('Zakład zaktualizowany');
      setEditorOpen(false);
      setEditing(null);
      fetchBets();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Nie udało się zaktualizować zakładu'));
    } finally {
      setEditorLoading(false);
    }
  };

  // --- Resolve (multi-winner aware) ---
  const openResolveModal = (bet: Bet) => {
    const existingWinners = parseWinningOptions(bet.winning_option).filter(
      (winner) => winner !== BET_WINNING_OPTION_REFUND && winner !== BET_WINNING_OPTION_FORCED_LOSS,
    );
    setResolveModal(bet);
    setSelectedWinners(existingWinners);
    setResolveStep('selection');
    setCorrectionScope('pending_only');
  };

  const toggleWinner = (optionName: string) => {
    setSelectedWinners((prev) =>
      prev.includes(optionName)
        ? prev.filter((n) => n !== optionName)
        : [...prev, optionName]
    );
  };

  const resolveBet = async (
    bet: Bet,
    winningOptionNames: string[],
    mode: SettlementMode = 'normal',
    scope: CorrectionScope = 'pending_only',
  ) => {
    setResolvingBetId(bet.id);
    const isCorrection = Boolean(bet.winning_option);
    try {
      const winningOptionForDb =
        mode === 'refund'
          ? BET_WINNING_OPTION_REFUND
          : mode === 'force_lost'
            ? BET_WINNING_OPTION_FORCED_LOSS
            : encodeWinningOptions(winningOptionNames);

      const { error: betUpdateError } = await supabase
        .from('bets')
        .update({ winning_option: winningOptionForDb, is_active: false })
        .eq('id', bet.id);
      if (betUpdateError) throw betUpdateError;

      const { data: placedBets, error: placedBetsError } = await supabase
        .from('placed_bets')
        .select('*')
        .eq('bet_id', bet.id);
      if (placedBetsError) throw placedBetsError;

      let creditsByUser: Record<string, number> = {};
      const includeAlreadyResolved = scope === 'all';

      // For multi-winner, a placed bet wins if its selected_option is in the winning set
      const winningOptionForLeg = mode === 'normal' ? winningOptionNames : [];

      if (placedBets) {
        for (const pb of placedBets) {
          if (!includeAlreadyResolved && pb.result !== 'pending') continue;

          const previousLegResult = normalizeCouponStatus(pb.result);
          const previousLegPayout = Number(pb.payout ?? 0);

          let couponBefore: CouponSettlementSnapshot | null = null;
          if (pb.coupon_id) {
            const { data: coupon } = await supabase
              .from('coupons')
              .select('stake, total_odds, status, payout')
              .eq('id', pb.coupon_id)
              .single();
            if (coupon) {
              couponBefore = {
                stake: Number(coupon.stake),
                totalOdds: Number(coupon.total_odds),
                status: normalizeCouponStatus(coupon.status),
                payout: Number(coupon.payout ?? 0),
              };
            }
          }

          // Multi-winner: selectedOption matches if it's in the winners array
          const effectiveWinningOption =
            mode === 'normal' && winningOptionForLeg.includes(pb.selected_option)
              ? pb.selected_option
              : mode === 'normal'
                ? '__no_match__'
                : '';

          const legOutcome = calculateLegOutcome({
            selectedOption: pb.selected_option,
            winningOption: effectiveWinningOption,
            stake: Number(pb.stake),
            oddsAtTime: Number(pb.odds_at_time),
            mode,
          });

          const legUpdatePayload = { result: legOutcome.result, payout: legOutcome.payout };

          const { error: legUpdateError } = await supabase
            .from('placed_bets')
            .update(legUpdatePayload)
            .eq('id', pb.id);
          if (legUpdateError) throw legUpdateError;

          let couponAfter: CouponSettlementSnapshot | null = null;
          if (pb.coupon_id) {
            const { data: coupon } = await supabase
              .from('coupons')
              .select('stake, total_odds, status, payout')
              .eq('id', pb.coupon_id)
              .single();
            if (coupon) {
              couponAfter = {
                stake: Number(coupon.stake),
                totalOdds: Number(coupon.total_odds),
                status: normalizeCouponStatus(coupon.status),
                payout: Number(coupon.payout ?? 0),
              };
            }
          }

          const creditAmount = calculateCreditDeltaAmount({
            previousLegResult,
            previousLegPayout,
            nextLegResult: legOutcome.result,
            nextLegPayout: legOutcome.payout,
            couponBefore,
            couponAfter,
          });

          creditsByUser = addCreditForUser({
            creditsByUser,
            userId: pb.user_id,
            amount: creditAmount,
          });
        }

        for (const [userId, creditAmount] of Object.entries(creditsByUser)) {
          if (creditAmount === 0) continue;
          const { error: creditError } = await supabase.rpc('admin_credit_balance', {
            p_user_id: userId,
            p_amount: creditAmount,
          });
          if (creditError) throw creditError;
        }
      }

      if (mode === 'refund') {
        toast.success(isCorrection ? 'Korekta zapisana jako zwrot' : 'Zakład rozliczony jako zwrot');
      } else if (mode === 'force_lost') {
        toast.success(isCorrection ? 'Korekta zapisana jako przegrana dla wszystkich' : 'Zakład rozliczony jako przegrany dla wszystkich');
      } else {
        toast.success(isCorrection ? 'Korekta wyniku zapisana' : 'Wynik ogłoszony!');
        if (!isCorrection) {
          confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        }
      }
      setResolveModal(null);
      setSelectedWinners([]);
      setResolveStep('selection');
      setCorrectionScope('pending_only');
      fetchBets();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Nie udało się ogłosić wyniku'));
    } finally {
      setResolvingBetId(null);
    }
  };

  // --- Delete ---
  const deleteBet = async (bet: Bet) => {
    const shouldDelete = window.confirm(`Czy na pewno chcesz usunąć zakład "${bet.title}"?`);
    if (!shouldDelete) return;

    setDeletingBetId(bet.id);
    try {
      const { error } = await supabase.from('bets').delete().eq('id', bet.id);
      if (error) throw error;
      if (editing?.id === bet.id) { setEditorOpen(false); setEditing(null); }
      if (resolveModal?.id === bet.id) {
        setResolveModal(null);
        setSelectedWinners([]);
        setResolveStep('selection');
        setCorrectionScope('pending_only');
      }
      toast.success('Zakład usunięty');
      fetchBets();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Nie udało się usunąć zakładu'));
    } finally {
      setDeletingBetId(null);
    }
  };

  const hasFixedOptionCount = editing ? editing.betType === 'single' || editing.betType === '12' || editing.betType === '1x2' : false;

  const statusBadge = (bet: Bet) => {
    if (bet.winning_option) {
      const winners = parseWinningOptions(bet.winning_option);
      const isRefund = winners.includes(BET_WINNING_OPTION_REFUND);
      const isForceLost = winners.includes(BET_WINNING_OPTION_FORCED_LOSS);
      if (isRefund) return <span className="text-xs bg-muted text-muted-foreground px-2.5 py-0.5 rounded-full font-semibold">Zwrot</span>;
      if (isForceLost) return <span className="text-xs bg-destructive/15 text-destructive px-2.5 py-0.5 rounded-full font-semibold">Przegrana</span>;
      return <span className="text-xs bg-success/20 text-success px-2.5 py-0.5 rounded-full font-semibold">Rozstrzygnięty</span>;
    }
    if (bet.is_active) return <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full font-semibold">Aktywny</span>;
    return <span className="text-xs bg-muted text-muted-foreground px-2.5 py-0.5 rounded-full font-semibold">Zamknięty</span>;
  };

  const submitNormalSettlement = () => {
    if (!resolveModal || selectedWinners.length === 0 || isResolveInProgress) return;

    const needsNonMultiConfirmation = resolveModal.bet_type !== 'multi' && selectedWinners.length > 1;
    if (needsNonMultiConfirmation && resolveStep === 'selection') {
      setResolveStep('non_multi_warning');
      return;
    }

    resolveBet(resolveModal, selectedWinners, 'normal', correctionScope);
  };

  const submitSpecialSettlement = (mode: Exclude<SettlementMode, 'normal'>) => {
    if (!resolveModal || isResolveInProgress) return;
    resolveBet(resolveModal, [], mode, correctionScope);
  };

  return (
    <>
      {/* Search bar */}
      <div className="mb-4 flex items-start">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Szukaj zakładów..."
            className="pl-9"
            aria-label="Szukaj zakładów"
          />
        </div>
      </div>

      {/* Pagination — top */}
      {!loading && filtered.length > PAGE_SIZE && (
        <PaginationBar currentPage={safePage} totalPages={totalPages} onPageChange={setPage} className="mb-3" />
      )}

      {/* Mobile card list */}
      <div className="space-y-3 md:hidden">
        {loading ? (
          [...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)
        ) : paginated.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">Brak zakładów</p>
        ) : (
          paginated.map((bet) => (
            <div key={bet.id} className="bg-card rounded-xl p-3 card-shadow">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[15px] truncate">{bet.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-muted-foreground uppercase">{bet.bet_type}</span>
                    {bet.is_bsplicboost && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-primary">
                        <Sparkles className="h-3 w-3" /> BOOST
                      </span>
                    )}
                    <span className="text-[11px] text-muted-foreground">{bet.bet_count} zakł.</span>
                  </div>
                </div>
                {statusBadge(bet)}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="outline" className="h-7 text-[13px]" onClick={() => openEditor(bet)} aria-label={`Edytuj ${bet.title}`}>
                  Edytuj
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[13px]"
                  onClick={() => openResolveModal(bet)}
                  disabled={resolvingBetId === bet.id}
                  aria-label={`${bet.winning_option ? 'Korekta wyniku dla' : 'Ogłoś wynik dla'} ${bet.title}`}
                >
                  {resolvingBetId === bet.id
                    ? <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    : <Trophy className="h-3 w-3 mr-1 text-gray-950" />}
                  {bet.winning_option ? 'Korekta' : 'Wynik'}
                </Button>
                {!bet.winning_option && (
                  <Button size="sm" variant="outline" className="h-7 text-[13px]" onClick={() => resolveBet(bet, [], 'refund')} disabled={resolvingBetId === bet.id}>
                    <RotateCcw className="h-3 w-3 mr-1 text-gray-950" /> 1.00
                  </Button>
                )}
                <Button size="sm" variant="destructive" className="h-7 text-[13px]" onClick={() => deleteBet(bet)} disabled={deletingBetId === bet.id}>
                  {deletingBetId === bet.id ? '...' : 'Usuń'}
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-card rounded-xl card-shadow overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-3">Tytuł</th>
                  <th className="p-3">Typ</th>
                  <th className="p-3">Zakłady</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Akcje</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Brak zakładów</td></tr>
                ) : paginated.map((bet) => (
                  <tr key={bet.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-medium max-w-[200px] truncate">{bet.title}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span>{bet.bet_type}</span>
                        {bet.is_bsplicboost && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                            <Sparkles className="h-3 w-3" /> BOOST
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3">{bet.bet_count}</td>
                    <td className="p-3">{statusBadge(bet)}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-0.5">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => openEditor(bet)}
                              aria-label={`Edytuj ${bet.title}`}
                            >
                              <Pencil className="h-3.5 w-3.5 text-gray-950" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edytuj</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => openResolveModal(bet)}
                              disabled={resolvingBetId === bet.id}
                              aria-label={`${bet.winning_option ? 'Korekta wyniku dla' : 'Ogłoś wynik dla'} ${bet.title}`}
                            >
                              {resolvingBetId === bet.id
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600" />
                                : <Trophy className="h-3.5 w-3.5 text-amber-600" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{bet.winning_option ? 'Korekta wyniku' : 'Ogłoś wynik'}</TooltipContent>
                        </Tooltip>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Więcej opcji">
                              <MoreHorizontal className="h-3.5 w-3.5 text-gray-950" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            {!bet.winning_option && (
                              <>
                                <DropdownMenuItem onClick={() => resolveBet(bet, [], 'refund')} disabled={resolvingBetId === bet.id}>
                                  <RotateCcw className="h-3.5 w-3.5 mr-2 text-gray-950" />
                                  Rozlicz 1.00
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            )}
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive focus:bg-destructive/10"
                              onClick={() => deleteBet(bet)}
                              disabled={deletingBetId === bet.id}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-2" />
                              {deletingBetId === bet.id ? 'Usuwanie…' : 'Usuń zakład'}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination — bottom */}
      {!loading && filtered.length > PAGE_SIZE && (
        <PaginationBar currentPage={safePage} totalPages={totalPages} onPageChange={setPage} className="mt-4" />
      )}

      {/* Edit dialog */}
      <Dialog open={editorOpen} onOpenChange={(open) => { setEditorOpen(open); if (!open) setEditing(null); }}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader><DialogTitle>Edytuj zakład</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Tytuł</Label>
                <Input value={editing.title} onChange={(e) => setEditing((p) => p ? { ...p, title: e.target.value } : p)} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Kategoria</Label>
                  <Select
                    value={editing.categoryId || NO_CATEGORY_VALUE}
                    onValueChange={(v) => setEditing((p) => p ? { ...p, categoryId: v === NO_CATEGORY_VALUE ? '' : v } : p)}
                  >
                    <SelectTrigger><SelectValue placeholder="Wybierz" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_CATEGORY_VALUE}>Brak kategorii</SelectItem>
                      {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.emoji} {c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Typ</Label>
                  <Select
                    value={editing.betType}
                    onValueChange={(v: EditableBetType) => setEditing((p) => p ? { ...p, betType: v, options: lockOptionsByType(v, p.options) } : p)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Single</SelectItem>
                      <SelectItem value="12">1/2</SelectItem>
                      <SelectItem value="1x2">1X2</SelectItem>
                      <SelectItem value="multi">Multi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Data zakończenia</Label>
                <Input type="datetime-local" value={editing.endsAt} onChange={(e) => setEditing((p) => p ? { ...p, endsAt: e.target.value } : p)} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <Label htmlFor="manage-bet-live">Na żywo</Label>
                  <Switch id="manage-bet-live" checked={editing.isLive} onCheckedChange={(c) => setEditing((p) => p ? { ...p, isLive: c } : p)} />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <Label htmlFor="manage-bet-boost">BSPLICBOOST</Label>
                  <Switch id="manage-bet-boost" checked={editing.isBsplicboost} onCheckedChange={(c) => setEditing((p) => p ? { ...p, isBsplicboost: c } : p)} />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <Label htmlFor="manage-bet-active">Aktywny</Label>
                  <Switch id="manage-bet-active" checked={editing.isActive} onCheckedChange={(c) => setEditing((p) => p ? { ...p, isActive: c } : p)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Opcje</Label>
                {editing.options.map((option, index) => (
                  <div key={`${editing.id}-${index}`} className="flex gap-2 items-center">
                    <Input value={option.name} onChange={(e) => setEditing((p) => { if (!p) return p; const o = [...p.options]; o[index].name = e.target.value; return { ...p, options: o }; })} className="flex-1" />
                    <Input type="number" step="0.01" min="1" value={option.odds} onChange={(e) => setEditing((p) => { if (!p) return p; const o = [...p.options]; o[index].odds = Number(e.target.value); return { ...p, options: o }; })} className="w-20" />
                    {!hasFixedOptionCount && editing.options.length > 2 && (
                      <button type="button" onClick={() => setEditing((p) => p ? { ...p, options: p.options.filter((_, i) => i !== index) } : p)} className="text-muted-foreground hover:text-destructive">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
                {!hasFixedOptionCount && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditing((p) => p ? { ...p, options: [...p.options, { name: '', odds: 2 }] } : p)}>
                    <Plus className="h-3 w-3 mr-1" /> Dodaj opcję
                  </Button>
                )}
              </div>

              <Button onClick={updateBet} disabled={editorLoading} className="w-full gradient-primary text-primary-foreground font-bold">
                {editorLoading ? 'Zapisywanie...' : 'Zapisz zmiany'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Resolve dialog — correction + multi-select aware */}
      {resolveModal && (
        <Dialog open={!!resolveModal} onOpenChange={(open) => { if (!open) closeResolveModal(); }}>
          <DialogContent
            className={cn('w-[calc(100vw-2rem)] sm:max-w-md', isResolveInProgress && '[&>button]:hidden')}
            onEscapeKeyDown={(event) => {
              if (isResolveInProgress) event.preventDefault();
            }}
            onPointerDownOutside={(event) => {
              if (isResolveInProgress) event.preventDefault();
            }}
          >
            <DialogHeader>
              <DialogTitle className="text-base">
                {resolveModal.winning_option ? 'Korekta wyniku' : 'Ogłoś wynik'}: {resolveModal.title}
              </DialogTitle>
              <DialogDescription>
                {resolveModal.winning_option
                  ? 'Wybierz nowe rozstrzygnięcie i zakres korekty.'
                  : 'Wybierz opcje, które wygrały.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              {resolveModal.winning_option && (
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs font-medium mb-2">Zakres korekty</p>
                  <RadioGroup
                    value={correctionScope}
                    onValueChange={(value: CorrectionScope) => setCorrectionScope(value)}
                    className="gap-2"
                    aria-label="Zakres korekty wyniku"
                  >
                    <label className="flex items-start gap-2 rounded-md border border-border p-2 cursor-pointer hover:bg-muted/40">
                      <RadioGroupItem value="pending_only" className="mt-1" />
                      <span className="text-xs">
                        Tylko zakłady nadal <span className="font-semibold">pending</span>
                      </span>
                    </label>
                    <label className="flex items-start gap-2 rounded-md border border-border p-2 cursor-pointer hover:bg-muted/40">
                      <RadioGroupItem value="all" className="mt-1" />
                      <span className="text-xs">
                        Wszystkie zakłady (także już rozliczone, z korektą salda)
                      </span>
                    </label>
                  </RadioGroup>
                </div>
              )}

              {resolveStep === 'selection' ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    {resolveModal.bet_type === 'multi'
                      ? 'Kliknij opcje które wygrały (możesz wybrać wiele):'
                      : 'Wybierz wygraną opcję (dla tego typu zwykle 1):'}
                  </p>
                  <div className="space-y-1.5">
                    {(resolveModal.options as unknown as BetOption[]).map((opt) => {
                      const isSelected = selectedWinners.includes(opt.name);
                      return (
                        <button
                          key={opt.name}
                          type="button"
                          onClick={() => toggleWinner(opt.name)}
                          disabled={isResolveInProgress}
                          className={cn(
                            'w-full flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed',
                            isSelected
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border hover:bg-muted',
                          )}
                          aria-pressed={isSelected}
                          aria-label={`Opcja ${opt.name}`}
                        >
                          <span className="flex items-center gap-2">
                            <span className={cn(
                              'h-4 w-4 rounded border flex items-center justify-center transition-colors',
                              isSelected ? 'bg-primary border-primary' : 'border-border',
                            )}>
                              {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                            </span>
                            {opt.name}
                          </span>
                          <span className="text-xs text-muted-foreground">{opt.odds.toFixed(2)}</span>
                        </button>
                      );
                    })}
                  </div>
                  <Button
                    className="w-full gradient-primary text-primary-foreground font-bold mt-2"
                    disabled={selectedWinners.length === 0 || isResolveInProgress}
                    onClick={submitNormalSettlement}
                  >
                    {isResolveInProgress
                      ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      : <Trophy className="h-4 w-4 mr-2" />}
                    {resolveModal.winning_option ? 'Zapisz korektę' : 'Ogłoś wynik'} ({selectedWinners.length} wybranych)
                  </Button>
                </>
              ) : (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-700 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-amber-900">Wybrano więcej niż 1 opcję dla typu {resolveModal.bet_type.toUpperCase()}</p>
                      <p className="text-xs text-amber-800">To niestandardowe rozliczenie. Potwierdź, że chcesz kontynuować.</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setResolveStep('selection')} disabled={isResolveInProgress}>
                      Wróć
                    </Button>
                    <Button className="flex-1 gradient-primary text-primary-foreground" onClick={submitNormalSettlement} disabled={isResolveInProgress}>
                      {isResolveInProgress ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                      Potwierdź
                    </Button>
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-border" />
              {resolveModal.is_bsplicboost && (
                <Button variant="outline" className="w-full justify-start" onClick={() => submitSpecialSettlement('force_lost')} disabled={isResolveInProgress}>
                  <CircleOff className="h-4 w-4 mr-2 text-gray-950" /> Ogłoś przegraną (wszyscy)
                </Button>
              )}
              <Button variant="outline" className="w-full justify-start" onClick={() => submitSpecialSettlement('refund')} disabled={isResolveInProgress}>
                <RotateCcw className="h-4 w-4 mr-2 text-gray-950" /> Rozlicz 1.00 (zwrot)
              </Button>
            </div>
          </DialogContent>
         </Dialog>
      )}
    </>
  );
}

/** Reusable pagination bar built on shadcn Pagination primitives. */
function PaginationBar({
  currentPage,
  totalPages,
  onPageChange,
  className,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  const pages = getPaginationRange(currentPage, totalPages);

  return (
    <Pagination className={className} aria-label="Nawigacja po stronach">
      <PaginationContent>
        <PaginationItem>
          <PaginationLink
            onClick={() => onPageChange(Math.max(0, currentPage - 1))}
            className={cn('gap-1 pl-2.5 cursor-pointer select-none', currentPage === 0 && 'pointer-events-none opacity-50')}
            aria-label="Poprzednia strona"
            aria-disabled={currentPage === 0}
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Wstecz</span>
          </PaginationLink>
        </PaginationItem>

        {pages.map((p, i) =>
          p === 'ellipsis' ? (
            <PaginationItem key={`e-${i}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={p}>
              <PaginationLink
                isActive={p === currentPage}
                onClick={() => onPageChange(p)}
                className="cursor-pointer select-none"
                aria-label={`Strona ${p + 1}`}
                aria-current={p === currentPage ? 'page' : undefined}
              >
                {p + 1}
              </PaginationLink>
            </PaginationItem>
          )
        )}

        <PaginationItem>
          <PaginationLink
            onClick={() => onPageChange(Math.min(totalPages - 1, currentPage + 1))}
            className={cn('gap-1 pr-2.5 cursor-pointer select-none', currentPage >= totalPages - 1 && 'pointer-events-none opacity-50')}
            aria-label="Następna strona"
            aria-disabled={currentPage >= totalPages - 1}
          >
            <span className="hidden sm:inline">Dalej</span>
            <ChevronRight className="h-4 w-4" />
          </PaginationLink>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

/** Returns an array of page indices and 'ellipsis' markers for display. */
function getPaginationRange(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);

  const result: (number | 'ellipsis')[] = [0];

  if (current > 2) result.push('ellipsis');

  const rangeStart = Math.max(1, current - 1);
  const rangeEnd = Math.min(total - 2, current + 1);
  for (let i = rangeStart; i <= rangeEnd; i++) result.push(i);

  if (current < total - 3) result.push('ellipsis');

  result.push(total - 1);
  return result;
}
