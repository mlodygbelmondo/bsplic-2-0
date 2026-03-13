import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Bet, BetOption, BetProposal, Category } from '@/types/database';
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

type AdminTab = 'dashboard' | 'create' | 'manage' | 'proposals' | 'categories';

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
          ] as [AdminTab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn('px-4 py-2 rounded-lg text-sm font-medium', tab === key ? 'bg-primary text-primary-foreground' : 'bg-muted')}
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
      </div>
    </div>
  );
}

function DashboardTab() {
  const [stats, setStats] = useState({ totalBets: 0, totalPool: 0, pendingProposals: 0 });

  useEffect(() => {
    const fetch = async () => {
      const { count: totalBets } = await supabase.from('placed_bets').select('*', { count: 'exact', head: true });
      const { data: bets } = await supabase.from('placed_bets').select('stake');
      const totalPool = bets?.reduce((acc, b) => acc + Number(b.stake), 0) || 0;
      const { count: pendingProposals } = await supabase.from('bet_proposals').select('*', { count: 'exact', head: true }).eq('status', 'pending');
      setStats({ totalBets: totalBets || 0, totalPool, pendingProposals: pendingProposals || 0 });
    };
    fetch();
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-card rounded-xl p-6 border">
        <p className="text-sm text-muted-foreground">Łączna liczba zakładów</p>
        <p className="text-3xl font-bold">{stats.totalBets}</p>
      </div>
      <div className="bg-card rounded-xl p-6 border">
        <p className="text-sm text-muted-foreground">Łączna pula</p>
        <p className="text-3xl font-bold">{stats.totalPool.toFixed(0)} zł</p>
      </div>
      <div className="bg-card rounded-xl p-6 border">
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
  const [endsAt, setEndsAt] = useState('');
  const [options, setOptions] = useState<BetOption[]>([{ name: '', odds: 2 }, { name: '', odds: 2 }]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.from('categories').select('*').order('sort_order').then(({ data }) => {
      if (data) setCategories(data as Category[]);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await supabase.from('bets').insert([{
        title,
        category_id: categoryId || null,
        bet_type: betType,
        options: options.filter(o => o.name.trim()) as unknown as any,
        ends_at: new Date(endsAt).toISOString(),
        is_live: isLive,
      }]);
      if (error) throw error;
      toast.success('Zakład utworzony!');
      setTitle('');
      setOptions([{ name: '', odds: 2 }, { name: '', odds: 2 }]);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-xl p-6 border space-y-4 max-w-2xl">
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
          <Select value={betType} onValueChange={(v: any) => setBetType(v)}>
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
            <Input value={opt.name} onChange={e => { const n = [...options]; n[i].name = e.target.value; setOptions(n); }} placeholder={`Opcja ${i+1}`} className="flex-1" />
            <Input type="number" step="0.01" min="1" value={opt.odds} onChange={e => { const n = [...options]; n[i].odds = Number(e.target.value); setOptions(n); }} className="w-24" />
            {options.length > 2 && (
              <button type="button" onClick={() => setOptions(options.filter((_, j) => j !== i))}><X className="h-4 w-4 text-muted-foreground" /></button>
            )}
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => setOptions([...options, { name: '', odds: 2 }])}>
          <Plus className="h-3 w-3 mr-1" /> Dodaj opcję
        </Button>
      </div>
      <Button type="submit" disabled={submitting} className="gradient-primary text-primary-foreground font-bold">
        {submitting ? 'Tworzenie...' : 'Utwórz zakład'}
      </Button>
    </form>
  );
}

function ManageBetsTab() {
  const [bets, setBets] = useState<Bet[]>([]);
  const [resolveModal, setResolveModal] = useState<Bet | null>(null);

  const fetchBets = async () => {
    const { data } = await supabase.from('bets').select('*').order('created_at', { ascending: false });
    if (data) setBets(data as unknown as Bet[]);
  };

  useEffect(() => { fetchBets(); }, []);

  const resolveBet = async (bet: Bet, winningOption: string) => {
    // Update bet
    await supabase.from('bets').update({ winning_option: winningOption, is_active: false }).eq('id', bet.id);
    // Update placed bets
    const { data: placedBets } = await supabase.from('placed_bets').select('*').eq('bet_id', bet.id);
    if (placedBets) {
      for (const pb of placedBets) {
        const won = pb.selected_option === winningOption;
        const payout = won ? Number(pb.stake) * Number(pb.odds_at_time) : 0;
        await supabase.from('placed_bets').update({ result: won ? 'won' : 'lost', payout }).eq('id', pb.id);
        if (won) {
          const { data: profile } = await supabase.from('profiles').select('balance').eq('id', pb.user_id).single();
          if (profile) {
            await supabase.from('profiles').update({ balance: Number(profile.balance) + payout }).eq('id', pb.user_id);
          }
        }
      }
    }
    toast.success('Wynik ogłoszony!');
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    setResolveModal(null);
    fetchBets();
  };

  return (
    <>
      <div className="bg-card rounded-xl border overflow-hidden">
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
                    {!bet.winning_option && (
                      <Button size="sm" variant="outline" onClick={() => setResolveModal(bet)}>
                        <Trophy className="h-3 w-3 mr-1" /> Ogłoś wynik
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
  const [proposals, setProposals] = useState<any[]>([]);

  const fetchProposals = async () => {
    const { data } = await supabase.from('bet_proposals').select('*, profile:profiles(username)').eq('status', 'pending').order('created_at', { ascending: false });
    if (data) setProposals(data);
  };

  useEffect(() => { fetchProposals(); }, []);

  const accept = async (p: any) => {
    // Create bet from proposal
    await supabase.from('bets').insert([{
      title: p.title,
      category_id: p.category_id,
      bet_type: p.bet_type,
      options: p.options as any,
      ends_at: new Date(Date.now() + 86400000).toISOString(),
    }]);
    await supabase.from('bet_proposals').update({ status: 'accepted' }).eq('id', p.id);
    toast.success('Propozycja zaakceptowana');
    fetchProposals();
  };

  const reject = async (p: any) => {
    await supabase.from('bet_proposals').update({ status: 'rejected' }).eq('id', p.id);
    toast.info('Propozycja odrzucona');
    fetchProposals();
  };

  return (
    <div className="space-y-3">
      {proposals.length === 0 && <p className="text-muted-foreground text-center py-8">Brak propozycji</p>}
      {proposals.map(p => (
        <div key={p.id} className="bg-card rounded-xl p-4 border flex items-center justify-between">
          <div>
            <p className="font-bold">{p.title}</p>
            <p className="text-xs text-muted-foreground">Od: {p.profile?.username || 'Użytkownik'} • {p.bet_type}</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => accept(p)} className="bg-success text-success-foreground"><Check className="h-3 w-3 mr-1" /> Akceptuj</Button>
            <Button size="sm" variant="outline" onClick={() => reject(p)}><XCircle className="h-3 w-3 mr-1" /> Odrzuć</Button>
          </div>
        </div>
      ))}
    </div>
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
      <div className="bg-card rounded-xl p-4 border">
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

      <div className="bg-card rounded-xl border overflow-hidden">
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
