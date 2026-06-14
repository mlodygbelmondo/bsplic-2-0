import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { Category, BetOption } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import type { EditableBetType } from '../constants';
import { getErrorMessage, toInputDateTime, getTomorrowAt2359 } from '../helpers';

interface BetOptionDraft {
  name: string;
  odds: string;
}

export default function CreateBetTab() {
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [betType, setBetType] = useState<EditableBetType>('12');
  const [isLive, setIsLive] = useState(false);
  const [isBsplicboost, setIsBsplicboost] = useState(false);
  const [endsAt, setEndsAt] = useState(() => toInputDateTime(getTomorrowAt2359()));
  const [options, setOptions] = useState<BetOptionDraft[]>([{ name: '1', odds: '2' }, { name: '2', odds: '2' }]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const leftColumnRef = useRef<HTMLDivElement>(null);
  const [desktopRightHeight, setDesktopRightHeight] = useState<number | null>(null);

  useEffect(() => {
    supabase.from('categories').select('*').order('sort_order').then(({ data }) => {
      if (data) setCategories(data as Category[]);
    });
  }, []);

  useEffect(() => {
    if (betType === 'single') {
      setOptions([{ name: '1', odds: '2' }]);
    } else if (betType === '12') {
      setOptions([{ name: '1', odds: '2' }, { name: '2', odds: '2' }]);
    } else if (betType === '1x2') {
      setOptions([{ name: '1', odds: '2' }, { name: 'X', odds: '3' }, { name: '2', odds: '2' }]);
    } else if (betType === 'multi') {
      setOptions((prev) => prev.length < 2 ? [{ name: '', odds: '2' }, { name: '', odds: '2' }] : prev);
    }
  }, [betType]);

  const hasFixedOptionCount = betType === 'single' || betType === '12' || betType === '1x2';

  useEffect(() => {
    const syncHeight = () => {
      if (window.innerWidth < 1024 || !leftColumnRef.current) {
        setDesktopRightHeight(null);
        return;
      }

      const nextHeight = Math.ceil(leftColumnRef.current.getBoundingClientRect().height);
      setDesktopRightHeight((prev) => (prev === nextHeight ? prev : nextHeight));
    };

    syncHeight();

    const observer = typeof ResizeObserver !== 'undefined' && leftColumnRef.current
      ? new ResizeObserver(syncHeight)
      : null;

    if (observer && leftColumnRef.current) {
      observer.observe(leftColumnRef.current);
    }

    window.addEventListener('resize', syncHeight);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', syncHeight);
    };
  }, []);

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

    const minOptions = betType === 'single' ? 1 : 2;
    if (cleanedOptions.length < minOptions) {
      toast.error(minOptions === 1 ? 'Dodaj co najmniej 1 opcję' : 'Dodaj co najmniej 2 opcje');
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
        is_bsplicboost: isBsplicboost,
      }]);
      if (error) throw error;
      toast.success('Zakład utworzony!');
      setTitle('');
      setIsBsplicboost(false);
      setEndsAt(toInputDateTime(getTomorrowAt2359()));
      if (betType === 'single') setOptions([{ name: '1', odds: '2' }]);
      else if (betType === '12') setOptions([{ name: '1', odds: '2' }, { name: '2', odds: '2' }]);
      else if (betType === '1x2') setOptions([{ name: '1', odds: '2' }, { name: 'X', odds: '3' }, { name: '2', odds: '2' }]);
      else setOptions([{ name: '', odds: '2' }, { name: '', odds: '2' }]);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Nie udało się utworzyć zakładu'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 pb-24 md:pb-6"
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(340px,1.05fr)] lg:items-start">
        <div ref={leftColumnRef} className="space-y-6">
          {/* Sekcja 1: Podstawowe informacje */}
          <div className="bg-card rounded-xl border border-border p-4 sm:p-6 shadow-sm space-y-4">
            <h3 className="font-semibold text-base sm:text-lg mb-2">Podstawowe informacje</h3>
            
            <div className="space-y-2">
              <Label htmlFor="create-title" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tytuł zakładu</Label>
              <Input
                id="create-title"
                aria-label="Tytuł zakładu"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="np. Kto wygra mecz Polska - Niemcy?"
                required
                className="w-full bg-background"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="create-category" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Kategoria</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger id="create-category" aria-label="Wybierz kategorię" className="bg-background">
                    <SelectValue placeholder="Wybierz kategorię" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.emoji} {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-bet-type" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Typ zakładu</Label>
                <Select value={betType} onValueChange={(v: string) => setBetType(v as EditableBetType)}>
                  <SelectTrigger id="create-bet-type" aria-label="Typ zakładu" className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single (1 opcja)</SelectItem>
                    <SelectItem value="12">1/2 (Dwie opcje)</SelectItem>
                    <SelectItem value="1x2">1X2 (Trzy opcje)</SelectItem>
                    <SelectItem value="multi">Multi (Wiele opcji)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-ends-at" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data zakończenia</Label>
              <Input
                id="create-ends-at"
                type="datetime-local"
                aria-label="Data zakończenia zakładu"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                required
                className="w-full bg-background"
              />
            </div>
          </div>

          {/* Sekcja 2: Opcje dodatkowe */}
          <div className="bg-card rounded-xl border border-border p-4 sm:p-6 shadow-sm space-y-4">
            <h3 className="font-semibold text-base sm:text-lg mb-2">Opcje dodatkowe</h3>
          
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
              <div className="flex items-center justify-between rounded-xl border border-border p-4 bg-background hover:bg-muted/50 transition-colors">
                <div className="space-y-0.5">
                  <Label htmlFor="create-live" className="text-sm font-medium cursor-pointer">Na żywo</Label>
                  <p className="text-xs text-muted-foreground">Oznacz jako wydarzenie live</p>
                </div>
                <Switch id="create-live" checked={isLive} onCheckedChange={setIsLive} aria-label="Zakład na żywo" />
              </div>
            
              <div className="flex items-center justify-between rounded-xl border border-border p-4 bg-background hover:bg-muted/50 transition-colors">
                <div className="space-y-0.5">
                  <Label htmlFor="create-boost" className="text-sm font-medium cursor-pointer text-primary">BSPLICBOOST</Label>
                  <p className="text-xs text-muted-foreground">Wyróżnij wyższym kursem</p>
                </div>
                <Switch id="create-boost" checked={isBsplicboost} onCheckedChange={setIsBsplicboost} aria-label="Włącz BSPLICBOOST" />
              </div>
            </div>
          </div>
        </div>

        <div
          className="flex min-h-0 flex-col gap-4"
          style={desktopRightHeight ? { height: `${desktopRightHeight}px` } : undefined}
        >
          {/* Sekcja 3: Opcje zakładu */}
          <div className="bg-card rounded-xl border border-border p-4 sm:p-6 shadow-sm flex min-h-0 flex-1 flex-col space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-base sm:text-lg">Możliwe typy</h3>
              {!hasFixedOptionCount && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-11 justify-center bg-background text-sm sm:min-h-0 sm:h-8 sm:text-xs"
                  onClick={() => setOptions([...options, { name: '', odds: '2' }])}
                >
                  <Plus className="h-3 w-3 mr-1" /> Dodaj opcję
                </Button>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="space-y-3 px-1 py-1">
                {options.map((opt, i) => (
                  <div key={i} className="group flex min-w-0 items-center gap-3">
                    <div className="relative min-w-0 flex-1">
                      <Label className="sr-only">Nazwa opcji {i + 1}</Label>
                      <Input
                        value={opt.name}
                        onChange={(e) => {
                          const n = [...options];
                          n[i].name = e.target.value;
                          setOptions(n);
                        }}
                        placeholder={`Nazwa opcji (np. Polska)`}
                        aria-label={`Nazwa opcji ${i + 1}`}
                        className="w-full bg-background"
                      />
                    </div>
                    <div className="relative w-24 shrink-0">
                      <Label className="sr-only">Kurs opcji {i + 1}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="1"
                        value={opt.odds}
                        onChange={(e) => {
                          const n = [...options];
                          n[i].odds = e.target.value;
                          setOptions(n);
                        }}
                        className="w-full bg-background text-center font-semibold text-primary"
                        placeholder="Kurs"
                        aria-label={`Kurs opcji ${i + 1}`}
                      />
                    </div>
                    {!hasFixedOptionCount && options.length > 2 ? (
                      <button
                        type="button"
                        onClick={() => setOptions(options.filter((_, j) => j !== i))}
                        className="h-10 w-10 shrink-0 flex items-center justify-center rounded-md border border-transparent text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 transition-colors"
                        aria-label={`Usuń opcję ${i + 1}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="hidden lg:block">
            <Button
              type="submit"
              size="lg"
              disabled={submitting}
              className="w-full gradient-primary text-primary-foreground font-bold shadow-lg shadow-primary/25 rounded-xl h-12 text-base"
              aria-label={submitting ? 'Tworzenie zakładu w toku' : 'Utwórz zakład'}
            >
              {submitting ? 'Tworzenie...' : 'Utwórz zakład'}
            </Button>
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="fixed inset-x-0 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-40 p-4 bg-background/80 backdrop-blur-md border-t border-border lg:hidden">
        <Button
          type="submit"
          size="lg"
          disabled={submitting}
          className="w-full gradient-primary text-primary-foreground font-bold shadow-lg shadow-primary/25 rounded-xl h-12 text-base"
          aria-label={submitting ? 'Tworzenie zakładu w toku' : 'Utwórz zakład'}
        >
          {submitting ? 'Tworzenie...' : 'Utwórz zakład'}
        </Button>
      </div>
    </form>
  );
}
