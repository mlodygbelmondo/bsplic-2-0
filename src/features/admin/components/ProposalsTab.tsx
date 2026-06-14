import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { BetOption, BetProposalSource, Category } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SectionLoader } from '@/components/SectionLoader';
import { toast } from 'sonner';
import { Check, XCircle, Plus, X, Inbox, Loader2 } from 'lucide-react';
import type { EditableBetType } from '../constants';
import ProposalSourceBadges from './ProposalSourceBadges';
import {
  getErrorMessage,
  toInputDateTime,
  getTomorrowAt2359,
  normalizeType,
  normalizeOptions,
  lockEditableOptionsByType,
  toEditableOptions,
} from '../helpers';
import type { EditableBetOption } from '../helpers';
import {
  normalizeAgentMetadata,
  normalizeProposalSource,
  type AgentProposalMetadata,
} from '../proposalSource';

interface ProposalRow {
  id: string;
  user_id: string;
  title: string;
  category_id: string | null;
  ends_at: string | null;
  bet_type: EditableBetType;
  options: BetOption[];
  username: string;
  proposal_source: BetProposalSource;
  agent_metadata: AgentProposalMetadata | null;
  agent_duplicate_key: string | null;
}

interface ProposalEditor {
  id: string;
  title: string;
  categoryId: string;
  betType: EditableBetType;
  options: EditableBetOption[];
  endsAt: string;
  isBsplicboost: boolean;
}

