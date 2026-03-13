import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { createBetProposal } from '@/features/home/api/betProposals';
import { Category } from '@/types/database';
import { toast } from 'sonner';
import { Plus, X } from 'lucide-react';

interface ProposeBetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
}

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
    if (betType === '12') {
      setOptions([
        { name: '1', odds: 2 },
        { name: '2', odds: 2 },
      ]);
      return;
    }

    if (betType === '1x2') {
      setOptions([
        { name: '1', odds: 2 },
        { name: 'X', odds: 3 },
        { name: '2', odds: 2 },
      ]);
      return;
    }

    setOptions((previous) => {
      if (previous.length >= 2) return previous;
      return [
        { name: '', odds: 2 },
        { name: '', odds: 2 },
      ];
    });
  }, [betType]);

  const isLocked = betType === '12' || betType === '1x2';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const preparedOptions = options
      .filter((option) => option.name.trim())
      .map((option) => ({
        name: option.name.trim(),
        odds: Number(option.odds) > 0 ? Number(option.odds) : 1,
      }));

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
              Opcje {isLocked && <span className="text-xs text-muted-foreground ml-1">(zablokowane dla tego typu)</span>}
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
                  disabled={isLocked}
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
                {!isLocked && options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => setOptions(options.filter((_, optionIndex) => optionIndex !== index))}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}

            {!isLocked && (
              <Button type="button" variant="outline" size="sm" onClick={() => setOptions([...options, { name: '', odds: 2 }])}>
                <Plus className="h-3 w-3 mr-1" /> Dodaj opcję
              </Button>
            )}
          </div>

          <Button type="submit" disabled={loading} className="w-full gradient-primary text-primary-foreground font-bold">
            {loading ? 'Wysyłanie...' : 'Wyślij propozycję'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
