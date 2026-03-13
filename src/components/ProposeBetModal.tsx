import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { createBetProposal } from '@/features/home/api/betProposals';
import { Category } from '@/types/database';
import { toast } from 'sonner';

interface ProposeBetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
}

const FIXED_OPTION_COUNTS: Record<string, number> = {
  '12': 2,
  '1x2': 3,
};

const hasFixedOptionCount = (type: string) => type in FIXED_OPTION_COUNTS;

const OPTION_DEFAULTS: Record<'1x2' | '12' | 'multi', string[]> = {
  '12': ['1', '2'],
  '1x2': ['1', 'X', '2'],
  multi: ['', ''],
};

export function ProposeBetModal({ open, onOpenChange, categories }: ProposeBetModalProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [betType, setBetType] = useState<'1x2' | '12' | 'multi'>('12');
  const [options, setOptions] = useState([
    { name: '1', odds: 2 },
    { name: '2', odds: 2 },
  ]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (hasFixedOptionCount(betType)) {
      const optionCount = FIXED_OPTION_COUNTS[betType];
      setOptions((previous) =>
        Array.from({ length: optionCount }, (_, index) => ({
          name: previous[index]?.name ?? OPTION_DEFAULTS[betType][index] ?? '',
          odds: previous[index]?.odds ?? (betType === '1x2' && index === 1 ? 3 : 2),
        })),
      );
    } else {
      setOptions((previous) =>
        previous.length >= 2
          ? previous
          : [
              { name: '', odds: 2 },
              { name: '', odds: 2 },
            ],
      );
    }
  }, [betType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const preparedOptions = options.map((option) => ({
      name: option.name.trim(),
      odds: Number(option.odds) > 0 ? Number(option.odds) : 1,
    }));

    if (preparedOptions.some((option) => !option.name)) {
      toast.error('Uzupełnij etykiety wszystkich opcji');
      return;
    }

    if (preparedOptions.length < 2) {
      toast.error('Dodaj co najmniej 2 opcje');
      return;
    }

    setLoading(true);

    try {
      await createBetProposal({
        userId: user.id,
        title,
        categoryId: categoryId || null,
        betType,
        options: preparedOptions,
      });

      toast.success('📋 Zakład zaproponowany — czeka na akceptację admina');
      onOpenChange(false);
      setTitle('');
      setCategoryId('');
      setBetType('12');
      setOptions([
        { name: '1', odds: 2 },
        { name: '2', odds: 2 },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nie udało się wysłać propozycji';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-bold">Zaproponuj zakład</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Tytuł</Label>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="np. Kto wygra El Clasico?" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Kategoria</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
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
              <Select value={betType} onValueChange={(value: '1x2' | '12' | 'multi') => setBetType(value)}>
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
            <Label>
              Opcje <span className="text-xs text-muted-foreground ml-1">(stała liczba dla typu)</span>
            </Label>

            {options.map((option, index) => (
              <div key={index} className="flex gap-2 items-center">
                <Input
                  value={option.name}
                  onChange={(event) => {
                    const nextOptions = [...options];
                    nextOptions[index].name = event.target.value;
                    setOptions(nextOptions);
                  }}
                  placeholder={`Opcja ${index + 1}`}
                  className="flex-1"
                />
                <Input
                  type="number"
                  step="0.01"
                  min="1"
                  value={option.odds}
                  onChange={(event) => {
                    const nextOptions = [...options];
                    nextOptions[index].odds = Number(event.target.value);
                    setOptions(nextOptions);
                  }}
                  className="w-24"
                  placeholder="Kurs"
                />
              </div>
            ))}
          </div>

          <Button type="submit" disabled={loading} className="w-full gradient-primary text-primary-foreground font-bold">
            {loading ? 'Wysyłanie...' : 'Wyślij propozycję'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