export default function ProposalsTab() {
  const [proposals, setProposals] = useState<ProposalRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorLoading, setEditorLoading] = useState(false);
  const [editing, setEditing] = useState<ProposalEditor | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const fetchProposals = async () => {
    setLoading(true);
    try {
      const [
        { data: proposalRows, error: proposalError },
        { data: categoryRows },
      ] = await Promise.all([
        supabase
          .from('bet_proposals')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),
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
        proposal_source: normalizeProposalSource(proposal.proposal_source),
        agent_metadata: normalizeAgentMetadata(proposal.agent_metadata),
        agent_duplicate_key:
          typeof proposal.agent_duplicate_key === 'string'
            ? proposal.agent_duplicate_key
            : null,
        username: 'Użytkownik',
      }));

      const uniqueUserIds = [...new Set(normalized.map((p) => p.user_id))];
      if (uniqueUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username')
          .in('id', uniqueUserIds);
        const userMap = new Map(
          (profiles || []).map((p) => [p.id, p.username]),
        );
        setProposals(
          normalized.map((p) => ({
            ...p,
            username: userMap.get(p.user_id) || 'Użytkownik',
          })),
        );
      } else {
        setProposals(normalized);
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Nie udało się pobrać propozycji'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProposals();
  }, []);

  const openEditor = (proposal: ProposalRow) => {
    const lockedOptions = lockEditableOptionsByType(
      proposal.bet_type,
      toEditableOptions(proposal.options),
    );
    setEditing({
      id: proposal.id,
      title: proposal.title,
      categoryId: proposal.category_id || '',
      betType: proposal.bet_type,
      options: lockedOptions,
      endsAt: proposal.ends_at
        ? toInputDateTime(proposal.ends_at)
        : toInputDateTime(getTomorrowAt2359()),
      isBsplicboost: false,
    });
    setEditorOpen(true);
  };

  const acceptEdited = async () => {
    if (!editing) return;

    const cleanedOptions = editing.options
      .filter((o) => o.name.trim())
      .map((o) => ({ name: o.name.trim(), oddsRaw: o.odds.trim() }));

    const fixedOptionCounts: Partial<Record<EditableBetType, number>> = {
      single: 1,
      '12': 2,
      '1x2': 3,
    };
    const fixedOptionCount = fixedOptionCounts[editing.betType];
    if (
      fixedOptionCount !== undefined
        ? cleanedOptions.length !== fixedOptionCount
        : cleanedOptions.length < 2
    ) {
      toast.error('Nieprawidłowa liczba opcji');
      return;
    }
    const invalidOddsIndex = cleanedOptions.findIndex((option) => {
      const odds = Number(option.oddsRaw);
      return !option.oddsRaw || !Number.isFinite(odds) || odds <= 0;
    });
    if (invalidOddsIndex !== -1) {
      toast.error(`Podaj poprawny kurs dla opcji ${invalidOddsIndex + 1}`);
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
      const { error } = await supabase.rpc('review_bet_proposal', {
        p_proposal_id: editing.id,
        p_status: 'accepted',
        p_title: editing.title.trim(),
        p_category_id: editing.categoryId || null,
        p_bet_type: editing.betType,
        p_options: cleanedOptions.map((option) => ({
          name: option.name,
          odds: Number(option.oddsRaw),
        })) as Json,
        p_ends_at: endsAtDate.toISOString(),
        p_is_bsplicboost: editing.isBsplicboost,
      });
      if (error) throw error;

      toast.success('Propozycja zaakceptowana');
      setEditorOpen(false);
      setEditing(null);
      fetchProposals();
    } catch (err: unknown) {
      toast.error(
        getErrorMessage(err, 'Nie udało się zaakceptować propozycji'),
      );
    } finally {
      setEditorLoading(false);
    }
  };

  const reject = async (proposalId: string) => {
    setRejectingId(proposalId);
    try {
      const { error } = await supabase.rpc('review_bet_proposal', {
        p_proposal_id: proposalId,
        p_status: 'rejected',
      });
      if (error) throw error;
      toast.info('Propozycja odrzucona');
      fetchProposals();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Nie udało się odrzucić propozycji'));
    } finally {
      setRejectingId(null);
    }
  };

  const hasFixedOptionCount = editing
    ? editing.betType === 'single' ||
      editing.betType === '12' ||
      editing.betType === '1x2'
    : false;

  /* ---------- Loading skeleton ---------- */
  if (loading) {
    return (
      <SectionLoader label="Wczytywanie propozycji..." />
    );
  }

  /* ---------- Main content ---------- */
  return (
    <>
      <div className="space-y-3">
        {proposals.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="rounded-full bg-muted p-5 mb-4">
              <Inbox className="h-8 w-8 text-foreground" aria-hidden="true" />
            </div>
            <h3 className="text-base font-semibold mb-1">Brak propozycji</h3>
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
              Nowe propozycje od użytkowników pojawią się tutaj i będzie można
              je zaakceptować lub odrzucić.
            </p>
          </div>
        )}
        {proposals.map((proposal) => {
          const isRejecting = rejectingId === proposal.id;
          return (
            <div
              key={proposal.id}
              className="bg-card rounded-xl p-3 sm:p-4 card-shadow transition-opacity"
              style={{ opacity: isRejecting ? 0.5 : 1 }}
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-sm sm:text-[15px]">
                    {proposal.title}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Od: {proposal.username} &middot;{' '}
                    {proposal.bet_type.toUpperCase()}
                  </p>
                  <ProposalSourceBadges
                    source={proposal.proposal_source}
                    metadata={proposal.agent_metadata}
                  />
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {proposal.options.map((option, i) => (
                      <span
                        key={`${proposal.id}-${i}`}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-foreground"
                      >
                        {option.name} ({Number(option.odds).toFixed(2)})
                      </span>
                    ))}
                  </div>
                </div>
                <div className="grid w-full grid-cols-2 gap-2 shrink-0 sm:flex sm:w-auto">
                  <Button
                    size="sm"
                    onClick={() => openEditor(proposal)}
                    className="min-h-11 justify-center gradient-primary text-primary-foreground text-sm sm:min-h-0 sm:h-8 sm:text-xs"
                    aria-label={`Akceptuj propozycję: ${proposal.title}`}
                    disabled={isRejecting}
                  >
                    <Check className="h-3 w-3 mr-1" aria-hidden="true" />{' '}
                    Akceptuj
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => reject(proposal.id)}
                    className="min-h-11 justify-center text-sm sm:min-h-0 sm:h-8 sm:text-xs"
                    disabled={isRejecting}
                    aria-label={`Odrzuć propozycję: ${proposal.title}`}
                  >
                    {isRejecting ? (
                      <Loader2
                        className="h-3 w-3 mr-1 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <XCircle
                        className="h-3 w-3 mr-1 text-foreground"
                        aria-hidden="true"
                      />
                    )}
                    Odrzuć
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Proposal editor dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-2xl max-h-[calc(var(--app-viewport-height,100svh)-2rem)] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Dostosuj propozycję</DialogTitle>
            <DialogDescription className="sr-only">
              Edytuj szczegóły propozycji przed jej zaakceptowaniem
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="proposal-edit-title">Tytuł</Label>
                <Input
                  id="proposal-edit-title"
                  aria-label="Tytuł propozycji"
                  value={editing.title}
                  onChange={(e) =>
                    setEditing((p) => (p ? { ...p, title: e.target.value } : p))
                  }
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="proposal-edit-category">Kategoria</Label>
                  <Select
                    value={editing.categoryId}
                    onValueChange={(v) =>
                      setEditing((p) => (p ? { ...p, categoryId: v } : p))
                    }
                  >
                    <SelectTrigger
                      id="proposal-edit-category"
                      aria-label="Kategoria propozycji"
                    >
                      <SelectValue placeholder="Wybierz" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.emoji} {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="proposal-edit-type">Typ</Label>
                  <Select
                    value={editing.betType}
                    onValueChange={(v: EditableBetType) =>
                      setEditing((p) =>
                        p
                          ? {
                              ...p,
                              betType: v,
                              options: lockEditableOptionsByType(v, p.options),
                            }
                          : p,
                      )
                    }
                  >
                    <SelectTrigger
                      id="proposal-edit-type"
                      aria-label="Typ zakładu propozycji"
                    >
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

              <div className="space-y-2">
                <Label htmlFor="proposal-edit-ends">Data zakończenia</Label>
                <Input
                  id="proposal-edit-ends"
                  type="datetime-local"
                  aria-label="Data zakończenia propozycji"
                  value={editing.endsAt}
                  onChange={(e) =>
                    setEditing((p) =>
                      p ? { ...p, endsAt: e.target.value } : p,
                    )
                  }
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border p-4 bg-background hover:bg-muted/50 transition-colors">
                <div className="space-y-0.5">
                  <Label
                    htmlFor="proposal-edit-boost"
                    className="text-sm font-medium cursor-pointer text-primary"
                  >
                    BSPLICBOOST
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Wyróżnij zaakceptowany zakład jako boost
                  </p>
                </div>
                <Switch
                  id="proposal-edit-boost"
                  checked={editing.isBsplicboost}
                  onCheckedChange={(checked) =>
                    setEditing((p) =>
                      p ? { ...p, isBsplicboost: checked } : p,
                    )
                  }
                  aria-label="Włącz BSPLICBOOST dla propozycji"
                />
              </div>

              <div className="space-y-2">
                <Label>Opcje</Label>
                {editing.options.map((option, index) => (
                  <div
                    key={`${editing.id}-${index}`}
                    className="flex gap-2 items-center"
                  >
                    <Input
                      value={option.name}
                      aria-label={`Nazwa opcji ${index + 1}`}
                      onChange={(e) =>
                        setEditing((p) => {
                          if (!p) return p;
                          const o = [...p.options];
                          o[index].name = e.target.value;
                          return { ...p, options: o };
                        })
                      }
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      min="1"
                      value={option.odds}
                      aria-label={`Kurs opcji ${index + 1}`}
                      onChange={(e) =>
                        setEditing((p) => {
                          if (!p) return p;
                          const o = [...p.options];
                          o[index].odds = e.target.value;
                          return { ...p, options: o };
                        })
                      }
                      className="w-20"
                    />
                    {!hasFixedOptionCount && editing.options.length > 2 && (
                      <button
                        type="button"
                        onClick={() =>
                          setEditing((p) =>
                            p
                              ? {
                                  ...p,
                                  options: p.options.filter(
                                    (_, i) => i !== index,
                                  ),
                                }
                              : p,
                          )
                        }
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Usuń opcję ${index + 1}`}
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
                    className="min-h-11 justify-center text-sm sm:min-h-0 sm:h-9"
                    onClick={() =>
                      setEditing((p) =>
                        p
                          ? {
                              ...p,
                              options: [...p.options, { name: '', odds: '2' }],
                            }
                          : p,
                      )
                    }
                  >
                    <Plus
                      className="h-3 w-3 mr-1 text-foreground"
                      aria-hidden="true"
                    />{' '}
                    Dodaj opcję
                  </Button>
                )}
              </div>

              <Button
                onClick={acceptEdited}
                disabled={editorLoading}
                className="min-h-11 w-full justify-center gradient-primary text-primary-foreground font-bold"
                aria-label={
                  editorLoading
                    ? 'Zapisywanie propozycji'
                    : 'Akceptuj propozycję'
                }
              >
                {editorLoading ? (
                  <>
                    <Loader2
                      className="h-4 w-4 mr-2 animate-spin"
                      aria-hidden="true"
                    />
                    Zapisywanie...
                  </>
                ) : (
                  'Akceptuj propozycję'
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
