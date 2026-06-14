import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Category } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationEllipsis,
} from '@/components/ui/pagination';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Plus, Trash2, Pencil, ChevronLeft, ChevronRight } from 'lucide-react';
import { getErrorMessage } from '../helpers';

const PAGE_SIZE = 10;

export default function CategoriesTab() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCat, setNewCat] = useState({ name: '', emoji: '⚽', color: '#dc2626', sort_order: 0 });
  const [adding, setAdding] = useState(false);

  // Pagination
  const [page, setPage] = useState(0);

  // Edit modal
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [editForm, setEditForm] = useState({ name: '', emoji: '', color: '', sort_order: 0 });
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  const fetchCats = async () => {
    const { data } = await supabase.from('categories').select('*').order('sort_order');
    if (data) setCategories(data as Category[]);
  };

  useEffect(() => { fetchCats(); }, []);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(categories.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paginated = useMemo(
    () => categories.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE),
    [categories, safePage]
  );
  const showPagination = categories.length > PAGE_SIZE;

  const addCategory = async () => {
    if (!newCat.name.trim()) return;
    setAdding(true);
    try {
      const { error } = await supabase.from('categories').insert(newCat);
      if (error) throw error;
      setNewCat({ name: '', emoji: '⚽', color: '#dc2626', sort_order: categories.length + 1 });
      fetchCats();
      toast.success('Kategoria dodana');
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Nie udało się dodać kategorii'));
    } finally {
      setAdding(false);
    }
  };

  const deleteCategory = async (id: string) => {
    const { count } = await supabase.from('bets').select('*', { count: 'exact', head: true }).eq('category_id', id).eq('is_active', true);
    if (count && count > 0) {
      toast.error('Usuń najpierw aktywne zakłady w tej kategorii');
      return;
    }
    try {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
      fetchCats();
      toast.success('Kategoria usunięta');
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Nie udało się usunąć kategorii'));
    }
  };

  // Edit
  const openEditModal = (cat: Category) => {
    setEditingCat(cat);
    setEditForm({
      name: cat.name,
      emoji: cat.emoji,
      color: cat.color,
      sort_order: cat.sort_order,
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editingCat) return;
    if (!editForm.name.trim()) { toast.error('Nazwa jest wymagana'); return; }

    setEditSaving(true);
    try {
      const { error } = await supabase
        .from('categories')
        .update({
          name: editForm.name.trim(),
          emoji: editForm.emoji,
          color: editForm.color,
          sort_order: editForm.sort_order,
        })
        .eq('id', editingCat.id);
      if (error) throw error;
      toast.success('Kategoria zaktualizowana');
      setEditOpen(false);
      setEditingCat(null);
      fetchCats();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Nie udało się zaktualizować kategorii'));
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Add category form */}
      <div className="bg-card rounded-xl p-3 sm:p-4 card-shadow">
        <h3 className="font-semibold text-sm mb-3">Dodaj kategorię</h3>

        {/* Mobile layout — 2-column grid */}
        <div className="grid grid-cols-4 gap-2 items-end sm:hidden">
          <div className="col-span-1 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Emoji</label>
            <Input
              value={newCat.emoji}
              onChange={(e) => setNewCat({ ...newCat, emoji: e.target.value })}
              className="text-center"
              aria-label="Emoji nowej kategorii"
            />
          </div>
          <div className="col-span-3 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Nazwa</label>
            <Input
              value={newCat.name}
              onChange={(e) => setNewCat({ ...newCat, name: e.target.value })}
              aria-label="Nazwa nowej kategorii"
            />
          </div>
          <div className="col-span-1 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Kolor</label>
            <label
              className="h-11 w-full min-w-11 rounded-lg border-2 border-border block shadow-sm cursor-pointer relative overflow-hidden"
              style={{ backgroundColor: newCat.color }}
              title={newCat.color}
            >
              <input
                type="color"
                value={newCat.color}
                onChange={(e) => setNewCat({ ...newCat, color: e.target.value })}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                aria-label="Kolor nowej kategorii"
              />
            </label>
          </div>
          <div className="col-span-1 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Kolejność</label>
            <Input
              type="number"
              value={newCat.sort_order}
              onChange={(e) => setNewCat({ ...newCat, sort_order: Number(e.target.value) })}
              aria-label="Kolejność nowej kategorii"
            />
          </div>
          <div className="col-span-2">
            <Button onClick={addCategory} disabled={adding} size="sm" className="min-h-11 w-full justify-center text-sm">
              <Plus className="h-3 w-3 mr-1" /> Dodaj
            </Button>
          </div>
        </div>

        {/* Desktop layout — 12-column proportional grid */}
        <div className="hidden sm:grid grid-cols-12 gap-3 items-end">
          <div className="col-span-1 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Emoji</label>
            <Input
              value={newCat.emoji}
              onChange={(e) => setNewCat({ ...newCat, emoji: e.target.value })}
              className="text-center px-1"
              aria-label="Emoji nowej kategorii"
            />
          </div>
          <div className="col-span-5 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Nazwa</label>
            <Input
              value={newCat.name}
              onChange={(e) => setNewCat({ ...newCat, name: e.target.value })}
              aria-label="Nazwa nowej kategorii"
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Kolor</label>
            <label
              className="h-9 w-9 rounded-lg border-2 border-border block shadow-sm cursor-pointer relative overflow-hidden"
              style={{ backgroundColor: newCat.color }}
              title={newCat.color}
            >
              <input
                type="color"
                value={newCat.color}
                onChange={(e) => setNewCat({ ...newCat, color: e.target.value })}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                aria-label="Kolor nowej kategorii"
              />
            </label>
          </div>
          <div className="col-span-2 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Kolejność</label>
            <Input
              type="number"
              value={newCat.sort_order}
              onChange={(e) => setNewCat({ ...newCat, sort_order: Number(e.target.value) })}
              aria-label="Kolejność nowej kategorii"
            />
          </div>
          <div className="col-span-2">
            <Button onClick={addCategory} disabled={adding} size="sm" className="w-full">
              <Plus className="h-3 w-3 mr-1" /> Dodaj
            </Button>
          </div>
        </div>
      </div>

      {/* Pagination — top */}
      {showPagination && (
        <CategoryPagination currentPage={safePage} totalPages={totalPages} onPageChange={setPage} />
      )}

      {/* Mobile card list */}
      <div className="space-y-2 md:hidden">
        {paginated.map((cat) => (
          <div key={cat.id} className="bg-card rounded-xl p-3 card-shadow flex items-center gap-3">
            <span className="text-lg">{cat.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{cat.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className="inline-block w-3.5 h-3.5 rounded-full shrink-0 border border-border/50"
                  style={{ backgroundColor: cat.color }}
                />
                <span className="text-[10px] text-muted-foreground">#{cat.sort_order}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button size="sm" variant="outline" className="h-11 w-11 p-0 rounded-lg" onClick={() => openEditModal(cat)} aria-label={`Edytuj ${cat.name}`}>
                <Pencil className="h-4 w-4 text-foreground" />
              </Button>
              <Button size="sm" variant="destructive" className="h-11 w-11 p-0 rounded-lg" onClick={() => deleteCategory(cat.id)} aria-label={`Usuń ${cat.name}`}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-card rounded-xl card-shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Emoji</th>
              <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nazwa</th>
              <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kolor</th>
              <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kolejność</th>
              <th className="w-[220px] px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((cat) => (
              <tr key={cat.id} className="border-b hover:bg-muted/30 transition-colors">
                <td className="px-3 py-2">{cat.emoji}</td>
                <td className="px-3 py-2 font-medium">{cat.name}</td>
                <td className="px-3 py-2">
                  <span
                    className="inline-block w-5 h-5 rounded-md border border-border/50 shadow-sm"
                    style={{ backgroundColor: cat.color }}
                  />
                </td>
                <td className="px-3 py-2 tabular-nums text-muted-foreground">{cat.sort_order}</td>
                <td className="w-[220px] px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEditModal(cat)} aria-label={`Edytuj ${cat.name}`}>
                      <Pencil className="h-3 w-3 mr-1 text-foreground" /> Edytuj
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => deleteCategory(cat.id)} aria-label={`Usuń ${cat.name}`}>
                      <Trash2 className="h-3 w-3 mr-1" /> Usuń
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination — bottom */}
      {showPagination && (
        <CategoryPagination currentPage={safePage} totalPages={totalPages} onPageChange={setPage} />
      )}

      {/* Edit category dialog */}
      <Dialog open={editOpen} onOpenChange={(open) => { setEditOpen(open); if (!open) setEditingCat(null); }}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Edytuj kategorię</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3 items-end">
              <div className="col-span-1 space-y-1.5">
                <Label htmlFor="edit-cat-emoji">Emoji</Label>
                <Input
                  id="edit-cat-emoji"
                  value={editForm.emoji}
                  onChange={(e) => setEditForm((f) => ({ ...f, emoji: e.target.value }))}
                  className="text-center"
                />
              </div>
              <div className="col-span-3 space-y-1.5">
                <Label htmlFor="edit-cat-name">Nazwa</Label>
                <Input
                  id="edit-cat-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 items-end">
              <div className="space-y-1.5">
                <Label>Kolor</Label>
                <label
                  className="h-9 w-full rounded-lg border-2 border-border block shadow-sm cursor-pointer relative overflow-hidden"
                  style={{ backgroundColor: editForm.color }}
                  title={editForm.color}
                >
                  <input
                    type="color"
                    value={editForm.color}
                    onChange={(e) => setEditForm((f) => ({ ...f, color: e.target.value }))}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    aria-label="Kolor kategorii"
                  />
                </label>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-cat-order">Kolejność</Label>
                <Input
                  id="edit-cat-order"
                  type="number"
                  value={editForm.sort_order}
                  onChange={(e) => setEditForm((f) => ({ ...f, sort_order: Number(e.target.value) }))}
                />
              </div>
            </div>

            <Button onClick={saveEdit} disabled={editSaving} className="min-h-11 w-full justify-center gradient-primary text-primary-foreground font-bold">
              {editSaving ? 'Zapisywanie…' : 'Zapisz zmiany'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Reusable pagination bar for categories. */
function CategoryPagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const pages = getCategoryPaginationRange(currentPage, totalPages);

  return (
    <Pagination aria-label="Nawigacja po stronach kategorii">
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

function getCategoryPaginationRange(current: number, total: number): (number | 'ellipsis')[] {
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
