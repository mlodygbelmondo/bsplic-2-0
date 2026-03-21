import { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { Bet, BetOption, Category } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Plus, X, Check, XCircle, Trophy } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Skeleton } from '@/components/ui/skeleton';
import {
  addCreditForUser,
  calculateAssetCreditQuantity,
  calculateCreditAmount,
  calculateLegOutcome,
  type CouponSettlementSnapshot,
} from '@/features/admin/settlement';
import {
  disableMarketDataRefreshCron,
  fetchAllMarketAssetsForAdmin,
  setupMarketDataRefreshCronProfile,
  upsertMarketAsset,
} from '@/features/markets/api';
import { searchTwelveDataSymbols } from '@/features/markets/provider.twelvedata';
import { MarketAsset, MarketAssetType } from '@/types/markets';

type AdminTab = 'dashboard' | 'create' | 'manage' | 'proposals' | 'categories' | 'assets';

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message;
  }
  return fallback;
};

const normalizeCouponStatus = (value: string | null | undefined): CouponSettlementSnapshot['status'] => {
  if (value === 'won' || value === 'lost') return value;
  return 'pending';
};

const toInputDateTime = (value: Date | string) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
};

const getTomorrowAt2359 = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(23, 59, 0, 0);
  return date;
};

interface BetOptionDraft {
  name: string;
  odds: string;
}

