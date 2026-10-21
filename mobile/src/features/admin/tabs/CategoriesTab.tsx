import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { memo, useState, type ReactNode } from 'react';
import { Alert, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { getErrorMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { toast } from '@/lib/toast';
import { alpha, createStyles, useTheme } from '@/theme';
import { getCategoryOptions } from '@/features/home/logic/category-tree';
import type { Category } from '@/types/database';
import { Button, SectionLoader, StateMessage, Text } from '@/ui';
import {
  CATEGORIES_QUERY_KEY,
  categoriesQueryOptions,
  countActiveBetsInCategory,
  deleteCategory,
  insertCategory,
  updateCategory,
} from '../b/api/categories';
import { ColorField } from '../b/components/ColorField';
import { FormModal } from '../b/components/FormModal';
import { AdminCard, FormField, Input, OfflineNotice } from '../b/components/primitives';
import { SelectField } from '../b/components/SelectField';
import { useAdminWriteGuard, useQueryErrorToast } from '../b/hooks';
import {
  CATEGORY_PAGE_SIZE,
  createNewCategoryForm,
  getCategoryPaginationRange,
  getParentCategoryChoices,
  getParentSelectOptions,
  parentIdToSelectValue,
  parseSortOrder,
  selectValueToParentId,
  toCategoryForm,
  type CategoryForm,
} from '../b/logic/categories';

/** Admin "Kategorie" tab (web `CategoriesTab`). */
export function CategoriesTab() {
  const styles = useStyles();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const { offline, ensureOnline } = useAdminWriteGuard();
  const query = useQuery(categoriesQueryOptions());
  const categories = query.data ?? [];

  const [newCat, setNewCat] = useState<CategoryForm>(() => createNewCategoryForm());
  const [adding, setAdding] = useState(false);
  const [page, setPage] = useState(0);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [editForm, setEditForm] = useState<CategoryForm>(() => createNewCategoryForm());
  const [editSaving, setEditSaving] = useState(false);

  useQueryErrorToast(query.error, query.errorUpdatedAt, (error) =>
    getErrorMessage(error, 'Nie udało się pobrać kategorii'),
  );

  // Hierarchy: each sport is listed with its leagues right below it. Only
  // top-level categories can be parents (max two levels).
  const orderedCategories = getCategoryOptions(categories);
  const newParentChoices = getParentCategoryChoices(categories, null);
  const editParentChoices = getParentCategoryChoices(categories, editingCat);

  const totalPages = Math.max(1, Math.ceil(orderedCategories.length / CATEGORY_PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paginated = orderedCategories.slice(safePage * CATEGORY_PAGE_SIZE, (safePage + 1) * CATEGORY_PAGE_SIZE);
  const showPagination = orderedCategories.length > CATEGORY_PAGE_SIZE;

  const refresh = () => queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });

  const addCategory = async () => {
    if (!newCat.name.trim() || adding) return;
    if (!ensureOnline()) return;
    setAdding(true);
    try {
      await insertCategory(newCat);
      setNewCat(createNewCategoryForm(categories.length + 1));
      void refresh();
      toast.success('Kategoria dodana');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Nie udało się dodać kategorii'));
    } finally {
      setAdding(false);
    }
  };

  const removeCategory = async (category: Category) => {
    try {
      const activeBets = await countActiveBetsInCategory(category.id);
      if (activeBets > 0) {
        toast.error('Usuń najpierw aktywne zakłady w tej kategorii');
        return;
      }
      await deleteCategory(category.id);
      void refresh();
      toast.success('Kategoria usunięta');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Nie udało się usunąć kategorii'));
    }
  };

  const confirmDelete = (category: Category) => {
    if (!ensureOnline()) return;
    Alert.alert(`Czy na pewno chcesz usunąć kategorię "${category.name}"?`, undefined, [
      { text: 'Anuluj', style: 'cancel' },
      { text: 'Usuń', style: 'destructive', onPress: () => void removeCategory(category) },
    ]);
  };

  const openEditModal = (category: Category) => {
    setEditingCat(category);
    setEditForm(toCategoryForm(category));
  };

  const saveEdit = async () => {
    if (!editingCat || editSaving) return;
    if (!editForm.name.trim()) {
      toast.error('Nazwa jest wymagana');
      return;
    }
    if (!ensureOnline()) return;
    setEditSaving(true);
    try {
      await updateCategory(editingCat.id, editForm);
      toast.success('Kategoria zaktualizowana');
      setEditingCat(null);
      void refresh();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Nie udało się zaktualizować kategorii'));
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      {offline ? <OfflineNotice /> : null}

      <AdminCard style={styles.addCard}>
        <Text weight="600" style={{ marginBottom: 12 }}>
          Dodaj kategorię
        </Text>
        <View style={styles.formGrid}>
          <View style={styles.row}>
            <SmallField label="Emoji" style={styles.col1}>
              <Input
                accessibilityLabel="Emoji nowej kategorii"
                value={newCat.emoji}
                onChangeText={(emoji) => setNewCat({ ...newCat, emoji })}
                style={styles.centered}
              />
            </SmallField>
            <SmallField label="Nazwa" style={styles.col3}>
              <Input
                accessibilityLabel="Nazwa nowej kategorii"
                value={newCat.name}
                onChangeText={(name) => setNewCat({ ...newCat, name })}
                returnKeyType="done"
                onSubmitEditing={() => void addCategory()}
              />
            </SmallField>
          </View>
          <SmallField label="Kategoria nadrzędna">
            <SelectField
              accessibilityLabel="Kategoria nadrzędna nowej kategorii"
              value={parentIdToSelectValue(newCat.parent_id)}
              options={getParentSelectOptions(newParentChoices.options)}
              onChange={(value) => setNewCat((form) => ({ ...form, parent_id: selectValueToParentId(value) }))}
            />
          </SmallField>
          <View style={[styles.row, styles.alignEnd]}>
            <SmallField label="Kolor" style={styles.col1}>
              <ColorField
                accessibilityLabel="Kolor nowej kategorii"
                value={newCat.color}
                onChange={(color) => setNewCat((form) => ({ ...form, color }))}
              />
            </SmallField>
            <SmallField label="Kolejność" style={styles.col1}>
              <Input
                accessibilityLabel="Kolejność nowej kategorii"
                keyboardType="number-pad"
                value={String(newCat.sort_order)}
                onChangeText={(value) => setNewCat({ ...newCat, sort_order: parseSortOrder(value) })}
              />
            </SmallField>
            <View style={styles.col2}>
              <Button
                size="sm"
                label="Dodaj"
                icon={<Plus size={12} color={colors.primaryForeground} />}
                disabled={adding || offline}
                onPress={() => void addCategory()}
                style={styles.tallButton}
              />
            </View>
          </View>
        </View>
      </AdminCard>

      {query.isPending ? <SectionLoader size="sm" label="Ładowanie..." /> : null}
      {query.isError && !query.data ? (
        <StateMessage
          title="Nie udało się pobrać kategorii"
          description={getErrorMessage(query.error, '')}
          actionLabel="Spróbuj ponownie"
          onAction={() => void query.refetch()}
        />
      ) : null}

      {showPagination ? (
        <CategoryPagination currentPage={safePage} totalPages={totalPages} onPageChange={setPage} />
      ) : null}

      <View style={styles.list}>
        {paginated.map(({ category, parent }) => (
          <CategoryRow
            key={category.id}
            category={category}
            parent={parent}
            disabled={offline}
            onEdit={openEditModal}
            onDelete={confirmDelete}
          />
        ))}
      </View>

      {showPagination ? (
        <CategoryPagination currentPage={safePage} totalPages={totalPages} onPageChange={setPage} />
      ) : null}

      <FormModal visible={editingCat !== null} title="Edytuj kategorię" onClose={() => setEditingCat(null)}>
        <View style={[styles.row, { gap: 12 }]}>
          <FormField label="Emoji" style={styles.col1}>
            <Input
              value={editForm.emoji}
              onChangeText={(emoji) => setEditForm((form) => ({ ...form, emoji }))}
              style={styles.centered}
            />
          </FormField>
          <FormField label="Nazwa" style={styles.col3}>
            <Input value={editForm.name} onChangeText={(name) => setEditForm((form) => ({ ...form, name }))} />
          </FormField>
        </View>
        <FormField label="Kategoria nadrzędna">
          <SelectField
            accessibilityLabel="Kategoria nadrzędna"
            value={parentIdToSelectValue(editForm.parent_id)}
            options={getParentSelectOptions(editParentChoices.options)}
            disabled={editParentChoices.locked}
            onChange={(value) => setEditForm((form) => ({ ...form, parent_id: selectValueToParentId(value) }))}
          />
          {editParentChoices.locked ? (
            <Text size="xs" color="mutedForeground">
              Ta kategoria ma podkategorie, więc sama nie może mieć kategorii nadrzędnej.
            </Text>
          ) : null}
        </FormField>
        <View style={[styles.row, styles.alignEnd, { gap: 12 }]}>
          <FormField label="Kolor" style={styles.col1}>
            <ColorField
              accessibilityLabel="Kolor kategorii"
              height={36}
              value={editForm.color}
              onChange={(color) => setEditForm((form) => ({ ...form, color }))}
            />
          </FormField>
          <FormField label="Kolejność" style={styles.col1}>
            <Input
              keyboardType="number-pad"
              value={String(editForm.sort_order)}
              onChangeText={(value) => setEditForm((form) => ({ ...form, sort_order: parseSortOrder(value) }))}
            />
          </FormField>
        </View>
        <Button
          variant="gradient"
          label={editSaving ? 'Zapisywanie…' : 'Zapisz zmiany'}
          disabled={editSaving || offline}
          onPress={() => void saveEdit()}
          style={styles.tallButton}
        />
      </FormModal>
    </View>
  );
}

function SmallField({ label, style, children }: { label: string; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  return (
    <View style={[{ gap: 6 }, style]}>
      <Text size="xs" weight="500" color="mutedForeground">
        {label}
      </Text>
      {children}
    </View>
  );
}

const CategoryRow = memo(function CategoryRow({
  category,
  parent,
  disabled,
  onEdit,
  onDelete,
}: {
  category: Category;
  parent: Category | null;
  disabled: boolean;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <AdminCard style={[styles.categoryCard, parent && styles.childCard]}>
      {parent ? (
        <Text color="mutedForeground" accessibilityElementsHidden importantForAccessibility="no">
          ↳
        </Text>
      ) : null}
      <Text size="lg">{category.emoji}</Text>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text weight="500" numberOfLines={1}>
          {category.name}
        </Text>
        <View style={styles.categoryMeta}>
          <View style={[styles.colorDot, { backgroundColor: category.color }]} />
          <Text size="2xs" color="mutedForeground">
            #{category.sort_order}
          </Text>
          {parent ? (
            <Text size="2xs" color="mutedForeground" numberOfLines={1} style={styles.parentName}>
              {parent.name}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.rowActions}>
        <Button
          variant="outline"
          size="icon"
          accessibilityLabel={`Edytuj ${category.name}`}
          onPress={() => onEdit(category)}
          style={styles.iconButton}
        >
          <Pencil size={16} color={colors.foreground} />
        </Button>
        <Button
          variant="destructive"
          size="icon"
          accessibilityLabel={`Usuń ${category.name}`}
          disabled={disabled}
          onPress={() => onDelete(category)}
          style={styles.iconButton}
        >
          <Trash2 size={16} color={colors.destructiveForeground} />
        </Button>
      </View>
    </AdminCard>
  );
});

/** shadcn `Pagination` used above and below the category list. */
function CategoryPagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const pages = getCategoryPaginationRange(currentPage, totalPages);
  const atStart = currentPage === 0;
  const atEnd = currentPage >= totalPages - 1;
  const go = (next: number) => {
    haptics.selection();
    onPageChange(next);
  };

  return (
    <View accessibilityLabel="Nawigacja po stronach kategorii" style={styles.pagination}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Poprzednia strona"
        accessibilityState={{ disabled: atStart }}
        disabled={atStart}
        onPress={() => go(Math.max(0, currentPage - 1))}
        style={[styles.pageButton, styles.pageNav, atStart && styles.pageDisabled]}
      >
        <ChevronLeft size={16} color={colors.foreground} />
      </Pressable>
      {pages.map((page, index) =>
        page === 'ellipsis' ? (
          <View key={`e-${index}`} style={styles.ellipsis}>
            <MoreHorizontal size={16} color={colors.foreground} />
          </View>
        ) : (
          <Pressable
            key={page}
            accessibilityRole="button"
            accessibilityLabel={`Strona ${page + 1}`}
            accessibilityState={{ selected: page === currentPage }}
            onPress={() => go(page)}
            style={[styles.pageButton, page === currentPage && styles.pageActive]}
          >
            <Text weight="500">{page + 1}</Text>
          </Pressable>
        ),
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Następna strona"
        accessibilityState={{ disabled: atEnd }}
        disabled={atEnd}
        onPress={() => go(Math.min(totalPages - 1, currentPage + 1))}
        style={[styles.pageButton, styles.pageNav, atEnd && styles.pageDisabled]}
      >
        <ChevronRight size={16} color={colors.foreground} />
      </Pressable>
    </View>
  );
}

const useStyles = createStyles(({ colors, radius }) => ({
  root: { gap: 16 },
  addCard: { padding: 12 },
  formGrid: { gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
  alignEnd: { alignItems: 'flex-end' },
  col1: { flex: 1 },
  col2: { flex: 2 },
  col3: { flex: 3 },
  centered: { textAlign: 'center' },
  tallButton: { height: 44 },
  list: { gap: 8 },
  categoryCard: { padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  childCard: { marginLeft: 20 },
  parentName: { flexShrink: 1 },
  categoryMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: alpha(colors.border, 0.5),
  },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconButton: { width: 44, height: 44, borderRadius: radius.lg },
  pagination: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  pageButton: {
    minWidth: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageNav: { paddingHorizontal: 12 },
  pageActive: { borderWidth: 1, borderColor: colors.input, backgroundColor: colors.background },
  pageDisabled: { opacity: 0.5 },
  ellipsis: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
}));
