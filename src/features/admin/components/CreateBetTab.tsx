import { useState, useEffect } from 'react';
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
      className="max-w-2xl md:bg-card md:rounded-xl md:p-6 md:card-shadow"
    >
      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="create-title">Tytuł</Label>
        <Input
          id="create-title"
          aria-label="Tytuł zakładu"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="w-full"
        />
      </div>

      {/* Category + Type */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
        <div className="space-y-2">
          <Label htmlFor="create-category">Kategoria</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger id="create-category" aria-label="Wybierz kategorię">
              <SelectValue placeholder="Wybierz" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.emoji} {c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="create-bet-type">Typ zakładu</Label>
          <Select value={betType} onValueChange={(v: string) => setBetType(v as EditableBetType)}>
            <SelectTrigger id="create-bet-type" aria-label="Typ zakładu">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="single">Single</SelectItem>
              <SelectItem value="12">1/2</SelectItem>
              <SelectItem value="1x2">1X2</SelectItem>
              <SelectItem value="multi">Multi</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* End date */}
      <div className="space-y-2 mt-5">
        <Label htmlFor="create-ends-at">Data zakończenia</Label>
        <Input
          id="create-ends-at"
          type="datetime-local"
          aria-label="Data zakończenia zakładu"
          value={endsAt}
          onChange={(e) => setEndsAt(e.target.value)}
          required
          className="w-full"
        />
      </div>

      {/* Toggles */}
      <div className="mt-6 pt-5 border-t border-border space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Opcje dodatkowe</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <Label htmlFor="create-live" className="cursor-pointer">Na żywo</Label>
            <Switch id="create-live" checked={isLive} onCheckedChange={setIsLive} aria-label="Zakład na żywo" />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <Label htmlFor="create-boost" className="cursor-pointer">BSPLICBOOST</Label>
            <Switch id="create-boost" checked={isBsplicboost} onCheckedChange={setIsBsplicboost} aria-label="Włącz BSPLICBOOST" />
          </div>
        </div>
      </div>

      {/* Options */}
      <div className="space-y-2 mt-6">
        <Label>Opcje zakładu</Label>
        <div className="bg-muted/40 border border-border rounded-lg p-3 sm:p-4 space-y-2">
          {options.map((opt, i) => (
            <div key={i} className="flex gap-2 items-center">
              <Input
                value={opt.name}
                onChange={(e) => {
                  const n = [...options];
                  n[i].name = e.target.value;
                  setOptions(n);
                }}
                placeholder={`Opcja ${i + 1}`}
                aria-label={`Nazwa opcji ${i + 1}`}
                className="flex-1"
              />
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
                className="w-20"
                placeholder="Kurs"
                aria-label={`Kurs opcji ${i + 1}`}
              />
              {!hasFixedOptionCount && options.length > 2 && (
                <button
                  type="button"
                  onClick={() => setOptions(options.filter((_, j) => j !== i))}
                  className="text-slate-900 hover:text-destructive transition-colors"
                  aria-label={`Usuń opcję ${i + 1}`}
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
              className="mt-1"
              onClick={() => setOptions([...options, { name: '', odds: '2' }])}
            >
              <Plus className="h-3 w-3 mr-1 text-slate-900" /> Dodaj opcję
            </Button>
          )}
        </div>
      </div>

      {/* Spacer so fixed button on mobile doesn't overlap content */}
      <div className="h-20 md:hidden" aria-hidden="true" />

      {/* Submit — fixed to bottom on mobile, inline on md+ */}
      <div className="fixed bottom-0 inset-x-0 z-30 p-3 bg-background/95 backdrop-blur border-t border-border md:static md:border-0 md:bg-transparent md:backdrop-blur-none md:p-0 md:mt-6 md:z-auto">
        <Button
          type="submit"
          disabled={submitting}
          className="w-full gradient-primary text-primary-foreground font-semibold"
          aria-label={submitting ? 'Tworzenie zakładu w toku' : 'Utwórz zakład'}
        >
          {submitting ? 'Tworzenie…' : 'Utwórz zakład'}
        </Button>
      </div>
    </form>
  );
}
