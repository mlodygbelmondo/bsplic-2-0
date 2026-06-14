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
import { SectionLoader } from '@/components/SectionLoader';
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
  lockEditableOptionsByType,
  parseWinningOptions,
  toEditableOptions,
} from '../helpers';
import type { EditableBetOption } from '../helpers';
import { settleBetWithBackend, type CorrectionScope, type SettlementMode } from '../settlementApi';
import { filterBets, type BetStatusFilter, type BetTypeFilter } from './manageBetsFilters';

type ResolveStep = 'selection' | 'non_multi_warning';

interface BetEditor {
  id: string;
  title: string;
  categoryId: string;
  betType: EditableBetType;
  options: EditableBetOption[];
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
  const [statusFilter, setStatusFilter] = useState<BetStatusFilter>('all');
  const [betTypeFilter, setBetTypeFilter] = useState<BetTypeFilter>('all');
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
    return filterBets({
      bets,
      search,
      status: statusFilter,
      betType: betTypeFilter,
    });
  }, [bets, search, statusFilter, betTypeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paginated = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  // Reset page when search changes
  useEffect(() => { setPage(0); }, [search, statusFilter, betTypeFilter]);

  // --- Editor ---
  const openEditor = (bet: Bet) => {
    const betType = normalizeType(bet.bet_type);
    const options = lockEditableOptionsByType(betType, toEditableOptions(normalizeOptions(bet.options)));
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
      oddsRaw: option.odds.trim(),
    }));
    if (cleanedOptions.some((option) => !option.name)) { toast.error('Uzupełnij etykiety wszystkich opcji'); return; }

    const invalidOddsIndex = cleanedOptions.findIndex((option) => {
      const odds = Number(option.oddsRaw);
      return !option.oddsRaw || !Number.isFinite(odds) || odds <= 0;
    });
    if (invalidOddsIndex !== -1) { toast.error(`Podaj poprawny kurs dla opcji ${invalidOddsIndex + 1}`); return; }

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
          options: cleanedOptions.map((option) => ({
            name: option.name,
            odds: Number(option.oddsRaw),
          })) as Json,
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
      await settleBetWithBackend({
        betId: bet.id,
        winningOptionNames,
        mode,
        scope,
      });

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
      if (isRefund) return <span className="text-[11px] border border-muted-foreground/30 bg-muted/50 text-muted-foreground px-2 py-0.5 rounded-md font-semibold tracking-wide">ZWROT</span>;
      if (isForceLost) return <span className="text-[11px] border border-destructive/30 bg-destructive/10 text-destructive px-2 py-0.5 rounded-md font-semibold tracking-wide">PRZEGRANA</span>;
      return <span className="text-[11px] border border-success/30 bg-success/10 text-success px-2 py-0.5 rounded-md font-semibold tracking-wide">ROZSTRZYGNIĘTY</span>;
    }
    if (bet.is_active) return <span className="text-[11px] border border-primary/30 bg-primary/10 text-primary px-2 py-0.5 rounded-md font-semibold tracking-wide">AKTYWNY</span>;
    return <span className="text-[11px] border border-muted-foreground/30 bg-muted/50 text-muted-foreground px-2 py-0.5 rounded-md font-semibold tracking-wide">ZAMKNIĘTY</span>;
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
      <div className="mb-6 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Szukaj zakładów..."
              className="pl-10 bg-card border-border h-11 rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.25)] focus-visible:ring-primary/20"
              aria-label="Szukaj zakładów"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:w-auto md:min-w-[360px]">
            <Select value={statusFilter} onValueChange={(value: BetStatusFilter) => setStatusFilter(value)}>
              <SelectTrigger className="h-11 rounded-xl bg-card shadow-[0_8px_24px_rgba(0,0,0,0.25)]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie statusy</SelectItem>
                <SelectItem value="active">Aktywne</SelectItem>
                <SelectItem value="resolved">Rozstrzygnięte</SelectItem>
                <SelectItem value="closed">Zamknięte</SelectItem>
              </SelectContent>
            </Select>

            <Select value={betTypeFilter} onValueChange={(value: BetTypeFilter) => setBetTypeFilter(value)}>
              <SelectTrigger className="h-11 rounded-xl bg-card shadow-[0_8px_24px_rgba(0,0,0,0.25)]">
                <SelectValue placeholder="Typ zakładu" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie typy</SelectItem>
                <SelectItem value="single">Single</SelectItem>
                <SelectItem value="12">1/2</SelectItem>
                <SelectItem value="1x2">1X2</SelectItem>
                <SelectItem value="multi">Multi</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Pagination — top */}
      {!loading && filtered.length > PAGE_SIZE && (
        <PaginationBar currentPage={safePage} totalPages={totalPages} onPageChange={setPage} className="mb-4" />
      )}

      {/* Mobile card list */}
      <div className="space-y-4 md:hidden pb-20">
        {loading ? (
          <SectionLoader label="Wczytywanie zakładów..." />
        ) : paginated.length === 0 ? (
          <div className="text-center bg-card border border-border rounded-xl p-8 text-muted-foreground">Brak zakładów</div>
        ) : (
          paginated.map((bet) => (
            <div key={bet.id} className="bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-bold text-[15px] leading-tight text-foreground line-clamp-2">{bet.title}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{bet.bet_type}</span>
                      {bet.is_bsplicboost && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-primary">
                          <Sparkles className="h-3 w-3" /> BOOST
                        </span>
                      )}
                      <span className="text-[11px] text-muted-foreground font-medium">{bet.bet_count} zakł.</span>
                    </div>
                  </div>
                  <div className="shrink-0">{statusBadge(bet)}</div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Button size="sm" variant="secondary" className="min-h-11 justify-center rounded-lg text-sm font-medium" onClick={() => openEditor(bet)} aria-label={`Edytuj ${bet.title}`}>
                    Edytuj
                  </Button>
                  <Button
                    size="sm"
                    variant="default"
                    className="min-h-11 justify-center rounded-lg text-sm font-semibold gradient-primary shadow-sm"
                    onClick={() => openResolveModal(bet)}
                    disabled={resolvingBetId === bet.id}
                  >
                    {resolvingBetId === bet.id
                      ? <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      : <Trophy className="h-3 w-3 mr-1" />}
                    {bet.winning_option ? 'Korekta' : 'Wynik'}
                  </Button>
                  {!bet.winning_option && (
                    <Button size="sm" variant="outline" className="min-h-11 justify-center rounded-lg text-sm font-medium border-border hover:bg-muted" onClick={() => resolveBet(bet, [], 'refund')} disabled={resolvingBetId === bet.id}>
                      <RotateCcw className="h-3 w-3 mr-1" /> 1.00
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="min-h-11 w-full p-0 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => deleteBet(bet)} disabled={deletingBetId === bet.id} aria-label={`Usuń ${bet.title}`}>
                    {deletingBetId === bet.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <SectionLoader label="Wczytywanie zakładów..." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1060px] table-fixed text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-4 py-3">Tytuł</th>
                  <th className="w-[130px] whitespace-nowrap px-5 py-3">Typ</th>
                  <th className="w-[130px] whitespace-nowrap px-5 py-3">Zakłady</th>
                  <th className="w-[170px] whitespace-nowrap px-5 py-3">Status</th>
                  <th className="w-[360px] whitespace-nowrap px-4 py-3 text-left">Akcje</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Brak zakładów</td></tr>
                ) : paginated.map((bet) => (
                  <tr key={bet.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium truncate">{bet.title}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span>{bet.bet_type}</span>
                        {bet.is_bsplicboost && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                            <Sparkles className="h-3 w-3" /> BOOST
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">{bet.bet_count}</td>
                    <td className="px-5 py-3">{statusBadge(bet)}</td>
                    <td className="w-[360px] px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 w-[132px] justify-center rounded-lg bg-background"
                          onClick={() => openEditor(bet)}
                          aria-label={`Edytuj ${bet.title}`}
                        >
                          <Pencil className="mr-2 h-3.5 w-3.5" />
                          Edytuj
                        </Button>

                        <Button
                          size="sm"
                          variant="default"
                          className="h-9 w-[168px] justify-center rounded-lg gradient-primary shadow-sm"
                          onClick={() => openResolveModal(bet)}
                          disabled={resolvingBetId === bet.id}
                          aria-label={`${bet.winning_option ? 'Korekta wyniku dla' : 'Ogłoś wynik dla'} ${bet.title}`}
                        >
                          {resolvingBetId === bet.id
                            ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                            : <Trophy className="mr-2 h-3.5 w-3.5" />}
                          {bet.winning_option ? 'Korekta wyniku' : 'Ogłoś wynik'}
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Więcej opcji">
                              <MoreHorizontal className="h-3.5 w-3.5 text-foreground" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            {!bet.winning_option && (
                              <>
                                <DropdownMenuItem onClick={() => resolveBet(bet, [], 'refund')} disabled={resolvingBetId === bet.id}>
                                  <RotateCcw className="h-3.5 w-3.5 mr-2 text-foreground" />
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
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-2xl max-h-[calc(var(--app-viewport-height,100svh)-2rem)] overflow-y-auto p-4 sm:p-6">
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
                    onValueChange={(v: EditableBetType) => setEditing((p) => p ? { ...p, betType: v, options: lockEditableOptionsByType(v, p.options) } : p)}
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
                    <Input type="number" step="0.01" min="1" value={option.odds} onChange={(e) => setEditing((p) => { if (!p) return p; const o = [...p.options]; o[index].odds = e.target.value; return { ...p, options: o }; })} className="w-20" />
                    {!hasFixedOptionCount && editing.options.length > 2 && (
                      <button type="button" onClick={() => setEditing((p) => p ? { ...p, options: p.options.filter((_, i) => i !== index) } : p)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={`Usuń opcję ${index + 1}`}>
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
                {!hasFixedOptionCount && (
                  <Button type="button" variant="outline" size="sm" className="min-h-11 justify-center text-sm sm:min-h-0 sm:h-9" onClick={() => setEditing((p) => p ? { ...p, options: [...p.options, { name: '', odds: '2' }] } : p)}>
                    <Plus className="h-3 w-3 mr-1" /> Dodaj opcję
                  </Button>
                )}
              </div>

              <Button onClick={updateBet} disabled={editorLoading} className="min-h-11 w-full justify-center gradient-primary text-primary-foreground font-bold">
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
                    <label className="flex items-center gap-2 rounded-md border border-border p-2 cursor-pointer hover:bg-muted/40">
                      <RadioGroupItem value="pending_only" />
                      <span className="text-xs">
                        Tylko zakłady nadal <span className="font-semibold">pending</span>
                      </span>
                    </label>
                    <label className="flex items-center gap-2 rounded-md border border-border p-2 cursor-pointer hover:bg-muted/40">
                      <RadioGroupItem value="all" />
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
                    className="min-h-11 w-full justify-center gradient-primary text-primary-foreground font-bold mt-2"
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
                    <Button variant="outline" className="min-h-11 flex-1 justify-center" onClick={() => setResolveStep('selection')} disabled={isResolveInProgress}>
                      Wróć
                    </Button>
                    <Button className="min-h-11 flex-1 justify-center gradient-primary text-primary-foreground" onClick={submitNormalSettlement} disabled={isResolveInProgress}>
                      {isResolveInProgress ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                      Potwierdź
                    </Button>
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-border" />
              {resolveModal.is_bsplicboost && (
                <Button variant="outline" className="min-h-11 w-full justify-center" onClick={() => submitSpecialSettlement('force_lost')} disabled={isResolveInProgress}>
                  <CircleOff className="h-4 w-4 mr-2 text-foreground" /> Ogłoś przegraną (wszyscy)
                </Button>
              )}
              <Button variant="outline" className="min-h-11 w-full justify-center" onClick={() => submitSpecialSettlement('refund')} disabled={isResolveInProgress}>
                <RotateCcw className="h-4 w-4 mr-2 text-foreground" /> Rozlicz 1.00 (zwrot)
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
      <PaginationContent className="w-full flex-wrap justify-center gap-2 md:flex-nowrap">
        <PaginationItem className="shrink-0">
          <PaginationLink
            onClick={() => onPageChange(Math.max(0, currentPage - 1))}
            size="default"
            className={cn('gap-1 px-3 cursor-pointer select-none', currentPage === 0 && 'pointer-events-none opacity-50')}
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
              <PaginationItem key={p} className="shrink-0">
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

        <PaginationItem className="shrink-0">
          <PaginationLink
            onClick={() => onPageChange(Math.min(totalPages - 1, currentPage + 1))}
            size="default"
            className={cn('gap-1 px-3 cursor-pointer select-none', currentPage >= totalPages - 1 && 'pointer-events-none opacity-50')}
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