export default function AdminPage() {
  const { isAdmin, loading } = useAuth();
  const [tab, setTab] = useState<AdminTab>('dashboard');

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/" />;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-6xl mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Panel Administracyjny</h1>
        <div className="flex gap-2 mb-6 flex-wrap">
          {([
            ['dashboard', '📊 Dashboard'],
            ['create', '➕ Utwórz zakład'],
            ['manage', '📋 Zarządzaj'],
            ['proposals', '💡 Propozycje'],
            ['categories', '🏷️ Kategorie'],
            ['assets', '📈 Aktywa'],
          ] as [AdminTab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-all', tab === key ? 'gradient-primary text-primary-foreground shadow-sm' : 'bg-muted hover:bg-muted/80')}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'dashboard' && <DashboardTab />}
        {tab === 'create' && <CreateBetTab />}
        {tab === 'manage' && <ManageBetsTab />}
        {tab === 'proposals' && <ProposalsTab />}
        {tab === 'categories' && <CategoriesTab />}
        {tab === 'assets' && <MarketAssetsTab />}
      </div>
    </div>
  );
}

function DashboardTab() {
  const [stats, setStats] = useState({ totalBets: 0, totalPool: 0, pendingProposals: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { count: totalBets } = await supabase.from('placed_bets').select('*', { count: 'exact', head: true });
      const { data: bets } = await supabase.from('placed_bets').select('stake');
      const totalPool = bets?.reduce((acc, b) => acc + Number(b.stake), 0) || 0;
      const { count: pendingProposals } = await supabase.from('bet_proposals').select('*', { count: 'exact', head: true }).eq('status', 'pending');
      setStats({ totalBets: totalBets || 0, totalPool, pendingProposals: pendingProposals || 0 });
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-card rounded-xl p-6 card-shadow">
            <Skeleton className="h-4 w-32 mb-2" />
            <Skeleton className="h-8 w-20" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-card rounded-xl p-6 card-shadow">
        <p className="text-sm text-muted-foreground">Łączna liczba zakładów</p>
        <p className="text-3xl font-bold">{stats.totalBets}</p>
      </div>
      <div className="bg-card rounded-xl p-6 card-shadow">
        <p className="text-sm text-muted-foreground">Łączna pula</p>
        <p className="text-3xl font-bold">{stats.totalPool.toFixed(0)} zł</p>
      </div>
      <div className="bg-card rounded-xl p-6 card-shadow">
        <p className="text-sm text-muted-foreground">Propozycje oczekujące</p>
        <p className="text-3xl font-bold text-primary">{stats.pendingProposals}</p>
      </div>
    </div>
  );
}

function CreateBetTab() {
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [betType, setBetType] = useState<'1x2' | '12' | 'multi'>('12');
  const [isLive, setIsLive] = useState(false);
  const [endsAt, setEndsAt] = useState(() => toInputDateTime(getTomorrowAt2359()));
  const [options, setOptions] = useState<BetOptionDraft[]>([{ name: '1', odds: '2' }, { name: '2', odds: '2' }]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.from('categories').select('*').order('sort_order').then(({ data }) => {
      if (data) setCategories(data as Category[]);
    });
  }, []);

  // Lock options based on bet type
  useEffect(() => {
    if (betType === '12') {
      setOptions([{ name: '1', odds: '2' }, { name: '2', odds: '2' }]);
    } else if (betType === '1x2') {
      setOptions([{ name: '1', odds: '2' }, { name: 'X', odds: '3' }, { name: '2', odds: '2' }]);
    } else if (betType === 'multi') {
      setOptions((previous) => {
        if (previous.length >= 2) return previous;
        return [{ name: '', odds: '2' }, { name: '', odds: '2' }];
      });
    }
  }, [betType]);

  const hasFixedOptionCount = betType === '12' || betType === '1x2';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanedOptions = options.map((option) => ({
      name: option.name.trim(),
      oddsRaw: option.odds.trim(),
    }));

    if (cleanedOptions.some((option) => !option.name)) {
      toast.error('Uzupełnij etykiety wszystkich opcji');
      return;
    }

    if (cleanedOptions.length < 2) {
      toast.error('Dodaj co najmniej 2 opcje');
      return;
    }

    const invalidOddsIndex = cleanedOptions.findIndex((option) => {
      if (!option.oddsRaw) return true;
      const odds = Number(option.oddsRaw);
      return !Number.isFinite(odds) || odds <= 0;
    });

    if (invalidOddsIndex !== -1) {
      toast.error(`Podaj poprawny kurs dla opcji ${invalidOddsIndex + 1}`);
      return;
    }

    const normalizedOptions: BetOption[] = cleanedOptions.map((option) => ({
      name: option.name,
      odds: Number(option.oddsRaw),
    }));

    setSubmitting(true);
    try {
      const { error } = await supabase.from('bets').insert([{
        title,
        category_id: categoryId || null,
        bet_type: betType,
        options: normalizedOptions as unknown as Json,
        ends_at: new Date(endsAt).toISOString(),
        is_live: isLive,
      }]);
      if (error) throw error;
      toast.success('Zakład utworzony!');
      setTitle('');
      setEndsAt(toInputDateTime(getTomorrowAt2359()));
      if (betType === '12') setOptions([{ name: '1', odds: '2' }, { name: '2', odds: '2' }]);
      else if (betType === '1x2') setOptions([{ name: '1', odds: '2' }, { name: 'X', odds: '3' }, { name: '2', odds: '2' }]);
      else setOptions([{ name: '', odds: '2' }, { name: '', odds: '2' }]);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Nie udało się utworzyć zakładu'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-xl p-6 card-shadow space-y-4 max-w-2xl">
      <div className="space-y-2">
        <Label>Tytuł</Label>
        <Input value={title} onChange={e => setTitle(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Kategoria</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger><SelectValue placeholder="Wybierz" /></SelectTrigger>
            <SelectContent>
              {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.emoji} {c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Typ</Label>
          <Select value={betType} onValueChange={(v: string) => setBetType(v as '1x2' | '12' | 'multi')}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="12">1/2</SelectItem>
              <SelectItem value="1x2">1X2</SelectItem>
              <SelectItem value="multi">Multi</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Data zakończenia</Label>
        <Input type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)} required />
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={isLive} onCheckedChange={setIsLive} />
        <Label>Na żywo 🔴</Label>
      </div>
      <div className="space-y-2">
        <Label>Opcje</Label>
        {options.map((opt, i) => (
          <div key={i} className="flex gap-2 items-center">
            <Input
              value={opt.name}
              onChange={e => { const n = [...options]; n[i].name = e.target.value; setOptions(n); }}
              placeholder={`Opcja ${i+1}`}
              className="flex-1"
            />
            <Input type="number" step="0.01" min="1" value={opt.odds} onChange={e => { const n = [...options]; n[i].odds = e.target.value; setOptions(n); }} className="w-24" />
            {!hasFixedOptionCount && options.length > 2 && (
              <button type="button" onClick={() => setOptions(options.filter((_, j) => j !== i))}><X className="h-4 w-4 text-muted-foreground" /></button>
            )}
          </div>
        ))}
        {!hasFixedOptionCount && (
          <Button type="button" variant="outline" size="sm" onClick={() => setOptions([...options, { name: '', odds: '2' }])}>
            <Plus className="h-3 w-3 mr-1" /> Dodaj opcję
          </Button>
        )}
      </div>
      <Button type="submit" disabled={submitting} className="gradient-primary text-primary-foreground font-bold">
        {submitting ? 'Tworzenie...' : 'Utwórz zakład'}
      </Button>
    </form>
  );
}

function ManageBetsTab() {
  type EditableBetType = '1x2' | '12' | 'multi';

  interface BetEditor {
    id: string;
    title: string;
    categoryId: string;
    betType: EditableBetType;
    options: BetOption[];
    endsAt: string;
    isLive: boolean;
    isActive: boolean;
  }

  const NO_CATEGORY_VALUE = '__none__';
  const [bets, setBets] = useState<Bet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [resolveModal, setResolveModal] = useState<Bet | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorLoading, setEditorLoading] = useState(false);
  const [editing, setEditing] = useState<BetEditor | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingBetId, setDeletingBetId] = useState<string | null>(null);

  const normalizeType = (value: string): EditableBetType => {
    if (value === '1x2' || value === 'multi') return value;
    return '12';
  };

  const normalizeOptions = (options: unknown): BetOption[] => {
    if (!Array.isArray(options)) return [];
    return options.map((option, index) => ({
      name: typeof (option as BetOption)?.name === 'string' ? (option as BetOption).name : `Opcja ${index + 1}`,
      odds: Number((option as BetOption)?.odds) > 0 ? Number((option as BetOption).odds) : 1,
    }));
  };

  const lockOptionsByType = (type: EditableBetType, current: BetOption[]) => {
    if (type === '12') {
      return [
        { name: current[0]?.name || '1', odds: current[0]?.odds || 2 },
        { name: current[1]?.name || '2', odds: current[1]?.odds || 2 },
      ];
    }

    if (type === '1x2') {
      return [
        { name: current[0]?.name || '1', odds: current[0]?.odds || 2 },
        { name: current[1]?.name || 'X', odds: current[1]?.odds || 3 },
        { name: current[2]?.name || '2', odds: current[2]?.odds || 2 },
      ];
    }

    if (current.length >= 2) return current;
    return [
      { name: '', odds: 2 },
      { name: '', odds: 2 },
    ];
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
      isActive: Boolean(bet.is_active),
    });
    setEditorOpen(true);
  };

  const updateBet = async () => {
    if (!editing) return;

    if (!editing.title.trim()) {
      toast.error('Tytuł jest wymagany');
      return;
    }

    const cleanedOptions = editing.options.map((option) => ({
      name: option.name.trim(),
      odds: Number(option.odds) > 0 ? Number(option.odds) : 1,
    }));

    if (cleanedOptions.some((option) => !option.name)) {
      toast.error('Uzupełnij etykiety wszystkich opcji');
      return;
    }

    if (cleanedOptions.length < 2) {
      toast.error('Zakład musi mieć minimum 2 opcje');
      return;
    }

    const endsAtDate = new Date(editing.endsAt);
    if (Number.isNaN(endsAtDate.getTime())) {
      toast.error('Wybierz poprawną datę zakończenia');
      return;
    }

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

  const resolveBet = async (bet: Bet, winningOption: string) => {
    interface CouponSettlementRow {
      stake: number;
      total_odds: number;
      status: string;
      payout: number | null;
      stake_asset_id: string | null;
      stake_asset_quantity: number | null;
      stake_asset_unit_price_pln: number | null;
    }

    try {
      const { error: betUpdateError } = await supabase
        .from('bets')
        .update({ winning_option: winningOption, is_active: false })
        .eq('id', bet.id);
      if (betUpdateError) throw betUpdateError;

      const { data: placedBets, error: placedBetsError } = await supabase
        .from('placed_bets')
        .select('*')
        .eq('bet_id', bet.id);
      if (placedBetsError) throw placedBetsError;

      let creditsByUser: Record<string, number> = {};

      if (placedBets) {
        for (const pb of placedBets) {
          if (pb.result === 'won' || pb.result === 'lost') continue;

          let couponBefore: CouponSettlementSnapshot | null = null;
          let couponBeforeRow: CouponSettlementRow | null = null;
          if (pb.coupon_id) {
            const { data: coupon } = await supabase
              .from('coupons')
              .select('stake, total_odds, status, payout, stake_asset_id, stake_asset_quantity, stake_asset_unit_price_pln')
              .eq('id', pb.coupon_id)
              .single();

            if (coupon) {
              couponBeforeRow = coupon as unknown as CouponSettlementRow;
              couponBefore = {
                stake: Number(couponBeforeRow.stake),
                totalOdds: Number(couponBeforeRow.total_odds),
                status: normalizeCouponStatus(couponBeforeRow.status),
                payout: Number(couponBeforeRow.payout ?? 0),
              };
            }
          }

          const legOutcome = calculateLegOutcome({
            selectedOption: pb.selected_option,
            winningOption,
            stake: Number(pb.stake),
            oddsAtTime: Number(pb.odds_at_time),
          });

          const { error: legUpdateError } = await supabase
            .from('placed_bets')
            .update({ result: legOutcome.result, payout: legOutcome.payout })
            .eq('id', pb.id);
          if (legUpdateError) throw legUpdateError;

          let couponAfter: CouponSettlementSnapshot | null = null;
          let couponAfterRow: CouponSettlementRow | null = null;
          if (pb.coupon_id) {
            const { data: coupon } = await supabase
              .from('coupons')
              .select('stake, total_odds, status, payout, stake_asset_id, stake_asset_quantity, stake_asset_unit_price_pln')
              .eq('id', pb.coupon_id)
              .single();

            if (coupon) {
              couponAfterRow = coupon as unknown as CouponSettlementRow;
              couponAfter = {
                stake: Number(couponAfterRow.stake),
                totalOdds: Number(couponAfterRow.total_odds),
                status: normalizeCouponStatus(couponAfterRow.status),
                payout: Number(couponAfterRow.payout ?? 0),
              };
            }
          }

          const creditAmount = calculateCreditAmount({
            legWon: legOutcome.won,
            legPayout: legOutcome.payout,
            couponBefore,
            couponAfter,
            useAssetStake: Boolean(couponAfterRow?.stake_asset_id),
          });

          if (couponAfterRow?.stake_asset_id) {
            const creditQuantity = calculateAssetCreditQuantity({
              legWon: legOutcome.won,
              oddsAtTime: Number(pb.odds_at_time),
              couponBefore,
              couponAfter,
              stakeAssetQuantity: Number(couponAfterRow.stake_asset_quantity ?? 0),
            });

            if (creditQuantity > 0) {
              const { error: assetCreditError } = await (supabase as never as {
                rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
              }).rpc('admin_credit_market_asset', {
                p_user_id: pb.user_id,
                p_asset_id: couponAfterRow.stake_asset_id,
                p_quantity: creditQuantity,
                p_unit_price_pln: Number(couponAfterRow.stake_asset_unit_price_pln ?? 0),
              });

              if (assetCreditError) {
                throw assetCreditError;
              }
            }
          }

          creditsByUser = addCreditForUser({
            creditsByUser,
            userId: pb.user_id,
            amount: creditAmount,
          });
        }

        const creditEntries = Object.entries(creditsByUser);
        for (const [userId, creditAmount] of creditEntries) {
          const { error: creditError } = await supabase.rpc('admin_credit_balance', {
            p_user_id: userId,
            p_amount: creditAmount,
          });
          if (creditError) throw creditError;
        }
      }
      toast.success('Wynik ogłoszony!');
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      setResolveModal(null);
      fetchBets();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Nie udało się ogłosić wyniku'));
    }
  };

  const deleteBet = async (bet: Bet) => {
    const shouldDelete = window.confirm(`Czy na pewno chcesz usunąć zakład "${bet.title}"?`);
    if (!shouldDelete) return;

    setDeletingBetId(bet.id);
    try {
      const { error } = await supabase.from('bets').delete().eq('id', bet.id);
      if (error) throw error;

      if (editing?.id === bet.id) {
        setEditorOpen(false);
        setEditing(null);
      }

      if (resolveModal?.id === bet.id) {
        setResolveModal(null);
      }

      toast.success('Zakład usunięty');
      fetchBets();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Nie udało się usunąć zakładu'));
    } finally {
      setDeletingBetId(null);
    }
  };

  const hasFixedOptionCount = editing ? editing.betType === '12' || editing.betType === '1x2' : false;

  return (
    <>
      <div className="bg-card rounded-xl card-shadow overflow-hidden">
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
                {bets.map(bet => (
                  <tr key={bet.id} className="border-b">
                    <td className="p-3 font-medium">{bet.title}</td>
                    <td className="p-3">{bet.bet_type}</td>
                    <td className="p-3">{bet.bet_count}</td>
                    <td className="p-3">
                      {bet.winning_option ? (
                        <span className="text-xs bg-success/20 text-success px-2 py-1 rounded-full">Rozstrzygnięty</span>
                      ) : bet.is_active ? (
                        <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">Aktywny</span>
                      ) : (
                        <span className="text-xs bg-muted px-2 py-1 rounded-full">Zamknięty</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEditor(bet)}>
                          Edytuj
                        </Button>
                        {!bet.winning_option && (
                          <Button size="sm" variant="outline" onClick={() => setResolveModal(bet)}>
                            <Trophy className="h-3 w-3 mr-1" /> Ogłoś wynik
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteBet(bet)}
                          disabled={deletingBetId === bet.id}
                        >
                          {deletingBetId === bet.id ? 'Usuwanie...' : 'Usuń'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog
        open={editorOpen}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (!open) setEditing(null);
        }}
      >
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Edytuj zakład</DialogTitle>
          </DialogHeader>

          {editing && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Tytuł</Label>
                <Input
                  value={editing.title}
                  onChange={(event) => setEditing((prev) => (prev ? { ...prev, title: event.target.value } : prev))}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Kategoria</Label>
                  <Select
                    value={editing.categoryId || NO_CATEGORY_VALUE}
                    onValueChange={(value) =>
                      setEditing((prev) =>
                        prev
                          ? {
                              ...prev,
                              categoryId: value === NO_CATEGORY_VALUE ? '' : value,
                            }
                          : prev
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Wybierz" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_CATEGORY_VALUE}>Brak kategorii</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.emoji} {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Typ</Label>
                  <Select
                    value={editing.betType}
                    onValueChange={(value: EditableBetType) =>
                      setEditing((prev) =>
                        prev
                          ? {
                              ...prev,
                              betType: value,
                              options: lockOptionsByType(value, prev.options),
                            }
                          : prev
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="12">1/2</SelectItem>
                      <SelectItem value="1x2">1X2</SelectItem>
                      <SelectItem value="multi">Multi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Data zakończenia</Label>
                <Input
                  type="datetime-local"
                  value={editing.endsAt}
                  onChange={(event) => setEditing((prev) => (prev ? { ...prev, endsAt: event.target.value } : prev))}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <Label htmlFor="manage-bet-live">Na żywo</Label>
                  <Switch
                    id="manage-bet-live"
                    checked={editing.isLive}
                    onCheckedChange={(checked) => setEditing((prev) => (prev ? { ...prev, isLive: checked } : prev))}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <Label htmlFor="manage-bet-active">Aktywny</Label>
                  <Switch
                    id="manage-bet-active"
                    checked={editing.isActive}
                    onCheckedChange={(checked) => setEditing((prev) => (prev ? { ...prev, isActive: checked } : prev))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Opcje</Label>

                {editing.options.map((option, index) => (
                  <div key={`${editing.id}-${index}`} className="flex gap-2 items-center">
                    <Input
                      value={option.name}
                      onChange={(event) =>
                        setEditing((prev) => {
                          if (!prev) return prev;
                          const nextOptions = [...prev.options];
                          nextOptions[index].name = event.target.value;
                          return { ...prev, options: nextOptions };
                        })
                      }
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      min="1"
                      value={option.odds}
                      onChange={(event) =>
                        setEditing((prev) => {
                          if (!prev) return prev;
                          const nextOptions = [...prev.options];
                          nextOptions[index].odds = Number(event.target.value);
                          return { ...prev, options: nextOptions };
                        })
                      }
                      className="w-24"
                    />
                    {!hasFixedOptionCount && editing.options.length > 2 && (
                      <button
                        type="button"
                        onClick={() =>
                          setEditing((prev) => {
                            if (!prev) return prev;
                            return {
                              ...prev,
                              options: prev.options.filter((_, optionIndex) => optionIndex !== index),
                            };
                          })
                        }
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}

                {!hasFixedOptionCount && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setEditing((prev) =>
                        prev
                          ? {
                              ...prev,
                              options: [...prev.options, { name: '', odds: 2 }],
                            }
                          : prev
                      )
                    }
                  >
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

      {resolveModal && (
        <Dialog open={!!resolveModal} onOpenChange={() => setResolveModal(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ogłoś wynik: {resolveModal.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Wybierz wygraną opcję:</p>
              {(resolveModal.options as unknown as BetOption[]).map(opt => (
                <Button key={opt.name} variant="outline" className="w-full justify-start" onClick={() => resolveBet(resolveModal, opt.name)}>
                  <Check className="h-4 w-4 mr-2" /> {opt.name} ({opt.odds.toFixed(2)})
                </Button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function ProposalsTab() {
  type ProposalType = '1x2' | '12' | 'multi';

  interface ProposalRow {
    id: string;
    user_id: string;
    title: string;
    category_id: string | null;
    ends_at: string | null;
    bet_type: ProposalType;
    options: BetOption[];
    username: string;
  }

  interface ProposalEditor {
    id: string;
    title: string;
    categoryId: string;
    betType: ProposalType;
    options: BetOption[];
    endsAt: string;
  }

  const [proposals, setProposals] = useState<ProposalRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorLoading, setEditorLoading] = useState(false);
  const [editing, setEditing] = useState<ProposalEditor | null>(null);

  const normalizeType = useCallback((value: string): ProposalType => {
    if (value === '1x2' || value === 'multi') return value;
    return '12';
  }, []);

  const normalizeOptions = (options: unknown): BetOption[] => {
    if (!Array.isArray(options)) return [];
    return options.map((option, index) => ({
      name: typeof option?.name === 'string' ? option.name : `Opcja ${index + 1}`,
      odds: Number(option?.odds) > 0 ? Number(option.odds) : 1,
    }));
  };

  const lockOptionsByType = (type: ProposalType, current: BetOption[]) => {
    if (type === '12') {
      return [
        { name: current[0]?.name || '1', odds: current[0]?.odds || 2 },
        { name: current[1]?.name || '2', odds: current[1]?.odds || 2 },
      ];
    }

    if (type === '1x2') {
      return [
        { name: current[0]?.name || '1', odds: current[0]?.odds || 2 },
        { name: current[1]?.name || 'X', odds: current[1]?.odds || 3 },
        { name: current[2]?.name || '2', odds: current[2]?.odds || 2 },
      ];
    }

    if (current.length >= 2) return current;
    return [
      { name: '', odds: 2 },
      { name: '', odds: 2 },
    ];
  };

  const fetchProposals = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: proposalRows, error: proposalError }, { data: categoryRows }] = await Promise.all([
        supabase.from('bet_proposals').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
        supabase.from('categories').select('*').order('sort_order'),
      ]);

      if (proposalError) throw proposalError;
      setCategories((categoryRows as Category[]) || []);

      const normalized = (proposalRows || []).map((proposal) => ({
        id: proposal.id,
        user_id: proposal.user_id,
        title: proposal.title,
        category_id: proposal.category_id,
        ends_at: proposal.ends_at,
        bet_type: normalizeType(proposal.bet_type),
        options: normalizeOptions(proposal.options),
        username: 'Użytkownik',
      }));

      const uniqueUserIds = [...new Set(normalized.map((proposal) => proposal.user_id))];
      if (uniqueUserIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, username').in('id', uniqueUserIds);
        const userMap = new Map((profiles || []).map((profile) => [profile.id, profile.username]));
        setProposals(
          normalized.map((proposal) => ({
            ...proposal,
            username: userMap.get(proposal.user_id) || 'Użytkownik',
          }))
        );
      } else {
        setProposals(normalized);
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Nie udało się pobrać propozycji'));
    } finally {
      setLoading(false);
    }
  }, [normalizeType]);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  const openEditor = (proposal: ProposalRow) => {
    const lockedOptions = lockOptionsByType(proposal.bet_type, proposal.options);
    setEditing({
      id: proposal.id,
      title: proposal.title,
      categoryId: proposal.category_id || '',
      betType: proposal.bet_type,
      options: lockedOptions,
      endsAt: proposal.ends_at ? toInputDateTime(proposal.ends_at) : toInputDateTime(getTomorrowAt2359()),
    });
    setEditorOpen(true);
  };

  const acceptEdited = async () => {
    if (!editing) return;

    const cleanedOptions = editing.options
      .filter((option) => option.name.trim())
      .map((option) => ({
        name: option.name.trim(),
        odds: Number(option.odds) > 0 ? Number(option.odds) : 1,
      }));

    if (cleanedOptions.length < 2) {
      toast.error('Zakład musi mieć minimum 2 opcje');
      return;
    }

    if (!editing.title.trim()) {
      toast.error('Tytuł jest wymagany');
      return;
    }

    const endsAtDate = new Date(editing.endsAt);
    if (Number.isNaN(endsAtDate.getTime())) {
      toast.error('Wybierz poprawną datę zakończenia');
      return;
    }

    setEditorLoading(true);
    try {
      const { error: insertError } = await supabase.from('bets').insert([
        {
          title: editing.title.trim(),
          category_id: editing.categoryId || null,
          bet_type: editing.betType,
          options: cleanedOptions as Json,
          ends_at: endsAtDate.toISOString(),
        },
      ]);

      if (insertError) throw insertError;

      const { error: proposalUpdateError } = await supabase
        .from('bet_proposals')
        .update({
          status: 'accepted',
          title: editing.title.trim(),
          category_id: editing.categoryId || null,
          bet_type: editing.betType,
          options: cleanedOptions as Json,
        })
        .eq('id', editing.id);

      if (proposalUpdateError) throw proposalUpdateError;

      toast.success('Propozycja zaakceptowana i dostosowana');
      setEditorOpen(false);
      setEditing(null);
      fetchProposals();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Nie udało się zaakceptować propozycji'));
    } finally {
      setEditorLoading(false);
    }
  };

  const reject = async (proposalId: string) => {
    const { error } = await supabase.from('bet_proposals').update({ status: 'rejected' }).eq('id', proposalId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.info('Propozycja odrzucona');
    fetchProposals();
  };

  const hasFixedOptionCount = editing ? editing.betType === '12' || editing.betType === '1x2' : false;

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {proposals.length === 0 && <p className="text-muted-foreground text-center py-8">Brak propozycji</p>}
        {proposals.map((proposal) => (
          <div key={proposal.id} className="bg-card rounded-xl p-4 card-shadow space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-bold">{proposal.title}</p>
                <p className="text-xs text-muted-foreground">Od: {proposal.username} • {proposal.bet_type.toUpperCase()}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {proposal.options.map((option, optionIndex) => (
                    <span key={`${proposal.id}-${optionIndex}`} className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-foreground">
                      {option.name} ({Number(option.odds).toFixed(2)})
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => openEditor(proposal)} className="gradient-primary text-primary-foreground">
                  <Check className="h-3 w-3 mr-1" /> Dostosuj i akceptuj
                </Button>
                <Button size="sm" variant="outline" onClick={() => reject(proposal.id)}>
                  <XCircle className="h-3 w-3 mr-1" /> Odrzuć
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Dostosuj propozycję przed akceptacją</DialogTitle>
          </DialogHeader>

          {editing && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Tytuł</Label>
                <Input
                  value={editing.title}
                  onChange={(event) => setEditing((prev) => (prev ? { ...prev, title: event.target.value } : prev))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Kategoria</Label>
                  <Select
                    value={editing.categoryId}
                    onValueChange={(value) => setEditing((prev) => (prev ? { ...prev, categoryId: value } : prev))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Wybierz" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.emoji} {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Typ</Label>
                  <Select
                    value={editing.betType}
                    onValueChange={(value: '1x2' | '12' | 'multi') =>
                      setEditing((prev) =>
                        prev
                          ? {
                              ...prev,
                              betType: value,
                              options: lockOptionsByType(value, prev.options),
                            }
                          : prev
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="12">1/2</SelectItem>
                      <SelectItem value="1x2">1X2</SelectItem>
                      <SelectItem value="multi">Multi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Data zakończenia</Label>
                <Input
                  type="datetime-local"
                  value={editing.endsAt}
                  onChange={(event) => setEditing((prev) => (prev ? { ...prev, endsAt: event.target.value } : prev))}
                />
              </div>

              <div className="space-y-2">
                <Label>Opcje</Label>

                {editing.options.map((option, index) => (
                  <div key={`${editing.id}-${index}`} className="flex gap-2 items-center">
                    <Input
                      value={option.name}
                      onChange={(event) =>
                        setEditing((prev) => {
                          if (!prev) return prev;
                          const nextOptions = [...prev.options];
                          nextOptions[index].name = event.target.value;
                          return { ...prev, options: nextOptions };
                        })
                      }
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      min="1"
                      value={option.odds}
                      onChange={(event) =>
                        setEditing((prev) => {
                          if (!prev) return prev;
                          const nextOptions = [...prev.options];
                          nextOptions[index].odds = Number(event.target.value);
                          return { ...prev, options: nextOptions };
                        })
                      }
                      className="w-24"
                    />
                    {!hasFixedOptionCount && editing.options.length > 2 && (
                      <button
                        type="button"
                        onClick={() =>
                          setEditing((prev) => {
                            if (!prev) return prev;
                            return {
                              ...prev,
                              options: prev.options.filter((_, optionIndex) => optionIndex !== index),
                            };
                          })
                        }
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}

                {!hasFixedOptionCount && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setEditing((prev) =>
                        prev
                          ? {
                              ...prev,
                              options: [...prev.options, { name: '', odds: 2 }],
                            }
                          : prev
                      )
                    }
                  >
                    <Plus className="h-3 w-3 mr-1" /> Dodaj opcję
                  </Button>
                )}
              </div>

              <Button onClick={acceptEdited} disabled={editorLoading} className="w-full gradient-primary text-primary-foreground font-bold">
                {editorLoading ? 'Zapisywanie...' : 'Akceptuj propozycję'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function CategoriesTab() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCat, setNewCat] = useState({ name: '', emoji: '⚽', color: '#dc2626', sort_order: 0 });
  const [adding, setAdding] = useState(false);

  const fetchCats = async () => {
    const { data } = await supabase.from('categories').select('*').order('sort_order');
    if (data) setCategories(data as Category[]);
  };

  useEffect(() => { fetchCats(); }, []);

  const addCategory = async () => {
    if (!newCat.name.trim()) return;
    setAdding(true);
    await supabase.from('categories').insert(newCat);
    setNewCat({ name: '', emoji: '⚽', color: '#dc2626', sort_order: categories.length + 1 });
    setAdding(false);
    fetchCats();
    toast.success('Kategoria dodana');
  };

  const deleteCategory = async (id: string) => {
    const { count } = await supabase.from('bets').select('*', { count: 'exact', head: true }).eq('category_id', id).eq('is_active', true);
    if (count && count > 0) {
      toast.error('Usuń najpierw aktywne zakłady w tej kategorii');
      return;
    }
    await supabase.from('categories').delete().eq('id', id);
    fetchCats();
    toast.success('Kategoria usunięta');
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl p-4 card-shadow">
        <h3 className="font-bold mb-3">Dodaj kategorię</h3>
        <div className="flex gap-2 items-end flex-wrap">
          <div>
            <Label className="text-xs">Emoji</Label>
            <Input value={newCat.emoji} onChange={e => setNewCat({ ...newCat, emoji: e.target.value })} className="w-16" />
          </div>
          <div className="flex-1">
            <Label className="text-xs">Nazwa</Label>
            <Input value={newCat.name} onChange={e => setNewCat({ ...newCat, name: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Kolor</Label>
            <Input type="color" value={newCat.color} onChange={e => setNewCat({ ...newCat, color: e.target.value })} className="w-16 h-9" />
          </div>
          <div>
            <Label className="text-xs">Kolejność</Label>
            <Input type="number" value={newCat.sort_order} onChange={e => setNewCat({ ...newCat, sort_order: Number(e.target.value) })} className="w-20" />
          </div>
          <Button onClick={addCategory} disabled={adding} size="sm"><Plus className="h-3 w-3 mr-1" /> Dodaj</Button>
        </div>
      </div>

      <div className="bg-card rounded-xl card-shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="p-3">Emoji</th>
              <th className="p-3">Nazwa</th>
              <th className="p-3">Kolor</th>
              <th className="p-3">Kolejność</th>
              <th className="p-3">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {categories.map(cat => (
              <tr key={cat.id} className="border-b">
                <td className="p-3">{cat.emoji}</td>
                <td className="p-3 font-medium">{cat.name}</td>
                <td className="p-3"><span className="inline-block w-6 h-6 rounded-full" style={{ backgroundColor: cat.color }} /></td>
                <td className="p-3">{cat.sort_order}</td>
                <td className="p-3">
                  <Button size="sm" variant="destructive" onClick={() => deleteCategory(cat.id)}>Usuń</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MarketAssetsTab() {
  const [assets, setAssets] = useState<MarketAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{
    symbol: string;
    displayName: string;
    quoteCurrency: string;
    type: MarketAssetType;
  }>>([]);
  const [cronConfig, setCronConfig] = useState({
    projectUrl: import.meta.env.VITE_SUPABASE_URL || '',
    anonKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
    peakStartHour: '10',
    peakEndHour: '16',
    offpeakStepHours: '2',
  });
  const [cronSaving, setCronSaving] = useState(false);
  const [cronDisabling, setCronDisabling] = useState(false);

  const [form, setForm] = useState({
    id: '',
    symbol: '',
    displayName: '',
    type: 'stock' as MarketAssetType,
    quoteCurrency: 'USD',
    minBetPln: '5',
    sortOrder: '0',
    isActive: true,
  });

  const loadAssets = async () => {
    setLoading(true);
    try {
      const data = await fetchAllMarketAssetsForAdmin();
      setAssets(data);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Nie udało się pobrać aktywów'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAssets();
  }, []);

  const resetForm = () => {
    setForm({
      id: '',
      symbol: '',
      displayName: '',
      type: 'stock',
      quoteCurrency: 'USD',
      minBetPln: '5',
      sortOrder: '0',
      isActive: true,
    });
  };

  const runSearch = async () => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const results = await searchTwelveDataSymbols(query);
      setSearchResults(results.slice(0, 30));
      if (results.length === 0) {
        toast.info('Brak wyników z API');
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Nie udało się wyszukać aktywów w API'));
    } finally {
      setSearching(false);
    }
  };

  const pickResult = (result: {
    symbol: string;
    displayName: string;
    quoteCurrency: string;
    type: MarketAssetType;
  }) => {
    setForm((prev) => ({
      ...prev,
      symbol: result.symbol,
      displayName: result.displayName,
      quoteCurrency: result.quoteCurrency,
      type: result.type,
    }));
  };

  const saveAsset = async () => {
    const minBetPln = Number(form.minBetPln);
    const sortOrder = Number(form.sortOrder);

    if (!form.symbol.trim() || !form.displayName.trim()) {
      toast.error('Symbol i nazwa są wymagane');
      return;
    }

    if (!Number.isFinite(minBetPln) || minBetPln <= 0) {
      toast.error('Minimalna wartość zakładu musi być większa od 0');
      return;
    }

    if (!Number.isFinite(sortOrder)) {
      toast.error('Kolejność musi być liczbą');
      return;
    }

    setSaving(true);
    try {
      await upsertMarketAsset({
        id: form.id || undefined,
        symbol: form.symbol,
        displayName: form.displayName,
        type: form.type,
        quoteCurrency: form.quoteCurrency,
        minBetPln,
        sortOrder,
        isActive: form.isActive,
      });

      toast.success(form.id ? 'Aktywo zaktualizowane' : 'Aktywo dodane');
      resetForm();
      await loadAssets();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Nie udało się zapisać aktywa'));
    } finally {
      setSaving(false);
    }
  };

  const editAsset = (asset: MarketAsset) => {
    setForm({
      id: asset.id,
      symbol: asset.symbol,
      displayName: asset.display_name,
      type: asset.type,
      quoteCurrency: asset.quote_currency,
      minBetPln: String(asset.min_bet_pln),
      sortOrder: String(asset.sort_order),
      isActive: asset.is_active,
    });
  };

  const setupCronProfile = async () => {
    const peakStartHour = Number(cronConfig.peakStartHour);
    const peakEndHour = Number(cronConfig.peakEndHour);
    const offpeakStepHours = Number(cronConfig.offpeakStepHours);

    if (!cronConfig.projectUrl.trim() || !cronConfig.anonKey.trim()) {
      toast.error('Podaj Project URL i klucz anon');
      return;
    }

    if (!Number.isInteger(peakStartHour) || peakStartHour < 0 || peakStartHour > 23) {
      toast.error('Peak start hour musi być liczbą 0-23');
      return;
    }

    if (!Number.isInteger(peakEndHour) || peakEndHour < 0 || peakEndHour > 23) {
      toast.error('Peak end hour musi być liczbą 0-23');
      return;
    }

    if (peakStartHour > peakEndHour) {
      toast.error('Peak start hour nie może być większy od peak end hour');
      return;
    }

    if (!Number.isInteger(offpeakStepHours) || offpeakStepHours < 1 || offpeakStepHours > 12) {
      toast.error('Off-peak co ile godzin: 1-12');
      return;
    }

    setCronSaving(true);
    try {
      const result = await setupMarketDataRefreshCronProfile({
        projectUrl: cronConfig.projectUrl,
        anonKey: cronConfig.anonKey,
        peakStartHour,
        peakEndHour,
        offpeakStepHours,
      });

      toast.success(
        `Cron ustawiony: ${result.estimated_runs_per_day}/dzień (peak: ${result.peak_schedule}, off-peak: ${result.offpeak_schedule})`
      );
    } catch (error) {
      toast.error(getErrorMessage(error, 'Nie udało się ustawić cron profilu'));
    } finally {
      setCronSaving(false);
    }
  };

  const disableCronProfile = async () => {
    setCronDisabling(true);
    try {
      await disableMarketDataRefreshCron();
      toast.success('Cron odświeżania market-data wyłączony');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Nie udało się wyłączyć cron'));
    } finally {
      setCronDisabling(false);
    }
  };

  const applyRecommendedCronPreset = () => {
    setCronConfig((prev) => ({
      ...prev,
      peakStartHour: '10',
      peakEndHour: '16',
      offpeakStepHours: '2',
    }));
    toast.success('Ustawiono rekomendowany preset (10-16 co 30 min, off-peak co 2h)');
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl p-4 card-shadow space-y-3">
        <h3 className="font-bold">Harmonogram odświeżania quote (cron)</h3>
        <p className="text-xs text-muted-foreground">
          Profil domyślny: peak 10-16 co 30 min + off-peak co 2h (maks 25/dzień).
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Project URL</Label>
            <Input
              value={cronConfig.projectUrl}
              onChange={(event) => setCronConfig((prev) => ({ ...prev, projectUrl: event.target.value }))}
              placeholder="https://<project-ref>.supabase.co"
            />
          </div>

          <div className="space-y-2">
            <Label>Anon key</Label>
            <Input
              value={cronConfig.anonKey}
              onChange={(event) => setCronConfig((prev) => ({ ...prev, anonKey: event.target.value }))}
              placeholder="sb_publishable_..."
            />
          </div>

          <div className="space-y-2">
            <Label>Peak start hour (0-23)</Label>
            <Input
              type="number"
              min={0}
              max={23}
              value={cronConfig.peakStartHour}
              onChange={(event) => setCronConfig((prev) => ({ ...prev, peakStartHour: event.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Peak end hour (0-23)</Label>
            <Input
              type="number"
              min={0}
              max={23}
              value={cronConfig.peakEndHour}
              onChange={(event) => setCronConfig((prev) => ({ ...prev, peakEndHour: event.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Off-peak co ile godzin (1-12)</Label>
            <Input
              type="number"
              min={1}
              max={12}
              value={cronConfig.offpeakStepHours}
              onChange={(event) => setCronConfig((prev) => ({ ...prev, offpeakStepHours: event.target.value }))}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={applyRecommendedCronPreset}>
            Użyj rekomendowanego presetu
          </Button>
          <Button onClick={setupCronProfile} disabled={cronSaving}>
            {cronSaving ? 'Ustawianie...' : 'Ustaw profil cron'}
          </Button>
          <Button variant="outline" onClick={disableCronProfile} disabled={cronDisabling}>
            {cronDisabling ? 'Wyłączanie...' : 'Wyłącz cron'}
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-xl p-4 card-shadow space-y-3">
        <h3 className="font-bold">Wyszukiwarka API (TwelveData)</h3>
        <div className="flex gap-2">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="np. TSLA, SPY, BTC/USD" />
          <Button onClick={runSearch} disabled={searching} variant="outline">
            {searching ? 'Szukam...' : 'Szukaj'}
          </Button>
        </div>

        {searchResults.length > 0 && (
          <div className="max-h-56 overflow-y-auto border border-border rounded-md divide-y divide-border">
            {searchResults.map((result) => (
              <button
                key={`${result.symbol}-${result.type}`}
                onClick={() => pickResult(result)}
                className="w-full text-left px-3 py-2 hover:bg-muted/40 transition-colors"
              >
                <p className="text-sm font-semibold">{result.symbol} - {result.displayName}</p>
                <p className="text-xs text-muted-foreground">
                  {result.type.toUpperCase()} • {result.quoteCurrency}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bg-card rounded-xl p-4 card-shadow space-y-3">
        <h3 className="font-bold">Dodaj / edytuj aktywo</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Symbol</Label>
            <Input value={form.symbol} onChange={(event) => setForm((prev) => ({ ...prev, symbol: event.target.value }))} />
          </div>

          <div className="space-y-2">
            <Label>Nazwa</Label>
            <Input value={form.displayName} onChange={(event) => setForm((prev) => ({ ...prev, displayName: event.target.value }))} />
          </div>

          <div className="space-y-2">
            <Label>Typ</Label>
            <Select value={form.type} onValueChange={(value: MarketAssetType) => setForm((prev) => ({ ...prev, type: value }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stock">stock</SelectItem>
                <SelectItem value="etf">etf</SelectItem>
                <SelectItem value="crypto">crypto</SelectItem>
                <SelectItem value="forex">forex</SelectItem>
                <SelectItem value="commodity">commodity</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Waluta notowania</Label>
            <Input value={form.quoteCurrency} onChange={(event) => setForm((prev) => ({ ...prev, quoteCurrency: event.target.value.toUpperCase() }))} />
          </div>

          <div className="space-y-2">
            <Label>Minimalna wartość zakładu (PLN)</Label>
            <Input type="number" min={0.01} step={0.01} value={form.minBetPln} onChange={(event) => setForm((prev) => ({ ...prev, minBetPln: event.target.value }))} />
          </div>

          <div className="space-y-2">
            <Label>Kolejność</Label>
            <Input type="number" value={form.sortOrder} onChange={(event) => setForm((prev) => ({ ...prev, sortOrder: event.target.value }))} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Switch checked={form.isActive} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked }))} />
          <Label>Aktywne</Label>
        </div>

        <div className="flex gap-2">
          <Button onClick={saveAsset} disabled={saving}>{saving ? 'Zapisywanie...' : form.id ? 'Zapisz zmiany' : 'Dodaj aktywo'}</Button>
          {form.id && (
            <Button variant="outline" onClick={resetForm}>
              Anuluj edycję
            </Button>
          )}
        </div>
      </div>

      <div className="bg-card rounded-xl p-4 card-shadow">
        <h3 className="font-bold mb-3">Aktywa w bazie</h3>

        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="p-2">Symbol</th>
                  <th className="p-2">Nazwa</th>
                  <th className="p-2">Typ</th>
                  <th className="p-2">Waluta</th>
                  <th className="p-2">Min zakład</th>
                  <th className="p-2">Aktywne</th>
                  <th className="p-2">Akcje</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => (
                  <tr key={asset.id} className="border-b border-border/50">
                    <td className="p-2 font-semibold">{asset.symbol}</td>
                    <td className="p-2">{asset.display_name}</td>
                    <td className="p-2">{asset.type}</td>
                    <td className="p-2">{asset.quote_currency}</td>
                    <td className="p-2">{Number(asset.min_bet_pln).toFixed(2)} zł</td>
                    <td className="p-2">{asset.is_active ? 'Tak' : 'Nie'}</td>
                    <td className="p-2">
                      <Button size="sm" variant="outline" onClick={() => editAsset(asset)}>
                        Edytuj
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
