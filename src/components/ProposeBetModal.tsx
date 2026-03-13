import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Category } from '@/types/database';
import { toast } from 'sonner';
import { Plus, X } from 'lucide-react';

interface ProposeBetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProposeBetModal({ open, onOpenChange }: ProposeBetModalProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [betType, setBetType] = useState<'1x2' | '12' | 'multi'>('12');
  const [options, setOptions] = useState([{ name: '', odds: 2 }, { name: '', odds: 2 }]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from('categories').select('*').order('sort_order').then(({ data }) => {
      if (data) setCategories(data as Category[]);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('bet_proposals').insert({
        user_id: user.id,
        title,
        category_id: categoryId || null,
        bet_type: betType,
        options: options.filter(o => o.name.trim()),
      });
      if (error) throw error;
      toast.success('📋 Zakład zaproponowany — czeka na akceptację admina');
      onOpenChange(false);
      setTitle('');
      setOptions([{ name: '', odds: 2 }, { name: '', odds: 2 }]);
    } catch (err: any) {
      toast.error(err.message);
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
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="np. Kto wygra El Clasico?" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Kategoria</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder="Wybierz" /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.emoji} {c.name}</SelectItem>
                  ))}
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
            <Label>Opcje</Label>
            {options.map((opt, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input
                  value={opt.name}
                  onChange={e => {
                    const newOpts = [...options];
                    newOpts[i].name = e.target.value;
                    setOptions(newOpts);
                  }}
                  placeholder={`Opcja ${i + 1}`}
                  className="flex-1"
                />
                {options.length > 2 && (
                  <button type="button" onClick={() => setOptions(options.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setOptions([...options, { name: '', odds: 2 }])}>
              <Plus className="h-3 w-3 mr-1" /> Dodaj opcję
            </Button>
          </div>
          <Button type="submit" disabled={loading} className="w-full gradient-primary text-primary-foreground font-bold">
            {loading ? 'Wysyłanie...' : 'Wyślij propozycję'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
